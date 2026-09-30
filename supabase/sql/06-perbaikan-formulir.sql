-- =====================================================================
--  SPMB 2027/2028 - Pondok Pesantren Tahfizhul Qur'an
--  Imam Asy-Syathiby Wahdah Islamiyah Gowa
--
--  Berkas 06: Perbaikan formulir pendaftaran (Fase 3 - Langkah 4)
--  Isi:
--   - NISN dan NIK tidak boleh terdaftar dua kali (kecuali pendaftaran
--     sebelumnya berstatus Dibatalkan oleh panitia)
--   - fungsi cek_terdaftar() untuk pemeriksaan langsung di formulir
--   - sumber informasi dapat dipilih lebih dari satu
--   - hafalan surah pendek (kurang dari 1 juz)
--   - jabatan/kedudukan pemberi rekomendasi
--   - surat rekomendasi wajib bila pemberi rekomendasi diisi;
--     bukti prestasi (digabung satu berkas) wajib bila prestasi diisi
--   - nama kontak darurat wajib berupa huruf
--
--  Prasyarat: berkas 04 dan 05 sudah dijalankan.
--  Cara pakai: Supabase > SQL Editor > New query > tempel > Run.
--  Aman bila tidak sengaja dijalankan dua kali.
-- =====================================================================

-- 1. Kolom baru
alter table public.pendaftar add column if not exists sumber_info_daftar text[] not null default '{}';
alter table public.pendaftar add column if not exists perekomendasi_peran text not null default '';
alter table public.pendaftar add column if not exists hafalan_surah smallint not null default 0;
do $$ begin
  alter table public.pendaftar add constraint pendaftar_hafalan_surah_cek check (hafalan_surah between 0 and 114);
exception when duplicate_object then null; end $$;
alter table public.pendaftar alter column sumber_info type text;   -- tetap teks gabungan untuk tampilan dan ekspor
update public.pendaftar set sumber_info_daftar = array[sumber_info]
 where cardinality(sumber_info_daftar) = 0 and sumber_info <> '';

-- 2. NIK unik (seperti NISN). Bila ternyata sudah ada NIK ganda, indeks
--    tidak dibuat dan muncul pemberitahuan; fungsi pendaftaran tetap menolak NIK ganda.
do $$ begin
  create unique index if not exists pendaftar_nik_unik on public.pendaftar (nik, uji) where status <> 'dibatalkan';
exception when unique_violation then
  raise notice 'Ada NIK ganda di data pendaftar. Batalkan salah satunya, lalu jalankan berkas ini lagi.';
end $$;

-- 3. Pemeriksaan langsung di formulir: hanya menjawab sudah/belum terdaftar,
--    tanpa membuka data siapa pun. Dibatasi 60 pemeriksaan per menit (seluruh situs).
create table if not exists public.cek_terdaftar_log (
  id bigint generated always as identity primary key,
  waktu timestamptz not null default now()
);
alter table public.cek_terdaftar_log enable row level security;

create or replace function public.cek_terdaftar(p_nisn text default null, p_nik text default null, p_uji boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nisn text := regexp_replace(coalesce(p_nisn, ''), '[^0-9]', '', 'g');
  v_nik  text := regexp_replace(coalesce(p_nik, ''), '[^0-9]', '', 'g');
  v_uji  boolean := coalesce(p_uji, false) and public.is_panitia();
begin
  delete from public.cek_terdaftar_log where waktu < now() - interval '10 minutes';
  if (select count(*) from public.cek_terdaftar_log where waktu > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'pesan', 'Pemeriksaan sedang padat. Data tetap diperiksa saat formulir dikirim.');
  end if;
  insert into public.cek_terdaftar_log default values;
  return jsonb_build_object('ok', true,
    'nisn', v_nisn ~ '^[0-9]{10}$' and exists (select 1 from public.pendaftar where nisn = v_nisn and uji = v_uji and status <> 'dibatalkan'),
    'nik',  v_nik ~ '^[0-9]{16}$' and exists (select 1 from public.pendaftar where nik = v_nik and uji = v_uji and status <> 'dibatalkan'));
end; $$;

-- 4. Label berkas bukti prestasi (hanya bila belum diubah Superadmin)
update public.pengaturan
   set nilai = jsonb_set(nilai, '{berkas}', (
         select jsonb_agg(case when b ->> 'kunci' = 'sertifikat' and b ->> 'label' = 'Sertifikat prestasi'
                               then b || '{"label": "Bukti prestasi (semua digabung satu berkas)"}' else b end order by i)
         from jsonb_array_elements(nilai -> 'berkas') with ordinality as x(b, i)))
 where kunci = 'spmb' and nilai -> 'berkas' @> '[{"kunci": "sertifikat", "label": "Sertifikat prestasi"}]';

-- 5. Fungsi pendaftaran dengan aturan baru
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
     where coalesce((b ->> 'wajib')::boolean, false) or (b ->> 'kunci') = any (syarat)
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

-- 6. Statistik: sumber informasi dihitung per pilihan
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
                            from (select nama, count(*) n from p
                                  cross join lateral unnest(case when cardinality(p.sumber_info_daftar) > 0 then p.sumber_info_daftar
                                                                 else array[coalesce(nullif(p.sumber_info, ''), 'Tidak diisi')] end) nama
                                  group by 1) x),
    'kuota',              (select coalesce(jsonb_agg(jsonb_build_object('gelombang', g.nama, 'gelombang_id', g.id, 'jenjang', k.jenjang,
                              'bagian', k.bagian, 'kuota', k.jumlah, 'terisi', public.jumlah_terisi(g.id, k.jenjang, k.bagian))
                              order by g.urutan, g.id, k.jenjang, k.bagian), '[]')
                            from public.kuota k join public.gelombang g on g.id = k.gelombang_id
                            where g.diarsipkan_pada is null and (p_gelombang is null or g.id = p_gelombang)),
    'data_uji',           (select count(*) from public.pendaftar where uji)
  ) into hasil;
  return hasil;
end; $$;

revoke execute on function public.cek_terdaftar(text, text, boolean) from public;
grant execute on function public.cek_terdaftar(text, text, boolean) to anon, authenticated;
grant execute on function public.kirim_pendaftaran(jsonb, uuid) to anon, authenticated;
grant execute on function public.statistik_dashboard(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Selesai. Bila berhasil, Supabase menampilkan
-- "Success. No rows returned".
-- ---------------------------------------------------------------------
