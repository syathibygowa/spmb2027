-- =====================================================================
--  SPMB 2027/2028 - Pondok Pesantren Tahfizhul Qur'an
--  Imam Asy-Syathiby Wahdah Islamiyah Gowa
--
--  Berkas 07: Menu Pendaftar dan Verifikasi (Fase 3 - Langkah 5)
--  Isi:
--   - Admin dan Superadmin dapat menghapus data dan berkas pendaftar
--   - fungsi hapus_pendaftar(): hapus permanen + daftar berkas Drive
--   - fungsi data_bukti(): data Bukti Pendaftaran PDF untuk panitia
--   - input pendaftar oleh panitia lewat formulir (berkas boleh menyusul,
--     boleh saat formulir ditutup)
--   - nomor WhatsApp Ketua Panitia untuk tombol konfirmasi pendaftar
--
--  Prasyarat: berkas 04, 05, dan 06 sudah dijalankan.
--  Cara pakai: Supabase > SQL Editor > New query > tempel > Run.
--  Aman bila tidak sengaja dijalankan dua kali.
-- =====================================================================

-- 1. Hak hapus untuk Admin
drop policy if exists "pendaftar: hapus" on public.pendaftar;
create policy "pendaftar: hapus" on public.pendaftar for delete to authenticated using (public.is_admin());
drop policy if exists "berkas pendaftar: hapus" on public.berkas_pendaftar;
create policy "berkas pendaftar: hapus" on public.berkas_pendaftar for delete to authenticated using (public.is_admin());

-- 2. Hapus permanen satu pendaftar. Mengembalikan ID berkas Drive agar
--    dashboard membuangnya ke Sampah Drive (dapat dipulihkan 30 hari).
create or replace function public.hapus_pendaftar(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.pendaftar; ids jsonb;
begin
  if not public.is_admin() then raise exception 'Hanya Admin atau Superadmin yang dapat menghapus pendaftar.'; end if;
  select * into p from public.pendaftar where id = p_id;
  if p.id is null then raise exception 'Data pendaftar tidak ditemukan.'; end if;
  select coalesce(jsonb_agg(drive_id), '[]') into ids from public.berkas_pendaftar where pendaftar_id = p_id;
  perform public.catat_log('hapus', 'pendaftar', p_id::text,
    jsonb_build_object('no_registrasi', p.no_registrasi, 'nama', p.nama_lengkap, 'nisn', p.nisn, 'status', p.status, 'uji', p.uji));
  delete from public.pendaftar where id = p_id;
  if not p.uji then
    perform public.kirim_notifikasi_ke_peran(array['superadmin']::public.peran_pengguna[], 'Pendaftar dihapus',
      format('%s (%s) dihapus permanen oleh %s.', p.nama_lengkap, p.no_registrasi,
             coalesce((select nama_lengkap from public.profil_pengguna where id = auth.uid()), 'panitia')),
      'peringatan', '#/log');
  end if;
  return jsonb_build_object('ok', true, 'drive_ids', ids);
end; $$;

-- 3. Data Bukti Pendaftaran untuk panitia (dipakai Apps Script dengan sesi panitia)
create or replace function public.data_bukti(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.pendaftar; g public.gelombang;
begin
  if not public.is_admin() then raise exception 'Akun Anda tidak berhak mencetak bukti pendaftaran.'; end if;
  select * into p from public.pendaftar where id = p_id;
  if p.id is null then return jsonb_build_object('ok', false, 'error', 'Data pendaftar tidak ditemukan.'); end if;
  select * into g from public.gelombang where id = p.gelombang_id;
  return jsonb_build_object('ok', true,
    'pendaftar', jsonb_build_object(
      'no_registrasi', p.no_registrasi, 'nama_lengkap', p.nama_lengkap, 'jenjang', p.jenjang, 'bagian', p.bagian,
      'gelombang', g.nama, 'tempat_lahir', p.tempat_lahir, 'tanggal_lahir', p.tanggal_lahir, 'nisn', p.nisn,
      'asal_sekolah', p.asal_sekolah, 'nama_ayah', p.nama_ayah, 'nama_ibu', p.nama_ibu, 'email', p.email,
      'no_wa', p.no_wa, 'dibuat_pada', p.dibuat_pada, 'uji', p.uji,
      'tes_mulai', g.tes_mulai, 'tes_selesai', g.tes_selesai, 'pengumuman', g.pengumuman),
    'berkas', coalesce((select jsonb_agg(jsonb_build_object('jenis', b.jenis, 'drive_id', b.drive_id, 'nama', b.nama) order by b.id)
                        from public.berkas_pendaftar b where b.pendaftar_id = p.id), '[]'));
end; $$;

-- 4. Nomor WhatsApp Ketua Panitia (tombol "Konfirmasi via WhatsApp" di formulir).
--    Diisi dari profil akun Ketua Panitia bila belum ada; dapat diubah di Pengaturan > Ketua Panitia.
update public.pengaturan k
   set nilai = k.nilai || jsonb_build_object('no_wa', u.no_wa)
  from public.profil_pengguna u
 where k.kunci = 'ketua_panitia' and u.id::text = k.nilai ->> 'pengguna_id'
   and coalesce(k.nilai ->> 'no_wa', '') = '' and coalesce(u.no_wa, '') <> '';

-- 5. Fungsi pendaftaran: mode input oleh panitia
create or replace function public.kirim_pendaftaran(p_data jsonb, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d        jsonb := coalesce(p_data, '{}');
  cfg      jsonb := coalesce((select nilai from public.pengaturan where kunci = 'spmb'), '{}');
  g        public.gelombang := public.gelombang_aktif();
  s        public.sesi_unggah;
  v_uji    boolean := false;
  v_jenjang text := d ->> 'jenjang';
  v_bagian text := d ->> 'bagian';
  v_nama   text := regexp_replace(trim(coalesce(d ->> 'nama_lengkap', '')), '\s+', ' ', 'g');
  v_nisn   text := regexp_replace(coalesce(d ->> 'nisn', ''), '[^0-9]', '', 'g');
  v_nik    text := regexp_replace(coalesce(d ->> 'nik', ''), '[^0-9]', '', 'g');
  v_email  text := lower(trim(coalesce(d ->> 'email', '')));
  v_wa     text := public.normal_wa(d ->> 'no_wa');
  darurat  text := nullif(public.normal_wa(d ->> 'darurat_no'), '');
  tgl      date;
  usia     numeric;
  acuan    date := coalesce((cfg #>> '{usia,acuan}')::date, date '2027-07-01');
  umin     int  := coalesce((cfg #>> array['usia', v_jenjang, 'min'])::int, case v_jenjang when 'SMP' then 11 else 14 end);
  umaks    int  := coalesce((cfg #>> array['usia', v_jenjang, 'maks'])::int, case v_jenjang when 'SMP' then 15 else 18 end);
  kuo      integer;
  terisi   integer;
  wajib    text;
  pilih    text[];
  no_baru  text;
  id_baru  uuid;
  pola_nama constant text := '^[[:alpha:] .,''`’-]{3,100}$';
  v_surah  int;
  v_juz    numeric;
  v_sumber text[];
  v_rekom  text := regexp_replace(trim(coalesce(d ->> 'perekomendasi', '')), '\s+', ' ', 'g');
  v_peran  text := left(regexp_replace(trim(coalesce(d ->> 'perekomendasi_peran', '')), '\s+', ' ', 'g'), 80);
  v_prest  int := 0;
  v_mondok boolean := coalesce((d ->> 'pernah_mondok')::boolean, false);
  syarat   text[] := '{}';
  v_manual boolean := coalesce((d ->> 'manual')::boolean, false) and public.is_admin();   -- diinput panitia
begin
  -- 1. Token dan gelombang
  select * into s from public.sesi_unggah where token = p_token for update;
  if s.token is null then perform public.galat_formulir(null, 'Sesi formulir tidak dikenal. Muat ulang halaman lalu kirim kembali.'); end if;
  if s.pendaftar_id is not null then
    -- pengiriman ganda (misalnya tombol ditekan dua kali): kembalikan hasil sebelumnya
    return (select jsonb_build_object('ok', true, 'ulang', true, 'id', id, 'no_registrasi', no_registrasi,
              'nama_lengkap', nama_lengkap, 'dibuat_pada', dibuat_pada, 'uji', uji)
            from public.pendaftar where id = s.pendaftar_id);
  end if;

  if v_manual then
    -- Admin menginput langsung (misalnya pendaftaran di kantor): boleh saat formulir ditutup
    v_uji := coalesce((d ->> 'uji')::boolean, false);
    if g.id is null then
      select * into g from public.gelombang where diarsipkan_pada is null
       order by (coalesce(buka, dibuat_pada) <= now()) desc, coalesce(buka, dibuat_pada) desc limit 1;
      if g.id is null then perform public.galat_formulir(null, 'Belum ada gelombang. Buat gelombang dulu di dashboard.'); end if;
    end if;
  elsif g.id is null then
    if public.is_panitia() then
      v_uji := true;   -- panitia menguji formulir saat pendaftaran belum dibuka
      select * into g from public.gelombang where diarsipkan_pada is null order by coalesce(buka, dibuat_pada) desc limit 1;
      if g.id is null then perform public.galat_formulir(null, 'Belum ada gelombang. Buat gelombang dulu di dashboard.'); end if;
    else
      perform public.galat_formulir(null, 'Pendaftaran sedang tidak dibuka. Silakan periksa jadwal gelombang.');
    end if;
  elsif public.is_panitia() and coalesce((d ->> 'uji')::boolean, false) then
    v_uji := true;
  end if;

  if not v_manual and (select count(*) from public.pendaftar where dibuat_pada > now() - interval '1 minute') >= 30 then
    perform public.galat_formulir(null, 'Server sedang sibuk. Silakan kirim ulang satu menit lagi.');
  end if;

  -- 2. Pilihan
  if v_jenjang is null or v_jenjang not in ('SMP', 'SMA') then perform public.galat_formulir('jenjang', 'Pilih jenjang SMP atau SMA.'); end if;
  if v_bagian is null or v_bagian not in ('putra', 'putri') then perform public.galat_formulir('bagian', 'Pilih putra atau putri.'); end if;

  -- 3. Data santri
  if v_nama !~ pola_nama then perform public.galat_formulir('nama_lengkap', 'Nama lengkap 3-100 huruf; hanya huruf, spasi, titik, koma, petik, dan strip.'); end if;
  if v_nisn !~ '^[0-9]{10}$' then perform public.galat_formulir('nisn', 'NISN harus tepat 10 digit angka.'); end if;
  if v_nik !~ '^[0-9]{16}$' then perform public.galat_formulir('nik', 'NIK harus tepat 16 digit angka.'); end if;
  if not public.kode_provinsi_sah(v_nik) then perform public.galat_formulir('nik', 'Dua digit awal NIK bukan kode provinsi yang sah.'); end if;
  if exists (select 1 from public.pendaftar p where p.nisn = v_nisn and p.uji = v_uji and p.status <> 'dibatalkan') then
    perform public.galat_formulir('nisn', 'NISN ini sudah terdaftar. Satu NISN hanya dapat didaftarkan sekali. Bila keliru, hubungi panitia untuk mereset data pendaftaran sebelumnya.');
  end if;
  if exists (select 1 from public.pendaftar p where p.nik = v_nik and p.uji = v_uji and p.status <> 'dibatalkan') then
    perform public.galat_formulir('nik', 'NIK ini sudah terdaftar. Satu NIK hanya dapat didaftarkan sekali. Bila keliru, hubungi panitia untuk mereset data pendaftaran sebelumnya.');
  end if;
  if coalesce(trim(d ->> 'tempat_lahir'), '') = '' then perform public.galat_formulir('tempat_lahir', 'Tempat lahir wajib diisi.'); end if;
  begin
    tgl := (d ->> 'tanggal_lahir')::date;
  exception when others then
    tgl := null;
  end;
  if tgl is null then perform public.galat_formulir('tanggal_lahir', 'Tanggal lahir tidak valid.'); end if;
  usia := extract(year from age(acuan, tgl)) + extract(month from age(acuan, tgl)) / 12.0;
  if usia < umin - 1 or usia >= umaks + 2 then
    perform public.galat_formulir('tanggal_lahir',
      format('Usia calon santri %s per %s di luar batas jenjang %s (%s-%s tahun).', floor(usia), to_char(acuan, 'DD/MM/YYYY'), v_jenjang, umin, umaks));
  end if;
  if coalesce(trim(d ->> 'asal_provinsi'), '') = '' or coalesce(trim(d ->> 'asal_kabupaten'), '') = '' then
    perform public.galat_formulir('asal_kabupaten', 'Asal daerah (provinsi dan kabupaten/kota) wajib dipilih.');
  end if;
  if coalesce(trim(d ->> 'desa'), '') = '' or coalesce(trim(d ->> 'kecamatan'), '') = '' or coalesce(trim(d ->> 'kabupaten'), '') = '' then
    perform public.galat_formulir('desa', 'Alamat domisili sampai desa/kelurahan wajib dipilih.');
  end if;
  if coalesce(d ->> 'rt', '') !~ '^[0-9]{1,3}$' then perform public.galat_formulir('rt', 'RT berisi 1-3 digit angka.'); end if;
  if coalesce(d ->> 'rw', '') !~ '^[0-9]{1,3}$' then perform public.galat_formulir('rw', 'RW berisi 1-3 digit angka.'); end if;
  if coalesce(d ->> 'kode_pos', '') !~ '^[0-9]{5}$' then perform public.galat_formulir('kode_pos', 'Kode pos harus tepat 5 digit.'); end if;
  if coalesce(d ->> 'npsn_sekolah', '') !~ '^([0-9]{8})?$' then perform public.galat_formulir('npsn_sekolah', 'NPSN sekolah asal harus tepat 8 digit (boleh dikosongkan).'); end if;
  if coalesce(trim(d ->> 'asal_sekolah'), '') = '' then perform public.galat_formulir('asal_sekolah', 'Asal sekolah wajib diisi.'); end if;

  -- 4. Orang tua dan kontak
  if coalesce(d ->> 'nama_ayah', '') !~ pola_nama then perform public.galat_formulir('nama_ayah', 'Nama ayah 3-100 huruf.'); end if;
  if coalesce(d ->> 'nama_ibu', '') !~ pola_nama then perform public.galat_formulir('nama_ibu', 'Nama ibu 3-100 huruf.'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then perform public.galat_formulir('email', 'Alamat email tidak valid.'); end if;
  if v_wa !~ '^628[0-9]{7,11}$' then perform public.galat_formulir('no_wa', 'Nomor WhatsApp diawali 08 atau +62, 10-13 digit.'); end if;
  if regexp_replace(trim(coalesce(d ->> 'darurat_nama', '')), '\s+', ' ', 'g') !~ pola_nama then
    perform public.galat_formulir('darurat_nama', 'Nama orang terkait (kontak darurat) wajib diisi dengan huruf, tanpa angka.');
  end if;
  if coalesce(trim(d ->> 'darurat_hubungan'), '') = '' then perform public.galat_formulir('darurat_hubungan', 'Pilih hubungan orang terkait dengan calon santri.'); end if;
  if darurat is null or darurat !~ '^628[0-9]{7,11}$' then perform public.galat_formulir('darurat_no', 'Nomor kontak darurat diawali 08 atau +62, 10-13 digit.'); end if;

  -- 4b. Pertanyaan
  if v_mondok then
    if length(trim(coalesce(d ->> 'pondok_sebelumnya', ''))) < 3 then perform public.galat_formulir('pondok_sebelumnya', 'Tulis nama pondok sebelumnya.'); end if;
    if coalesce(trim(d ->> 'lama_mondok'), '') !~ '^([0-9]{1,2} tahun)?( ?[0-9]{1,2} bulan)?$' or trim(coalesce(d ->> 'lama_mondok', '')) = '' then
      perform public.galat_formulir('lama_mondok', 'Isi lama mondok, misalnya 1,5 (menjadi 1 tahun 6 bulan).');
    end if;
  end if;
  begin
    v_juz := coalesce(nullif(d ->> 'hafalan_juz', '')::numeric, 0);
    v_surah := coalesce(nullif(d ->> 'hafalan_surah', '')::int, 0);
  exception when others then
    perform public.galat_formulir('hafalan_juz', 'Jumlah hafalan harus berupa angka.');
  end;
  if v_juz not between 0 and 30 or v_juz * 2 <> floor(v_juz * 2) then perform public.galat_formulir('hafalan_juz', 'Jumlah hafalan 1-30 juz (boleh setengah, misalnya 2,5).'); end if;
  if v_surah not between 0 and 114 then perform public.galat_formulir('hafalan_surah', 'Jumlah surah yang dihafal 1-114.'); end if;
  if v_juz >= 1 then v_surah := 0; end if;   -- hafalan juz sudah mencakup surah pendek

  if jsonb_typeof(d -> 'sumber_info') = 'array' then
    select array_agg(distinct left(trim(x), 60)) into v_sumber from jsonb_array_elements_text(d -> 'sumber_info') x where trim(x) <> '';
  elsif coalesce(trim(d ->> 'sumber_info'), '') <> '' then
    v_sumber := array[left(trim(d ->> 'sumber_info'), 60)];
  end if;
  if coalesce(cardinality(v_sumber), 0) = 0 then perform public.galat_formulir('sumber_info', 'Pilih minimal satu sumber informasi SPMB.'); end if;
  if cardinality(v_sumber) > 12 then perform public.galat_formulir('sumber_info', 'Sumber informasi terlalu banyak.'); end if;

  if v_rekom <> '' then
    if v_rekom !~ pola_nama then perform public.galat_formulir('perekomendasi', 'Nama pemberi rekomendasi 3-100 huruf, tanpa angka.'); end if;
    if length(v_peran) < 3 then perform public.galat_formulir('perekomendasi_peran', 'Isi jabatan/kedudukan pemberi rekomendasi.'); end if;
    syarat := array_append(syarat, 'rekomendasi');
  end if;

  if jsonb_typeof(coalesce(d -> 'prestasi', '[]')) <> 'array' or jsonb_array_length(coalesce(d -> 'prestasi', '[]')) > 10 then
    perform public.galat_formulir('prestasi', 'Prestasi paling banyak 10 baris.');
  end if;
  select count(*) into v_prest from jsonb_array_elements(coalesce(d -> 'prestasi', '[]')) x where trim(coalesce(x ->> 'nama', '')) <> '';
  if v_prest > 0 then syarat := array_append(syarat, 'sertifikat'); end if;
  if not coalesce((d ->> 'setuju')::boolean, false) then perform public.galat_formulir('setuju', 'Centang pernyataan persetujuan sebelum mengirim.'); end if;

  -- 5. Berkas: hanya berkas milik token ini yang dipilih formulir
  select array_agg(x) into pilih from jsonb_array_elements_text(coalesce(d -> 'berkas', '[]')) x;
  for wajib in
    select b ->> 'kunci' from jsonb_array_elements(coalesce(cfg -> 'berkas', '[]')) b
     where not (v_manual and not v_uji)   -- input panitia: berkas boleh dilengkapi kemudian di dashboard
       and (coalesce((b ->> 'wajib')::boolean, false) or (b ->> 'kunci') = any (syarat))
  loop
    if not exists (select 1 from public.berkas_pendaftar bp
                   where bp.token = p_token and bp.pendaftar_id is null and bp.jenis = wajib and bp.drive_id = any (coalesce(pilih, '{}'))) then
      perform public.galat_formulir('berkas_' || wajib, case wajib when 'rekomendasi' then 'Surat rekomendasi wajib diunggah karena Anda mengisi pemberi rekomendasi: '
                                                                when 'sertifikat' then 'Bukti prestasi wajib diunggah karena Anda mengisi prestasi: ' else 'Berkas wajib belum diunggah: ' end ||
        coalesce((select b ->> 'label' from jsonb_array_elements(cfg -> 'berkas') b where b ->> 'kunci' = wajib), wajib) || '.');
    end if;
  end loop;

  -- 6. Kuota (dikunci agar dua pendaftar bersamaan tidak melewati kuota)
  perform pg_advisory_xact_lock(hashtext('kuota-' || g.id || v_jenjang || v_bagian));
  select jumlah into kuo from public.kuota where gelombang_id = g.id and kuota.jenjang = v_jenjang and kuota.bagian = v_bagian;
  terisi := public.jumlah_terisi(g.id, v_jenjang, v_bagian);
  if not v_uji and kuo is not null and terisi >= kuo then
    perform public.galat_formulir('jenjang', format('Kuota %s %s %s sudah penuh.', v_jenjang, v_bagian, g.nama));
  end if;

  -- 7. Simpan
  no_baru := public.buat_no_registrasi(v_jenjang, v_bagian, v_uji);
  insert into public.pendaftar (
    no_registrasi, gelombang_id, jenjang, bagian, nama_lengkap, nisn, nik, tempat_lahir, tanggal_lahir,
    asal_provinsi, asal_kabupaten, alamat_jalan, rt, rw, dusun, desa, kecamatan, kabupaten, provinsi, kode_wilayah,
    kode_pos, asal_sekolah, npsn_sekolah, nama_ayah, pekerjaan_ayah, nama_ibu, pekerjaan_ibu, email, no_wa,
    darurat_nama, darurat_hubungan, darurat_no, pernah_mondok, pondok_sebelumnya, lama_mondok, hafalan_juz,
    sumber_info, sumber_info_daftar, perekomendasi, perekomendasi_peran, hafalan_surah, prestasi, peringatan, uji, didaftarkan_oleh)
  values (
    no_baru, g.id, v_jenjang, v_bagian, v_nama, v_nisn, v_nik, trim(d ->> 'tempat_lahir'), tgl,
    trim(d ->> 'asal_provinsi'), trim(d ->> 'asal_kabupaten'), left(trim(coalesce(d ->> 'alamat_jalan', '')), 200),
    lpad(d ->> 'rt', 3, '0'), lpad(d ->> 'rw', 3, '0'), left(trim(coalesce(d ->> 'dusun', '')), 100),
    trim(d ->> 'desa'), trim(d ->> 'kecamatan'), trim(d ->> 'kabupaten'), trim(coalesce(d ->> 'provinsi', '')),
    coalesce(d ->> 'kode_wilayah', ''), d ->> 'kode_pos', left(trim(d ->> 'asal_sekolah'), 150),
    nullif(d ->> 'npsn_sekolah', ''), trim(d ->> 'nama_ayah'), left(trim(coalesce(d ->> 'pekerjaan_ayah', '')), 60),
    trim(d ->> 'nama_ibu'), left(trim(coalesce(d ->> 'pekerjaan_ibu', '')), 60), v_email, v_wa,
    left(regexp_replace(trim(coalesce(d ->> 'darurat_nama', '')), '\s+', ' ', 'g'), 100), left(trim(coalesce(d ->> 'darurat_hubungan', '')), 40), darurat,
    v_mondok, case when v_mondok then left(trim(coalesce(d ->> 'pondok_sebelumnya', '')), 150) else '' end,
    case when v_mondok then left(trim(coalesce(d ->> 'lama_mondok', '')), 40) else '' end, v_juz,
    left(array_to_string(v_sumber, '; '), 400), v_sumber, v_rekom, case when v_rekom <> '' then v_peran else '' end, v_surah,
    (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(coalesce(d -> 'prestasi', '[]')) x where trim(coalesce(x ->> 'nama', '')) <> ''),
    case when jsonb_typeof(d -> 'peringatan') = 'array' then d -> 'peringatan' else '[]' end,
    v_uji, auth.uid())
  returning id into id_baru;

  update public.berkas_pendaftar set pendaftar_id = id_baru
   where token = p_token and pendaftar_id is null and drive_id = any (coalesce(pilih, '{}'));
  update public.sesi_unggah set pendaftar_id = id_baru where token = p_token;

  perform public.catat_log('daftar', 'pendaftar', id_baru::text,
    jsonb_build_object('no_registrasi', no_baru, 'nama', v_nama, 'jenjang', v_jenjang, 'bagian', v_bagian, 'gelombang', g.nama, 'uji', v_uji));

  -- 8. Notifikasi panitia
  perform public.kirim_notifikasi_ke_peran(array['superadmin', 'admin']::public.peran_pengguna[],
    case when v_uji then 'Pendaftar uji coba' else 'Pendaftar baru' end,
    format('%s (%s, %s %s) mendaftar dengan nomor %s.', v_nama, g.nama, v_jenjang, initcap(v_bagian), no_baru),
    case when v_uji then 'info' else 'sukses' end, '#/pendaftar/' || id_baru);

  if not v_uji and kuo is not null and kuo > 0
     and terisi + 1 >= ceil(kuo * 0.9) and terisi < ceil(kuo * 0.9) then
    perform public.kirim_notifikasi_ke_peran(array['superadmin', 'admin']::public.peran_pengguna[],
      'Kuota hampir penuh', format('Kuota %s %s %s terisi %s dari %s.', v_jenjang, v_bagian, g.nama, terisi + 1, kuo),
      'peringatan', '#/pendaftar');
  end if;

  return jsonb_build_object('ok', true, 'id', id_baru, 'no_registrasi', no_baru, 'nama_lengkap', v_nama,
                            'gelombang', g.nama, 'dibuat_pada', now(), 'uji', v_uji);
end; $$;

revoke execute on function public.hapus_pendaftar(uuid), public.data_bukti(uuid) from public, anon;
grant execute on function public.hapus_pendaftar(uuid), public.data_bukti(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Selesai. Bila berhasil, Supabase menampilkan
-- "Success. No rows returned".
-- ---------------------------------------------------------------------
