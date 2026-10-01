-- =====================================================================
-- SPMB · SQL 15 · PERSIAPAN PELUNCURAN DAN PEMAKAIAN JANGKA PANJANG
-- Jalankan sesudah 14-keringanan-keuangan.sql. Aman dijalankan dua kali.
--
-- A. Tahun ajaran: setiap gelombang dan pendaftar mencatat tahun
--    ajarannya; NISN/NIK unik per tahun ajaran; nomor registrasi, SKL,
--    dan kuitansi mulai dari 001 lagi pada tahun berikutnya; statistik
--    dan keuangan otomatis memakai tahun ajaran aktif
-- B. Mulai tahun ajaran baru (Superadmin): arsip gelombang lama,
--    salin susunan gelombang/kuota/biaya ke tahun berikutnya
-- C. Keuangan oleh Admin: rincian biaya, rekening, format kuitansi,
--    dan keringanan dapat diatur Admin (panitia)
-- D. Data uji lengkap: 10 calon santri dan 2 penguji melewati seluruh
--    alur (verifikasi, tes, nilai, keputusan, pengumuman, daftar ulang,
--    pembayaran) di "Gelombang Uji Coba" yang tidak tampil di situs
-- E. Hapus data uji versi 2: menghapus seluruh jejak uji coba
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. ALAT BANTU: menambal fungsi yang sudah terpasang tanpa menyalin
--    ulang seluruh isinya. Bila teks yang dicari tidak ada (dan belum
--    pernah ditambal), proses dihentikan agar tidak ada yang terlewat.
-- ---------------------------------------------------------------------
create or replace function public._tambal(p_fn regprocedure, p_cari text, p_ganti text)
returns void language plpgsql as $$
declare def text := pg_get_functiondef(p_fn);
begin
  if position(p_ganti in def) > 0 then return; end if;          -- sudah ditambal
  if position(p_cari in def) = 0 then
    raise exception 'SQL 15 tidak menemukan bagian yang perlu disesuaikan pada fungsi %. Pastikan SQL 01-14 sudah dijalankan berurutan.', p_fn;
  end if;
  execute replace(def, p_cari, p_ganti);
end; $$;
revoke all on function public._tambal(regprocedure, text, text) from public, anon, authenticated;


-- =====================================================================
-- A. TAHUN AJARAN
-- =====================================================================
create or replace function public.ta_aktif()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim((select nilai ->> 'tahun_ajaran' from public.pengaturan where kunci = 'identitas')), ''),
                  extract(year from now())::int || '/' || (extract(year from now())::int + 1))
$$;
create or replace function public.tahun_awal_ta(p_ta text default null)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(substring(coalesce(p_ta, public.ta_aktif()) from '([0-9]{4})')::int, extract(year from now())::int)
$$;
grant execute on function public.ta_aktif(), public.tahun_awal_ta(text) to anon, authenticated;

alter table public.gelombang add column if not exists tahun_ajaran text;
alter table public.gelombang add column if not exists uji boolean not null default false;
update public.gelombang set tahun_ajaran = public.ta_aktif() where tahun_ajaran is null;
alter table public.gelombang alter column tahun_ajaran set default public.ta_aktif();
alter table public.gelombang alter column tahun_ajaran set not null;
comment on column public.gelombang.tahun_ajaran is 'Tahun ajaran gelombang, misalnya 2027/2028';
comment on column public.gelombang.uji is 'Gelombang khusus data uji coba (tidak tampil di situs, terhapus bersama data uji)';

alter table public.pendaftar add column if not exists tahun_ajaran text;
update public.pendaftar p set tahun_ajaran = coalesce(g.tahun_ajaran, public.ta_aktif())
  from public.gelombang g where g.id = p.gelombang_id and p.tahun_ajaran is null;
update public.pendaftar set tahun_ajaran = public.ta_aktif() where tahun_ajaran is null;
alter table public.pendaftar alter column tahun_ajaran set not null;
create index if not exists pendaftar_ta_idx on public.pendaftar (tahun_ajaran, uji);

-- Tahun ajaran pendaftar mengikuti gelombangnya
create or replace function public.isi_ta_pendaftar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.gelombang_id is distinct from old.gelombang_id then
    new.tahun_ajaran := coalesce((select tahun_ajaran from public.gelombang where id = new.gelombang_id), new.tahun_ajaran, public.ta_aktif());
  end if;
  return new;
end; $$;
drop trigger if exists isi_ta_pendaftar on public.pendaftar;
create trigger isi_ta_pendaftar before insert or update of gelombang_id on public.pendaftar
  for each row execute function public.isi_ta_pendaftar();

-- NISN dan NIK unik per tahun ajaran (santri yang belum diterima boleh mendaftar lagi tahun berikutnya)
drop index if exists public.pendaftar_nisn_unik;
drop index if exists public.pendaftar_nik_unik;
create unique index if not exists pendaftar_nisn_ta_unik on public.pendaftar (nisn, uji, tahun_ajaran) where status <> 'dibatalkan';
do $$ begin
  create unique index if not exists pendaftar_nik_ta_unik on public.pendaftar (nik, uji, tahun_ajaran) where status <> 'dibatalkan';
exception when unique_violation then
  raise notice 'Ada NIK ganda dalam satu tahun ajaran; indeks NIK dilewati (pemeriksaan tetap berjalan di formulir).';
end $$;

-- Penghitung nomor registrasi per tahun: kunci lama "SMP-P" menjadi "SMP-P-2027"
update public.penghitung_nomor set kunci = kunci || '-' || public.tahun_awal_ta()
 where kunci ~ '^(uji-)?(SMP|SMA)-[PI]$'
   and not exists (select 1 from public.penghitung_nomor x where x.kunci = penghitung_nomor.kunci || '-' || public.tahun_awal_ta());
select public._tambal('public.buat_no_registrasi(text, text, boolean)',
  $x$v_kunci text := (case when p_uji then 'uji-' else '' end) || p_jenjang || '-' || jk;$x$,
  $x$v_kunci text := (case when p_uji then 'uji-' else '' end) || p_jenjang || '-' || jk || '-' || tahun;$x$);

-- Formulir: gelombang uji tidak pernah dipakai pendaftar sungguhan; NISN/NIK diperiksa dalam tahun ajaran yang sama
select public._tambal('public.gelombang_aktif()', 'where formulir_dibuka and diarsipkan_pada is null', 'where formulir_dibuka and diarsipkan_pada is null and not uji');
select public._tambal('public.kirim_pendaftaran(jsonb, uuid)', 'from public.gelombang where diarsipkan_pada is null', 'from public.gelombang where diarsipkan_pada is null and not uji');
select public._tambal('public.kirim_pendaftaran(jsonb, uuid)',
  $x$p.nisn = v_nisn and p.uji = v_uji and p.status <> 'dibatalkan'$x$,
  $x$p.nisn = v_nisn and p.uji = v_uji and p.status <> 'dibatalkan' and p.tahun_ajaran = coalesce(g.tahun_ajaran, public.ta_aktif())$x$);
select public._tambal('public.kirim_pendaftaran(jsonb, uuid)',
  $x$p.nik = v_nik and p.uji = v_uji and p.status <> 'dibatalkan'$x$,
  $x$p.nik = v_nik and p.uji = v_uji and p.status <> 'dibatalkan' and p.tahun_ajaran = coalesce(g.tahun_ajaran, public.ta_aktif())$x$);
select public._tambal('public.kirim_pendaftaran(jsonb, uuid)', $x$date '2027-07-01'$x$, $x$make_date(public.tahun_awal_ta(), 7, 1)$x$);
select public._tambal('public.cek_terdaftar(text, text, boolean)',
  $x$where nisn = v_nisn and uji = v_uji and status <> 'dibatalkan'$x$,
  $x$where nisn = v_nisn and uji = v_uji and status <> 'dibatalkan' and tahun_ajaran = public.ta_aktif()$x$);
select public._tambal('public.cek_terdaftar(text, text, boolean)',
  $x$where nik = v_nik and uji = v_uji and status <> 'dibatalkan'$x$,
  $x$where nik = v_nik and uji = v_uji and status <> 'dibatalkan' and tahun_ajaran = public.ta_aktif()$x$);
select public._tambal('public.isi_data_uji(integer)', 'from public.gelombang where diarsipkan_pada is null', 'from public.gelombang where diarsipkan_pada is null and not uji');
select public._tambal('public.isi_data_uji(integer)', $x$date '2027-07-01'$x$, $x$make_date(public.tahun_awal_ta(), 7, 1)$x$);

-- Statistik dan keuangan tanpa pilihan gelombang = tahun ajaran aktif
select public._tambal('public.statistik_dashboard(bigint, boolean)',
  $x$where uji = p_uji and status <> 'dibatalkan' and (p_gelombang is null or gelombang_id = p_gelombang)$x$,
  $x$where uji = p_uji and status <> 'dibatalkan' and (p_gelombang is not null or tahun_ajaran = public.ta_aktif()) and (p_gelombang is null or gelombang_id = p_gelombang)$x$);
select public._tambal('public.statistik_dashboard(bigint, boolean)',
  'where g.diarsipkan_pada is null and (p_gelombang is null or g.id = p_gelombang)',
  'where g.diarsipkan_pada is null and g.uji = p_uji and (p_gelombang is null or g.id = p_gelombang)');
select public._tambal('public.statistik_publik()',
  $x$where not uji and status not in ('dibatalkan', 'mengundurkan_diri')$x$,
  $x$where not uji and status not in ('dibatalkan', 'mengundurkan_diri') and tahun_ajaran = public.ta_aktif()$x$);
select public._tambal('public.keuangan_santri(bigint, boolean)',
  'where x.uji = p_uji and (p_gelombang is null or x.gelombang_id = p_gelombang)',
  'where x.uji = p_uji and (p_gelombang is null or x.gelombang_id = p_gelombang) and (p_gelombang is not null or x.tahun_ajaran = public.ta_aktif())');
select public._tambal('public.keuangan_ringkas(bigint, boolean)',
  'y.uji = p_uji and (p_gelombang is null or y.gelombang_id = p_gelombang)',
  'y.uji = p_uji and (p_gelombang is null or y.gelombang_id = p_gelombang) and (p_gelombang is not null or y.tahun_ajaran = public.ta_aktif())');

-- Nomor SKL dimulai dari 001 setiap tahun ajaran
select public._tambal('public.beri_nomor_skl(bigint)',
  'where nomor_skl is not null and uji = r.uji',
  'where nomor_skl is not null and uji = r.uji and tahun_ajaran is not distinct from (select x.tahun_ajaran from public.pendaftar x where x.id = r.id)');
-- Nomor kuitansi dimulai dari 001 setiap tahun (bila format memuat {tahun})
select public._tambal('public.du_verifikasi(uuid, text, text, bigint, date, text)',
  'where x.nomor_kuitansi is not null and y.uji = p.uji',
  $x$where x.nomor_kuitansi is not null and y.uji = p.uji and (position('{tahun}' in fmt) = 0 or extract(year from coalesce(x.diterima_tanggal, x.diverifikasi_pada::date)) = extract(year from tgl))$x$);
select public._tambal('public.catat_pembayaran(uuid, text, text, bigint, date, text, bigint, text, text)',
  $x$where x.sumber = 'manual' and y.uji = p.uji$x$,
  $x$where x.sumber = 'manual' and y.uji = p.uji and (position('{tahun}' in fmt) = 0 or extract(year from x.tanggal) = extract(year from tgl))$x$);


-- =====================================================================
-- B. MULAI TAHUN AJARAN BARU (Superadmin)
-- =====================================================================
create or replace function public.ringkasan_tahun_ajaran()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Hanya Admin atau Superadmin.'; end if;
  return jsonb_build_object('aktif', public.ta_aktif(),
    'daftar', coalesce((select jsonb_agg(jsonb_build_object('tahun_ajaran', ta, 'pendaftar', n, 'santri_baru', s,
                 'gelombang', (select count(*) from public.gelombang g where g.tahun_ajaran = x.ta and not g.uji)) order by ta desc)
               from (select tahun_ajaran ta, count(*) n, count(*) filter (where status = 'daftar_ulang_selesai') s
                     from public.pendaftar where not uji group by 1
                     union select g.tahun_ajaran, 0, 0 from public.gelombang g where not g.uji
                       and not exists (select 1 from public.pendaftar p where p.tahun_ajaran = g.tahun_ajaran and not p.uji)) x), '[]'));
end; $$;

create or replace function public.mulai_tahun_ajaran(p_ta text, p_salin boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lama text := public.ta_aktif();
  baru text := trim(coalesce(p_ta, ''));
  sel int;
  g record;
  gid bigint;
  n_arsip int := 0; n_salin int := 0; n_biaya int := 0;
  geser interval;
begin
  if not public.is_superadmin() then raise exception 'Hanya Superadmin yang dapat memulai tahun ajaran baru.'; end if;
  if baru !~ '^[0-9]{4}/[0-9]{4}$' or substring(baru from 6 for 4)::int <> substring(baru from 1 for 4)::int + 1 then
    raise exception 'Tulis tahun ajaran dengan format 2028/2029.';
  end if;
  if baru = lama then raise exception 'Tahun ajaran % sudah aktif.', baru; end if;
  sel := public.tahun_awal_ta(baru) - public.tahun_awal_ta(lama);
  if sel <= 0 then raise exception 'Tahun ajaran baru harus setelah %.', lama; end if;
  geser := make_interval(years => sel);

  for g in select * from public.gelombang where tahun_ajaran = lama and not uji order by urutan, id loop
    if p_salin then
      insert into public.gelombang (nama, buka, tutup, tes_mulai, tes_selesai, pengumuman, daftar_ulang_mulai, daftar_ulang_selesai,
                                    kegiatan, keterangan, formulir_dibuka, urutan, tampil, tahun_ajaran)
      values (g.nama, g.buka + geser, g.tutup + geser, g.tes_mulai + geser, g.tes_selesai + geser, g.pengumuman + geser,
              g.daftar_ulang_mulai + geser, g.daftar_ulang_selesai + geser,
              coalesce((select jsonb_agg(k || jsonb_build_object(
                  'mulai', case when k ->> 'mulai' ~ '^\d{4}-\d{2}-\d{2}' then (left(k ->> 'mulai', 10)::date + geser)::date::text else k ->> 'mulai' end,
                  'selesai', case when k ->> 'selesai' ~ '^\d{4}-\d{2}-\d{2}' then (left(k ->> 'selesai', 10)::date + geser)::date::text else k ->> 'selesai' end))
                from jsonb_array_elements(g.kegiatan) k), '[]'),
              g.keterangan, false, g.urutan, g.tampil, baru)
      returning id into gid;
      insert into public.kuota (gelombang_id, jenjang, bagian, jumlah) select gid, jenjang, bagian, jumlah from public.kuota where gelombang_id = g.id;
      insert into public.rincian_biaya (komponen, tahap, jenjang, bagian, gelombang_id, nominal, wajib, keterangan, urutan, tampil)
      select komponen, tahap, jenjang, bagian, gid, nominal, wajib, keterangan, urutan, tampil
        from public.rincian_biaya where gelombang_id = g.id and diarsipkan_pada is null;
      get diagnostics n_biaya = row_count;
      n_salin := n_salin + 1;
    end if;
    update public.gelombang set diarsipkan_pada = coalesce(diarsipkan_pada, now()), formulir_dibuka = false, tampil = false where id = g.id;
    n_arsip := n_arsip + 1;
  end loop;

  update public.pengaturan set nilai = jsonb_set(nilai, '{tahun_ajaran}', to_jsonb(baru)) where kunci = 'identitas';
  update public.pengaturan set nilai = jsonb_set(nilai, '{usia,acuan}',
           to_jsonb(coalesce((nullif(nilai #>> '{usia,acuan}', '')::date + geser)::date, make_date(public.tahun_awal_ta(baru), 7, 1))::text))
   where kunci = 'spmb' and nilai ? 'usia';
  update public.pengaturan set nilai = jsonb_set(nilai, '{mode}', '"jadwal"') where kunci = 'daftar_ulang';
  perform public.catat_log('mulai_tahun_ajaran', 'pengaturan', 'identitas',
    jsonb_build_object('lama', lama, 'baru', baru, 'gelombang_diarsipkan', n_arsip, 'gelombang_disalin', n_salin));
  perform public.kirim_notifikasi_ke_peran(array['superadmin', 'admin']::public.peran_pengguna[], 'Tahun ajaran baru',
    'SPMB kini memakai Tahun Ajaran ' || baru || '. Data ' || lama || ' tersimpan sebagai arsip dan tetap dapat dilihat.', 'info', '#/pendaftar');
  return jsonb_build_object('ok', true, 'lama', lama, 'baru', baru, 'diarsipkan', n_arsip, 'disalin', n_salin);
end; $$;
grant execute on function public.ringkasan_tahun_ajaran(), public.mulai_tahun_ajaran(text, boolean) to authenticated;


-- =====================================================================
-- C. KEUANGAN OLEH ADMIN
-- =====================================================================
create or replace function public.boleh_keringanan()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
$$;

do $$
declare t text;
begin
  foreach t in array array['rincian_biaya', 'rekening'] loop
    execute format('drop policy if exists "%1$s: tambah" on public.%1$I', t);
    execute format('create policy "%1$s: tambah" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    execute format('drop policy if exists "%1$s: ubah" on public.%1$I', t);
    execute format('create policy "%1$s: ubah" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('drop policy if exists "%1$s: hapus" on public.%1$I', t);
    execute format('create policy "%1$s: hapus" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Format nomor kuitansi (daftar ulang dan pembayaran lain) oleh Admin/Superadmin
create or replace function public.atur_format_kuitansi(p_du text, p_lain text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a text := trim(coalesce(p_du, '')); b text := trim(coalesce(p_lain, ''));
begin
  if not public.is_admin() then raise exception 'Hanya Admin atau Superadmin.'; end if;
  if position('{urut}' in a) = 0 or position('{urut}' in b) = 0 then raise exception 'Format kuitansi wajib memuat {urut}.'; end if;
  if length(a) > 80 or length(b) > 80 then raise exception 'Format kuitansi terlalu panjang.'; end if;
  if a = b then raise exception 'Format kuitansi daftar ulang dan pembayaran lain harus berbeda agar nomornya tidak bentrok.'; end if;
  update public.pengaturan set nilai = nilai || jsonb_build_object('format_kuitansi', a) where kunci = 'daftar_ulang';
  update public.pengaturan set nilai = nilai || jsonb_build_object('format_kuitansi', b) where kunci = 'keuangan';
  perform public.catat_log('atur_format_kuitansi', 'pengaturan', 'keuangan', jsonb_build_object('daftar_ulang', a, 'lainnya', b));
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.atur_format_kuitansi(text, text) to authenticated;


-- =====================================================================
-- D. DATA UJI LENGKAP
-- =====================================================================
create or replace function public.isi_data_uji_lengkap()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  hari date := public.hari_ini_wita();
  ta   text := public.ta_aktif();
  thn  int  := public.tahun_awal_ta();
  gel  public.gelombang;
  bid  text[] := public.bidang_daftar();
  pj   uuid[] := '{}';
  pjn  text[] := '{}';
  pid  uuid;
  ids  uuid[] := '{}';
  s_smp bigint; s_sma bigint;
  r record; b text; i int; v numeric; idx int;
  tok uuid; t jsonb; komp bigint;
  penguji_uji boolean := true;
  catatan text := '';
  -- nama, jenjang, bagian, nilai dasar, tahap akhir
  S constant jsonb := '[
    ["Muhammad Fathir Syamsuddin","SMP","putra",88,"du_selesai"],
    ["Ahmad Zaki Rahman","SMP","putra",82,"du_menunggu"],
    ["Umar Faruq Hidayat","SMP","putra",71,"cadangan"],
    ["Aisyah Humaira Nur","SMP","putri",91,"du_cicil"],
    ["Fatimah Azzahra Kadir","SMP","putri",84,"lulus"],
    ["Khadijah Nur Latif","SMP","putri",58,"tidak_lulus"],
    ["Bilal Ramadhan Amiruddin","SMA","putra",80,"du_perbaikan"],
    ["Maryam Qonita Anwar","SMA","putri",86,"nilai_menunggu"],
    ["Yusuf Mansur Ramli","SMA","putra",0,"berkas_kurang"],
    ["Zainab Salsabila Yusuf","SMA","putri",0,"terdaftar"]]';
  daerah constant text[][] := array[['Sulawesi Selatan','Kab. Gowa','7306'],['Sulawesi Selatan','Kota Makassar','7371'],['Sulawesi Selatan','Kab. Takalar','7305'],
    ['Sulawesi Selatan','Kab. Maros','7309'],['Sulawesi Selatan','Kab. Bone','7308'],['Sulawesi Tenggara','Kota Kendari','7471'],['Sulawesi Barat','Kab. Polewali Mandar','7604'],
    ['Sulawesi Selatan','Kab. Bulukumba','7302'],['Kalimantan Timur','Kota Balikpapan','6471'],['Sulawesi Selatan','Kab. Sinjai','7307']];
  ayah constant text[] := array['Syamsuddin','Abdul Rahman','Hidayatullah','Muhammad Nur','Abdul Kadir','Abdul Latif','Amiruddin','Khairul Anwar','Ramli','Muhammad Yusuf'];
  ibu  constant text[] := array['Nurhayati','Rosmiati','Hasnah','Nurjannah','Sitti Aminah','Hadijah','Ramlah','Suriani','Megawati','Rahmawati'];
  x jsonb; nm text; jj text; bg text; lahir date; v_nisn text; v_nik text; v_no text; k int;
begin
  if not public.is_superadmin() then raise exception 'Hanya Superadmin yang dapat membuat data uji lengkap.'; end if;
  if exists (select 1 from public.gelombang where uji) then
    raise exception 'Data uji lengkap sudah ada. Hapus data uji dulu (menu Pendaftar atau Pengaturan > Integrasi) bila ingin membuat ulang.';
  end if;
  if cardinality(bid) = 0 then raise exception 'Bidang tes belum diatur.'; end if;

  -- 1. Gelombang uji (tidak tampil di situs)
  insert into public.gelombang (nama, buka, tutup, tes_mulai, tes_selesai, pengumuman, daftar_ulang_mulai, daftar_ulang_selesai,
                                keterangan, formulir_dibuka, urutan, tampil, uji, tahun_ajaran)
  values ('Gelombang Uji Coba', now() - interval '30 days', now() - interval '12 days', hari - 8, hari - 7,
          now() - interval '1 day', hari - 1, hari + 14,
          'Gelombang khusus data uji. Tidak tampil di situs dan ikut terhapus saat data uji dihapus.', false, 99, false, true, ta)
  returning * into gel;
  insert into public.kuota (gelombang_id, jenjang, bagian, jumlah) values
    (gel.id, 'SMP', 'putra', 2), (gel.id, 'SMP', 'putri', 2), (gel.id, 'SMA', 'putra', 1), (gel.id, 'SMA', 'putri', 1);

  -- 2. Biaya uji (hanya untuk tahap yang belum memiliki biaya umum)
  if not exists (select 1 from public.rincian_biaya where tahap = 'pendaftaran' and gelombang_id is null and wajib and tampil and diarsipkan_pada is null) then
    insert into public.rincian_biaya (komponen, tahap, gelombang_id, nominal, urutan) values ('Biaya pendaftaran (uji)', 'pendaftaran', gel.id, 250000, 1);
  end if;
  if not exists (select 1 from public.rincian_biaya where tahap = 'daftar_ulang' and gelombang_id is null and wajib and tampil and diarsipkan_pada is null) then
    insert into public.rincian_biaya (komponen, tahap, gelombang_id, nominal, urutan) values
      ('Uang pangkal (uji)', 'daftar_ulang', gel.id, 3000000, 1), ('Seragam dan perlengkapan (uji)', 'daftar_ulang', gel.id, 1250000, 2),
      ('Kitab dan buku (uji)', 'daftar_ulang', gel.id, 500000, 3);
  end if;
  if not exists (select 1 from public.rincian_biaya where tahap = 'tahunan' and gelombang_id is null and wajib and tampil and diarsipkan_pada is null) then
    insert into public.rincian_biaya (komponen, tahap, gelombang_id, nominal, urutan) values ('Biaya kegiatan tahunan (uji)', 'tahunan', gel.id, 1500000, 1);
  end if;

  -- 3. Dua penguji uji (akun tanpa kata sandi, tidak dapat dipakai masuk)
  begin
    for i in 1 .. 2 loop
      pid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                              created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', pid, 'authenticated', 'authenticated', 'penguji.uji' || i || '@contoh.id', '', now(),
              jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'uji', true, 'peran', 'penguji', 'aktif', true,
                'nama_lengkap', case i when 1 then '[UJI] Ust. Abdurrahman Hafizh' else '[UJI] Ustzh. Nur Aini' end,
                'bidang_penguji', to_jsonb(case i when 1 then bid[1:1] else coalesce(bid[2:], bid[1:1]) end),
                'bagian', 'umum'), '{}'::jsonb, now(), now(), '', '', '', '');
      pj := pj || pid;
      pjn := pjn || (select nama_lengkap from public.profil_pengguna where id = pid);
    end loop;
  exception when others then
    penguji_uji := false; pj := array[auth.uid(), auth.uid()]; pjn := array[public.nama_saya(), public.nama_saya()];
    catatan := 'Akun penguji uji tidak dapat dibuat di proyek ini; Anda sendiri dicatat sebagai penguji.';
  end;

  -- 4. Sepuluh calon santri
  for i in 1 .. 10 loop
    x := S -> (i - 1);
    nm := x ->> 0; jj := x ->> 1; bg := x ->> 2;
    lahir := make_date(thn - case when jj = 'SMP' then 12 else 15 end, 1 + (i * 5) % 12, 1 + (i * 7) % 27);
    v_nisn := '99' || lpad((thn % 100)::text, 2, '0') || lpad((i * 731 + 1234)::text, 6, '0');
    k := 1 + (i - 1) % 10;
    v_nik := daerah[k][3] || lpad((1 + i % 9)::text, 2, '0') || lpad((extract(day from lahir)::int + case when bg = 'putri' then 40 else 0 end)::text, 2, '0')
           || to_char(lahir, 'MMYY') || lpad((9000 + i)::text, 4, '0');
    v_no := public.buat_no_registrasi(jj, bg, true);
    insert into public.pendaftar (no_registrasi, gelombang_id, jenjang, bagian, nama_lengkap, nisn, nik, tempat_lahir, tanggal_lahir,
      asal_provinsi, asal_kabupaten, alamat_jalan, rt, rw, dusun, desa, kecamatan, kabupaten, provinsi, kode_pos, asal_sekolah,
      nama_ayah, pekerjaan_ayah, nama_ibu, pekerjaan_ibu, email, no_wa, darurat_nama, darurat_hubungan, darurat_no,
      pernah_mondok, hafalan_juz, hafalan_surah, sumber_info, sumber_info_daftar, uji, didaftarkan_oleh, dibuat_pada, tahun_ajaran)
    values (v_no, gel.id, jj, bg, nm, v_nisn, v_nik, replace(replace(daerah[k][2], 'Kab. ', ''), 'Kota ', ''), lahir,
      daerah[k][1], daerah[k][2], 'Jl. Uji Coba No. ' || i, lpad(i::text, 3, '0'), '002', 'Dusun Contoh', 'Desa Contoh', 'Kecamatan Contoh',
      daerah[k][2], daerah[k][1], '9' || lpad((1000 + i * 37)::text, 4, '0'),
      case when jj = 'SMP' then 'SD Negeri ' || i || ' ' else 'SMP Negeri ' || i || ' ' end || replace(replace(daerah[k][2], 'Kab. ', ''), 'Kota ', ''),
      ayah[i], 'Wiraswasta/Pedagang', ibu[i], 'Mengurus rumah tangga', 'wali.uji' || i || '@contoh.id', '6281200000' || lpad(i::text, 3, '0'),
      'Kerabat ' || ayah[i], 'Paman', '6285200000' || lpad(i::text, 3, '0'),
      i % 4 = 0, (i % 5)::numeric, 10 + i, 'Media sosial', array['Media sosial'], true, auth.uid(),
      now() - make_interval(days => 28 - i), ta)
    returning id into pid;
    ids := ids || pid;
  end loop;

  -- 5. Verifikasi berkas dan pembayaran pendaftaran
  update public.pendaftar set verif_berkas = 'diterima', verif_bayar = 'diterima' where id = any (ids[1:8]);
  update public.pendaftar set verif_berkas = 'perbaikan', catatan_berkas = '- Foto Kartu Keluarga buram, mohon unggah ulang (contoh data uji)' where id = ids[9];

  -- 6. Sesi tes, penguji, peserta
  insert into public.sesi_tes (gelombang_id, nama, bidang, tanggal, jam_mulai, jam_selesai, mode, tempat, jenjang, catatan)
  values (gel.id, 'Sesi Uji SMP', bid, hari - 8, '08:00', '12:00', 'offline', 'Aula Pondok (uji)', 'SMP', 'Data uji coba') returning id into s_smp;
  insert into public.sesi_tes (gelombang_id, nama, bidang, tanggal, jam_mulai, jam_selesai, mode, tempat, tautan, jenjang, catatan)
  values (gel.id, 'Sesi Uji SMA', bid, hari - 7, '13:00', '16:00', 'online', 'Zoom', 'https://zoom.us/j/0000000000', 'SMA', 'Data uji coba') returning id into s_sma;
  for i in 1 .. cardinality(bid) loop
    insert into public.penguji_sesi (sesi_id, pengguna_id, bidang) values (s_smp, pj[case when i = 1 then 1 else 2 end], bid[i]) on conflict do nothing;
    insert into public.penguji_sesi (sesi_id, pengguna_id, bidang) values (s_sma, pj[case when i = 1 then 1 else 2 end], bid[i]) on conflict do nothing;
  end loop;
  for i in 1 .. 8 loop
    insert into public.peserta_sesi (sesi_id, pendaftar_id, hadir) values (case when i <= 6 then s_smp else s_sma end, ids[i], true);
  end loop;

  -- 7. Nilai (diisi penguji, divalidasi Superadmin); satu nilai sengaja menunggu validasi
  for i in 1 .. 8 loop
    select * into r from public.pendaftar where id = ids[i];
    idx := 0;
    foreach b in array public.bidang_wajib(r.jenjang) loop
      idx := idx + 1;
      v := least(100, greatest(0, ((S -> (i - 1) ->> 3)::int + case idx % 3 when 1 then 3 when 2 then -2 else -1 end)));
      insert into public.nilai_tes (pendaftar_id, bidang, nilai, hafalan_diuji, catatan, status, diisi_oleh, nama_pengisi, diisi_pada,
                                    divalidasi_oleh, nama_validator, divalidasi_pada)
      values (r.id, b, v, case when b = 'tahfizh' then r.hafalan_juz end, 'Data uji coba',
              case when i = 8 and idx = cardinality(public.bidang_wajib(r.jenjang)) then 'menunggu' else 'disetujui' end,
              pj[case when b = bid[1] then 1 else 2 end], pjn[case when b = bid[1] then 1 else 2 end], now() - interval '6 days',
              case when i = 8 and idx = cardinality(public.bidang_wajib(r.jenjang)) then null else auth.uid() end,
              case when i = 8 and idx = cardinality(public.bidang_wajib(r.jenjang)) then null else public.nama_saya() end,
              case when i = 8 and idx = cardinality(public.bidang_wajib(r.jenjang)) then null else now() - interval '5 days' end);
    end loop;
    perform public.perbarui_status_seleksi(r.id);
  end loop;

  -- 8. Keputusan: sesuai peringkat, lalu satu keputusan manual tidak lulus
  perform public.tetapkan_sesuai_rekomendasi(gel.id, true, null, false);
  perform public.tetapkan_hasil(array[ids[6]], 'tidak_lulus', 'Nilai tahfizh belum memenuhi standar (contoh data uji)');
  perform public.atur_dokumen_hasil(gel.id, jsonb_build_object('nomor_sk', 'UJI/001/SK/SPMB/' || public.angka_romawi(extract(month from hari)::int) || '/' || extract(year from hari),
    'tanggal_sk', hari::text, 'nomor_ba', 'UJI/001/BA/SPMB/' || extract(year from hari), 'tanggal_ba', hari::text, 'tempat_rapat', 'Aula Pondok (uji)'));
  perform public.terbitkan_hasil(gel.id, '', hari, true, true);

  -- 9. Keringanan 30% uang pangkal untuk santri pertama
  select id into komp from public.rincian_biaya where gelombang_id = gel.id and tahap = 'daftar_ulang' order by urutan limit 1;
  perform public.atur_keringanan(ids[1], 'daftar_ulang', komp, 'persen', 30, 'hafalan', 'Hafalan 5 juz (contoh data uji)', null);

  -- 10. Daftar ulang
  foreach i in array array[1, 2, 4, 7] loop
    select * into r from public.pendaftar where id = ids[i];
    insert into public.sesi_du (pendaftar_id, panitia) values (r.id, auth.uid()) returning token into tok;
    t := public.tagihan_santri(r.id, 'daftar_ulang');
    perform public.du_simpan(tok, '{}'::jsonb,
      jsonb_build_object('no_kk', '730601' || lpad((100000 + i)::text, 6, '0') || '0001', 'agama', 'Islam', 'kewarganegaraan', 'Indonesia (WNI)',
        'suku', 'Makassar', 'anak_ke', 1 + i % 3, 'jumlah_saudara', 2 + i % 3, 'tinggal_bersama', 'Orang tua', 'transportasi', 'Diantar orang tua (motor/mobil)',
        'jarak_km', 5 + i, 'waktu_menit', 15 + i * 3, 'ayah_status', 'Masih hidup', 'ayah_nik', '73060112' || lpad((700000 + i)::text, 8, '0'),
        'ayah_pendidikan', 'SMA/sederajat', 'ayah_penghasilan', 'Rp2.000.000 – Rp4.999.999', 'ibu_status', 'Masih hidup',
        'ibu_nik', '73060152' || lpad((800000 + i)::text, 8, '0'), 'ibu_pendidikan', 'SMA/sederajat', 'ibu_penghasilan', 'Tidak berpenghasilan',
        'ada_wali', 'Tidak', 'tinggi_cm', 140 + i * 2, 'berat_kg', 35 + i, 'golongan_darah', 'O', 'jenis_pendaftaran', 'Siswa baru',
        'tahun_lulus', thn, 'penerima_kip', 'Tidak', 'darurat_alamat', 'Jl. Uji Coba No. ' || i || ', ' || r.kabupaten, 'pernyataan', true),
      jsonb_build_object('nominal', (t ->> 'bayar')::bigint, 'tanggal', (hari - 1)::text, 'bank_pengirim', 'BSI', 'nama_pengirim', r.nama_ayah),
      true);
    if i = 1 then
      perform public.du_verifikasi(r.id, 'terima', 'Lunas (contoh data uji)', (t ->> 'bayar')::bigint, hari, 'transfer');
    elsif i = 4 then
      perform public.du_verifikasi(r.id, 'terima', 'Dicicil; sisa Rp1.000.000 dibayar bulan depan (contoh data uji)', greatest((t ->> 'bayar')::bigint - 1000000, 0), hari, 'transfer');
    elsif i = 7 then
      perform public.du_verifikasi(r.id, 'perbaikan', 'Foto KTP ayah buram, mohon unggah ulang (contoh data uji).');
    end if;
  end loop;

  -- 11. Pembayaran lain (biaya tahunan) untuk santri pertama
  t := public.tagihan_santri(ids[1], 'tahunan');
  if (t ->> 'bayar')::bigint > 0 then
    perform public.catat_pembayaran(ids[1], 'tahunan', 'Biaya kegiatan tahunan', (t ->> 'bayar')::bigint, hari, 'tunai', null, ayah[1], 'Contoh data uji');
  end if;

  perform public.catat_log('isi_data_uji_lengkap', 'gelombang', gel.id::text, jsonb_build_object('santri', 10, 'penguji_uji', penguji_uji));
  return jsonb_build_object('ok', true, 'gelombang', gel.nama, 'gelombang_id', gel.id, 'santri', 10, 'penguji_uji', penguji_uji, 'catatan', catatan,
    'akun_wali', (select jsonb_agg(jsonb_build_object('no_registrasi', no_registrasi, 'nama', nama_lengkap, 'nisn', nisn, 'tanggal_lahir', tanggal_lahir,
                     'status', status) order by no_registrasi)
                  from public.pendaftar where id = any (ids) and status in ('lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai', 'cadangan', 'tidak_lulus')));
end; $$;
revoke all on function public.isi_data_uji_lengkap() from public, anon;
grant execute on function public.isi_data_uji_lengkap() to authenticated;


-- =====================================================================
-- E. HAPUS DATA UJI (versi 2): pendaftar uji, gelombang uji beserta sesi,
--    kuota, biaya, dan akun penguji uji
-- =====================================================================
create or replace function public.hapus_data_uji()
returns jsonb language plpgsql security definer set search_path = public as $$
declare ids text[]; n int; ng int := 0; nu int := 0;
begin
  if not public.is_superadmin() then raise exception 'Hanya Superadmin yang dapat menghapus data uji.'; end if;
  select coalesce(array_agg(b.drive_id), '{}') into ids
    from public.berkas_pendaftar b join public.pendaftar p on p.id = b.pendaftar_id where p.uji;
  delete from public.pendaftar where uji;
  get diagnostics n = row_count;
  delete from public.rincian_biaya where gelombang_id in (select id from public.gelombang where uji);
  delete from public.notifikasi where tautan like '#/penilaian?sesi=%'
     and substring(tautan from 'sesi=([0-9]+)')::bigint in (select s.id from public.sesi_tes s join public.gelombang g on g.id = s.gelombang_id where g.uji);
  delete from public.gelombang where uji;
  get diagnostics ng = row_count;
  begin
    delete from auth.users where raw_app_meta_data ->> 'uji' = 'true';
    get diagnostics nu = row_count;
  exception when others then nu := 0;
  end;
  delete from public.penghitung_nomor where kunci like 'uji-%';
  delete from public.percobaan_cek where kunci like 'UJI-%' or kunci like 'DU:UJI-%';
  perform public.catat_log('hapus_data_uji', 'pendaftar', null, jsonb_build_object('jumlah', n, 'gelombang', ng, 'akun_penguji', nu));
  return jsonb_build_object('jumlah', n, 'gelombang', ng, 'akun_penguji', nu, 'drive_ids', to_jsonb(ids));
end; $$;
revoke all on function public.hapus_data_uji() from public, anon;
grant execute on function public.hapus_data_uji() to authenticated;


-- =====================================================================
-- F. MENU PENILAIAN: hanya untuk akun yang ditugaskan sebagai penguji
--    pada sesi tes tahun ajaran aktif (Superadmin, Admin, atau Penguji)
-- =====================================================================
create or replace function public.saya_penguji()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.penguji_sesi pj
                   join public.sesi_tes s on s.id = pj.sesi_id
                   join public.gelombang g on g.id = s.gelombang_id
                  where pj.pengguna_id = auth.uid() and g.tahun_ajaran = public.ta_aktif())
$$;
revoke all on function public.saya_penguji() from public, anon;
grant execute on function public.saya_penguji() to authenticated;


-- ---------------------------------------------------------------------
drop function if exists public._tambal(regprocedure, text, text);
notify pgrst, 'reload schema';
-- Selesai. Bila berhasil, Supabase menampilkan hasil kosong atau
-- "Success. No rows returned".
