/* =====================================================================
   DAFTAR ULANG · DEFINISI ISIAN BERSAMA (Fase 4 · Langkah 6)
   Dipakai formulir wali (daftarulang.js), menu panitia (daftarulang-admin.js),
   Bukti Daftar Ulang, Kuitansi, dan ekspor.
   Sumber nilai (src):
     'kunci' : dari pendaftaran, tampil terkunci
     'p'     : dari pendaftaran, boleh diperbarui (tersimpan di tabel pendaftar)
     'd'     : isian baru daftar ulang (tersimpan di daftar_ulang.data)
   Wajib/opsional isian 'd' dapat diatur Superadmin (pengaturan daftar_ulang.wajib).
   ===================================================================== */
(function () {
  'use strict';
  const PENDIDIKAN = ['Tidak sekolah', 'SD/sederajat', 'SMP/sederajat', 'SMA/sederajat', 'D1', 'D2', 'D3', 'D4/S1', 'S2', 'S3'];
  const PENGHASILAN = ['Tidak berpenghasilan', 'Kurang dari Rp500.000', 'Rp500.000 – Rp999.999', 'Rp1.000.000 – Rp1.999.999',
    'Rp2.000.000 – Rp4.999.999', 'Rp5.000.000 – Rp20.000.000', 'Lebih dari Rp20.000.000'];
  const HUBUNGAN = ['Ayah', 'Ibu', 'Kakak', 'Paman', 'Bibi', 'Kakek', 'Nenek', 'Wali', 'Lainnya'];
  const TINGKAT = ['Sekolah', 'Kecamatan', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional'];
  const YA_TIDAK = ['Ya', 'Tidak'];

  const LANGKAH = [
    ['Biodata', 'ph-identification-card', 'var(--c3)'],
    ['Domisili', 'ph-house-line', 'var(--c1)'],
    ['Orang Tua/Wali', 'ph-users-three', 'var(--c4)'],
    ['Periodik & Kesehatan', 'ph-heartbeat', 'var(--c7)'],
    ['Riwayat Sekolah', 'ph-school', 'var(--c2)'],
    ['Prestasi', 'ph-trophy', 'var(--c6)'],
    ['Beasiswa & Bantuan', 'ph-hand-coins', 'var(--c5)'],
    ['Kontak Darurat', 'ph-first-aid-kit', 'var(--c8)'],
    ['Dokumen & Pembayaran', 'ph-wallet', 'var(--ok)'],
    ['Periksa & Kirim', 'ph-paper-plane-tilt', 'var(--c3)']
  ];

  // s: indeks langkah; w: wajib bawaan; sub: subjudul sebelum isian
  const ISIAN = [
    // 1. Biodata
    { s: 0, sub: ['Identitas dari pendaftaran', 'ph-lock-simple', 'var(--c7)'] },
    { k: 'nama_lengkap', l: 'Nama lengkap', t: 'teks', src: 'kunci', s: 0 },
    { k: 'nisn', l: 'NISN', t: 'teks', src: 'kunci', s: 0 },
    { k: 'nik', l: 'NIK', t: 'teks', src: 'kunci', s: 0 },
    { k: 'tempat_lahir', l: 'Tempat lahir', t: 'teks', src: 'kunci', s: 0 },
    { k: 'tanggal_lahir', l: 'Tanggal lahir', t: 'tanggal', src: 'kunci', s: 0 },
    { k: 'jenis_kelamin', l: 'Jenis kelamin', t: 'teks', src: 'kunci', s: 0 },
    { s: 0, sub: ['Melengkapi identitas', 'ph-identification-card', 'var(--c3)'] },
    { k: 'no_kk', l: 'Nomor Kartu Keluarga', t: 'nik', src: 'd', s: 0, w: true, inti: true, b: '16 digit, tertera di bagian atas Kartu Keluarga.' },
    { k: 'nama_panggilan', l: 'Nama panggilan', t: 'teks', src: 'd', s: 0, w: false, maks: 40 },
    { k: 'agama', l: 'Agama', t: 'pilih', src: 'd', s: 0, w: true, opsi: ['Islam'], bawaan: 'Islam' },
    { k: 'kewarganegaraan', l: 'Kewarganegaraan', t: 'pilih', src: 'd', s: 0, w: true, opsi: ['Indonesia (WNI)', 'Asing (WNA)'], bawaan: 'Indonesia (WNI)' },
    { k: 'suku', l: 'Suku bangsa', t: 'teks', src: 'd', s: 0, w: false, maks: 40, contoh: 'Misalnya Makassar, Bugis' },
    { k: 'anak_ke', l: 'Anak ke-', t: 'angka', src: 'd', s: 0, w: true, min: 1, max: 20 },
    { k: 'jumlah_saudara', l: 'Jumlah saudara kandung', t: 'angka', src: 'd', s: 0, w: true, min: 0, max: 20, b: 'Tidak termasuk calon santri.' },
    { k: 'bahasa_rumah', l: 'Bahasa sehari-hari di rumah', t: 'teks', src: 'd', s: 0, w: false, maks: 40 },
    { k: 'hobi', l: 'Hobi', t: 'teks', src: 'd', s: 0, w: false, maks: 60 },
    { k: 'cita_cita', l: 'Cita-cita', t: 'teks', src: 'd', s: 0, w: false, maks: 60 },

    // 2. Domisili
    { s: 1, sub: ['Wilayah (dari pendaftaran)', 'ph-map-trifold', 'var(--c7)'] },
    { k: 'provinsi', l: 'Provinsi', t: 'teks', src: 'kunci', s: 1 },
    { k: 'kabupaten', l: 'Kabupaten/kota', t: 'teks', src: 'kunci', s: 1 },
    { k: 'kecamatan', l: 'Kecamatan', t: 'teks', src: 'kunci', s: 1 },
    { k: 'desa', l: 'Desa/kelurahan', t: 'teks', src: 'kunci', s: 1 },
    { s: 1, sub: ['Alamat (boleh diperbarui)', 'ph-house-line', 'var(--c1)'] },
    { k: 'alamat_jalan', l: 'Jalan / lorong dan nomor rumah', t: 'teks', src: 'p', s: 1, w: true, maks: 200, full: true },
    { k: 'dusun', l: 'Dusun / lingkungan', t: 'teks', src: 'p', s: 1, w: false, maks: 80 },
    { k: 'rt', l: 'RT', t: 'angka', src: 'p', s: 1, w: true, min: 0, max: 999 },
    { k: 'rw', l: 'RW', t: 'angka', src: 'p', s: 1, w: true, min: 0, max: 999 },
    { k: 'kode_pos', l: 'Kode pos', t: 'kodepos', src: 'p', s: 1, w: true },
    { s: 1, sub: ['Tempat tinggal dan perjalanan', 'ph-path', 'var(--c5)'] },
    { k: 'tinggal_bersama', l: 'Tinggal bersama', t: 'pilih', src: 'd', s: 1, w: true, opsi: ['Orang tua', 'Ayah', 'Ibu', 'Wali', 'Kakek/nenek', 'Saudara', 'Asrama/pondok', 'Lainnya'] },
    { k: 'jenis_tinggal', l: 'Jenis tempat tinggal', t: 'pilih', src: 'd', s: 1, w: false, opsi: ['Rumah milik sendiri', 'Rumah orang tua', 'Rumah sewa/kontrak', 'Rumah dinas', 'Asrama', 'Lainnya'] },
    { k: 'transportasi', l: 'Transportasi ke pondok', t: 'pilih', src: 'd', s: 1, w: true, opsi: ['Diantar orang tua (motor/mobil)', 'Kendaraan umum', 'Ojek', 'Mobil travel', 'Jalan kaki', 'Lainnya'] },
    { k: 'jarak_km', l: 'Jarak rumah ke pondok', t: 'angka', src: 'd', s: 1, w: true, min: 0, max: 5000, satuan: 'km', desimal: true },
    { k: 'waktu_menit', l: 'Waktu tempuh', t: 'angka', src: 'd', s: 1, w: true, min: 0, max: 6000, satuan: 'menit' },
    { k: 'koordinat', l: 'Titik lokasi rumah', t: 'koordinat', src: 'd', s: 1, w: false, full: true, b: 'Tekan "Ambil lokasi saya" saat berada di rumah, atau tempel tautan Google Maps.' },

    // 3. Orang tua / wali
    { s: 2, sub: ['Ayah', 'ph-user', 'var(--c1)'] },
    { k: 'nama_ayah', l: 'Nama ayah', t: 'teks', src: 'kunci', s: 2 },
    { k: 'pekerjaan_ayah', l: 'Pekerjaan ayah', t: 'pilih', src: 'p', s: 2, w: true, opsiDari: 'pekerjaan' },
    { k: 'ayah_status', l: 'Status ayah', t: 'chip', src: 'd', s: 2, w: true, opsi: ['Masih hidup', 'Sudah meninggal'], bawaan: 'Masih hidup' },
    { k: 'ayah_hubungan', l: 'Hubungan', t: 'chip', src: 'd', s: 2, w: false, opsi: ['Kandung', 'Tiri', 'Angkat'], bawaan: 'Kandung' },
    { k: 'ayah_nik', l: 'NIK ayah', t: 'nik', src: 'd', s: 2, w: true, jika: D => D.ayah_status !== 'Sudah meninggal' },
    { k: 'ayah_tgl_lahir', l: 'Tanggal lahir ayah', t: 'tanggal', src: 'd', s: 2, w: false },
    { k: 'ayah_pendidikan', l: 'Pendidikan terakhir ayah', t: 'pilih', src: 'd', s: 2, w: true, opsi: PENDIDIKAN },
    { k: 'ayah_penghasilan', l: 'Penghasilan ayah per bulan', t: 'pilih', src: 'd', s: 2, w: true, opsi: PENGHASILAN, jika: D => D.ayah_status !== 'Sudah meninggal' },
    { k: 'ayah_hp', l: 'Nomor HP ayah', t: 'tel', src: 'd', s: 2, w: false, jika: D => D.ayah_status !== 'Sudah meninggal' },
    { s: 2, sub: ['Ibu', 'ph-user', 'var(--c4)'] },
    { k: 'nama_ibu', l: 'Nama ibu', t: 'teks', src: 'kunci', s: 2 },
    { k: 'pekerjaan_ibu', l: 'Pekerjaan ibu', t: 'pilih', src: 'p', s: 2, w: true, opsiDari: 'pekerjaan' },
    { k: 'ibu_status', l: 'Status ibu', t: 'chip', src: 'd', s: 2, w: true, opsi: ['Masih hidup', 'Sudah meninggal'], bawaan: 'Masih hidup' },
    { k: 'ibu_hubungan', l: 'Hubungan', t: 'chip', src: 'd', s: 2, w: false, opsi: ['Kandung', 'Tiri', 'Angkat'], bawaan: 'Kandung' },
    { k: 'ibu_nik', l: 'NIK ibu', t: 'nik', src: 'd', s: 2, w: true, jika: D => D.ibu_status !== 'Sudah meninggal' },
    { k: 'ibu_tgl_lahir', l: 'Tanggal lahir ibu', t: 'tanggal', src: 'd', s: 2, w: false },
    { k: 'ibu_pendidikan', l: 'Pendidikan terakhir ibu', t: 'pilih', src: 'd', s: 2, w: true, opsi: PENDIDIKAN },
    { k: 'ibu_penghasilan', l: 'Penghasilan ibu per bulan', t: 'pilih', src: 'd', s: 2, w: true, opsi: PENGHASILAN, jika: D => D.ibu_status !== 'Sudah meninggal' },
    { k: 'ibu_hp', l: 'Nomor HP ibu', t: 'tel', src: 'd', s: 2, w: false, jika: D => D.ibu_status !== 'Sudah meninggal' },
    { s: 2, sub: ['Wali', 'ph-user-circle', 'var(--c5)'] },
    { k: 'ada_wali', l: 'Santri memiliki wali selain orang tua?', t: 'chip', src: 'd', s: 2, w: true, opsi: ['Tidak', 'Ya'], bawaan: 'Tidak', full: true },
    { k: 'wali_nama', l: 'Nama wali', t: 'teks', src: 'd', s: 2, w: true, maks: 100, jika: D => D.ada_wali === 'Ya' },
    { k: 'wali_hubungan', l: 'Hubungan dengan santri', t: 'pilih', src: 'd', s: 2, w: true, opsi: HUBUNGAN, jika: D => D.ada_wali === 'Ya' },
    { k: 'wali_pendidikan', l: 'Pendidikan wali', t: 'pilih', src: 'd', s: 2, w: false, opsi: PENDIDIKAN, jika: D => D.ada_wali === 'Ya' },
    { k: 'wali_pekerjaan', l: 'Pekerjaan wali', t: 'pilih', src: 'd', s: 2, w: false, opsiDari: 'pekerjaan', jika: D => D.ada_wali === 'Ya' },
    { k: 'wali_penghasilan', l: 'Penghasilan wali', t: 'pilih', src: 'd', s: 2, w: false, opsi: PENGHASILAN, jika: D => D.ada_wali === 'Ya' },
    { k: 'wali_hp', l: 'Nomor HP wali', t: 'tel', src: 'd', s: 2, w: true, jika: D => D.ada_wali === 'Ya' },
    { s: 2, sub: ['Kontak utama', 'ph-whatsapp-logo', '#16a34a'] },
    { k: 'no_wa', l: 'Nomor WhatsApp utama', t: 'tel', src: 'p', s: 2, w: true, b: 'Panitia dan pondok menghubungi melalui nomor ini.' },
    { k: 'email', l: 'Email', t: 'email', src: 'p', s: 2, w: true },

    // 4. Periodik dan kesehatan
    { s: 3, sub: ['Data periodik', 'ph-ruler', 'var(--c2)'] },
    { k: 'tinggi_cm', l: 'Tinggi badan', t: 'angka', src: 'd', s: 3, w: true, min: 80, max: 230, satuan: 'cm' },
    { k: 'berat_kg', l: 'Berat badan', t: 'angka', src: 'd', s: 3, w: true, min: 15, max: 200, satuan: 'kg', desimal: true },
    { k: 'lingkar_kepala', l: 'Lingkar kepala', t: 'angka', src: 'd', s: 3, w: false, min: 30, max: 80, satuan: 'cm' },
    { k: 'ukuran_baju', l: 'Ukuran baju', t: 'pilih', src: 'd', s: 3, w: false, opsi: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
    { s: 3, sub: ['Kesehatan', 'ph-heartbeat', 'var(--c7)'] },
    { k: 'golongan_darah', l: 'Golongan darah', t: 'chip', src: 'd', s: 3, w: true, opsi: ['A', 'B', 'AB', 'O', 'Belum tahu'] },
    { k: 'penyakit_bawaan', l: 'Penyakit bawaan / kronis', t: 'area', src: 'd', s: 3, w: false, full: true, contoh: 'Misalnya asma, epilepsi. Kosongkan bila tidak ada.' },
    { k: 'alergi', l: 'Alergi (makanan/obat)', t: 'teks', src: 'd', s: 3, w: false, maks: 150, full: true },
    { k: 'riwayat_sakit', l: 'Riwayat sakit/rawat inap terakhir', t: 'teks', src: 'd', s: 3, w: false, maks: 150, full: true },
    { k: 'kebutuhan_khusus', l: 'Kebutuhan khusus / disabilitas', t: 'teks', src: 'd', s: 3, w: false, maks: 100, contoh: 'Kosongkan bila tidak ada' },
    { k: 'imunisasi', l: 'Imunisasi yang pernah diterima', t: 'teks', src: 'd', s: 3, w: false, maks: 150 },

    // 5. Riwayat sekolah
    { s: 4, sub: ['Sekolah asal (dari pendaftaran)', 'ph-lock-simple', 'var(--c7)'] },
    { k: 'asal_sekolah', l: 'Nama sekolah asal', t: 'teks', src: 'kunci', s: 4 },
    { k: 'npsn_sekolah', l: 'NPSN sekolah asal', t: 'teks', src: 'kunci', s: 4 },
    { s: 4, sub: ['Melengkapi riwayat sekolah', 'ph-school', 'var(--c2)'] },
    { k: 'jenis_pendaftaran', l: 'Jenis pendaftaran', t: 'chip', src: 'd', s: 4, w: true, opsi: ['Siswa baru', 'Pindahan'], bawaan: 'Siswa baru' },
    { k: 'tahun_lulus', l: 'Tahun lulus sekolah asal', t: 'angka', src: 'd', s: 4, w: true, min: 2015, max: 2030 },
    { k: 'no_ijazah', l: 'Nomor seri ijazah', t: 'teks', src: 'd', s: 4, w: false, maks: 40, b: 'Boleh dikosongkan bila ijazah belum terbit.' },
    { k: 'no_skhu', l: 'Nomor SKL/SKHU', t: 'teks', src: 'd', s: 4, w: false, maks: 40 },
    { k: 'no_peserta_ujian', l: 'Nomor peserta ujian', t: 'teks', src: 'd', s: 4, w: false, maks: 40 },
    { k: 'nis_lama', l: 'NIS di sekolah asal', t: 'teks', src: 'd', s: 4, w: false, maks: 30 },
    { k: 'pernah_paud', l: 'Pernah PAUD/TK?', t: 'chip', src: 'd', s: 4, w: false, opsi: YA_TIDAK },
    { k: 'sekolah_pindahan', l: 'Alasan pindah', t: 'teks', src: 'd', s: 4, w: true, maks: 150, full: true, jika: D => D.jenis_pendaftaran === 'Pindahan' },

    // 6. Prestasi
    { k: 'prestasi_tambahan', l: 'Prestasi tambahan', t: 'baris', src: 'd', s: 5, w: false, full: true,
      kolom: [['nama', 'Nama prestasi/lomba', 'teks'], ['tingkat', 'Tingkat', 'pilih', TINGKAT], ['tahun', 'Tahun', 'angka'], ['penyelenggara', 'Penyelenggara', 'teks']] },

    // 7. Beasiswa dan bantuan
    { s: 6, sub: ['Bantuan sosial', 'ph-hand-heart', 'var(--c5)'] },
    { k: 'penerima_kip', l: 'Penerima KIP (Kartu Indonesia Pintar)?', t: 'chip', src: 'd', s: 6, w: true, opsi: YA_TIDAK, bawaan: 'Tidak' },
    { k: 'no_kip', l: 'Nomor KIP', t: 'teks', src: 'd', s: 6, w: true, maks: 30, jika: D => D.penerima_kip === 'Ya' },
    { k: 'nama_di_kip', l: 'Nama tertera di KIP', t: 'teks', src: 'd', s: 6, w: false, maks: 100, jika: D => D.penerima_kip === 'Ya' },
    { k: 'penerima_kks', l: 'Penerima KKS/PKH?', t: 'chip', src: 'd', s: 6, w: false, opsi: YA_TIDAK, bawaan: 'Tidak' },
    { k: 'no_kks', l: 'Nomor KKS/PKH', t: 'teks', src: 'd', s: 6, w: false, maks: 30, jika: D => D.penerima_kks === 'Ya' },
    { k: 'no_kis', l: 'Nomor KIS / BPJS Kesehatan', t: 'teks', src: 'd', s: 6, w: false, maks: 30 },
    { k: 'beasiswa', l: 'Beasiswa yang pernah/sedang diterima', t: 'baris', src: 'd', s: 6, w: false, full: true,
      kolom: [['pemberi', 'Pemberi beasiswa', 'teks'], ['besaran', 'Besaran/keterangan', 'teks'], ['mulai', 'Tahun mulai', 'angka'], ['selesai', 'Tahun selesai', 'angka']] },

    // 8. Kontak darurat
    { k: 'darurat_nama', l: 'Nama kontak darurat', t: 'teks', src: 'p', s: 7, w: true, maks: 100 },
    { k: 'darurat_hubungan', l: 'Hubungan dengan santri', t: 'pilih', src: 'p', s: 7, w: true, opsi: HUBUNGAN },
    { k: 'darurat_no', l: 'Nomor HP / WhatsApp', t: 'tel', src: 'p', s: 7, w: true },
    { k: 'darurat_alamat', l: 'Alamat lengkap kontak darurat', t: 'area', src: 'd', s: 7, w: true, full: true }
  ];

  // Nilai bawaan isian tambahan dari pengaturan
  function isianLengkap(cfg) {
    const tambahan = (cfg?.isian_tambahan || []).filter(x => x && x.kunci && x.label).map(x => ({
      k: 'x_' + x.kunci, l: x.label, t: { angka: 'angka', pilihan: 'pilih', tanggal: 'tanggal' }[x.jenis] || 'teks',
      src: 'd', s: Math.min(7, Math.max(0, +x.langkah || 0)), w: !!x.wajib, opsi: x.pilihan || [], tambahan: true, maks: 150
    }));
    const hasil = [];
    for (let s = 0; s < 8; s++) {
      hasil.push(...ISIAN.filter(f => f.s === s));
      const t = tambahan.filter(f => f.s === s);
      if (t.length) hasil.push({ s, sub: ['Isian tambahan panitia', 'ph-plus-circle', 'var(--c6)'] }, ...t);
    }
    return hasil;
  }
  const wajibKah = (f, cfg) => f.src !== 'kunci' && (f.inti ? true : (cfg?.wajib && f.k in cfg.wajib ? !!cfg.wajib[f.k] : !!f.w));

  // Nilai tampilan sebuah isian
  function teksNilai(f, v) {
    if (v == null || v === '') return '–';
    if (f.t === 'tanggal' && /^\d{4}-\d{2}-\d{2}/.test(v)) return window.SPMB.fmt.tglPanjang(new Date(String(v).slice(0, 10) + 'T00:00:00'));
    if (f.t === 'tel') return '+' + String(v).replace(/^\+/, '');
    if (f.t === 'baris') return (Array.isArray(v) ? v : []).filter(r => Object.values(r).some(x => String(x || '').trim()))
      .map(r => f.kolom.map(([k]) => r[k]).filter(Boolean).join(' · ')).join('; ') || '–';
    if (f.t === 'koordinat') return v.lat ? `${(+v.lat).toFixed(6)}, ${(+v.lng).toFixed(6)}` : v.url || '–';
    if (f.satuan) return `${String(v).replace('.', ',')} ${f.satuan}`;
    return String(v);
  }
  // Gabungan nilai: pendaftar + data daftar ulang
  function nilaiGabung(paket) {
    const p = paket.pendaftar || {}, d = paket.du?.data || {};
    return { ...p, jenis_kelamin: p.bagian === 'putri' ? 'Perempuan' : 'Laki-laki', ...d };
  }

  const STATUS_DU = {
    belum: ['Belum mengisi', 'var(--c7)', 'ph-circle-dashed'],
    draf: ['Draf (belum dikirim)', 'var(--c6)', 'ph-note-pencil'],
    menunggu: ['Menunggu verifikasi', 'var(--c2)', 'ph-hourglass-medium'],
    perbaikan: ['Perlu perbaikan', 'var(--c3)', 'ph-warning'],
    selesai: ['Selesai', 'var(--ok)', 'ph-seal-check']
  };

  /* ---------- Dokumen ---------- */
  const rupiah = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(+n || 0);
  function terbilang(n) {
    const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    n = Math.floor(+n || 0);
    if (n < 12) return n === 0 ? 'nol' : s[n];
    if (n < 20) return terbilang(n - 10) + ' belas';
    if (n < 100) return terbilang(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
    if (n < 200) return 'seratus' + (n > 100 ? ' ' + terbilang(n - 100) : '');
    if (n < 1000) return terbilang(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
    if (n < 2000) return 'seribu' + (n > 1000 ? ' ' + terbilang(n - 1000) : '');
    if (n < 1e6) return terbilang(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
    if (n < 1e9) return terbilang(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + terbilang(n % 1e6) : '');
    return terbilang(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + terbilang(n % 1e9) : '');
  }
  const kapital = t => t.charAt(0).toUpperCase() + t.slice(1);

  // Bukti Daftar Ulang: ringkasan data inti + status berkas
  function dokumenBuktiDU(paket, peng) {
    const { esc, fmt, penandaTangan } = window.SPMB;
    const cfg = peng.daftar_ulang || {}, p = paket.pendaftar, du = paket.du || {}, D = nilaiGabung(paket);
    const ta = peng.identitas?.tahun_ajaran || '';
    const r = (a, b) => `<tr><td>${a}</td><td>${esc(b == null || b === '' ? '–' : String(b))}</td></tr>`;
    const f = k => ISIAN.find(x => x.k === k);
    const label = Object.fromEntries((cfg.berkas || []).map(b => [b.kunci, b.label]).concat((peng.spmb?.berkas || []).map(b => [b.kunci, b.label])));
    const berkas = (paket.berkas || []);
    const statusB = { menunggu: 'Menunggu verifikasi', diterima: 'Diterima', ditolak: 'Ditolak' };
    const alamat = [p.alamat_jalan, p.dusun, `RT ${p.rt || '–'}/RW ${p.rw || '–'}`, p.desa, p.kecamatan ? `Kec. ${p.kecamatan}` : '', p.kabupaten, p.provinsi, p.kode_pos].filter(Boolean).join(', ');
    return {
      judul: 'Bukti Daftar Ulang Santri Baru', nomor: p.no_registrasi,
      meta: `Tahun Ajaran ${esc(ta)} · ${esc(p.gelombang || '')} · Status: <b>${esc((STATUS_DU[du.status] || STATUS_DU.belum)[0])}</b>${du.nomor_kuitansi ? ` · Kuitansi ${esc(du.nomor_kuitansi)}` : ''}${du.dikirim_pada ? ` · Dikirim ${fmt.tglJam(du.dikirim_pada)} WITA` : ''}${p.uji ? ' · <b>DATA UJI COBA</b>' : ''}`,
      isi: `<table><colgroup><col style="width:34%"><col style="width:66%"></colgroup><thead><tr><th>Data santri</th><th>Keterangan</th></tr></thead><tbody>
          ${r('Nomor registrasi', p.no_registrasi)}${r('Nama lengkap', p.nama_lengkap)}${r('NISN / NIK', `${p.nisn} / ${p.nik}`)}${r('Nomor KK', D.no_kk)}
          ${r('Tempat, tanggal lahir', `${p.tempat_lahir}, ${teksNilai(f('tanggal_lahir'), p.tanggal_lahir)}`)}
          ${r('Jenjang / bagian', `${p.jenjang} ${p.bagian === 'putri' ? 'Putri' : 'Putra'}`)}${r('Alamat', alamat)}
          ${r('Ayah', [p.nama_ayah, D.ayah_status === 'Sudah meninggal' ? '(alm.)' : '', p.pekerjaan_ayah].filter(Boolean).join(' · '))}
          ${r('Ibu', [p.nama_ibu, D.ibu_status === 'Sudah meninggal' ? '(almh.)' : '', p.pekerjaan_ibu].filter(Boolean).join(' · '))}
          ${D.ada_wali === 'Ya' ? r('Wali', `${D.wali_nama || '–'} (${D.wali_hubungan || '–'})`) : ''}
          ${r('WhatsApp / email', `+${p.no_wa} / ${p.email}`)}${r('Kontak darurat', `${p.darurat_nama || '–'} (${p.darurat_hubungan || '–'}) · +${p.darurat_no || '–'}`)}
          ${r('Tinggi / berat badan', `${teksNilai(f('tinggi_cm'), D.tinggi_cm)} / ${teksNilai(f('berat_kg'), D.berat_kg)}`)}${r('Golongan darah', D.golongan_darah)}
          ${r('Sekolah asal / tahun lulus', `${p.asal_sekolah || '–'} / ${D.tahun_lulus || '–'}`)}
        </tbody></table>
        <div style="height:6px"></div>
        <table><colgroup><col style="width:8%"><col style="width:58%"><col style="width:34%"></colgroup><thead><tr><th>No</th><th>Berkas</th><th>Status</th></tr></thead><tbody>
          ${berkas.length ? berkas.map((b, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(label[b.jenis] || b.jenis)}</td><td>${statusB[b.status] || b.status}</td></tr>`).join('') : '<tr><td></td><td>Belum ada berkas</td><td></td></tr>'}
        </tbody></table>
        <p style="font-size:9pt;margin:6px 0 0">Bukti ini menyatakan data daftar ulang telah ${du.status === 'selesai' ? 'diverifikasi panitia' : 'diterima sistem dan menunggu verifikasi panitia'}. Bawa bukti ini saat kedatangan santri ke pondok.</p>`,
      ttd: [{ jabatan: 'Orang tua / wali,', nama: D.ada_wali === 'Ya' && D.wali_nama ? D.wali_nama : p.nama_ayah || p.nama_ibu }, ...penandaTangan('bukti_du', peng, p.jenjang).slice(-1)],
      tanggal: du.diterima_tanggal || null
    };
  }

  // Kuitansi pembayaran daftar ulang
  function dokumenKuitansi(paket, peng) {
    const { esc, fmt } = window.SPMB;
    const p = paket.pendaftar, du = paket.du || {}, ta = peng.identitas?.tahun_ajaran || '';
    const tag = paket.tagihan || [], total = tag.reduce((a, x) => a + +x.nominal, 0) || +du.tagihan || 0;
    const bayar = +du.diterima_nominal || 0, sisa = Math.max(0, total - bayar);
    const penyetor = du.bayar?.nama_pengirim || du.data?.wali_nama || p.nama_ayah || p.nama_ibu || '';
    return {
      judul: 'Kuitansi Pembayaran Daftar Ulang', nomor: du.nomor_kuitansi || '',
      meta: `Tahun Ajaran ${esc(ta)} · ${esc(p.gelombang || '')}${p.uji ? ' · <b>DATA UJI COBA · TIDAK BERLAKU</b>' : ''}`,
      isi: `<table class="sk-tabel"><colgroup><col style="width:28%"><col style="width:3%"><col></colgroup><tbody>
          <tr><td>Telah terima dari</td><td>:</td><td>${esc(penyetor || '–')}</td></tr>
          <tr><td>Untuk pembayaran</td><td>:</td><td>Daftar ulang santri baru a.n. <b>${esc(p.nama_lengkap)}</b> (${esc(p.no_registrasi)}), ${esc(p.jenjang)} ${p.bagian === 'putri' ? 'Putri' : 'Putra'}</td></tr>
          <tr><td>Uang sejumlah</td><td>:</td><td><b>${rupiah(bayar)}</b></td></tr>
          <tr><td>Terbilang</td><td>:</td><td><i>${esc(kapital(terbilang(bayar)))} rupiah</i></td></tr>
          <tr><td>Cara pembayaran</td><td>:</td><td>${du.diterima_metode === 'tunai' ? 'Tunai' : 'Transfer bank'}${du.diterima_tanggal ? `, ${fmt.tglPanjang(new Date(du.diterima_tanggal + 'T00:00:00'))}` : ''}</td></tr>
        </tbody></table>
        <div style="height:8px"></div>
        <table><colgroup><col style="width:8%"><col style="width:62%"><col style="width:30%"></colgroup><thead><tr><th>No</th><th>Rincian tagihan</th><th>Nominal</th></tr></thead><tbody>
          ${tag.map((x, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(x.komponen)}</td><td style="text-align:right">${rupiah(x.nominal)}</td></tr>`).join('')}
          <tr><td></td><td><b>Jumlah tagihan</b></td><td style="text-align:right"><b>${rupiah(total)}</b></td></tr>
          <tr><td></td><td>Dibayar</td><td style="text-align:right">${rupiah(bayar)}</td></tr>
          <tr><td></td><td><b>${sisa ? 'Sisa tagihan' : 'Status'}</b></td><td style="text-align:right"><b>${sisa ? rupiah(sisa) : 'LUNAS'}</b></td></tr>
        </tbody></table>
        ${du.catatan ? `<p style="font-size:9.5pt;margin:6px 0 0">Catatan: ${esc(du.catatan)}</p>` : ''}`,
      ttd: [{ jabatan: 'Penyetor,', nama: penyetor }, { jabatan: 'Penerima,', nama: du.nama_verifikator || '' }],
      tanggal: du.diterima_tanggal || null
    };
  }

  // Kolom ekspor (urutan mengikuti pola Database Peserta Didik)
  function kolomEkspor(cfg) {
    const dasar = [['no_registrasi', 'No. Registrasi'], ['nama_lengkap', 'Nama Lengkap'], ['nisn', 'NISN'], ['nik', 'NIK'], ['no_kk', 'No. KK'],
      ['jenis_kelamin', 'Jenis Kelamin'], ['tempat_lahir', 'Tempat Lahir'], ['tanggal_lahir', 'Tanggal Lahir'], ['jenjang', 'Jenjang'], ['bagian', 'Bagian']];
    const sudah = new Set(dasar.map(x => x[0]));
    let sub = '', sLama = -1;
    const semua = isianLengkap(cfg).map(f => { if (f.s !== sLama) { sLama = f.s; sub = LANGKAH[f.s][0]; } if (f.sub) sub = f.sub[0].replace(/ \(.*\)$/, ''); return { f, sub }; }).filter(x => x.f.k && !sudah.has(x.f.k));
    const hitung = {}; semua.forEach(x => { hitung[x.f.l] = (hitung[x.f.l] || 0) + 1; });
    const lain = semua.map(({ f, sub }) => [f.k, hitung[f.l] > 1 ? `${f.l} (${sub.toLowerCase()})` : f.l, f]);
    return [...dasar, ...lain, ['asal_provinsi', 'Provinsi Asal'], ['asal_kabupaten', 'Kabupaten Asal'], ['nomor_skl', 'No. SKL'],
      ['du_status', 'Status Daftar Ulang'], ['tagihan', 'Tagihan'], ['diterima_nominal', 'Dibayar'], ['nomor_kuitansi', 'No. Kuitansi']];
  }

  window.SPMB_DU = { LANGKAH, ISIAN, PENDIDIKAN, PENGHASILAN, HUBUNGAN, STATUS_DU, isianLengkap, wajibKah, teksNilai, nilaiGabung,
    dokumenBuktiDU, dokumenKuitansi, kolomEkspor, rupiah, terbilang };
})();
