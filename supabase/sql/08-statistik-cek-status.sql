-- =====================================================================
--  SPMB 2027/2028 - Pondok Pesantren Tahfizhul Qur'an
--  Imam Asy-Syathiby Wahdah Islamiyah Gowa
--
--  Berkas 08: Statistik publik, Cek Status, nama berkas (Fase 3 - Langkah 6)
--  Isi:
--   - perbarui_nama_berkas(): nama berkas di data pendaftar mengikuti nama
--     rapi di Google Drive ("Nama Santri - Jenis Berkas - Nomor urut")
--   - statistik_publik(): angka ringkas untuk bagian Statistik di landing
--     page (tanpa data pribadi; data uji dan pendaftaran batal tidak dihitung)
--   - cek_status(): hasil seleksi tidak terlihat sebelum waktu pengumuman,
--     ditambah jadwal daftar ulang
--
--  Prasyarat: berkas 04 sampai 07 sudah dijalankan.
--  Cara pakai: Supabase > SQL Editor > New query > tempel > Run.
--  Aman bila tidak sengaja dijalankan dua kali.
-- =====================================================================

-- 1. Nama berkas setelah dirapikan Apps Script (hanya berkas milik token itu)
create or replace function public.perbarui_nama_berkas(p_token uuid, p_daftar jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if jsonb_typeof(p_daftar) <> 'array' then return 0; end if;
  update public.berkas_pendaftar b
     set nama = left(x.nama, 150)
    from jsonb_to_recordset(p_daftar) as x(drive_id text, nama text)
   where b.drive_id = x.drive_id and b.token = p_token and coalesce(x.nama, '') <> '';
  get diagnostics n = row_count;
  return n;
end; $$;

-- 2. Statistik publik untuk landing page
create or replace function public.statistik_publik()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g public.gelombang := public.gelombang_aktif();
  hasil jsonb;
begin
  if g.id is null then
    select * into g from public.gelombang where diarsipkan_pada is null and tampil
     order by (coalesce(buka, dibuat_pada) <= now()) desc, coalesce(buka, dibuat_pada) desc limit 1;
  end if;
  with p as (
    select * from public.pendaftar where not uji and status not in ('dibatalkan', 'mengundurkan_diri')
  )
  select jsonb_build_object(
    'diperbarui', now(),
    'total', (select count(*) from p),
    'hari_ini', (select count(*) from p where (dibuat_pada at time zone 'Asia/Makassar')::date = public.hari_ini_wita()),
    'per_jenjang', (select coalesce(jsonb_agg(jsonb_build_object('jenjang', j, 'bagian', b,
                      'jumlah', (select count(*) from p where p.jenjang = j and p.bagian = b)) order by j desc, b), '[]')
                    from (values ('SMP'), ('SMA')) jj(j) cross join (values ('putra'), ('putri')) bb(b)),
    'jumlah_provinsi', (select count(distinct asal_provinsi) from p where asal_provinsi <> ''),
    'jumlah_kabupaten', (select count(distinct asal_kabupaten) from p where asal_kabupaten <> ''),
    'teratas', (select coalesce(jsonb_agg(jsonb_build_object('nama', nama, 'jumlah', n) order by n desc, nama), '[]')
                from (select asal_kabupaten nama, count(*) n from p where asal_kabupaten <> '' group by 1 order by 2 desc, 1 limit 5) x),
    'harian', (select coalesce(jsonb_agg(jsonb_build_object('tanggal', h::date, 'jumlah', coalesce(n, 0)) order by h), '[]')
               from generate_series(public.hari_ini_wita() - 13, public.hari_ini_wita(), interval '1 day') h
               left join (select (dibuat_pada at time zone 'Asia/Makassar')::date t, count(*) n from p group by 1) x on x.t = h::date),
    'gelombang', case when g.id is null then null else jsonb_build_object('nama', g.nama, 'buka', g.buka, 'tutup', g.tutup,
                   'dibuka', g.id = (public.gelombang_aktif()).id,
                   'kuota', (select coalesce(jsonb_agg(jsonb_build_object('jenjang', k.jenjang, 'bagian', k.bagian, 'kuota', k.jumlah,
                              'terisi', public.jumlah_terisi(g.id, k.jenjang, k.bagian)) order by k.jenjang desc, k.bagian), '[]')
                             from public.kuota k where k.gelombang_id = g.id and k.jumlah is not null)) end
  ) into hasil;
  return hasil;
end; $$;

-- 3. Cek Status: hasil seleksi baru terlihat setelah waktu pengumuman
create or replace function public.cek_status(p_no text, p_tanggal_lahir date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k  text := upper(regexp_replace(coalesce(p_no, ''), '\s', '', 'g'));
  pc public.percobaan_cek;
  p  public.pendaftar;
  g  public.gelombang;
  v_status text;
  tertahan boolean := false;
begin
  if k = '' or p_tanggal_lahir is null then
    return jsonb_build_object('ok', false, 'pesan', 'Isi nomor registrasi dan tanggal lahir.');
  end if;
  select * into pc from public.percobaan_cek where kunci = k;
  if pc.kunci_sampai is not null and pc.kunci_sampai > now() then
    return jsonb_build_object('ok', false, 'terkunci', true, 'pesan', 'Terlalu banyak percobaan. Silakan coba lagi setelah pukul '
      || to_char(pc.kunci_sampai at time zone 'Asia/Makassar', 'HH24.MI') || ' WITA.');
  end if;

  select * into p from public.pendaftar where upper(no_registrasi) = k and tanggal_lahir = p_tanggal_lahir;
  if p.id is null then
    insert into public.percobaan_cek (kunci, gagal, terakhir) values (k, 1, now())
    on conflict (kunci) do update set
      gagal = case when public.percobaan_cek.terakhir < now() - interval '15 minutes' then 1 else public.percobaan_cek.gagal + 1 end,
      terakhir = now()
    returning * into pc;
    if pc.gagal >= 5 then
      update public.percobaan_cek set gagal = 0, kunci_sampai = now() + interval '15 minutes' where kunci = k;
      return jsonb_build_object('ok', false, 'terkunci', true, 'pesan', 'Data tidak cocok. Percobaan dikunci 15 menit.');
    end if;
    return jsonb_build_object('ok', false, 'pesan', 'Nomor registrasi atau tanggal lahir tidak cocok. Sisa percobaan: ' || (5 - pc.gagal) || '.');
  end if;
  delete from public.percobaan_cek where kunci = k;

  select * into g from public.gelombang where id = p.gelombang_id;
  v_status := p.status;
  if p.status in ('lulus', 'cadangan', 'tidak_lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai')
     and (g.pengumuman is null or g.pengumuman > now()) and p.status <> 'daftar_ulang_selesai' then
    v_status := 'menunggu_pengumuman'; tertahan := true;
  end if;
  return jsonb_build_object('ok', true,
    'no_registrasi', p.no_registrasi, 'nama_lengkap', p.nama_lengkap, 'jenjang', p.jenjang, 'bagian', p.bagian,
    'asal', p.asal_kabupaten, 'gelombang', g.nama, 'status', v_status, 'hasil_tertahan', tertahan,
    'verif_berkas', p.verif_berkas, 'catatan_berkas', p.catatan_berkas,
    'verif_bayar', p.verif_bayar, 'catatan_bayar', p.catatan_bayar,
    'tes_mulai', g.tes_mulai, 'tes_selesai', g.tes_selesai, 'pengumuman', g.pengumuman,
    'daftar_ulang_mulai', g.daftar_ulang_mulai, 'daftar_ulang_selesai', g.daftar_ulang_selesai,
    'dibuat_pada', p.dibuat_pada, 'uji', p.uji,
    'berkas', coalesce((select jsonb_agg(jsonb_build_object('jenis', b.jenis, 'status', b.status, 'catatan', b.catatan) order by b.id)
                        from public.berkas_pendaftar b where b.pendaftar_id = p.id), '[]'));
end; $$;

-- 4. Bagian Statistik di landing page: tampilkan (sebelumnya disembunyikan sejak Fase 2).
--    Superadmin tetap dapat menyembunyikannya di Konten Situs > Beranda dan Susunan.
update public.pengaturan
   set nilai = jsonb_set(nilai, '{bagian}', (
         select jsonb_agg(case when b ->> 'kunci' = 'statistik' and coalesce(b ->> 'diaktifkan_fase3', '') = ''
                               then b || '{"tampil": true, "diaktifkan_fase3": "1"}' else b end order by i)
         from jsonb_array_elements(nilai -> 'bagian') with ordinality as x(b, i)))
 where kunci = 'beranda' and nilai -> 'bagian' @> '[{"kunci": "statistik"}]';

revoke execute on function public.perbarui_nama_berkas(uuid, jsonb), public.statistik_publik() from public;
grant execute on function public.perbarui_nama_berkas(uuid, jsonb), public.statistik_publik(), public.cek_status(text, date) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Selesai. Bila berhasil, Supabase menampilkan
-- "Success. No rows returned".
-- ---------------------------------------------------------------------
