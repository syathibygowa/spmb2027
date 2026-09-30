-- =====================================================================
--  SPMB 2027/2028 - Pondok Pesantren Tahfizhul Qur'an
--  Imam Asy-Syathiby Wahdah Islamiyah Gowa
--
--  Berkas 04: Pendaftaran Online (Fase 3 - Langkah 1)
--  Isi:
--    A. Data pendukung SPMB : gelombang, kuota, rincian biaya, rekening
--    B. Pendaftar           : data pendaftar, berkas, riwayat status,
--                             log WhatsApp, nomor registrasi otomatis
--    C. Layanan pengunjung  : token unggah, kirim formulir, cek status,
--                             info pendaftaran dan statistik publik
--    D. Layanan panitia     : statistik dashboard, hapus data uji
--    E. Pengaturan SPMB, templat WhatsApp, dan pemindahan isi modul
--       Biaya dan Jadwal lama (Konten Situs) ke data terstruktur
--
--  Prasyarat: berkas 01, 02, dan 03 sudah dijalankan.
--  Cara pakai: Supabase > SQL Editor > New query > tempel seluruh
--  isi berkas ini > Run. Aman bila tidak sengaja dijalankan dua kali.
-- =====================================================================


-- =====================================================================
-- A. DATA PENDUKUNG SPMB (diatur Superadmin)
-- =====================================================================

-- A1. Gelombang pendaftaran
create table if not exists public.gelombang (
  id                   bigint generated always as identity primary key,
  nama                 text not null check (length(trim(nama)) between 2 and 60),
  buka                 timestamptz,                 -- formulir mulai dapat diisi
  tutup                timestamptz,                 -- formulir ditutup
  tes_mulai            date,
  tes_selesai          date,
  pengumuman           timestamptz,
  daftar_ulang_mulai   date,
  daftar_ulang_selesai date,
  kegiatan             jsonb not null default '[]'::jsonb,   -- kegiatan tambahan: [{judul, mulai, selesai, keterangan}]
  keterangan           text not null default '',
  formulir_dibuka      boolean not null default false,       -- saklar utama; formulir aktif bila ON dan dalam rentang buka-tutup
  urutan               integer not null default 0,
  tampil               boolean not null default true,
  diarsipkan_pada      timestamptz,
  dibuat_pada          timestamptz not null default now(),
  diperbarui_pada      timestamptz not null default now(),
  diperbarui_oleh      uuid references auth.users (id) on delete set null,
  constraint gelombang_rentang_daftar check (tutup is null or buka is null or tutup > buka),
  constraint gelombang_rentang_tes    check (tes_selesai is null or tes_mulai is null or tes_selesai >= tes_mulai),
  constraint gelombang_rentang_du     check (daftar_ulang_selesai is null or daftar_ulang_mulai is null or daftar_ulang_selesai >= daftar_ulang_mulai),
  constraint gelombang_kegiatan_larik check (jsonb_typeof(kegiatan) = 'array')
);
comment on table public.gelombang is 'Gelombang pendaftaran beserta jadwal tes, pengumuman, dan daftar ulang.';

-- A2. Kuota per gelombang, jenjang, dan putra/putri (kosong = tanpa batas)
create table if not exists public.kuota (
  gelombang_id bigint not null references public.gelombang (id) on delete cascade,
  jenjang      text not null check (jenjang in ('SMP', 'SMA')),
  bagian       text not null check (bagian in ('putra', 'putri')),
  jumlah       integer check (jumlah is null or jumlah >= 0),
  primary key (gelombang_id, jenjang, bagian)
);
comment on table public.kuota is 'Kuota santri per gelombang. jumlah kosong berarti tidak dibatasi, 0 berarti ditutup.';

-- A3. Rincian biaya
create table if not exists public.rincian_biaya (
  id              bigint generated always as identity primary key,
  komponen        text not null check (length(trim(komponen)) between 2 and 80),
  tahap           text not null default 'pendaftaran'
                  check (tahap in ('pendaftaran', 'daftar_ulang', 'bulanan', 'tahunan', 'lainnya')),
  jenjang         text not null default 'semua' check (jenjang in ('semua', 'SMP', 'SMA')),
  bagian          text not null default 'semua' check (bagian in ('semua', 'putra', 'putri')),
  gelombang_id    bigint references public.gelombang (id) on delete set null,   -- kosong = semua gelombang
  nominal         bigint not null default 0 check (nominal between 0 and 1000000000),
  wajib           boolean not null default true,
  keterangan      text not null default '',
  urutan          integer not null default 0,
  tampil          boolean not null default true,
  diarsipkan_pada timestamptz,
  dibuat_pada     timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),
  diperbarui_oleh uuid references auth.users (id) on delete set null
);
comment on table public.rincian_biaya is 'Komponen biaya per tahap, jenjang, dan putra/putri. Dipakai landing page, formulir, tagihan, kuitansi.';

-- A4. Rekening pembayaran
create table if not exists public.rekening (
  id              bigint generated always as identity primary key,
  bank            text not null check (length(trim(bank)) between 2 and 60),
  nomor_rekening  text not null check (nomor_rekening ~ '^[0-9][0-9 .-]{4,30}$'),
  atas_nama       text not null check (length(trim(atas_nama)) between 2 and 100),
  peruntukan      text not null default 'semua' check (peruntukan in ('semua', 'pendaftaran', 'daftar_ulang')),
  bagian          text not null default 'semua' check (bagian in ('semua', 'putra', 'putri')),
  keterangan      text not null default '',
  urutan          integer not null default 0,
  tampil          boolean not null default true,
  diarsipkan_pada timestamptz,
  dibuat_pada     timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),
  diperbarui_oleh uuid references auth.users (id) on delete set null
);
comment on table public.rekening is 'Rekening tujuan pembayaran pendaftaran dan daftar ulang.';


-- =====================================================================
-- B. PENDAFTAR
-- =====================================================================

-- B1. Data pendaftar (hanya dibuat lewat fungsi kirim_pendaftaran)
create table if not exists public.pendaftar (
  id                 uuid primary key default gen_random_uuid(),
  no_registrasi      text not null unique,
  gelombang_id       bigint references public.gelombang (id) on delete set null,
  jenjang            text not null check (jenjang in ('SMP', 'SMA')),
  bagian             text not null check (bagian in ('putra', 'putri')),   -- putra = laki-laki, putri = perempuan
  status             text not null default 'terdaftar' check (status in (
                       'terdaftar', 'berkas_kurang', 'berkas_diverifikasi', 'pembayaran_dikonfirmasi',
                       'ikut_tes', 'nilai_divalidasi', 'lulus', 'cadangan', 'tidak_lulus',
                       'daftar_ulang_menunggu', 'daftar_ulang_selesai', 'mengundurkan_diri', 'dibatalkan')),
  verif_berkas       text not null default 'menunggu' check (verif_berkas in ('menunggu', 'diterima', 'perbaikan')),
  catatan_berkas     text not null default '',
  verif_berkas_oleh  uuid references auth.users (id) on delete set null,
  verif_berkas_pada  timestamptz,
  verif_bayar        text not null default 'menunggu' check (verif_bayar in ('menunggu', 'diterima', 'ditolak')),
  catatan_bayar      text not null default '',
  verif_bayar_oleh   uuid references auth.users (id) on delete set null,
  verif_bayar_pada   timestamptz,

  -- Langkah 2: data calon santri
  nama_lengkap       text not null,
  nisn               text not null check (nisn ~ '^[0-9]{10}$'),
  nik                text not null check (nik ~ '^[0-9]{16}$'),
  tempat_lahir       text not null,
  tanggal_lahir      date not null,
  asal_provinsi      text not null default '',
  asal_kabupaten     text not null default '',
  alamat_jalan       text not null default '',
  rt                 text check (rt ~ '^[0-9]{3}$'),
  rw                 text check (rw ~ '^[0-9]{3}$'),
  dusun              text not null default '',
  desa               text not null default '',
  kecamatan          text not null default '',
  kabupaten          text not null default '',
  provinsi           text not null default '',
  kode_wilayah       text not null default '',          -- kode desa/kelurahan Kemendagri
  kode_pos           text check (kode_pos ~ '^[0-9]{5}$'),
  asal_sekolah       text not null default '',
  npsn_sekolah       text check (npsn_sekolah ~ '^[0-9]{8}$'),

  -- Langkah 3: orang tua dan kontak
  nama_ayah          text not null default '',
  pekerjaan_ayah     text not null default '',
  nama_ibu           text not null default '',
  pekerjaan_ibu      text not null default '',
  email              text not null,
  no_wa              text not null check (no_wa ~ '^628[0-9]{7,11}$'),
  darurat_nama       text not null default '',
  darurat_hubungan   text not null default '',
  darurat_no         text check (darurat_no ~ '^628[0-9]{7,11}$'),

  -- Langkah 4: pertanyaan
  pernah_mondok      boolean not null default false,
  pondok_sebelumnya  text not null default '',
  lama_mondok        text not null default '',
  hafalan_juz        numeric(4,1) not null default 0 check (hafalan_juz between 0 and 30),
  sumber_info        text not null default '',
  perekomendasi      text not null default '',
  prestasi           jsonb not null default '[]'::jsonb check (jsonb_typeof(prestasi) = 'array'),

  -- Lain-lain
  peringatan         jsonb not null default '[]'::jsonb,  -- peringatan yang dikonfirmasi pendaftar (NIK vs tanggal lahir, usia)
  persetujuan_pada   timestamptz not null default now(),
  catatan_admin      text not null default '',
  uji                boolean not null default false,        -- data uji coba panitia (dapat dihapus massal)
  didaftarkan_oleh   uuid references auth.users (id) on delete set null,   -- terisi bila diinput panitia
  email_terkirim_pada timestamptz,
  dibuat_pada        timestamptz not null default now(),
  diperbarui_pada    timestamptz not null default now(),
  diperbarui_oleh    uuid references auth.users (id) on delete set null
);
comment on table public.pendaftar is 'Data pendaftar SPMB. Dibuat lewat formulir online (fungsi kirim_pendaftaran).';

create index if not exists pendaftar_kuota_idx   on public.pendaftar (gelombang_id, jenjang, bagian);
create index if not exists pendaftar_status_idx  on public.pendaftar (status);
create index if not exists pendaftar_waktu_idx   on public.pendaftar (dibuat_pada desc);
create index if not exists pendaftar_nama_idx    on public.pendaftar (lower(nama_lengkap));
-- NISN tidak boleh ganda (pendaftaran yang dibatalkan tidak dihitung; data uji terpisah)
create unique index if not exists pendaftar_nisn_unik on public.pendaftar (nisn, uji) where status <> 'dibatalkan';

-- B2. Berkas pendaftar (berkasnya di Google Drive, folder Berkas Pendaftar)
create table if not exists public.berkas_pendaftar (
  id            bigint generated always as identity primary key,
  pendaftar_id  uuid references public.pendaftar (id) on delete cascade,  -- kosong = belum terkirim (masih draf)
  token         uuid,                                                      -- token unggah pengunjung
  jenis         text not null check (jenis ~ '^[a-z_]{2,30}$'),
  drive_id      text not null unique,
  nama          text not null,
  url           text not null,
  mime          text,
  ukuran        integer,
  status        text not null default 'menunggu' check (status in ('menunggu', 'diterima', 'ditolak')),
  catatan       text not null default '',
  diunggah_oleh uuid references auth.users (id) on delete set null,       -- terisi bila diunggah panitia
  dibuat_pada   timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),
  diperbarui_oleh uuid references auth.users (id) on delete set null
);
create index if not exists berkas_pendaftar_idx on public.berkas_pendaftar (pendaftar_id, jenis);
create index if not exists berkas_token_idx     on public.berkas_pendaftar (token) where pendaftar_id is null;

-- B3. Token unggah untuk pengunjung tanpa akun
create table if not exists public.sesi_unggah (
  token            uuid primary key default gen_random_uuid(),
  jumlah_berkas    integer not null default 0,
  pendaftar_id     uuid references public.pendaftar (id) on delete cascade,
  dibuat_pada      timestamptz not null default now(),
  kedaluwarsa_pada timestamptz not null default now() + interval '24 hours'
);

-- B4. Riwayat status dan verifikasi
create table if not exists public.riwayat_status (
  id           bigint generated always as identity primary key,
  pendaftar_id uuid not null references public.pendaftar (id) on delete cascade,
  jenis        text not null check (jenis in ('status', 'berkas', 'bayar')),
  dari         text,
  ke           text,
  catatan      text,
  oleh         uuid references auth.users (id) on delete set null,
  nama_oleh    text,
  pada         timestamptz not null default now()
);
create index if not exists riwayat_status_idx on public.riwayat_status (pendaftar_id, pada desc);

-- B5. Catatan pengiriman WhatsApp (agar tidak terkirim dua kali)
create table if not exists public.log_wa (
  id           bigint generated always as identity primary key,
  pendaftar_id uuid not null references public.pendaftar (id) on delete cascade,
  templat      text not null,
  nomor        text not null,
  pesan        text not null,
  oleh         uuid default auth.uid() references auth.users (id) on delete set null,
  nama_oleh    text,
  pada         timestamptz not null default now()
);
create index if not exists log_wa_idx on public.log_wa (pendaftar_id, pada desc);

-- B6. Penghitung nomor registrasi dan pengaman cek status
create table if not exists public.penghitung_nomor (
  kunci text primary key,
  nilai integer not null default 0
);

create table if not exists public.percobaan_cek (
  kunci        text primary key,
  gagal        integer not null default 0,
  kunci_sampai timestamptz,
  terakhir     timestamptz not null default now()
);


-- =====================================================================
-- TRIGGER
-- =====================================================================
drop trigger if exists sebelum_ubah_gelombang on public.gelombang;
create trigger sebelum_ubah_gelombang before insert or update on public.gelombang
  for each row execute function public.stempel_ubah();
drop trigger if exists sebelum_ubah_biaya on public.rincian_biaya;
create trigger sebelum_ubah_biaya before insert or update on public.rincian_biaya
  for each row execute function public.stempel_ubah();
drop trigger if exists sebelum_ubah_rekening on public.rekening;
create trigger sebelum_ubah_rekening before insert or update on public.rekening
  for each row execute function public.stempel_ubah();
drop trigger if exists sebelum_ubah_berkas_pendaftar on public.berkas_pendaftar;
create trigger sebelum_ubah_berkas_pendaftar before update on public.berkas_pendaftar
  for each row execute function public.stempel_ubah();

drop trigger if exists log_gelombang on public.gelombang;
create trigger log_gelombang after insert or update or delete on public.gelombang
  for each row execute function public.log_perubahan();
drop trigger if exists log_biaya on public.rincian_biaya;
create trigger log_biaya after insert or delete on public.rincian_biaya
  for each row execute function public.log_perubahan();
drop trigger if exists log_biaya_ubah on public.rincian_biaya;
create trigger log_biaya_ubah after update on public.rincian_biaya
  for each row when (old.urutan is not distinct from new.urutan) execute function public.log_perubahan();
drop trigger if exists log_rekening on public.rekening;
create trigger log_rekening after insert or update or delete on public.rekening
  for each row execute function public.log_perubahan();

-- Log kuota (tabel tanpa kolom id)
create or replace function public.log_kuota()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.catat_log(lower(tg_op), 'kuota', coalesce(new.gelombang_id, old.gelombang_id)::text,
    jsonb_build_object('lama', to_jsonb(old), 'baru', to_jsonb(new)));
  return coalesce(new, old);
end; $$;
drop trigger if exists log_kuota on public.kuota;
create trigger log_kuota after insert or update or delete on public.kuota
  for each row execute function public.log_kuota();

-- Menjaga data pendaftar + status otomatis + riwayat
create or replace function public.jaga_pendaftar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id or new.no_registrasi is distinct from old.no_registrasi
     or new.dibuat_pada is distinct from old.dibuat_pada or new.uji is distinct from old.uji then
    raise exception 'Nomor registrasi, tanggal daftar, dan tanda uji tidak dapat diubah.';
  end if;
  if auth.uid() is not null and not public.is_superadmin()
     and (new.gelombang_id is distinct from old.gelombang_id or new.jenjang is distinct from old.jenjang
          or new.bagian is distinct from old.bagian) then
    raise exception 'Gelombang, jenjang, dan putra/putri hanya dapat diubah Superadmin.';
  end if;

  -- stempel verifikasi
  if new.verif_berkas is distinct from old.verif_berkas then
    new.verif_berkas_oleh := auth.uid(); new.verif_berkas_pada := now();
  end if;
  if new.verif_bayar is distinct from old.verif_bayar then
    new.verif_bayar_oleh := auth.uid(); new.verif_bayar_pada := now();
  end if;

  -- status otomatis selama tahap verifikasi (tidak menimpa status yang diubah manual)
  if new.status is not distinct from old.status
     and new.status in ('terdaftar', 'berkas_kurang', 'berkas_diverifikasi', 'pembayaran_dikonfirmasi') then
    new.status := case
      when new.verif_berkas = 'perbaikan' then 'berkas_kurang'
      when new.verif_berkas = 'diterima' and new.verif_bayar = 'diterima' then 'pembayaran_dikonfirmasi'
      when new.verif_berkas = 'diterima' then 'berkas_diverifikasi'
      else 'terdaftar' end;
  end if;

  new.diperbarui_pada := now();
  new.diperbarui_oleh := auth.uid();
  return new;
end; $$;
drop trigger if exists sebelum_ubah_pendaftar on public.pendaftar;
create trigger sebelum_ubah_pendaftar before update on public.pendaftar
  for each row execute function public.jaga_pendaftar();

create or replace function public.catat_riwayat_pendaftar()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text := (select nama_lengkap from public.profil_pengguna where id = auth.uid());
begin
  if new.status is distinct from old.status then
    insert into public.riwayat_status (pendaftar_id, jenis, dari, ke, catatan, oleh, nama_oleh)
    values (new.id, 'status', old.status, new.status, null, auth.uid(), nm);
  end if;
  if new.verif_berkas is distinct from old.verif_berkas or new.catatan_berkas is distinct from old.catatan_berkas then
    insert into public.riwayat_status (pendaftar_id, jenis, dari, ke, catatan, oleh, nama_oleh)
    values (new.id, 'berkas', old.verif_berkas, new.verif_berkas, nullif(new.catatan_berkas, ''), auth.uid(), nm);
  end if;
  if new.verif_bayar is distinct from old.verif_bayar or new.catatan_bayar is distinct from old.catatan_bayar then
    insert into public.riwayat_status (pendaftar_id, jenis, dari, ke, catatan, oleh, nama_oleh)
    values (new.id, 'bayar', old.verif_bayar, new.verif_bayar, nullif(new.catatan_bayar, ''), auth.uid(), nm);
  end if;
  return new;
end; $$;
drop trigger if exists riwayat_pendaftar on public.pendaftar;
create trigger riwayat_pendaftar after update on public.pendaftar
  for each row execute function public.catat_riwayat_pendaftar();

drop trigger if exists log_pendaftar on public.pendaftar;
create trigger log_pendaftar after update or delete on public.pendaftar
  for each row execute function public.log_perubahan();
drop trigger if exists log_berkas_pendaftar on public.berkas_pendaftar;
create trigger log_berkas_pendaftar after update or delete on public.berkas_pendaftar
  for each row when (pg_trigger_depth() < 2) execute function public.log_perubahan();

-- nama pengirim di log WhatsApp
create or replace function public.isi_nama_log_wa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.oleh := auth.uid();
  new.nama_oleh := (select nama_lengkap from public.profil_pengguna where id = auth.uid());
  new.pada := now();
  return new;
end; $$;
drop trigger if exists sebelum_tambah_log_wa on public.log_wa;
create trigger sebelum_tambah_log_wa before insert on public.log_wa
  for each row execute function public.isi_nama_log_wa();


-- =====================================================================
-- FUNGSI BANTU
-- =====================================================================

-- Waktu dan tanggal WITA
create or replace function public.hari_ini_wita()
returns date language sql stable as $$ select (now() at time zone 'Asia/Makassar')::date $$;

-- Normalisasi nomor HP/WA ke format 62...
create or replace function public.normal_wa(p text)
returns text language sql immutable as $$
  select case
    when x ~ '^0' then '62' || substr(x, 2)
    when x ~ '^8' then '62' || x
    else x end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as x) s
$$;

-- Kode provinsi Kemendagri yang sah (2 digit awal NIK)
create or replace function public.kode_provinsi_sah(p text)
returns boolean language sql immutable as $$
  select left(p, 2) = any (array['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36',
    '51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82','91','92','93','94','95','96'])
$$;

-- Gelombang yang formulirnya sedang dibuka
create or replace function public.gelombang_aktif()
returns public.gelombang language sql stable security definer set search_path = public as $$
  select * from public.gelombang
  where formulir_dibuka and diarsipkan_pada is null and buka is not null and tutup is not null
    and now() >= buka and now() < tutup
  order by buka limit 1
$$;

-- Jumlah pendaftar yang mengisi kuota
create or replace function public.jumlah_terisi(p_gel bigint, p_jenjang text, p_bagian text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.pendaftar
  where gelombang_id = p_gel and jenjang = p_jenjang and bagian = p_bagian
    and not uji and status not in ('dibatalkan', 'mengundurkan_diri')
$$;

-- Membuat nomor registrasi sesuai format di pengaturan spmb
create or replace function public.buat_no_registrasi(p_jenjang text, p_bagian text, p_uji boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  cfg   jsonb := coalesce((select nilai from public.pengaturan where kunci = 'spmb'), '{}');
  ta    text  := coalesce((select nilai ->> 'tahun_ajaran' from public.pengaturan where kunci = 'identitas'), '');
  tahun text  := coalesce(substring(ta from '([0-9]{4})'), to_char(now(), 'YYYY'));
  pola  text  := coalesce(nullif(cfg ->> 'format_nomor', ''), 'SPMB{TA}-{JENJANG}-{JK}-{NO}');
  digit int   := greatest(2, least(6, coalesce((cfg ->> 'digit_nomor')::int, 4)));
  jk    text  := case p_bagian when 'putra' then 'P' else 'I' end;
  v_kunci text := (case when p_uji then 'uji-' else '' end) || p_jenjang || '-' || jk;
  urut  int;
  hasil text;
begin
  insert into public.penghitung_nomor (kunci, nilai) values (v_kunci, 1)
  on conflict (kunci) do update set nilai = public.penghitung_nomor.nilai + 1
  returning nilai into urut;

  hasil := replace(replace(replace(replace(replace(pola,
             '{TA}', right(tahun, 2)), '{TAHUN}', tahun), '{JENJANG}', p_jenjang), '{JK}', jk),
             '{NO}', lpad(urut::text, digit, '0'));
  if p_uji then hasil := 'UJI-' || hasil; end if;
  -- jaga-jaga bila format diubah sehingga bertabrakan dengan nomor lama
  while exists (select 1 from public.pendaftar where no_registrasi = hasil) loop
    hasil := hasil || '-' || substr(md5(random()::text), 1, 3);
  end loop;
  return hasil;
end; $$;

-- Galat berbahasa Indonesia untuk formulir
create or replace function public.galat_formulir(p_kolom text, p_pesan text)
returns void language plpgsql as $$
begin
  raise exception using message = p_pesan, hint = coalesce(p_kolom, ''), errcode = 'P0001';
end; $$;


-- =====================================================================
-- C. LAYANAN PENGUNJUNG (tanpa akun)
-- =====================================================================

-- C1. Info pendaftaran untuk formulir, landing page, dan statistik publik
create or replace function public.info_spmb()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g    public.gelombang := public.gelombang_aktif();
  nxt  public.gelombang;
  kuo  jsonb;
  total int;
begin
  select * into nxt from public.gelombang
  where diarsipkan_pada is null and tampil and formulir_dibuka and buka > now()
  order by buka limit 1;

  if g.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'jenjang', j, 'bagian', b, 'kuota', k.jumlah,
             'terisi', public.jumlah_terisi(g.id, j, b),
             'sisa', case when k.jumlah is null then null else greatest(k.jumlah - public.jumlah_terisi(g.id, j, b), 0) end)
           order by j, b), '[]')
    into kuo
    from (values ('SMP'), ('SMA')) jj(j) cross join (values ('putra'), ('putri')) bb(b)
    left join public.kuota k on k.gelombang_id = g.id and k.jenjang = j and k.bagian = b;
  end if;

  select count(*) into total from public.pendaftar where not uji and status not in ('dibatalkan');

  return jsonb_build_object(
    'sekarang', now(),
    'dibuka', g.id is not null,
    'gelombang', case when g.id is null then null else jsonb_build_object(
        'id', g.id, 'nama', g.nama, 'buka', g.buka, 'tutup', g.tutup, 'tes_mulai', g.tes_mulai,
        'tes_selesai', g.tes_selesai, 'pengumuman', g.pengumuman) end,
    'berikutnya', case when nxt.id is null then null else jsonb_build_object(
        'id', nxt.id, 'nama', nxt.nama, 'buka', nxt.buka, 'tutup', nxt.tutup) end,
    'kuota', coalesce(kuo, '[]'),
    'total_pendaftar', total
  );
end; $$;

-- C2. Token unggah: diminta formulir sebelum mengunggah berkas.
--     Bila token lama dikirim dan belum dipakai, masa berlakunya diperpanjang.
create or replace function public.minta_token_unggah(p_token_lama uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if p_token_lama is not null then
    update public.sesi_unggah
       set kedaluwarsa_pada = least(dibuat_pada + interval '7 days', now() + interval '24 hours')
     where token = p_token_lama and pendaftar_id is null and dibuat_pada > now() - interval '7 days'
    returning token into t;
    if t is not null then return t; end if;
  end if;

  if (select count(*) from public.sesi_unggah where dibuat_pada > now() - interval '1 hour') >= 300 then
    raise exception 'Layanan unggah sedang sibuk. Silakan coba beberapa menit lagi.';
  end if;
  insert into public.sesi_unggah default values returning token into t;
  return t;
end; $$;

-- C3. Dipanggil Apps Script sebelum menyimpan berkas: memeriksa token
create or replace function public.cek_token_unggah(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.sesi_unggah;
begin
  select * into s from public.sesi_unggah where token = p_token;
  if s.token is null then return jsonb_build_object('ok', false, 'error', 'Token unggah tidak dikenal. Muat ulang formulir.'); end if;
  if s.pendaftar_id is not null then return jsonb_build_object('ok', false, 'error', 'Pendaftaran ini sudah terkirim.'); end if;
  if s.kedaluwarsa_pada < now() then return jsonb_build_object('ok', false, 'error', 'Sesi unggah berakhir. Muat ulang formulir.'); end if;
  if s.jumlah_berkas >= 20 then return jsonb_build_object('ok', false, 'error', 'Batas jumlah unggahan tercapai. Hubungi panitia.'); end if;
  return jsonb_build_object('ok', true, 'folder', 'draf-' || left(s.token::text, 8));
end; $$;

-- C4. Dipanggil Apps Script setelah berkas tersimpan di Drive
create or replace function public.catat_unggah_pendaftar(
  p_token uuid, p_jenis text, p_drive_id text, p_nama text, p_url text, p_mime text, p_ukuran integer)
returns bigint language plpgsql security definer set search_path = public as $$
declare hasil jsonb := public.cek_token_unggah(p_token); nid bigint;
begin
  if not (hasil ->> 'ok')::boolean then raise exception '%', hasil ->> 'error'; end if;
  if p_jenis !~ '^[a-z_]{2,30}$' then raise exception 'Jenis berkas tidak dikenal.'; end if;
  if coalesce(p_ukuran, 0) > 10 * 1024 * 1024 then raise exception 'Ukuran berkas terlalu besar.'; end if;

  insert into public.berkas_pendaftar (token, jenis, drive_id, nama, url, mime, ukuran)
  values (p_token, p_jenis, p_drive_id, left(p_nama, 150), p_url, p_mime, p_ukuran)
  returning id into nid;
  update public.sesi_unggah set jumlah_berkas = jumlah_berkas + 1 where token = p_token;
  return nid;
end; $$;

-- C5. Kirim formulir pendaftaran
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

  if g.id is null then
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

  if (select count(*) from public.pendaftar where dibuat_pada > now() - interval '1 minute') >= 30 then
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
    perform public.galat_formulir('nisn', 'NISN ini sudah terdaftar. Bila merasa belum pernah mendaftar, hubungi panitia.');
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
  if darurat is not null and darurat !~ '^628[0-9]{7,11}$' then perform public.galat_formulir('darurat_no', 'Nomor kontak darurat diawali 08 atau +62, 10-13 digit.'); end if;
  if coalesce((d ->> 'hafalan_juz')::numeric, 0) not between 0 and 30 then perform public.galat_formulir('hafalan_juz', 'Jumlah hafalan 0-30 juz.'); end if;
  if jsonb_typeof(coalesce(d -> 'prestasi', '[]')) <> 'array' or jsonb_array_length(coalesce(d -> 'prestasi', '[]')) > 10 then
    perform public.galat_formulir('prestasi', 'Prestasi paling banyak 10 baris.');
  end if;
  if not coalesce((d ->> 'setuju')::boolean, false) then perform public.galat_formulir('setuju', 'Centang pernyataan persetujuan sebelum mengirim.'); end if;

  -- 5. Berkas: hanya berkas milik token ini yang dipilih formulir
  select array_agg(x) into pilih from jsonb_array_elements_text(coalesce(d -> 'berkas', '[]')) x;
  for wajib in
    select b ->> 'kunci' from jsonb_array_elements(coalesce(cfg -> 'berkas', '[]')) b where coalesce((b ->> 'wajib')::boolean, false)
  loop
    if not exists (select 1 from public.berkas_pendaftar bp
                   where bp.token = p_token and bp.pendaftar_id is null and bp.jenis = wajib and bp.drive_id = any (coalesce(pilih, '{}'))) then
      perform public.galat_formulir('berkas_' || wajib, 'Berkas wajib belum diunggah: ' ||
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
    sumber_info, perekomendasi, prestasi, peringatan, uji, didaftarkan_oleh)
  values (
    no_baru, g.id, v_jenjang, v_bagian, v_nama, v_nisn, v_nik, trim(d ->> 'tempat_lahir'), tgl,
    trim(d ->> 'asal_provinsi'), trim(d ->> 'asal_kabupaten'), left(trim(coalesce(d ->> 'alamat_jalan', '')), 200),
    lpad(d ->> 'rt', 3, '0'), lpad(d ->> 'rw', 3, '0'), left(trim(coalesce(d ->> 'dusun', '')), 100),
    trim(d ->> 'desa'), trim(d ->> 'kecamatan'), trim(d ->> 'kabupaten'), trim(coalesce(d ->> 'provinsi', '')),
    coalesce(d ->> 'kode_wilayah', ''), d ->> 'kode_pos', left(trim(d ->> 'asal_sekolah'), 150),
    nullif(d ->> 'npsn_sekolah', ''), trim(d ->> 'nama_ayah'), left(trim(coalesce(d ->> 'pekerjaan_ayah', '')), 60),
    trim(d ->> 'nama_ibu'), left(trim(coalesce(d ->> 'pekerjaan_ibu', '')), 60), v_email, v_wa,
    left(trim(coalesce(d ->> 'darurat_nama', '')), 100), left(trim(coalesce(d ->> 'darurat_hubungan', '')), 40), darurat,
    coalesce((d ->> 'pernah_mondok')::boolean, false), left(trim(coalesce(d ->> 'pondok_sebelumnya', '')), 150),
    left(trim(coalesce(d ->> 'lama_mondok', '')), 40), coalesce((d ->> 'hafalan_juz')::numeric, 0),
    left(trim(coalesce(d ->> 'sumber_info', '')), 60), left(trim(coalesce(d ->> 'perekomendasi', '')), 100),
    coalesce(d -> 'prestasi', '[]'),
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

-- C6. Cek status: nomor registrasi + tanggal lahir (5 kali gagal = dikunci 15 menit)
create or replace function public.cek_status(p_no text, p_tanggal_lahir date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k  text := upper(regexp_replace(coalesce(p_no, ''), '\s', '', 'g'));
  pc public.percobaan_cek;
  p  public.pendaftar;
  g  public.gelombang;
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
  return jsonb_build_object('ok', true,
    'no_registrasi', p.no_registrasi, 'nama_lengkap', p.nama_lengkap, 'jenjang', p.jenjang, 'bagian', p.bagian,
    'asal', p.asal_kabupaten, 'gelombang', g.nama, 'status', p.status,
    'verif_berkas', p.verif_berkas, 'catatan_berkas', p.catatan_berkas,
    'verif_bayar', p.verif_bayar, 'catatan_bayar', p.catatan_bayar,
    'tes_mulai', g.tes_mulai, 'tes_selesai', g.tes_selesai, 'pengumuman', g.pengumuman,
    'dibuat_pada', p.dibuat_pada, 'uji', p.uji,
    'berkas', coalesce((select jsonb_agg(jsonb_build_object('jenis', b.jenis, 'status', b.status, 'catatan', b.catatan) order by b.id)
                        from public.berkas_pendaftar b where b.pendaftar_id = p.id), '[]'));
end; $$;


-- =====================================================================
-- D. LAYANAN PANITIA
-- =====================================================================

-- D1. Statistik dashboard (Admin/Superadmin)
create or replace function public.statistik_dashboard(p_gelombang bigint default null, p_uji boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare hasil jsonb;
begin
  if not public.is_admin() then raise exception 'Anda tidak berhak melihat statistik pendaftar.'; end if;

  with p as (
    select * from public.pendaftar
    where uji = p_uji and status <> 'dibatalkan' and (p_gelombang is null or gelombang_id = p_gelombang)
  )
  select jsonb_build_object(
    'total',              (select count(*) from p),
    'hari_ini',           (select count(*) from p where (dibuat_pada at time zone 'Asia/Makassar')::date = public.hari_ini_wita()),
    'menunggu_berkas',    (select count(*) from p where verif_berkas = 'menunggu' and status in ('terdaftar', 'berkas_diverifikasi', 'berkas_kurang')),
    'menunggu_bayar',     (select count(*) from p where verif_bayar = 'menunggu' and status in ('terdaftar', 'berkas_diverifikasi', 'berkas_kurang')),
    'berkas_kurang',      (select count(*) from p where status = 'berkas_kurang'),
    'terverifikasi',      (select count(*) from p where status = 'pembayaran_dikonfirmasi'),
    'lulus',              (select count(*) from p where status in ('lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai')),
    'daftar_ulang',       (select count(*) from p where status = 'daftar_ulang_selesai'),
    'per_status',         (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from p group by status) x),
    'per_jenjang',        (select coalesce(jsonb_agg(jsonb_build_object('jenjang', jenjang, 'bagian', bagian, 'jumlah', n) order by jenjang, bagian), '[]')
                            from (select jenjang, bagian, count(*) n from p group by jenjang, bagian) x),
    'harian',             (select coalesce(jsonb_agg(jsonb_build_object('tanggal', h, 'jumlah', coalesce(n, 0)) order by h), '[]')
                            from generate_series(public.hari_ini_wita() - 29, public.hari_ini_wita(), interval '1 day') h
                            left join (select (dibuat_pada at time zone 'Asia/Makassar')::date t, count(*) n from p group by 1) x on x.t = h::date),
    'per_provinsi',       (select coalesce(jsonb_agg(jsonb_build_object('nama', nama, 'jumlah', n) order by n desc), '[]')
                            from (select coalesce(nullif(asal_provinsi, ''), 'Tidak diisi') nama, count(*) n from p group by 1 order by 2 desc limit 10) x),
    'per_kabupaten',      (select coalesce(jsonb_agg(jsonb_build_object('nama', nama, 'jumlah', n) order by n desc), '[]')
                            from (select coalesce(nullif(asal_kabupaten, ''), 'Tidak diisi') nama, count(*) n from p group by 1 order by 2 desc limit 10) x),
    'per_sumber',         (select coalesce(jsonb_agg(jsonb_build_object('nama', nama, 'jumlah', n) order by n desc), '[]')
                            from (select coalesce(nullif(sumber_info, ''), 'Tidak diisi') nama, count(*) n from p group by 1) x),
    'kuota',              (select coalesce(jsonb_agg(jsonb_build_object('gelombang', g.nama, 'gelombang_id', g.id, 'jenjang', k.jenjang,
                              'bagian', k.bagian, 'kuota', k.jumlah, 'terisi', public.jumlah_terisi(g.id, k.jenjang, k.bagian))
                              order by g.urutan, g.id, k.jenjang, k.bagian), '[]')
                            from public.kuota k join public.gelombang g on g.id = k.gelombang_id
                            where g.diarsipkan_pada is null and (p_gelombang is null or g.id = p_gelombang)),
    'data_uji',           (select count(*) from public.pendaftar where uji)
  ) into hasil;
  return hasil;
end; $$;

-- D2. Hapus seluruh data uji coba (Superadmin). Mengembalikan ID berkas Drive
--     agar dashboard dapat membuangnya ke Sampah lewat Apps Script.
create or replace function public.hapus_data_uji()
returns jsonb language plpgsql security definer set search_path = public as $$
declare ids text[]; n int;
begin
  if not public.is_superadmin() then raise exception 'Hanya Superadmin yang dapat menghapus data uji.'; end if;
  select coalesce(array_agg(b.drive_id), '{}') into ids
    from public.berkas_pendaftar b join public.pendaftar p on p.id = b.pendaftar_id where p.uji;
  delete from public.pendaftar where uji;
  get diagnostics n = row_count;
  delete from public.penghitung_nomor where kunci like 'uji-%';
  perform public.catat_log('hapus_data_uji', 'pendaftar', null, jsonb_build_object('jumlah', n));
  return jsonb_build_object('jumlah', n, 'drive_ids', to_jsonb(ids));
end; $$;

-- D3. Berkas draf yang tidak jadi dikirim (lebih dari 7 hari) untuk dibersihkan (Superadmin)
create or replace function public.berkas_yatim()
returns table (id bigint, drive_id text, nama text, dibuat_pada timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.drive_id, b.nama, b.dibuat_pada from public.berkas_pendaftar b
  where public.is_superadmin() and b.pendaftar_id is null and b.dibuat_pada < now() - interval '7 days'
  order by b.dibuat_pada
$$;


-- =====================================================================
-- ATURAN AKSES (ROW LEVEL SECURITY)
-- =====================================================================
alter table public.gelombang        enable row level security;
alter table public.kuota            enable row level security;
alter table public.rincian_biaya    enable row level security;
alter table public.rekening         enable row level security;
alter table public.pendaftar        enable row level security;
alter table public.berkas_pendaftar enable row level security;
alter table public.sesi_unggah      enable row level security;
alter table public.riwayat_status   enable row level security;
alter table public.log_wa           enable row level security;
alter table public.penghitung_nomor enable row level security;
alter table public.percobaan_cek    enable row level security;

-- Gelombang, biaya, rekening: pengunjung melihat yang tampil; panitia melihat semua; tulis Superadmin
do $$
declare t text;
begin
  foreach t in array array['gelombang', 'rincian_biaya', 'rekening'] loop
    execute format('drop policy if exists "%1$s: lihat" on public.%1$I', t);
    execute format('create policy "%1$s: lihat" on public.%1$I for select to anon, authenticated
                    using ((tampil and diarsipkan_pada is null) or public.is_panitia())', t);
    execute format('drop policy if exists "%1$s: tambah" on public.%1$I', t);
    execute format('create policy "%1$s: tambah" on public.%1$I for insert to authenticated with check (public.is_superadmin())', t);
    execute format('drop policy if exists "%1$s: ubah" on public.%1$I', t);
    execute format('create policy "%1$s: ubah" on public.%1$I for update to authenticated
                    using (public.is_superadmin()) with check (public.is_superadmin())', t);
    execute format('drop policy if exists "%1$s: hapus" on public.%1$I', t);
    execute format('create policy "%1$s: hapus" on public.%1$I for delete to authenticated using (public.is_superadmin())', t);
  end loop;
end $$;

drop policy if exists "kuota: lihat" on public.kuota;
create policy "kuota: lihat" on public.kuota for select to anon, authenticated using (true);
drop policy if exists "kuota: tulis" on public.kuota;
create policy "kuota: tulis" on public.kuota for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Pendaftar: Admin dan Superadmin (Penguji menyusul di Fase 4)
drop policy if exists "pendaftar: lihat" on public.pendaftar;
create policy "pendaftar: lihat" on public.pendaftar for select to authenticated using (public.is_admin());
drop policy if exists "pendaftar: ubah" on public.pendaftar;
create policy "pendaftar: ubah" on public.pendaftar for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "pendaftar: hapus" on public.pendaftar;
create policy "pendaftar: hapus" on public.pendaftar for delete to authenticated using (public.is_superadmin());

drop policy if exists "berkas pendaftar: lihat" on public.berkas_pendaftar;
create policy "berkas pendaftar: lihat" on public.berkas_pendaftar for select to authenticated using (public.is_admin());
drop policy if exists "berkas pendaftar: tambah" on public.berkas_pendaftar;
create policy "berkas pendaftar: tambah" on public.berkas_pendaftar for insert to authenticated
  with check (public.is_admin() and pendaftar_id is not null);
drop policy if exists "berkas pendaftar: ubah" on public.berkas_pendaftar;
create policy "berkas pendaftar: ubah" on public.berkas_pendaftar for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "berkas pendaftar: hapus" on public.berkas_pendaftar;
create policy "berkas pendaftar: hapus" on public.berkas_pendaftar for delete to authenticated using (public.is_superadmin());

drop policy if exists "riwayat: lihat" on public.riwayat_status;
create policy "riwayat: lihat" on public.riwayat_status for select to authenticated using (public.is_admin());

drop policy if exists "log wa: lihat" on public.log_wa;
create policy "log wa: lihat" on public.log_wa for select to authenticated using (public.is_admin());
drop policy if exists "log wa: tambah" on public.log_wa;
create policy "log wa: tambah" on public.log_wa for insert to authenticated with check (public.is_admin());
-- sesi_unggah, penghitung_nomor, percobaan_cek: tanpa kebijakan = hanya lewat fungsi


-- =====================================================================
-- HAK AKSES TABEL DAN FUNGSI
-- =====================================================================
revoke all on public.gelombang, public.kuota, public.rincian_biaya, public.rekening, public.pendaftar,
              public.berkas_pendaftar, public.sesi_unggah, public.riwayat_status, public.log_wa,
              public.penghitung_nomor, public.percobaan_cek from anon, authenticated;

grant select on public.gelombang, public.kuota, public.rincian_biaya, public.rekening to anon, authenticated;
grant insert, update, delete on public.gelombang, public.kuota, public.rincian_biaya, public.rekening to authenticated;
grant select, update, delete on public.pendaftar to authenticated;
grant select, insert, update, delete on public.berkas_pendaftar to authenticated;
grant select on public.riwayat_status to authenticated;
grant select, insert on public.log_wa to authenticated;

revoke execute on function
  public.hari_ini_wita(), public.normal_wa(text), public.kode_provinsi_sah(text), public.gelombang_aktif(),
  public.jumlah_terisi(bigint, text, text), public.buat_no_registrasi(text, text, boolean),
  public.galat_formulir(text, text), public.info_spmb(), public.minta_token_unggah(uuid),
  public.cek_token_unggah(uuid), public.catat_unggah_pendaftar(uuid, text, text, text, text, text, integer),
  public.kirim_pendaftaran(jsonb, uuid), public.cek_status(text, date),
  public.statistik_dashboard(bigint, boolean), public.hapus_data_uji(), public.berkas_yatim(),
  public.log_kuota(), public.jaga_pendaftar(), public.catat_riwayat_pendaftar(), public.isi_nama_log_wa()
from public, anon, authenticated;

grant execute on function
  public.hari_ini_wita(), public.normal_wa(text), public.kode_provinsi_sah(text),
  public.info_spmb(), public.minta_token_unggah(uuid), public.cek_token_unggah(uuid),
  public.catat_unggah_pendaftar(uuid, text, text, text, text, text, integer),
  public.kirim_pendaftaran(jsonb, uuid), public.cek_status(text, date)
to anon, authenticated;
grant execute on function public.statistik_dashboard(bigint, boolean), public.hapus_data_uji(), public.berkas_yatim()
to authenticated;


-- =====================================================================
-- E. PENGATURAN SPMB, TEMPLAT WHATSAPP, DAN PEMINDAHAN ISI LAMA
-- =====================================================================
insert into public.pengaturan (kunci, nilai, keterangan, publik) values
(
  'spmb',
  jsonb_build_object(
    'format_nomor', 'SPMB{TA}-{JENJANG}-{JK}-{NO}',
    'digit_nomor',  4,
    'usia', jsonb_build_object(
      'acuan', '2027-07-01',
      'SMP', jsonb_build_object('min', 11, 'maks', 15),
      'SMA', jsonb_build_object('min', 14, 'maks', 18)),
    'berkas', jsonb_build_array(
      jsonb_build_object('kunci', 'pas_foto',    'label', 'Pas foto',                      'wajib', true,  'jenis', 'gambar'),
      jsonb_build_object('kunci', 'kk',          'label', 'Kartu Keluarga',                'wajib', true,  'jenis', 'semua'),
      jsonb_build_object('kunci', 'akta',        'label', 'Akta Kelahiran',                'wajib', true,  'jenis', 'semua'),
      jsonb_build_object('kunci', 'skl_rapor',   'label', 'SKL / Ijazah / Rapor terakhir', 'wajib', true,  'jenis', 'semua'),
      jsonb_build_object('kunci', 'bukti_bayar', 'label', 'Bukti transfer pendaftaran',    'wajib', true,  'jenis', 'semua'),
      jsonb_build_object('kunci', 'rekomendasi', 'label', 'Surat rekomendasi',             'wajib', false, 'jenis', 'semua'),
      jsonb_build_object('kunci', 'sertifikat',  'label', 'Sertifikat prestasi',           'wajib', false, 'jenis', 'semua')),
    'sumber_info', jsonb_build_array('Media sosial (Instagram/Facebook/TikTok)', 'YouTube', 'Situs web pondok',
      'Brosur atau spanduk', 'Keluarga atau kerabat', 'Alumni atau santri', 'Guru atau sekolah asal',
      'Kegiatan dakwah Wahdah Islamiyah', 'Lainnya'),
    'pekerjaan', jsonb_build_array('Tidak bekerja', 'Mengurus rumah tangga', 'PNS/ASN', 'TNI/Polri', 'Karyawan swasta',
      'Karyawan BUMN/BUMD', 'Guru/Dosen', 'Wiraswasta/Pedagang', 'Petani/Pekebun', 'Nelayan', 'Buruh',
      'Dokter/Tenaga kesehatan', 'Ustadz/Dai', 'Pensiunan', 'Sudah meninggal', 'Lainnya'),
    'pernyataan', 'Saya menyatakan data yang diisi benar dan menyetujui penggunaan data ini untuk keperluan penerimaan santri baru Pondok Pesantren Tahfizhul Qur''an Imam Asy-Syathiby.',
    'catatan_formulir', ''
  ),
  'Aturan formulir: format nomor registrasi, batas usia, daftar berkas, pilihan isian',
  true
),
(
  'templat_wa',
  jsonb_build_object(
    'diterima',        jsonb_build_object('judul', 'Pendaftaran Diterima', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nTerima kasih, pendaftaran ananda *{nama}* di {nama_lembaga} telah kami terima.\n\nNomor registrasi: *{no_registrasi}*\nJenjang: {jenjang} · {gelombang}\n\nStatus pendaftaran dapat diperiksa di: {tautan_status}\n\nPanitia SPMB {tahun_ajaran}'),
    'berkas_kurang',   jsonb_build_object('judul', 'Berkas Kurang', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nBerkas pendaftaran ananda *{nama}* ({no_registrasi}) perlu dilengkapi:\n{catatan}\n\nMohon kirimkan perbaikan melalui WhatsApp ini. Jazakumullahu khairan.\n\nPanitia SPMB {tahun_ajaran}'),
    'bayar_ok',        jsonb_build_object('judul', 'Pembayaran Dikonfirmasi', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nPembayaran pendaftaran ananda *{nama}* ({no_registrasi}) telah kami konfirmasi. Informasi jadwal tes akan kami sampaikan berikutnya.\n\nPanitia SPMB {tahun_ajaran}'),
    'jadwal_tes',      jsonb_build_object('judul', 'Jadwal Tes', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nAnanda *{nama}* ({no_registrasi}) dijadwalkan mengikuti tes seleksi:\n{jadwal_tes}\n\nMohon hadir tepat waktu. Detail dapat dilihat di: {tautan_status}\n\nPanitia SPMB {tahun_ajaran}'),
    'pengingat_tes',   jsonb_build_object('judul', 'Pengingat Tes', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nMengingatkan, tes seleksi ananda *{nama}* ({no_registrasi}) akan dilaksanakan:\n{jadwal_tes}\n\nSemoga Allah memudahkan.\n\nPanitia SPMB {tahun_ajaran}'),
    'lulus',           jsonb_build_object('judul', 'Lulus', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nAlhamdulillah, ananda *{nama}* ({no_registrasi}) dinyatakan *LULUS* seleksi SPMB {tahun_ajaran}.\n\nPengumuman lengkap: {tautan_pengumuman}\n\nPanitia SPMB {tahun_ajaran}'),
    'cadangan',        jsonb_build_object('judul', 'Cadangan', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nAnanda *{nama}* ({no_registrasi}) masuk daftar *CADANGAN*. Kami akan menghubungi Bapak/Ibu bila kuota tersedia.\n\nPengumuman: {tautan_pengumuman}\n\nPanitia SPMB {tahun_ajaran}'),
    'tidak_lulus',     jsonb_build_object('judul', 'Tidak Lulus', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nTerima kasih atas kepercayaan Bapak/Ibu. Dengan berat hati kami sampaikan ananda *{nama}* ({no_registrasi}) belum dapat kami terima pada SPMB {tahun_ajaran}. Semoga Allah memberikan yang terbaik.\n\nPanitia SPMB {tahun_ajaran}'),
    'undangan_du',     jsonb_build_object('judul', 'Undangan Daftar Ulang', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nAnanda *{nama}* ({no_registrasi}) dipersilakan melakukan daftar ulang melalui: {tautan_daftar_ulang}\n\nPanitia SPMB {tahun_ajaran}'),
    'du_selesai',      jsonb_build_object('judul', 'Daftar Ulang Selesai', 'isi',
      E'Assalamu''alaikum warahmatullah.\n\nDaftar ulang ananda *{nama}* ({no_registrasi}) telah selesai. Selamat bergabung di {nama_lembaga}.\n\nPanitia SPMB {tahun_ajaran}')
  ),
  'Templat pesan WhatsApp satu klik. Isian otomatis: {nama} {no_registrasi} {jenjang} {gelombang} {catatan} {jadwal_tes} {tautan_status} {tautan_pengumuman} {tautan_daftar_ulang} {nama_lembaga} {tahun_ajaran}',
  false
)
on conflict (kunci) do nothing;

-- Tampilkan bagian Statistik di halaman depan tetap tersembunyi sampai Langkah 6.


-- ---------------------------------------------------------------------
-- Pemindahan isi modul Biaya dan Jadwal lama (Konten Situs) ke data
-- terstruktur. Hanya berjalan sekali: saat tabel tujuan masih kosong.
-- Isi lama TIDAK dihapus, sehingga halaman depan tetap tampil sampai
-- berkas situs Langkah 2 dipasang.
-- ---------------------------------------------------------------------
do $$
declare
  r record; gid bigint; judul text; urut int := 0;
  mulai timestamptz; selesai timestamptz;
begin
  -- Biaya
  if not exists (select 1 from public.rincian_biaya) then
    insert into public.rincian_biaya (komponen, tahap, jenjang, bagian, nominal, wajib, keterangan, urutan, tampil)
    select left(k.judul, 80),
           case k.data ->> 'tahap' when 'Daftar ulang' then 'daftar_ulang' when 'Bulanan' then 'bulanan'
                when 'Tahunan' then 'tahunan' when 'Lainnya' then 'lainnya' else 'pendaftaran' end,
           case k.data ->> 'jenjang' when 'SMP' then 'SMP' when 'SMA' then 'SMA' else 'semua' end,
           case k.data ->> 'bagian' when 'Putra' then 'putra' when 'Putri' then 'putri' else 'semua' end,
           greatest(0, coalesce(nullif(regexp_replace(k.data ->> 'nominal', '[^0-9]', '', 'g'), '')::bigint, 0)),
           coalesce((k.data ->> 'wajib')::boolean, true), coalesce(k.isi, ''), k.urutan, k.tampil
    from public.konten_situs k
    where k.jenis = 'biaya' and k.diarsipkan_pada is null and length(trim(k.judul)) >= 2
    order by k.urutan, k.id;
  end if;

  -- Jadwal: satu gelombang untuk setiap nama gelombang; kegiatan dipetakan
  -- ke jadwal baku bila judulnya dikenali, sisanya menjadi kegiatan tambahan
  if not exists (select 1 from public.gelombang) then
    for r in
      select coalesce(nullif(trim(k.data ->> 'gelombang'), ''), 'Gelombang 1') as nama, min(k.urutan) as u
      from public.konten_situs k where k.jenis = 'jadwal' and k.diarsipkan_pada is null
      group by 1 order by 2, 1
    loop
      urut := urut + 1;
      insert into public.gelombang (nama, urutan) values (left(r.nama, 60), urut) returning id into gid;

      for judul, mulai, selesai in
        select k.judul,
               ((k.data ->> 'mulai')::date)::timestamp at time zone 'Asia/Makassar',
               (coalesce(nullif(k.data ->> 'selesai', ''), k.data ->> 'mulai')::date + 1)::timestamp at time zone 'Asia/Makassar' - interval '1 second'
        from public.konten_situs k
        where k.jenis = 'jadwal' and k.diarsipkan_pada is null
          and coalesce(nullif(trim(k.data ->> 'gelombang'), ''), 'Gelombang 1') = r.nama
          and coalesce(k.data ->> 'mulai', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        order by k.data ->> 'mulai', k.urutan
      loop
        if lower(judul) ~ 'daftar ulang|daftar-ulang|registrasi ulang|her-registrasi' then
          update public.gelombang set daftar_ulang_mulai = coalesce(daftar_ulang_mulai, (mulai at time zone 'Asia/Makassar')::date),
                 daftar_ulang_selesai = coalesce(daftar_ulang_selesai, (selesai at time zone 'Asia/Makassar')::date) where id = gid
             and daftar_ulang_mulai is null;
          if not found then
            update public.gelombang set kegiatan = kegiatan || jsonb_build_array(jsonb_build_object('judul', judul,
              'mulai', (mulai at time zone 'Asia/Makassar')::date, 'selesai', (selesai at time zone 'Asia/Makassar')::date, 'keterangan', '')) where id = gid;
          end if;
        elsif lower(judul) ~ 'pengumuman' then
          update public.gelombang set pengumuman = mulai + interval '8 hours' where id = gid and pengumuman is null;
          if not found then
            update public.gelombang set kegiatan = kegiatan || jsonb_build_array(jsonb_build_object('judul', judul,
              'mulai', (mulai at time zone 'Asia/Makassar')::date, 'selesai', (selesai at time zone 'Asia/Makassar')::date, 'keterangan', '')) where id = gid;
          end if;
        elsif lower(judul) ~ '(^|[^a-z])tes|seleksi|ujian' then
          update public.gelombang set tes_mulai = (mulai at time zone 'Asia/Makassar')::date,
                 tes_selesai = (selesai at time zone 'Asia/Makassar')::date where id = gid and tes_mulai is null;
          if not found then
            update public.gelombang set kegiatan = kegiatan || jsonb_build_array(jsonb_build_object('judul', judul,
              'mulai', (mulai at time zone 'Asia/Makassar')::date, 'selesai', (selesai at time zone 'Asia/Makassar')::date, 'keterangan', '')) where id = gid;
          end if;
        elsif lower(judul) ~ 'daftar|pendaftaran' then
          update public.gelombang set buka = mulai, tutup = selesai where id = gid and buka is null;
          if not found then
            update public.gelombang set kegiatan = kegiatan || jsonb_build_array(jsonb_build_object('judul', judul,
              'mulai', (mulai at time zone 'Asia/Makassar')::date, 'selesai', (selesai at time zone 'Asia/Makassar')::date, 'keterangan', '')) where id = gid;
          end if;
        else
          update public.gelombang set kegiatan = kegiatan || jsonb_build_array(jsonb_build_object('judul', judul,
            'mulai', (mulai at time zone 'Asia/Makassar')::date, 'selesai', (selesai at time zone 'Asia/Makassar')::date, 'keterangan', '')) where id = gid;
        end if;
      end loop;

      -- kuota awal kosong (tanpa batas) untuk keempat kombinasi, diisi Superadmin kemudian
      insert into public.kuota (gelombang_id, jenjang, bagian)
      select gid, j, b from (values ('SMP'), ('SMA')) jj(j) cross join (values ('putra'), ('putri')) bb(b)
      on conflict do nothing;
    end loop;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Ringkasan hasil (tampil di bawah editor SQL)
-- ---------------------------------------------------------------------
select
  (select count(*) from public.gelombang)     as gelombang,
  (select count(*) from public.kuota)         as baris_kuota,
  (select count(*) from public.rincian_biaya) as komponen_biaya,
  (select count(*) from public.rekening)      as rekening,
  (select count(*) from public.pendaftar)     as pendaftar,
  (select nilai ->> 'format_nomor' from public.pengaturan where kunci = 'spmb') as format_nomor;
