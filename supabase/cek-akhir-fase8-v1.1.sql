-- SIMKA PRO | supabase/cek-akhir-fase8-v1.1.sql | v1.1 | Penutupan Fase 8 – perbaikan: tanpa rujukan tanda tangan fungsi (regprocedure) | 11/10/2026
-- Pemeriksaan akhir Fase 8 (hanya membaca, aman dijalankan kapan saja).
-- Hasil yang benar: baris 1–14 "Sesuai"; baris 15–19 keterangan kesiapan data; baris 20 diagnosis.
-- v1.1: definisi fungsi dibaca menurut nama (bukan daftar parameter), sehingga tidak galat bila parameter di server berbeda.
select 1 as no, 'Migrasi 5800–6600 terpasang (12 fungsi pokok)' as pemeriksaan,
       case when (select count(distinct proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in (
         'akses_luas','profil_tugas_saya','cek_dokumen','boleh_lihat_dokumen','laporan_kehadiran_pegawai','laporan_kehadiran_santri',
         'laporan_security','laporan_libur','laporan_pengajuan','laporan_klinik','ajukan_dokumen_resmi','tandatangani_dokumen')) = 12 then 'Sesuai' else 'Periksa' end as hasil
union all select 2, 'Akses pengasuh: jadwal dan rencana mengajar hanya kelompok sendiri',
       case when (select count(*) from pg_policies where schemaname = 'public' and policyname = 'baca'
                   and tablename in ('teaching_assignments','class_schedules','teaching_plans')) = 3 then 'Sesuai' else 'Periksa' end
union all select 3, 'Kontrol hanya Kepala Bidang ke atas (Kepala Unit tidak menyetujui)',
       case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'calon_penyetuju')
              or not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'profil_tugas_saya') then 'Periksa: fungsi belum ada (jalankan migrasi 5800–5900)'
            when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('calon_penyetuju','profil_tugas_saya')
                          and position('KEPALA_UNIT' in pg_get_functiondef(oid)) > 0) then 'Periksa: jalankan ulang migrasi 5900'
            else 'Sesuai' end
union all select 4, 'Hak pemantauan wakil kepala dan bendahara dicabut',
       case when not exists (select 1 from feature_grants g join structural_positions sp on sp.id = g.sasaran_id
                              where g.sasaran = 'struktural' and sp.kode in ('WAKIL_KEPALA_BIDANG','WAKIL_KEPALA_SEKOLAH','BENDAHARA')
                                and g.feature_kode in ('data_santri','absensi_kelas','absensi_halaqah','absensi_asrama','absensi_ekskul','jadwal_mengajar','pantauan'))
            then 'Sesuai' else 'Periksa' end
union all select 5, 'Registri dokumen ber-RLS dan tidak dapat ditulis langsung',
       case when (select count(*) from pg_tables where schemaname = 'public' and rowsecurity and tablename in ('document_registry','document_signatures')) = 2
             and not exists (select 1 from pg_policies where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
                              and tablename in ('document_registry','document_signatures')) then 'Sesuai' else 'Periksa' end
union all select 6, 'Kebijakan registri tanpa putaran (galat infinite recursion teratasi)',
       case when (select count(*) from pg_policies where tablename in ('document_registry','document_signatures') and qual like '%boleh_lihat_dokumen%') = 2
            then 'Sesuai' else 'Periksa' end
union all select 7, 'Surat pengajuan dan surat sakit otomatis terdaftar',
       case when (select count(*) from pg_trigger where tgname = 'zz_registri') = 2 then 'Sesuai' else 'Periksa' end
union all select 8, 'Semua surat lama terdaftar di registri',
       case when (select count(*) from leave_requests where kode_validasi is not null) + (select count(*) from clinic_letters)
                 <= (select count(*) from document_registry where ref_tabel in ('leave_requests','clinic_letters')) then 'Sesuai' else 'Periksa' end
union all select 9, 'Cek Keabsahan dapat dibuka tanpa masuk (anon)',
       case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'cek_dokumen'
                          and has_function_privilege('anon', oid, 'execute')) then 'Sesuai' else 'Periksa' end
union all select 10, 'Fungsi laporan dan penerbitan tidak dapat dipanggil tanpa masuk',
       case when not exists (select 1 from information_schema.routine_privileges where grantee in ('anon','PUBLIC') and routine_schema = 'public'
         and routine_name in ('laporan_kehadiran_pegawai','laporan_kehadiran_santri','laporan_security','laporan_libur','laporan_pengajuan','laporan_klinik',
                              'ajukan_dokumen_resmi','tandatangani_dokumen','batalkan_dokumen_resmi','cabut_dokumen')) then 'Sesuai' else 'Periksa' end
union all select 11, 'Status Ditolak dan mode tanda tangan elektronik/basah',
       case when exists (select 1 from pg_constraint where conname = 'document_registry_status_check' and pg_get_constraintdef(oid) like '%ditolak%')
             and exists (select 1 from pg_constraint where conname = 'document_registry_mode_ttd_check') then 'Sesuai' else 'Periksa' end
union all select 12, 'Salinan beku laporan resmi (kolom isi dan kunci)',
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'document_registry'
                   and column_name in ('isi','kunci','tautan','mode_ttd','diajukan_pada','catatan')) = 6 then 'Sesuai' else 'Periksa' end
union all select 13, 'Notifikasi pengumuman tanpa tanda tebal/miring',
       case when exists (select 1 from pg_trigger where tgname = 'aa_teks_polos')
             and public._teks_polos('*Rapat* _Senin_') = 'Rapat Senin' then 'Sesuai' else 'Periksa' end
union all select 14, 'Cek Keabsahan menyebut mode tanda tangan',
       case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'cek_dokumen'
                          and position('mode_ttd' in pg_get_functiondef(oid)) > 0) then 'Sesuai' else 'Periksa' end
union all select 15, 'Penanda tangan aktif terhubung akun pegawai (syarat TTD elektronik)',
       (select count(*) filter (where employee_id is not null)::text || ' dari ' || count(*)::text || ' pejabat' from signatories where aktif)
union all select 16, 'Dokumen terdaftar per status',
       coalesce((select string_agg(status || ' ' || n, ', ' order by status) from (select status, count(*)::text n from document_registry group by status) q), 'belum ada')
union all select 17, 'Laporan resmi (sah / menunggu tanda tangan)',
       (select count(*) filter (where status = 'sah')::text || ' sah, ' || count(*) filter (where status = 'draf')::text || ' menunggu'
          from document_registry where jenis like 'laporan\_%')
union all select 18, 'Tanggal mulai penutupan presensi (dasar hitung tidak presensi)',
       coalesce(nullif(public.pengaturan_presensi()->>'mulai_tanggal', ''), 'belum diatur – sesi lama tanpa catatan dihitung tanpa keterangan')
union all select 19, 'Pemeriksaan keabsahan dokumen oleh publik',
       (select coalesce(sum(jumlah_cek), 0)::text || ' kali' from document_registry)
union all select 20, 'Diagnosis fungsi persetujuan pengajuan (benar: calon_penyetuju(uuid,text,date))',
       coalesce((select string_agg(pronamespace::regnamespace::text || ' › ' || oid::regprocedure::text, '; ') from pg_proc where proname = 'calon_penyetuju'),
                'TIDAK ADA – laporkan');
