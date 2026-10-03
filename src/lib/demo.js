// SIMKA PRO | src/lib/demo.js | v1.4 | Fase 1 – Jabatan dan tunjangan | 03/10/2026
// Data contoh untuk MODE DEMO. Nama pegawai di bawah fiktif.
const menitLalu = (m) => new Date(Date.now() - m * 60000).toISOString()

export const PENGGUNA_DEMO = {
  superadmin: { id: 'd-sa', nama_lengkap: 'Superadmin SIMKA', username: 'superadmin', peran: 'superadmin', jabatan: 'Superadmin sistem', nama_unit: 'Pimpinan Pondok', jenis_kelamin: 'L' },
  admin:      { id: 'd-ad', nama_lengkap: 'Ust. Fadhil Rahman, S.Kom.', username: 'fadhil', peran: 'admin', jabatan: 'Operator, Admin kepegawaian', nama_unit: 'Bidang Umum', jenis_kelamin: 'L' },
  pegawai:    { id: 'd-pg', nama_lengkap: 'Ust. Hasan Basri, Lc.', username: 'hasanbasri', peran: 'pegawai', jabatan: 'Muhaffizh, Wali kelas', nama_unit: 'Bidang Tahfizh', jenis_kelamin: 'L' },
}

export const PEGAWAI_DEMO = [
  ['Ust. Hasan Basri, Lc.', '2019070101', 'L', 'Bidang Tahfizh', ['Muhaffizh', 'Wali kelas'], null, 'tetap', 'aktif', '2019-07-01'],
  ['Ustzh. Nurul Aini, S.Pd.', '2020071502', 'P', 'Bidang Kesetaraan Wustha', ['Guru mapel', 'Wali kelas'], null, 'tetap', 'aktif', '2020-07-15'],
  ['Ust. Muhammad Ikhsan, S.Pd.I.', '2018010303', 'L', 'Bidang Kesantrian', ['Musyrif'], 'Kepala Bidang', 'tetap', 'aktif', '2018-01-03'],
  ['Ustzh. Fatimah Az-Zahra, A.Md.Kep.', '2021080104', 'P', 'Unit Klinik', ['Petugas kesehatan'], null, 'kontrak', 'aktif', '2021-08-01'],
  ['Ust. Abdul Hakim', '2022020105', 'L', 'Unit Security', ['Petugas keamanan'], null, 'honorer', 'aktif', '2022-02-01'],
  ['Ust. Yusuf Maulana, S.Pd.', '2023071006', 'L', 'Bidang SMA', ['Guru mapel', 'Pembina ekskul'], null, 'kontrak', 'menunggu', '2023-07-10'],
  ['Ustzh. Khadijah Ramadhani, S.Ag.', '2017071507', 'P', 'Bidang Tahfizh', ['Muhaffizh'], 'Wakil Kepala Bidang', 'tetap', 'aktif', '2017-07-15'],
  ['Ust. Rizal Fahmi, S.E.', '2016010208', 'L', 'Pimpinan Pondok', ['Staf bidang'], 'Bendahara', 'tetap', 'aktif', '2016-01-02'],
  ['Ust. Ahmad Zaki', null, 'L', 'Bidang Sarana', ['Petugas sarpras'], null, 'honorer', 'tanpa_akun', '2024-03-01'],
  ['Ustzh. Aisyah Putri, S.Pd.', '2024071010', 'P', 'Bidang Bahasa', ['Guru mapel'], null, 'honorer', 'menunggu', '2024-07-10'],
  ['Ust. Ilham Saputra, S.Sos.', '2020011511', 'L', 'Bidang Media', ['Petugas media'], null, 'kontrak', 'aktif', '2020-01-15'],
  ['Ust. Syamsul Arifin, S.Pd.', '2019071512', 'L', 'Bidang Kesetaraan Wustha', ['Guru mapel', 'Musyrif'], null, 'tetap', 'aktif', '2019-07-15'],
].map(([nama_lengkap, niy, jenis_kelamin, nama_unit, jabatan_fungsional, jabatan_struktural, status_kepegawaian, status_akun, tmt_tugas], i) => ({
  id: `p${i + 1}`, nama_lengkap, niy, jenis_kelamin, nama_unit, jabatan_fungsional, jabatan_struktural,
  status_kepegawaian, status_akun, status_keaktifan: 'aktif', tmt_tugas,
}))

export const NOTIFIKASI_DEMO = {
  superadmin: [
    { judul: 'Pendaftaran pegawai baru', isi: 'Ustzh. Aisyah Putri, S.Pd. menunggu verifikasi akun.', tautan: '/verifikasi/menunggu', ikon: 'UserPlus', warna: 'biru', menit: 6 },
    { judul: 'Pendaftaran pegawai baru', isi: 'Ust. Yusuf Maulana, S.Pd. menunggu verifikasi akun.', tautan: '/verifikasi/menunggu', ikon: 'UserPlus', warna: 'biru', menit: 52 },
    { judul: 'Periksa kop surat', isi: 'Empat kop resmi sudah terpasang. Lakukan cetak uji F4 sebelum dipakai.', tautan: '/pengaturan', ikon: 'Printer', warna: 'emas', menit: 180, dibaca: true },
    { judul: 'Pemindahan berkas ke Drive berjalan', isi: 'Antrian berkas kosong. Semua berkas sudah tersimpan di Google Drive.', tautan: '/', ikon: 'CloudArrowUp', warna: 'hijau', menit: 1500, dibaca: true },
  ],
  admin: [
    { judul: 'Pendaftaran pegawai baru', isi: 'Ustzh. Aisyah Putri, S.Pd. menunggu verifikasi akun.', tautan: '/verifikasi/menunggu', ikon: 'UserPlus', warna: 'biru', menit: 6 },
    { judul: 'Pendaftaran pegawai baru', isi: 'Ust. Yusuf Maulana, S.Pd. menunggu verifikasi akun.', tautan: '/verifikasi/menunggu', ikon: 'UserPlus', warna: 'biru', menit: 52 },
    { judul: 'Data pegawai belum lengkap', isi: 'Ust. Ahmad Zaki belum memiliki NIY dan akun.', tautan: '/pegawai/p9', ikon: 'WarningCircle', warna: 'jingga', menit: 240, dibaca: true },
  ],
  pegawai: [
    { judul: 'Akun Anda telah aktif', isi: 'Selamat bergabung di SIMKA PRO. Lengkapi profil Anda bila masih ada data yang kosong.', tautan: '/profil', ikon: 'CheckCircle', warna: 'hijau', menit: 30 },
    { judul: 'Presensi GPS segera hadir', isi: 'Fitur presensi dengan selfie dibuka pada Fase 2.', tautan: '/presensi', ikon: 'Fingerprint', warna: 'teal', menit: 1440, dibaca: true },
  ],
}

export const notifikasiDemo = (peran) =>
  (NOTIFIKASI_DEMO[peran] || []).map((n, i) => ({
    id: `n${peran}${i}`, judul: n.judul, isi: n.isi, tautan: n.tautan, ikon: n.ikon, warna: n.warna,
    created_at: menitLalu(n.menit), dibaca_pada: n.dibaca ? menitLalu(n.menit - 1) : null,
  }))

export function statistikDemo() {
  const p = PEGAWAI_DEMO
  const perBidang = {}
  p.forEach((x) => { const b = x.nama_unit.replace('Unit Klinik', 'Bidang Kesantrian').replace('Unit Security', 'Bidang Kesantrian'); perBidang[b] = (perBidang[b] || 0) + 1 })
  return {
    pegawai_aktif: 98, akun_aktif: 86,
    menunggu_verifikasi: p.filter((x) => x.status_akun === 'menunggu').length,
    tanpa_akun: 10, laki_laki: 61, perempuan: 37, bidang_aktif: 8, admin: 3,
    per_status: { tetap: 52, kontrak: 27, honorer: 19 },
    per_bidang: [
      { bidang: 'Bidang Tahfizh', jumlah: 24 }, { bidang: 'Bidang Kesetaraan Wustha', jumlah: 18 },
      { bidang: 'Bidang SMA', jumlah: 15 }, { bidang: 'Bidang Kesantrian', jumlah: 21 },
      { bidang: 'Bidang Sarana', jumlah: 6 }, { bidang: 'Bidang Media', jumlah: 4 },
      { bidang: 'Bidang Bahasa', jumlah: 5 }, { bidang: 'Bidang Umum', jumlah: 5 },
    ],
    audit_hari_ini: 37, heartbeat_terakhir: menitLalu(310), berkas_antri: 3, berkas_gagal: 0,
    notifikasi_belum_dibaca: 0,
  }
}

// ---------- Data contoh pengaturan lembaga (mengikuti isi awal migrasi 0400) ----------
const KEMENAG = 'https://cdn.kemenag.go.id/storage/archives/logo-kemenag-png-1png.png'
const LOGO_PONDOK = 'https://i.ibb.co.com/W4kqQScd/PPS-IMAM-ASY-SYATHIBY.png'
const ALAMAT_KOP = 'Jalan Poros Malino KM.04, Ling. Bontobaddo, Kel. Bontoramba, Kab. Gowa Kode Pos 92119'
export const LEMBAGA_DEMO = () => ({
  identitas: {
    nama_lengkap: "Pondok Pesantren Tahfizhul Qur'an Imam Asy-Syathiby Wahdah Islamiyah Gowa",
    nama_singkat: 'IMAM ASY-SYATHIBY', tagline: "Generasi Qur'ani dan Berprestasi",
    npsn: '70023617', nspp: '502373060054', telepon: '085243324006', email: 'syathiby.gowa@gmail.com',
    alamat: 'Jl. Poros Malino Sungguminasa, Lingkungan Bontobaddo No.KM.04, Bontoramba, Kec. Somba Opu, Kabupaten Gowa, Sulawesi Selatan 92119',
    kota_surat: 'Gowa', logo_url: LOGO_PONDOK, logo_kemenag_url: KEMENAG, ikon_url: 'https://i.ibb.co.com/Kjq1b2Kw/Icon-SIMKA.png',
  },
  hijriah: { koreksi_hari: 0 },
  integrasi: { gas_url: '', drive_folder_nama: 'SIMKA PRO', drive_folder_id: '', email_pengirim: 'syathiby.gowa@gmail.com', nama_pengirim: 'SIMKA PRO Imam Asy-Syathiby', domain_aplikasi: '' },
  letterheads: [
    { id: 'k1', kode: 'pondok', nama: 'Kop Pondok', kode_unit: 'PPTQ-IAS', bentuk: 'gambar', gambar_url: 'kop/kop-pondok.jpg', logo_kiri_url: KEMENAG, logo_kanan_url: LOGO_PONDOK,
      baris: [{ teks: 'KEMENTERIAN AGAMA KABUPATEN GOWA', tebal: false, ukuran: 13 }, { teks: "PONDOK PESANTREN TAHFIZHUL QUR'AN", tebal: true, ukuran: 15 }, { teks: 'IMAM ASY-SYATHIBY WAHDAH ISLAMIYAH GOWA', tebal: true, ukuran: 15 }, { teks: 'NPSN. 70023617  NSPP. 502373060054  e-Mail: syathiby.gowa@gmail.com', tebal: false, ukuran: 10 }],
      pita_teks: ALAMAT_KOP + ' | Telp. 085243324006', pita_warna: '#F8E02F', aktif: true, urutan: 1 },
    { id: 'k2', kode: 'wustha', nama: 'Kop Kesetaraan Wustha', kode_unit: 'KW-IAS', bentuk: 'gambar', gambar_url: 'kop/kop-wustha.jpg', logo_kiri_url: KEMENAG, logo_kanan_url: null,
      baris: [{ teks: 'KEMENTERIAN AGAMA KABUPATEN GOWA', tebal: false, ukuran: 13 }, { teks: "KESETARAAN WUSTHA PPS TAHFIZHUL QUR'AN", tebal: true, ukuran: 15 }, { teks: 'IMAM ASY-SYATHIBY WAHDAH ISLAMIYAH GOWA', tebal: true, ukuran: 15 }],
      pita_teks: ALAMAT_KOP + ' | Telp. 082194934531', pita_warna: '#F8E02F', aktif: true, urutan: 2 },
    { id: 'k3', kode: 'sma', nama: 'Kop SMA', kode_unit: 'SMAS-IAS', bentuk: 'gambar', gambar_url: 'kop/kop-sma.jpg', logo_kiri_url: null, logo_kanan_url: null,
      baris: [{ teks: 'PEMERINTAH PROVINSI SULAWESI SELATAN', tebal: false, ukuran: 12 }, { teks: "SMAS TAHFIZHUL QUR'AN IMAM ASY-SYATIBY W.I", tebal: true, ukuran: 15 }],
      pita_teks: ALAMAT_KOP + ' | Telp. 085256006743', pita_warna: '#F8E02F', aktif: true, urutan: 3 },
    { id: 'k4', kode: 'yayasan', nama: 'Kop Yayasan', kode_unit: 'YPIA', bentuk: 'gambar', gambar_url: 'kop/kop-yayasan.jpg', logo_kiri_url: null, logo_kanan_url: null,
      baris: [{ teks: 'YAYASAN PESANTREN IMAM ASYSYATIBY (YPIA)', tebal: true, ukuran: 15 }, { teks: 'WAHDAH ISLAMIYAH', tebal: true, ukuran: 14 }],
      pita_teks: 'Nomor Induk Berusaha. 0205230018097', pita_warna: '#F8E02F', aktif: true, urutan: 4 },
  ],
  signatories: [
    { id: 's1', jabatan_tertulis: 'Direktur', nama: 'Siswandi Safari, S.Pd.I., Lc., S.H., M.Ag.', niy: '1983020910201401', aktif: true, urutan: 1 },
    { id: 's2', jabatan_tertulis: 'Kepala Kesetaraan Wustha (SMP)', nama: 'Chamdar Nur, S.Pd.I., SH., Lc., M.Pd.', niy: '1983042805201401', aktif: true, urutan: 2 },
    { id: 's3', jabatan_tertulis: 'Kepala SMA', nama: 'H. Afrianto, Lc, M.H.', niy: '1994042801202001', aktif: true, urutan: 3 },
  ],
  signer_rules: [
    { jenis_dokumen: 'pengajuan_pegawai', nama_dokumen: 'Surat izin/sakit/cuti pegawai', kiri: 'atasan_terakhir', kanan: 'pemohon', mode: 'elektronik', kop_kode: 'pondok', urutan: 1 },
    { jenis_dokumen: 'rekap_pegawai', nama_dokumen: 'Rekap kehadiran pegawai', kiri: 's1', kanan: 'pencetak', mode: 'elektronik', kop_kode: 'pondok', urutan: 3 },
    { jenis_dokumen: 'slip_gaji', nama_dokumen: 'Slip gaji', kiri: 'bendahara', kanan: 'pegawai', mode: 'elektronik', kop_kode: 'pondok', urutan: 5 },
    { jenis_dokumen: 'kartu_pegawai', nama_dokumen: 'Kartu pegawai', kiri: 's1', kanan: null, mode: 'elektronik', kop_kode: 'pondok', urutan: 7 },
    { jenis_dokumen: 'daftar_pegawai', nama_dokumen: 'Daftar dan rekap kepegawaian', kiri: 's1', kanan: 'pencetak', mode: 'elektronik', kop_kode: 'pondok', urutan: 10 },
  ],
  academic_years: [{ id: 't1', nama: '2026/2027', mulai: '2026-07-13', selesai: '2027-06-30', semester: 1, aktif: true, terkunci: false }],
  holiday_calendars: [
    { jenis_tugas: 'sekolah', nama: 'Sekolah (Wustha dan SMA)', hari_libur: [0], catatan: 'Ahad libur' },
    { jenis_tugas: 'tahfizh', nama: 'Halaqah tahfizh', hari_libur: [0], catatan: 'Ahad libur' },
    { jenis_tugas: 'asrama', nama: 'Asrama (musyrif)', hari_libur: [], catatan: 'Tetap masuk hari Ahad' },
    { jenis_tugas: 'security', nama: 'Security', hari_libur: [], catatan: 'Bergiliran; libur diatur pada jadwal shift' },
    { jenis_tugas: 'medis', nama: 'Klinik (medis)', hari_libur: [], catatan: 'Diatur pada jadwal shift' },
    { jenis_tugas: 'kantor', nama: 'Kantor dan staf', hari_libur: [0], catatan: 'Ahad libur' },
  ],
  holidays: [
    { id: 'h1', tanggal_mulai: '2026-12-25', tanggal_akhir: '2026-12-25', nama: 'Libur Natal', jenis: 'libur_nasional', berlaku_untuk: ['semua'] },
  ],
  doc_number_formats: [
    { kode: 'surat', nama: 'Surat tata usaha (D/K)', pola: '{DK}.{URUT3}/{PERIHAL}/{UNIT}/{BLN_H_ROMAWI}/{THN_H}', grup_urut: 'surat', reset: 'tahun_hijriah', aktif: true },
    { kode: 'sk', nama: 'Surat Keputusan (SK)', pola: '{DK}.{URUT3}/{PERIHAL}/{UNIT}/{BLN_H_ROMAWI}/{THN_H}', grup_urut: 'sk', reset: 'tahun_hijriah', aktif: true },
    { kode: 'pengajuan', nama: 'Dokumen pengajuan pegawai', pola: 'PGJ.{URUT3}/{UNIT}/{BLN_ROMAWI}/{THN}', grup_urut: 'pengajuan', reset: 'tahun_masehi', aktif: true },
    { kode: 'slip', nama: 'Slip gaji', pola: 'SLIP.{URUT3}/{UNIT}/{BLN}/{THN}', grup_urut: 'slip', reset: 'bulan_masehi', aktif: true },
  ],
  letter_subject_codes: [
    { kode: 'QR', arti: 'Qarar', keterangan: 'Surat Keputusan (SK)', urutan: 1 }, { kode: 'AM', arti: 'Amanah', keterangan: 'Tugas, mandat, instruksi, kuasa, perjalanan dinas', urutan: 3 },
    { kode: 'DW', arti: "Da'wah", keterangan: 'Undangan dan panggilan', urutan: 6 }, { kode: 'NZ', arti: 'Nahwa Dzalik', keterangan: 'Lain-lain', urutan: 9 },
  ],
})

// ---------- Data contoh struktur organisasi (mengikuti isi awal migrasi 0400) ----------
export const ORGANISASI_DEMO = () => {
  const u = (id, parent_id, kode, nama, jenis, urutan, prioritas = false) => ({ id, parent_id, kode, nama, jenis, urutan, prioritas, aktif: true })
  return {
    units: [
      u('u0', null, 'PIMPINAN', 'Pimpinan Pondok', 'pimpinan', 0, true),
      u('u1', 'u0', 'TAHFIZH', 'Bidang Tahfizh', 'bidang', 1, true), u('u2', 'u0', 'WUSTHA', 'Bidang Kesetaraan Wustha', 'bidang', 2, true),
      u('u3', 'u0', 'SMA', 'Bidang SMA', 'bidang', 3, true), u('u4', 'u0', 'KESANTRIAN', 'Bidang Kesantrian', 'bidang', 4, true),
      u('u5', 'u0', 'SARANA', 'Bidang Sarana', 'bidang', 5), u('u6', 'u0', 'MEDIA', 'Bidang Media', 'bidang', 6),
      u('u7', 'u0', 'BAHASA', 'Bidang Bahasa', 'bidang', 7), u('u8', 'u0', 'UMUM', 'Bidang Umum', 'bidang', 8),
      u('u9', 'u4', 'KLINIK', 'Unit Klinik', 'unit', 1), u('u10', 'u4', 'SECURITY', 'Unit Security', 'unit', 2),
      u('u11', 'u8', 'TU', 'Unit Tata Usaha', 'unit', 1), u('u12', 'u8', 'DAPUR', 'Unit Dapur', 'unit', 2),
    ],
    fungsional: [
      ['GURU', 'Guru mata pelajaran', 'rentang', false, false], ['WALI_KELAS', 'Wali kelas', 'rentang', false, true],
      ['MUHAFFIZH', 'Muhaffizh/Muhaffizhah', 'sesi', false, true], ['MUSYRIF', 'Musyrif/Musyrifah', 'sesi', false, true],
      ['PEMBINA_EKSKUL', 'Pembina ekskul', 'sesi', false, true], ['OPERATOR', 'Operator', 'rentang', false, false],
      ['STAF_BIDANG', 'Staf bidang', 'rentang', false, false], ['STAF_PEMBANTU', 'Staf pembantu', 'rentang', false, false],
      ['MEDIS', 'Petugas kesehatan (medis)', 'shift', true, false], ['SECURITY', 'Petugas keamanan (security)', 'shift', true, false],
      ['KEBERSIHAN', 'Petugas kebersihan', 'rentang', false, false], ['LOGISTIK', 'Petugas logistik', 'rentang', false, false],
      ['MEDIA', 'Petugas media', 'rentang', false, false], ['SARPRAS', 'Petugas sarana prasarana', 'rentang', false, false],
    ].map(([kode, nama, jenis_sesi, tanpa_rangkap, pengasuh], i) => ({ id: 'f' + i, kode, nama, jenis_sesi, tanpa_rangkap, pengasuh, aktif: true, urutan: i + 1 })),
    struktural: [
      ['YAYASAN', 'Pengurus Yayasan', 10, true], ['DIREKTUR', 'Direktur (Mudir)', 15, true], ['WAKIL_DIREKTUR', 'Wakil Direktur', 20, true],
      ['BENDAHARA', 'Bendahara', 25, false], ['KEPALA_BIDANG', 'Kepala Bidang', 30, true], ['WAKIL_KEPALA_BIDANG', 'Wakil Kepala Bidang', 35, false],
      ['WAKIL_KEPALA_SEKOLAH', 'Wakil Kepala Sekolah', 36, false], ['KEPALA_UNIT', 'Kepala Unit', 40, false], ['TATA_USAHA', 'Tata Usaha', 50, false],
    ].map(([kode, nama, tingkat, boleh_menyetujui], i) => ({ id: 's' + i, kode, nama, tingkat, boleh_menyetujui, aktif: true, urutan: i + 1 })),
    jumlahUnit: { u1: 24, u2: 18, u3: 15, u4: 12, u9: 3, u10: 6, u5: 6, u6: 4, u7: 5, u8: 2, u11: 2, u12: 1, u0: 4 },
    jumlahFungsional: { f0: 30, f1: 14, f2: 24, f3: 16, f4: 8, f8: 3, f9: 6 },
    jumlahStruktural: { s1: 1, s2: 1, s3: 1, s4: 6 },
  }
}

// ---------- Data contoh hak akses (mengikuti isi awal migrasi 0400) ----------
export const FITUR_DEMO = [
  ['data_pegawai', 'Data kepegawaian', 'Kepegawaian', 1], ['presensi', 'Presensi', 'Kepegawaian', 2], ['pengajuan', 'Pengajuan izin, sakit, cuti', 'Kepegawaian', 3],
  ['jurnal_harian', 'Jurnal harian', 'Kepegawaian', 3], ['berkas_pegawai', 'Berkas pegawai', 'Kepegawaian', 3], ['kartu_pegawai', 'Kartu pegawai', 'Kepegawaian', 3],
  ['data_santri', 'Data santri', 'Santri', 4], ['absensi_kelas', 'Absensi kelas', 'Santri', 4], ['absensi_halaqah', 'Absensi halaqah', 'Santri', 4],
  ['absensi_asrama', 'Absensi asrama', 'Santri', 4], ['tahfizh', 'Tahfizh', 'Santri', 5], ['klinik', 'Klinik', 'Layanan', 6], ['gerbang', 'Gerbang dan izin keluar', 'Layanan', 7],
  ['pantauan', 'Pantauan langsung', 'Layanan', 7], ['tata_usaha', 'Tata usaha', 'Administrasi', 10], ['slip_gaji', 'Slip gaji', 'Administrasi', 11],
  ['laporan', 'Laporan dan ekspor', 'Administrasi', 8], ['pengumuman', 'Pengumuman', 'Sistem', 3], ['pengaturan_lembaga', 'Pengaturan lembaga', 'Sistem', 1],
  ['hak_akses', 'Hak akses', 'Sistem', 1], ['audit_log', 'Audit log', 'Sistem', 3],
].map(([kode, nama, kelompok, fase], i) => ({ kode, nama, kelompok, fase, urutan: i }))
export const IZIN_ADMIN_DEMO = [
  { kode: 'verval_akun', nama: 'Verifikasi akun pegawai baru', urutan: 1 }, { kode: 'kelola_pegawai', nama: 'Mengelola data kepegawaian dan impor Excel', urutan: 2 },
  { kode: 'kalender', nama: 'Mengelola hari libur dan kalender', urutan: 3 }, { kode: 'audit_log', nama: 'Melihat audit log seluruh pegawai', urutan: 4 },
  { kode: 'verval_presensi', nama: 'Verval presensi di luar area (Fase 2)', urutan: 5 },
]

// ---------- Data contoh tarif tunjangan (mengikuti isi awal migrasi 1100) ----------
export const TARIF_DEMO = () => {
  const b = (kategori, kunci, nama, besaran) => ({ id: `${kategori}-${kunci}`, kategori, kunci, nama, besaran, berlaku_mulai: '2026-01-01', keterangan: null })
  return [
    b('struktural', 'DIREKTUR', 'Direktur', 3000000), b('struktural', 'WAKIL_DIREKTUR', 'Wakil Direktur', 2500000), b('struktural', 'KEPALA_BIDANG', 'Kepala Bidang', 2000000),
    b('struktural', 'WAKIL_KEPALA_BIDANG', 'Wakil Kepala Bidang', 1000000), b('struktural', 'WAKIL_KEPALA_SEKOLAH', 'Wakil Kepala Sekolah', 1200000),
    b('struktural', 'KEPALA_UNIT', 'Kepala Unit', 1000000), b('struktural', 'BENDAHARA', 'Bendahara', 800000), b('struktural', 'TATA_USAHA', 'Tata Usaha', 700000),
    b('fungsional', 'MUHAFFIZH', 'Muhaffizh', 500000), b('fungsional', 'MUSYRIF', 'Musyrif', 300000), b('fungsional', 'GURU', 'Guru mapel', 450000),
    b('fungsional', 'WALI_KELAS', 'Wali kelas', 250000), b('fungsional', 'OPERATOR', 'Operator', 350000), b('fungsional', 'STAF_BIDANG', 'Staf bidang', 300000),
    b('fungsional', 'STAF_PEMBANTU', 'Staf pembantu', 150000), ...['SECURITY', 'KEBERSIHAN', 'MEDIS', 'LOGISTIK', 'MEDIA', 'SARPRAS'].map((k) => b('fungsional', k, 'Petugas ' + k.toLowerCase(), 700000)),
    b('pendidikan', 'SD', 'SD', 50000), b('pendidikan', 'SMP', 'SMP', 50000), b('pendidikan', 'SMA', 'SMA', 80000), b('pendidikan', 'S1', 'Sarjana (S1)', 130000),
    b('pendidikan', 'S1-LN', 'Sarjana luar negeri (S1-LN)', 180000), b('pendidikan', 'S2', 'Magister (S2)', 250000),
    ...[50, 100, 150, 200, 250, 350, 500, 600, 700, 800, 900, 1000].map((v, i) => b('masa_kerja', String(i + 1), `${i + 1} tahun`, v * 1000)),
    b('kepegawaian', 'tetap', 'Pegawai tetap', 1000000), b('kepegawaian', 'kontrak', 'Pegawai kontrak', 600000),
    b('kesehatan', 'tetap', 'Pegawai tetap', 150000), b('kesehatan', 'kontrak', 'Pegawai kontrak', 100000),
    b('level_muhaffizh', 'mahir', 'Mahir', 300000), b('level_muhaffizh', 'terampil', 'Terampil', 200000), b('level_muhaffizh', 'pemula', 'Pemula', 100000),
    b('honorer_jam', 'guru_lama', 'Guru lama (per jam)', 20000), b('honorer_jam', 'guru_baru', 'Guru baru (per jam)', 15000),
    b('honorer_jam', 'muhaffizh_lama', 'Muhaffizh lama (per jam)', 25000), b('honorer_jam', 'muhaffizh_baru', 'Muhaffizh baru (per jam)', 20000),
  ]
}
