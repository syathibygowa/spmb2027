-- =====================================================================
-- SPMB · SQL 17 · SIMULASI PANITIA DAN WHATSAPP LANJUTAN (Fase 5)
-- Jalankan sesudah 16-unduhan.sql. Aman dijalankan dua kali.
--
-- A. Grup WhatsApp per sesi tes (kolom sesi_tes.grup_wa)
-- B. Pengaturan 'wa_info': grup WhatsApp umum dan data pertemuan wali
-- C. Templat WhatsApp baru: tagihan, undangan pertemuan, undangan grup
-- D. isi_data_simulasi(): data uji satu rombel (32 santri) dan 6 akun
--    penguji yang DAPAT MASUK (kata sandi dibuat otomatis), mencakup
--    verifikasi, sesi tes, nilai, keputusan, pengumuman, daftar ulang,
--    keringanan, dan pembayaran. Menggantikan isi_data_uji_lengkap().
-- E. Data uji tetap dihapus dengan hapus_data_uji() (SQL 15).
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. GRUP WHATSAPP PER SESI TES
-- ---------------------------------------------------------------------
alter table public.sesi_tes add column if not exists grup_wa text not null default '';
comment on column public.sesi_tes.grup_wa is 'Tautan undangan grup WhatsApp peserta sesi ini (misalnya https://chat.whatsapp.com/...)';
do $$ begin
  alter table public.sesi_tes add constraint sesi_tes_grup_wa_pola check (grup_wa = '' or grup_wa ~ '^https://\S+$');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- B. PENGATURAN GRUP UMUM DAN PERTEMUAN
-- ---------------------------------------------------------------------
insert into public.pengaturan (kunci, nilai, keterangan, publik) values (
  'wa_info',
  jsonb_build_object(
    'grup', '[]'::jsonb,   -- [{nama, tautan, jenjang: semua|SMP|SMA, bagian: semua|putra|putri, status: semua|pendaftar|lulus|santri_baru}]
    'pertemuan', jsonb_build_object('judul', 'Pertemuan Wali Calon Santri', 'tanggal', null, 'jam', '', 'mode', 'offline', 'tempat', '', 'tautan', '', 'keterangan', '')),
  'Grup WhatsApp umum (dikirim lewat templat undangan grup) dan data pertemuan wali',
  false
) on conflict (kunci) do nothing;

-- ---------------------------------------------------------------------
-- C. TEMPLAT WHATSAPP BARU (hanya ditambahkan bila belum ada)
-- ---------------------------------------------------------------------
update public.pengaturan set nilai = jsonb_build_object(
  'tagihan', jsonb_build_object('judul', 'Tagihan pembayaran', 'isi',
    E'Assalamu''alaikum warahmatullah.\n\nBapak/Ibu wali ananda *{nama}* ({no_registrasi}), berikut tagihan SPMB {tahun_ajaran} yang belum lunas:\n\n{rincian_tagihan}\n\n*Total sisa: {sisa_tagihan}*\n\nPembayaran dapat ditransfer ke:\n{rekening}\n\nMohon kirim bukti transfer melalui WhatsApp ini. Abaikan pesan ini bila sudah membayar.\n\nJazakumullahu khairan.\nPanitia SPMB {tahun_ajaran}'),
  'undangan_pertemuan', jsonb_build_object('judul', 'Undangan pertemuan', 'isi',
    E'Assalamu''alaikum warahmatullah.\n\nDengan hormat, kami mengundang Bapak/Ibu wali ananda *{nama}* ({jenjang}) untuk menghadiri *{judul_pertemuan}*.\n\nHari/tanggal: {jadwal_pertemuan}\nTempat: {tempat_pertemuan}\n{tautan_pertemuan}\n\n{keterangan_pertemuan}\n\nKehadiran Bapak/Ibu sangat kami harapkan.\nPanitia SPMB {tahun_ajaran}'),
  'undangan_grup', jsonb_build_object('judul', 'Undangan grup WhatsApp', 'isi',
    E'Assalamu''alaikum warahmatullah.\n\nBapak/Ibu wali ananda *{nama}* ({no_registrasi}), mohon bergabung ke grup WhatsApp berikut agar tidak tertinggal informasi:\n\n{grup_wa}\n\nSetiap grup memiliki informasi yang berbeda; mohon masuk ke semua grup di atas.\n\nPanitia SPMB {tahun_ajaran}')
) || nilai
 where kunci = 'templat_wa';


-- ---------------------------------------------------------------------
-- D. DATA SIMULASI
-- ---------------------------------------------------------------------
drop function if exists public.isi_data_uji_lengkap();

create or replace function public.isi_data_simulasi(p_santri int default 32, p_penguji int default 6)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  hari date := public.hari_ini_wita();
  ta   text := public.ta_aktif();
  thn  int  := public.tahun_awal_ta();
  n    int  := least(greatest(coalesce(p_santri, 32), 8), 120);
  np   int  := least(greatest(coalesce(p_penguji, 6), 2), 12);
  gpj  int;                                  -- penguji per kelompok (putra / putri)
  gel  public.gelombang;
  bid  text[] := public.bidang_daftar();
  sandi text := 'Simulasi' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  pj   uuid[] := '{}'; pjn text[] := '{}'; pjb jsonb := '[]';
  pid  uuid; ids uuid[] := '{}'; dasar int[] := '{}';
  sesi bigint[] := '{}';                     -- [SMP putra, SMP putri, SMA putra, SMA putri]
  r record; b text; i int; j int; k int; v numeric; idx int; nsmp int;
  tok uuid; t jsonb; komp bigint; lulus uuid[]; nl int;
  penguji_masuk boolean := true; catatan text := '';
  nm text; jj text; bg text; lahir date; v_nisn text; v_nik text; v_no text; kel int; bidang_saya text[];
  putra constant text[] := array['Muhammad Fathir','Ahmad Zaki','Umar Faruq','Bilal Ramadhan','Yusuf Mansur','Abdullah Hafizh','Ali Akbar','Hamzah Fadhil','Ibrahim Khalil','Ismail Hanif',
    'Khalid Walid','Salman Alfarisi','Zaid Haritsah','Usman Affan','Hasan Basri','Husain Nabil','Rayyan Azzam','Naufal Aqil','Fikri Haikal','Daffa Rasyid'];
  putri constant text[] := array['Aisyah Humaira','Fatimah Azzahra','Khadijah Nur','Maryam Qonita','Zainab Salsabila','Hafshah Nabila','Ummu Kultsum','Ruqayyah Hasna','Safiyyah Aulia','Sumayyah Husna',
    'Asma Kamila','Nusaibah Rahma','Hana Syakira','Alya Zahirah','Najwa Shafira','Raihana Putri','Afifah Zahra','Nadhira Ilmi','Qanita Ayu','Shalihah Mutia'];
  ayah constant text[] := array['Syamsuddin','Abdul Rahman','Hidayatullah','Muhammad Nur','Abdul Kadir','Abdul Latif','Amiruddin','Khairul Anwar','Ramli','Muhammad Yusuf',
    'Baharuddin','Jamaluddin','Kamaruddin','Saifullah','Nasruddin','Mursalim','Hasanuddin','Ridwan','Arifin','Syahrir'];
  ibu constant text[] := array['Nurhayati','Rosmiati','Hasnah','Nurjannah','Sitti Aminah','Hadijah','Ramlah','Suriani','Megawati','Rahmawati',
    'Sitti Hawa','Nurlaela','Haslinda','Jumriani','Kasmawati','Rukmini','Darmawati','Nurmiati','Hamsiah','Asmawati'];
  daerah constant text[][] := array[['Sulawesi Selatan','Kab. Gowa','7306'],['Sulawesi Selatan','Kota Makassar','7371'],['Sulawesi Selatan','Kab. Takalar','7305'],
    ['Sulawesi Selatan','Kab. Maros','7309'],['Sulawesi Selatan','Kab. Bone','7308'],['Sulawesi Tenggara','Kota Kendari','7471'],['Sulawesi Barat','Kab. Polewali Mandar','7604'],
    ['Sulawesi Selatan','Kab. Bulukumba','7302'],['Kalimantan Timur','Kota Balikpapan','6471'],['Sulawesi Selatan','Kab. Sinjai','7307'],
    ['Sulawesi Selatan','Kab. Jeneponto','7304'],['Sulawesi Tengah','Kota Palu','7271']];
  sumber constant text[] := array['Media sosial','Alumni','Keluarga/kerabat','Brosur','Situs web','Kegiatan dakwah'];
  nama_pj constant text[] := array['[UJI] Ust. Abdurrahman Hafizh','[UJI] Ust. Muhammad Ilham','[UJI] Ust. Fadhlan Syakir','[UJI] Ust. Rasyid Ridha','[UJI] Ust. Anas Malik','[UJI] Ust. Harun Arrasyid',
    '[UJI] Ustzh. Nur Aini','[UJI] Ustzh. Hafshah Ramadhani','[UJI] Ustzh. Ummu Salamah','[UJI] Ustzh. Zahra Amalia','[UJI] Ustzh. Hilyah Sakinah','[UJI] Ustzh. Faizah Nuraini'];
begin
  if not public.is_superadmin() then raise exception 'Hanya Superadmin yang dapat membuat data simulasi.'; end if;
  if exists (select 1 from public.gelombang where uji) then
    raise exception 'Data simulasi sudah ada. Hapus data uji dulu (Pengaturan > Integrasi) bila ingin membuat ulang.';
  end if;
  if cardinality(bid) = 0 then raise exception 'Bidang tes belum diatur (Seleksi > Bidang dan Bobot).'; end if;
  gpj := greatest(1, np / 2);
  nsmp := round(n * 0.625);

  -- 1. Gelombang simulasi (tidak tampil di situs)
  insert into public.gelombang (nama, buka, tutup, tes_mulai, tes_selesai, pengumuman, daftar_ulang_mulai, daftar_ulang_selesai,
                                keterangan, formulir_dibuka, urutan, tampil, uji, tahun_ajaran)
  values ('Gelombang Simulasi', now() - interval '30 days', now() - interval '12 days', hari - 8, hari - 7,
          now() - interval '1 day', hari - 1, hari + 14,
          'Gelombang khusus simulasi panitia. Tidak tampil di situs dan ikut terhapus saat data uji dihapus.', false, 99, false, true, ta)
  returning * into gel;
  insert into public.kuota (gelombang_id, jenjang, bagian, jumlah) values
    (gel.id, 'SMP', 'putra', greatest(1, floor(ceil(nsmp / 2.0) * 0.75)::int)), (gel.id, 'SMP', 'putri', greatest(1, floor((nsmp / 2) * 0.75)::int)),
    (gel.id, 'SMA', 'putra', greatest(1, floor(ceil((n - nsmp) / 2.0) * 0.75)::int)), (gel.id, 'SMA', 'putri', greatest(1, floor(((n - nsmp) / 2) * 0.75)::int));

  -- 2. Biaya simulasi (hanya untuk tahap yang belum memiliki biaya umum)
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

  -- 3. Akun penguji simulasi: separuh ustadz (sesi putra), separuh ustadzah (sesi putri); dapat masuk dengan kata sandi bersama
  begin
    for i in 1 .. np loop
      kel := case when i <= gpj then 0 else 1 end;          -- 0 putra, 1 putri
      j := case when kel = 0 then i else i - gpj end;        -- urutan di kelompok
      select coalesce(array_agg(bid[x] order by x), '{}') into bidang_saya from generate_series(1, cardinality(bid)) x where (x - 1) % gpj = j - 1;
      if cardinality(bidang_saya) = 0 then bidang_saya := bid[1:1]; end if;
      pid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                              created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', pid, 'authenticated', 'authenticated', 'penguji.uji' || i || '@contoh.id',
              crypt(sandi, gen_salt('bf')), now(),
              jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'uji', true, 'peran', 'penguji', 'aktif', true,
                'nama_lengkap', nama_pj[case when kel = 0 then j else 6 + j end], 'bidang_penguji', to_jsonb(bidang_saya),
                'bagian', case when kel = 0 then 'putra' else 'putri' end), '{}'::jsonb, now(), now(), '', '', '', '');
      begin   -- identitas login email (dibutuhkan Supabase Auth versi baru)
        execute 'insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
                 values (gen_random_uuid(), $1::text, $1, jsonb_build_object(''sub'', $1::text, ''email'', $2, ''email_verified'', true), ''email'', now(), now(), now())'
          using pid, 'penguji.uji' || i || '@contoh.id';
      exception when others then null;
      end;
      pj := pj || pid; pjn := pjn || nama_pj[case when kel = 0 then j else 6 + j end];
      pjb := pjb || jsonb_build_object('nama', nama_pj[case when kel = 0 then j else 6 + j end], 'email', 'penguji.uji' || i || '@contoh.id',
                                        'bidang', to_jsonb(bidang_saya), 'bagian', case when kel = 0 then 'putra' else 'putri' end);
    end loop;
  exception when others then
    penguji_masuk := false; pj := array_fill(auth.uid(), array[np]); pjn := array_fill(public.nama_saya(), array[np]); pjb := '[]';
    catatan := 'Akun penguji simulasi tidak dapat dibuat di proyek ini (' || sqlerrm || '); Anda sendiri dicatat sebagai penguji.';
  end;

  -- 4. Calon santri: 62,5% SMP, sisanya SMA; putra dan putri bergantian
  for i in 1 .. n loop
    jj := case when i <= nsmp then 'SMP' else 'SMA' end;
    bg := case when (case when jj = 'SMP' then i else i - nsmp end) % 2 = 1 then 'putra' else 'putri' end;
    k  := 1 + (i - 1) % 20;
    nm := case when bg = 'putra' then putra[1 + (i * 7) % 20] else putri[1 + (i * 11) % 20] end || ' ' || split_part(ayah[k], ' ', array_length(string_to_array(ayah[k], ' '), 1));
    lahir := make_date(thn - case when jj = 'SMP' then 12 else 15 end, 1 + (i * 5) % 12, 1 + (i * 7) % 27);
    v_nisn := '99' || lpad((thn % 100)::text, 2, '0') || lpad((i * 731 + 1234)::text, 6, '0');
    kel := 1 + (i - 1) % 12;
    v_nik := daerah[kel][3] || lpad((1 + i % 9)::text, 2, '0') || lpad((extract(day from lahir)::int + case when bg = 'putri' then 40 else 0 end)::text, 2, '0')
           || to_char(lahir, 'MMYY') || lpad((9000 + i)::text, 4, '0');
    v_no := public.buat_no_registrasi(jj, bg, true);
    insert into public.pendaftar (no_registrasi, gelombang_id, jenjang, bagian, nama_lengkap, nisn, nik, tempat_lahir, tanggal_lahir,
      asal_provinsi, asal_kabupaten, alamat_jalan, rt, rw, dusun, desa, kecamatan, kabupaten, provinsi, kode_pos, asal_sekolah,
      nama_ayah, pekerjaan_ayah, nama_ibu, pekerjaan_ibu, email, no_wa, darurat_nama, darurat_hubungan, darurat_no,
      pernah_mondok, hafalan_juz, hafalan_surah, sumber_info, sumber_info_daftar, uji, didaftarkan_oleh, dibuat_pada, tahun_ajaran)
    values (v_no, gel.id, jj, bg, nm, v_nisn, v_nik, replace(replace(daerah[kel][2], 'Kab. ', ''), 'Kota ', ''), lahir,
      daerah[kel][1], daerah[kel][2], 'Jl. Simulasi No. ' || i, lpad((1 + i % 9)::text, 3, '0'), '002', 'Dusun Contoh', 'Desa Contoh', 'Kecamatan Contoh',
      daerah[kel][2], daerah[kel][1], '9' || lpad((1000 + i * 37)::text, 4, '0'),
      case when jj = 'SMP' then 'SD Negeri ' || i || ' ' else 'SMP Negeri ' || i || ' ' end || replace(replace(daerah[kel][2], 'Kab. ', ''), 'Kota ', ''),
      ayah[k], (array['Wiraswasta/Pedagang','PNS/ASN','Petani/Pekebun','Karyawan swasta','Guru/Dosen'])[1 + i % 5], ibu[k], 'Mengurus rumah tangga',
      'wali.uji' || i || '@contoh.id', '6281200000' || lpad(i::text, 3, '0'),
      'Kerabat ' || ayah[k], 'Paman', '6285200000' || lpad(i::text, 3, '0'),
      i % 4 = 0, (i % 6)::numeric, 10 + i % 25, sumber[1 + i % 6], array[sumber[1 + i % 6]], true, auth.uid(),
      now() - make_interval(days => 29 - (i * 28 / n)), ta)
    returning id into pid;
    ids := ids || pid;
    dasar := dasar || (62 + (i * 37) % 36);
  end loop;

  -- 5. Verifikasi: n-5 lolos; 1 bayar menunggu; 2 berkas kurang; 2 belum diperiksa
  update public.pendaftar set verif_berkas = 'diterima', verif_bayar = 'diterima' where id = any (ids[1:n - 5]);
  update public.pendaftar set verif_berkas = 'diterima' where id = ids[n - 4];
  update public.pendaftar set verif_berkas = 'perbaikan', catatan_berkas = '- Foto Kartu Keluarga buram, mohon unggah ulang (simulasi)' where id = any (array[ids[n - 3], ids[n - 2]]);

  -- 6. Empat sesi tes (SMP putra/putri offline, SMA putra/putri online), masing-masing dengan grup WhatsApp
  for kel in 0 .. 3 loop
    jj := case when kel < 2 then 'SMP' else 'SMA' end; bg := case when kel % 2 = 0 then 'putra' else 'putri' end;
    insert into public.sesi_tes (gelombang_id, nama, bidang, tanggal, jam_mulai, jam_selesai, mode, tempat, tautan, jenjang, bagian, catatan, grup_wa)
    values (gel.id, 'Sesi ' || jj || ' ' || initcap(bg) || ' (simulasi)', bid, hari - case when kel < 2 then 8 else 7 end,
            case when kel % 2 = 0 then time '08:00' else time '13:00' end, case when kel % 2 = 0 then time '11:30' else time '16:00' end,
            case when kel < 2 then 'offline' else 'online' end,
            case when kel < 2 then 'Aula ' || initcap(bg) || ' (simulasi)' when kel = 2 then 'Zoom' else 'Google Meet' end,
            case when kel = 2 then 'https://zoom.us/j/0000000000' when kel = 3 then 'https://meet.google.com/abc-defg-hij' else '' end,
            jj, bg, 'Data simulasi', 'https://chat.whatsapp.com/SIMULASI' || upper(jj) || upper(left(bg, 2)))
    returning id into komp;
    sesi := sesi || komp;
    -- penguji: kelompok putra untuk sesi putra, kelompok putri untuk sesi putri
    for idx in 1 .. cardinality(bid) loop
      j := ((idx - 1) % gpj) + 1 + case when bg = 'putri' and np > gpj then gpj else 0 end;
      insert into public.penguji_sesi (sesi_id, pengguna_id, bidang) values (komp, pj[least(j, np)], bid[idx]) on conflict do nothing;
    end loop;
  end loop;
  for i in 1 .. n - 5 loop
    select * into r from public.pendaftar where id = ids[i];
    insert into public.peserta_sesi (sesi_id, pendaftar_id, hadir)
    values (sesi[case when r.jenjang = 'SMP' then 1 else 3 end + case when r.bagian = 'putri' then 1 else 0 end], r.id, true);
  end loop;

  -- 7. Nilai (diisi penguji, divalidasi Superadmin); santri ke-(n-5) masih punya satu nilai menunggu validasi
  for i in 1 .. n - 5 loop
    select * into r from public.pendaftar where id = ids[i];
    idx := 0;
    foreach b in array public.bidang_wajib(r.jenjang) loop
      idx := idx + 1;
      v := least(100, greatest(0, dasar[i] + case idx % 3 when 1 then 4 when 2 then -3 else -1 end));
      j := ((array_position(bid, b) - 1) % gpj) + 1 + case when r.bagian = 'putri' and np > gpj then gpj else 0 end;
      insert into public.nilai_tes (pendaftar_id, bidang, nilai, hafalan_diuji, catatan, status, diisi_oleh, nama_pengisi, diisi_pada,
                                    divalidasi_oleh, nama_validator, divalidasi_pada)
      values (r.id, b, v, case when b = 'tahfizh' then r.hafalan_juz end, 'Data simulasi',
              case when i = n - 5 and idx = 1 then 'menunggu' else 'disetujui' end,
              pj[least(j, np)], pjn[least(j, np)], now() - interval '6 days',
              case when i = n - 5 and idx = 1 then null else auth.uid() end,
              case when i = n - 5 and idx = 1 then null else public.nama_saya() end,
              case when i = n - 5 and idx = 1 then null else now() - interval '5 days' end);
    end loop;
    perform public.perbarui_status_seleksi(r.id);
  end loop;

  -- 8. Keputusan sesuai peringkat dan kuota, lalu 2 cadangan dengan nilai terendah dinyatakan tidak lulus
  perform public.tetapkan_sesuai_rekomendasi(gel.id, true, null, false);
  perform public.tetapkan_hasil(array(select x.id from public.pendaftar x join unnest(ids, dasar) u(id, d) on u.id = x.id
                                       where x.status = 'cadangan' order by u.d limit 2),
                                'tidak_lulus', 'Nilai belum memenuhi standar (simulasi)');
  perform public.atur_dokumen_hasil(gel.id, jsonb_build_object('nomor_sk', 'UJI/001/SK/SPMB/' || public.angka_romawi(extract(month from hari)::int) || '/' || extract(year from hari),
    'tanggal_sk', hari::text, 'nomor_ba', 'UJI/001/BA/SPMB/' || extract(year from hari), 'tanggal_ba', hari::text, 'tempat_rapat', 'Aula Pondok (simulasi)'));
  perform public.terbitkan_hasil(gel.id, '', hari, true, true);

  -- 9. Keringanan untuk 3 santri lulus pertama
  lulus := array(select id from public.pendaftar where id = any (ids) and status = 'lulus' order by no_registrasi);
  nl := coalesce(cardinality(lulus), 0);
  select id into komp from public.rincian_biaya where tahap = 'daftar_ulang' and (gelombang_id = gel.id or gelombang_id is null)
     and wajib and tampil and diarsipkan_pada is null order by gelombang_id nulls last, urutan limit 1;
  if nl >= 1 and komp is not null then perform public.atur_keringanan(lulus[1], 'daftar_ulang', komp, 'persen', 30, 'hafalan', 'Hafalan 5 juz (simulasi)', null); end if;
  if nl >= 2 then perform public.atur_keringanan(lulus[2], 'daftar_ulang', null, 'nominal', 500000, 'saudara', 'Saudara kandung santri aktif (simulasi)', null); end if;
  if nl >= 3 then perform public.atur_keringanan(lulus[3], 'daftar_ulang', null, 'persen', 50, 'yatim', 'Santri yatim (simulasi)', null); end if;

  -- 10. Daftar ulang: 40% lunas, 15% cicil, 15% menunggu verifikasi, 1 dikembalikan untuk perbaikan, sisanya belum
  for j in 1 .. nl loop
    exit when j > ceil(nl * 0.70) + 1;
    select * into r from public.pendaftar where id = lulus[j];
    insert into public.sesi_du (pendaftar_id, panitia) values (r.id, auth.uid()) returning token into tok;
    t := public.tagihan_santri(r.id, 'daftar_ulang');
    perform public.du_simpan(tok, '{}'::jsonb,
      jsonb_build_object('no_kk', '730601' || lpad((100000 + j)::text, 6, '0') || '0001', 'agama', 'Islam', 'kewarganegaraan', 'Indonesia (WNI)',
        'suku', (array['Makassar','Bugis','Mandar','Toraja','Jawa'])[1 + j % 5], 'anak_ke', 1 + j % 3, 'jumlah_saudara', 2 + j % 3, 'tinggal_bersama', 'Orang tua',
        'transportasi', 'Diantar orang tua (motor/mobil)', 'jarak_km', 5 + j, 'waktu_menit', 15 + j * 3, 'ayah_status', 'Masih hidup',
        'ayah_nik', '73060112' || lpad((700000 + j)::text, 8, '0'), 'ayah_pendidikan', 'SMA/sederajat', 'ayah_penghasilan', 'Rp2.000.000 – Rp4.999.999',
        'ibu_status', 'Masih hidup', 'ibu_nik', '73060152' || lpad((800000 + j)::text, 8, '0'), 'ibu_pendidikan', 'SMA/sederajat', 'ibu_penghasilan', 'Tidak berpenghasilan',
        'ada_wali', 'Tidak', 'tinggi_cm', 140 + j % 20, 'berat_kg', 35 + j % 15, 'golongan_darah', (array['O','A','B','AB'])[1 + j % 4], 'jenis_pendaftaran', 'Siswa baru',
        'tahun_lulus', thn, 'penerima_kip', 'Tidak', 'darurat_alamat', 'Jl. Simulasi No. ' || j || ', ' || r.kabupaten, 'pernyataan', true),
      jsonb_build_object('nominal', (t ->> 'bayar')::bigint, 'tanggal', (hari - 1)::text, 'bank_pengirim', 'BSI', 'nama_pengirim', r.nama_ayah),
      true);
    if j <= ceil(nl * 0.40) then
      perform public.du_verifikasi(r.id, 'terima', 'Lunas (simulasi)', (t ->> 'bayar')::bigint, hari, 'transfer');
      if j % 2 = 1 then   -- separuh yang lunas juga membayar biaya tahunan
        t := public.tagihan_santri(r.id, 'tahunan');
        if (t ->> 'bayar')::bigint > 0 then
          perform public.catat_pembayaran(r.id, 'tahunan', 'Biaya kegiatan tahunan', (t ->> 'bayar')::bigint, hari, case when j % 4 = 1 then 'tunai' else 'transfer' end, null, r.nama_ayah, 'Simulasi');
        end if;
      end if;
    elsif j <= ceil(nl * 0.55) then
      perform public.du_verifikasi(r.id, 'terima', 'Dicicil; sisa Rp1.000.000 dibayar bulan depan (simulasi)', greatest((t ->> 'bayar')::bigint - 1000000, 0), hari, 'transfer');
    elsif j = ceil(nl * 0.70) + 1 then
      perform public.du_verifikasi(r.id, 'perbaikan', 'Foto KTP ayah buram, mohon unggah ulang (simulasi).');
    end if;   -- selebihnya menunggu verifikasi panitia
  end loop;

  perform public.catat_log('isi_data_simulasi', 'gelombang', gel.id::text, jsonb_build_object('santri', n, 'penguji', np, 'penguji_masuk', penguji_masuk));
  return jsonb_build_object('ok', true, 'gelombang', gel.nama, 'gelombang_id', gel.id, 'santri', n, 'penguji', np, 'penguji_masuk', penguji_masuk,
    'kata_sandi', case when penguji_masuk then sandi end, 'catatan', catatan, 'akun_penguji', pjb,
    'akun_wali', (select jsonb_agg(jsonb_build_object('no_registrasi', no_registrasi, 'nama', nama_lengkap, 'jenjang', jenjang, 'bagian', bagian,
                     'nisn', nisn, 'tanggal_lahir', tanggal_lahir, 'status', status) order by jenjang desc, bagian, no_registrasi)
                  from public.pendaftar where id = any (ids)));
end; $$;
revoke all on function public.isi_data_simulasi(int, int) from public, anon;
grant execute on function public.isi_data_simulasi(int, int) to authenticated;

notify pgrst, 'reload schema';
-- Selesai. Bila berhasil, Supabase menampilkan "Success. No rows returned".
