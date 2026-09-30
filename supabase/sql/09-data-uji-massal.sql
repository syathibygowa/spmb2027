-- =====================================================================
--  SPMB 2027/2028 - Pondok Pesantren Tahfizhul Qur'an
--  Imam Asy-Syathiby Wahdah Islamiyah Gowa
--
--  Berkas 09: Data uji massal (Fase 3 - Langkah 7)
--  Isi: isi_data_uji(jumlah) untuk Superadmin: membuat pendaftar fiktif
--       bernomor UJI- (tanpa berkas) dengan jenjang, putra/putri, asal
--       daerah, usia, dan status verifikasi yang beragam, tersebar dalam
--       14 hari terakhir. Dipakai untuk latihan Admin dan menguji
--       statistik, saringan, cetak, dan ekspor.
--       Data uji tidak dihitung dalam kuota/statistik publik dan dapat
--       dihapus sekaligus dengan tombol "Hapus data uji".
--
--  Prasyarat: berkas 04 sampai 08 sudah dijalankan.
--  Cara pakai: Supabase > SQL Editor > New query > tempel > Run.
--  Aman bila tidak sengaja dijalankan dua kali.
-- =====================================================================

create or replace function public.isi_data_uji(p_jumlah integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg     jsonb := coalesce((select nilai from public.pengaturan where kunci = 'spmb'), '{}');
  acuan   date := coalesce((cfg #>> '{usia,acuan}')::date, date '2027-07-01');
  g       public.gelombang;
  putra   text[] := array['Muhammad Fathir', 'Ahmad Zaki', 'Umar Faruq', 'Ali Akbar', 'Yusuf Mansur', 'Bilal Ramadhan', 'Abdullah Faqih', 'Salman Alfarisi',
                          'Ismail Hakim', 'Ibrahim Khalil', 'Hamzah Fauzan', 'Utsman Hadi', 'Zaid Haritsah', 'Anas Malik', 'Hasan Basri', 'Muadz Jabal'];
  putri   text[] := array['Aisyah Humaira', 'Fatimah Azzahra', 'Khadijah Nur', 'Zainab Salsabila', 'Maryam Qonita', 'Hafshah Aulia', 'Ruqayyah Syifa', 'Sumayyah Hana',
                          'Nafisah Rahma', 'Asma Nabila', 'Safiyyah Zahra', 'Ummu Kultsum', 'Juwairiyah Putri', 'Saudah Amira', 'Rufaidah Insani', 'Hamnah Salma'];
  marga   text[] := array['Syamsuddin', 'Rahman', 'Nur', 'Hidayat', 'Amiruddin', 'Kadir', 'Saputra', 'Ramli', 'Hasanuddin', 'Latif', 'Anwar', 'Yusuf'];
  daerah  text[][] := array[['Sulawesi Selatan', 'Kab. Gowa', '7306'], ['Sulawesi Selatan', 'Kota Makassar', '7371'], ['Sulawesi Selatan', 'Kab. Takalar', '7305'],
                            ['Sulawesi Selatan', 'Kab. Maros', '7309'], ['Sulawesi Selatan', 'Kab. Bone', '7308'], ['Sulawesi Selatan', 'Kab. Bulukumba', '7302'],
                            ['Sulawesi Tenggara', 'Kota Kendari', '7471'], ['Sulawesi Barat', 'Kab. Polewali Mandar', '7604'],
                            ['Kalimantan Timur', 'Kota Balikpapan', '6471'], ['Papua Barat Daya', 'Kota Sorong', '9271']];
  sumber  text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(cfg -> 'sumber_info') x), array['Media sosial', 'Alumni atau santri']);
  kerja   text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(cfg -> 'pekerjaan') x), array['Wiraswasta/Pedagang']);
  i int; k int; j text; b text; nm text; lahir date; hari int; nik text; nisn text; st int; no text; dibuat timestamptz; sb text[];
  dibuat_n int := 0;
begin
  if not public.is_superadmin() then raise exception 'Hanya Superadmin yang dapat membuat data uji massal.'; end if;
  if p_jumlah is null or p_jumlah < 1 or p_jumlah > 200 then raise exception 'Jumlah data uji 1 sampai 200.'; end if;
  select * into g from public.gelombang where diarsipkan_pada is null
   order by (coalesce(buka, dibuat_pada) <= now()) desc, coalesce(buka, dibuat_pada) desc limit 1;
  if g.id is null then raise exception 'Belum ada gelombang. Buat gelombang dulu di Pengaturan SPMB.'; end if;

  for i in 1 .. p_jumlah loop
    j := case when random() < 0.62 then 'SMP' else 'SMA' end;
    b := case when random() < 0.52 then 'putra' else 'putri' end;
    nm := (case when b = 'putra' then putra[1 + floor(random() * array_length(putra, 1))::int] else putri[1 + floor(random() * array_length(putri, 1))::int] end)
          || ' ' || marga[1 + floor(random() * array_length(marga, 1))::int];
    k := 1 + floor(random() * array_length(daerah, 1))::int;
    lahir := acuan - ((case when j = 'SMP' then 12 else 15 end) * 365 + floor(random() * 700)::int);
    hari := extract(day from lahir)::int + case when b = 'putri' then 40 else 0 end;
    dibuat := now() - (floor(random() * 14) || ' days')::interval - (floor(random() * 600) || ' minutes')::interval;
    st := i % 6;
    sb := array[sumber[1 + floor(random() * array_length(sumber, 1))::int]];
    if random() < 0.4 then sb := array(select distinct unnest(sb || sumber[1 + floor(random() * array_length(sumber, 1))::int])); end if;
    begin
      nisn := '9' || lpad(floor(random() * 1e9)::bigint::text, 9, '0');
      nik := daerah[k][3] || lpad((1 + floor(random() * 12))::int::text, 2, '0') || lpad(hari::text, 2, '0') || to_char(lahir, 'MMYY') || lpad((1 + floor(random() * 9999))::int::text, 4, '0');
      no := public.buat_no_registrasi(j, b, true);
      insert into public.pendaftar (
        no_registrasi, gelombang_id, jenjang, bagian, status, verif_berkas, catatan_berkas, verif_bayar,
        nama_lengkap, nisn, nik, tempat_lahir, tanggal_lahir, asal_provinsi, asal_kabupaten, alamat_jalan, rt, rw,
        desa, kecamatan, kabupaten, provinsi, kode_pos, asal_sekolah, nama_ayah, pekerjaan_ayah, nama_ibu, pekerjaan_ibu,
        email, no_wa, darurat_nama, darurat_hubungan, darurat_no, pernah_mondok, hafalan_juz, hafalan_surah,
        sumber_info, sumber_info_daftar, uji, didaftarkan_oleh, dibuat_pada, diperbarui_pada)
      values (
        no, g.id, j, b,
        case st when 2 then 'berkas_kurang' when 3 then 'berkas_diverifikasi' when 4 then 'pembayaran_dikonfirmasi' else 'terdaftar' end,
        case st when 2 then 'perbaikan' when 3 then 'diterima' when 4 then 'diterima' else 'menunggu' end,
        case st when 2 then '- Foto Kartu Keluarga kurang jelas' else '' end,
        case st when 4 then 'diterima' else 'menunggu' end,
        nm, nisn, nik, daerah[k][2], lahir, daerah[k][1], daerah[k][2], 'Jl. Contoh No. ' || i, lpad((1 + floor(random() * 9))::int::text, 3, '0'), '001',
        'Desa Contoh', 'Kecamatan Contoh', daerah[k][2], daerah[k][1], '9' || lpad(floor(random() * 9999)::int::text, 4, '0'),
        case when j = 'SMP' then 'SD Negeri ' else 'SMP Negeri ' end || (1 + floor(random() * 30))::int || ' ' || replace(replace(daerah[k][2], 'Kab. ', ''), 'Kota ', ''),
        'Bapak ' || marga[1 + floor(random() * array_length(marga, 1))::int], kerja[1 + floor(random() * array_length(kerja, 1))::int],
        'Ibu ' || putri[1 + floor(random() * array_length(putri, 1))::int], kerja[1 + floor(random() * array_length(kerja, 1))::int],
        'wali.uji' || i || '@contoh.id', '62812' || lpad(floor(random() * 1e8)::bigint::text, 8, '0'), 'Kerabat Uji', 'Paman', '62852' || lpad(floor(random() * 1e8)::bigint::text, 8, '0'),
        random() < 0.2, case when random() < 0.5 then round((1 + random() * 8)::numeric * 2) / 2 else 0 end, case when random() < 0.5 then 0 else (5 + floor(random() * 30))::int end,
        array_to_string(sb, '; '), sb, true, auth.uid(), dibuat, dibuat);
      dibuat_n := dibuat_n + 1;
    exception when unique_violation then
      null;   -- NISN/NIK acak kebetulan sama: lewati satu data
    end;
  end loop;

  perform public.catat_log('isi_data_uji', 'pendaftar', null, jsonb_build_object('jumlah', dibuat_n, 'gelombang', g.nama));
  return jsonb_build_object('ok', true, 'jumlah', dibuat_n, 'gelombang', g.nama);
end; $$;

revoke execute on function public.isi_data_uji(integer) from public, anon;
grant execute on function public.isi_data_uji(integer) to authenticated;

-- ---------------------------------------------------------------------
-- Selesai. Bila berhasil, Supabase menampilkan
-- "Success. No rows returned".
-- ---------------------------------------------------------------------
