/* =====================================================================
   FORMULIR PENDAFTARAN ONLINE (Fase 3 · Langkah 4)
   Halaman daftar.html. Enam langkah: Pilihan, Data Santri, Orang Tua dan
   Kontak, Pertanyaan, Berkas, Periksa dan Kirim.
   - Draf tersimpan otomatis di perangkat (localStorage)
   - Validasi dua kali: saat kolom ditinggalkan dan saat menekan Selanjutnya
   - Wilayah Kemendagri 2025 yang dapat dicari (assets/wilayah)
   - Berkas diunggah ke Google Drive lewat Apps Script dengan token sekali pakai
   Dimuat sebelum situs.js; situs.js memanggil SPMB_HAL.daftar().
   ===================================================================== */
(function () {
  'use strict';
  window.SPMB_HAL = window.SPMB_HAL || {};

  const KUNCI_DRAF = 'spmb-draf-daftar-v1';
  const KUNCI_TERAKHIR = 'spmb-daftar-terakhir';
  const LANGKAH = [
    ['Pilihan', 'ph-signpost', 'var(--c1)'], ['Data Santri', 'ph-student', 'var(--c3)'], ['Orang Tua', 'ph-users-three', 'var(--c5)'],
    ['Pertanyaan', 'ph-chat-circle-dots', 'var(--c2)'], ['Berkas', 'ph-files', 'var(--c4)'], ['Kirim', 'ph-paper-plane-tilt', 'var(--ok)']
  ];
  const PROV_SAH = ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '31', '32', '33', '34', '35', '36', '51', '52', '53', '61', '62', '63', '64', '65', '71', '72', '73', '74', '75', '76', '81', '82', '91', '92', '93', '94', '95', '96'];
  const HUBUNGAN = ['Ayah', 'Ibu', 'Kakak', 'Paman', 'Bibi', 'Kakek', 'Nenek', 'Wali', 'Lainnya'];
  const TINGKAT = ['Sekolah', 'Kecamatan', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional'];
  const POLA_NAMA = /^[\p{L} .,'`’-]{3,100}$/u;
  const BUKAN_HURUF_NAMA = /[^\p{L} .,'`’-]/gu;
  const NAMA_SAJA = ['nama_lengkap', 'nama_ayah', 'nama_ibu', 'darurat_nama', 'perekomendasi'];
  const PERAN_REKOM = ['Pengurus Wahdah Islamiyah', 'Ustadz/ustadzah pondok', 'Guru/pegawai pondok', 'Alumni pondok', 'Wali santri pondok', 'Guru sekolah asal', 'Tokoh agama/masyarakat'];

  // Kolom yang dilaporkan server (hint) -> langkah
  const LANGKAH_KOLOM = {
    jenjang: 0, bagian: 0, nama_lengkap: 1, nisn: 1, nik: 1, tempat_lahir: 1, tanggal_lahir: 1, asal_provinsi: 1, asal_kabupaten: 1,
    provinsi: 1, kabupaten: 1, kecamatan: 1, desa: 1, rt: 1, rw: 1, kode_pos: 1, asal_sekolah: 1, npsn_sekolah: 1,
    nama_ayah: 2, nama_ibu: 2, email: 2, no_wa: 2, darurat_nama: 2, darurat_hubungan: 2, darurat_no: 2,
    pondok_sebelumnya: 3, lama_mondok: 3, hafalan_juz: 3, hafalan_surah: 3, sumber_info: 3, perekomendasi: 3, perekomendasi_peran: 3, prestasi: 3, setuju: 5
  };

  window.SPMB_HAL.daftar = async api => {
    const { sb, fmt, esc, toast, konfirmasi, pesanGalat, cetakDokumen, buatPdfDokumen, dokumenBukti, unggahBerkasPendaftar, konfirmasiPendaftaran, ambilBuktiPdf, simpanPdf } = window.SPMB;
    const $ = (s, r = document) => r.querySelector(s);
    const S = api.S;
    const cfg = S.p.spmb || {};
    const id = S.p.identitas || {};
    const ta = S.ta;
    document.title = `Pendaftaran Online · ${id.nama_singkat || 'SPMB'}`;

    const isi = $('#isi');
    isi.innerHTML = `${api.kepalaHalaman('Pendaftaran Online', `SPMB Tahun Ajaran ${ta}`, 'ph-note-pencil', 'var(--c3)')}
      <section class="sek daftar-sek"><div class="wadah" id="wadahDaftar"><div class="kartu" style="padding:24px"><span class="spinner"></span> Memuat formulir…</div></div></section>`;
    const W = $('#wadahDaftar');

    /* ---------- Data pendukung ---------- */
    const [infoR, sesi] = await Promise.all([sb.rpc('info_spmb'), sb.auth.getSession()]);
    if (infoR.error) throw infoR.error;
    const info = infoR.data;
    let panitia = false;
    let adminP = false;   // Admin/Superadmin: boleh menginput pendaftar sungguhan (berkas menyusul)
    if (sesi.data?.session) {
      const { data } = await sb.rpc('is_panitia'); panitia = !!data;
      if (panitia) { const { data: peran } = await sb.rpc('peran_saya'); adminP = ['admin', 'superadmin'].includes(peran); }
    }
    const gel = info.gelombang;
    const [biayaR, rekR] = await Promise.all([
      sb.from('rincian_biaya').select('*').eq('tahap', 'pendaftaran').eq('tampil', true).is('diarsipkan_pada', null).order('urutan'),
      sb.from('rekening').select('*').eq('tampil', true).is('diarsipkan_pada', null).in('peruntukan', ['semua', 'pendaftaran']).order('urutan')
    ]);
    const biaya = (biayaR.data || []).filter(b => !b.gelombang_id || b.gelombang_id === gel?.id);
    const rekening = rekR.data || [];
    const kontak = (S.konten.kontak_panitia || []);

    // Hasil pendaftaran sebelumnya (untuk mencetak ulang bukti)
    let terakhir = null; try { terakhir = JSON.parse(localStorage.getItem(KUNCI_TERAKHIR) || 'null'); } catch (e) {}

    /* ---------- Formulir tertutup (dibangun paling akhir) ---------- */
    const tertutup = !info.dibuka && !panitia;
    function tampilTutup() {
      const b = info.berikutnya;
      W.innerHTML = `
        <div class="kartu daftar-tutup">
          <span class="ic-box" style="--tone:var(--c7)"><i class="ph-duotone ph-lock-simple"></i></span>
          <h2>${b ? 'Pendaftaran belum dibuka' : 'Pendaftaran sedang ditutup'}</h2>
          <p>${b ? `<b>${esc(b.nama)}</b> dibuka pada <b>${tsPanjang(b.buka)}</b> dan ditutup ${tsPanjang(b.tutup)}.` : 'Saat ini tidak ada gelombang pendaftaran yang dibuka. Pantau jadwal gelombang berikutnya atau hubungi panitia.'}</p>
          ${b ? `<div class="hitung-kecil" data-hitung="${esc(b.buka)}"></div>` : ''}
          <div class="hero-actions" style="justify-content:center"><a class="btn" href="index.html#jadwal"><i class="ph-duotone ph-calendar-dots"></i>Lihat jadwal</a>
            <a class="btn ghost" href="kontak.html"><i class="ph-duotone ph-phone-call"></i>Hubungi panitia</a></div>
          ${terakhir ? `<p class="muted" style="margin-top:18px">Pendaftaran terakhir dari perangkat ini: <b>${esc(terakhir.hasil.no_registrasi)}</b>. <a href="#" id="lihatTerakhir">Lihat bukti</a></p>` : ''}
        </div>`;
      hitungMundur(W);
      $('#lihatTerakhir')?.addEventListener('click', e => { e.preventDefault(); tampilSukses(terakhir.D, terakhir.hasil, true, terakhir.token); });
    }
    const wajibUji = !info.dibuka && panitia && !adminP;
    const modeUji = () => panitia && (wajibUji || st.uji);
    const manualNyata = () => adminP && !modeUji();

    /* ---------- Draf ---------- */
    const baru = () => ({ D: { _kode: {}, prestasi: [], pernah_mondok: false, pondok_sama: false, samakan_asal: false, hafalan_jenis: '', hafalan_juz: '', hafalan_surah: '', sumber_info: [], ada_rekomendasi: false }, langkah: 0, token: null, berkas: {}, ok: [], uji: true });
    let st = baru(), dipulihkan = false;
    try { const x = JSON.parse(localStorage.getItem(KUNCI_DRAF) || 'null'); if (x && x.D) { st = Object.assign(baru(), x); dipulihkan = true; } } catch (e) {}
    const D = st.D; D._kode = D._kode || {}; D.prestasi = D.prestasi || [];
    if (!Array.isArray(D.sumber_info)) D.sumber_info = D.sumber_info ? [D.sumber_info] : [];
    if (!D.hafalan_jenis && D.hafalan_juz !== '' && D.hafalan_juz != null) D.hafalan_jenis = juzAngka(D.hafalan_juz) >= 1 ? 'juz' : 'belum';
    if (D.perekomendasi && D.ada_rekomendasi === undefined) D.ada_rekomendasi = true;
    let tSimpan;
    let selesaiKirim = false;
    const tulisDraf = () => { clearTimeout(tSimpan); tSimpan = null; if (selesaiKirim) return; try { st.waktu = Date.now(); localStorage.setItem(KUNCI_DRAF, JSON.stringify(st)); } catch (e) {} };
    const simpanDraf = (segera = false) => { clearTimeout(tSimpan); if (segera) return tulisDraf(); tSimpan = setTimeout(tulisDraf, 300); };
    // jangan sampai isian terakhir hilang saat halaman ditutup atau dimuat ulang
    addEventListener('pagehide', () => { if (tSimpan) tulisDraf(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && tSimpan) tulisDraf(); });

    /* ---------- Wilayah ---------- */
    const cacheW = {};
    const ambilW = u => cacheW[u] || (cacheW[u] = fetch('assets/wilayah/' + u).then(r => { if (!r.ok) throw new Error('Data wilayah tidak dapat dimuat.'); return r.json(); }));
    const OPSI = {
      provinsi: async () => (await ambilW('provinsi.json')).map(([k, n]) => ({ v: n, kode: k })),
      kabupaten: async prov => prov ? (await ambilW('kabkota.json')).filter(x => x[2] === prov).map(([k, n]) => ({ v: n, kode: k })) : [],
      semuaKab: async () => { const [kab, prov] = await Promise.all([ambilW('kabkota.json'), ambilW('provinsi.json')]); const np = Object.fromEntries(prov);
        return kab.map(([k, n, p]) => ({ v: n, kode: k, sub: np[p] })); },
      kecamatan: async kab => { if (!kab) return []; const P = await ambilW(`p/${kab.slice(0, 2)}.json`); return (P[kab] || []).map(([s, n]) => ({ v: n, kode: `${kab}.${s}` })); },
      desa: async kec => { if (!kec) return []; const P = await ambilW(`p/${kec.slice(0, 2)}.json`); const e = (P[kec.slice(0, 5)] || []).find(x => x[0] === kec.slice(6));
        return e ? e[2].map(([s, n, kp]) => ({ v: n, kode: `${kec}.${s}`, sub: (s[0] === '1' ? 'Kelurahan' : 'Desa') + (kp ? ` · ${kp}` : ''), kp })) : []; }
    };
    // Kolom kombo: sumber opsi dan kolom yang direset bila induknya berubah
    const KOMBO = {
      tempat_lahir: { opsi: () => OPSI.semuaKab(), bebas: true },
      asal_provinsi: { opsi: () => OPSI.provinsi(), anak: ['asal_kabupaten'] },
      asal_kabupaten: { opsi: () => OPSI.kabupaten(D._kode.asal_provinsi), induk: 'asal_provinsi' },
      provinsi: { opsi: () => OPSI.provinsi(), anak: ['kabupaten', 'kecamatan', 'desa'] },
      kabupaten: { opsi: () => OPSI.kabupaten(D._kode.provinsi), induk: 'provinsi', anak: ['kecamatan', 'desa'] },
      kecamatan: { opsi: () => OPSI.kecamatan(D._kode.kabupaten), induk: 'kabupaten', anak: ['desa'] },
      desa: { opsi: () => OPSI.desa(D._kode.kecamatan), induk: 'kecamatan' }
    };
    const NAMA_KOLOM = { asal_provinsi: 'provinsi asal', asal_kabupaten: 'kabupaten/kota asal', provinsi: 'provinsi', kabupaten: 'kabupaten/kota', kecamatan: 'kecamatan', desa: 'desa/kelurahan' };

    /* ---------- Aturan validasi (sama dengan server) ---------- */
    const digit = v => String(v || '').replace(/\D/g, '');
    const normalWA = v => { let x = digit(v); if (x.startsWith('0')) x = '62' + x.slice(1); else if (x.startsWith('8')) x = '62' + x; return x; };
    const usiaPada = (lahir, acuan) => {
      const a = new Date(lahir + 'T00:00:00'), b = new Date(acuan + 'T00:00:00');
      let bln = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()); if (b.getDate() < a.getDate()) bln--;
      return Math.floor(bln / 12) + (bln % 12) / 12;
    };
    // Lama mondok: "1,5" -> 18 bulan -> "1 tahun 6 bulan"
    const lamaBulan = v => {
      v = String(v || '').trim().toLowerCase(); if (!v) return 0;
      const m = v.match(/^(?:(\d{1,2})\s*tahun)?\s*(?:(\d{1,2})\s*bulan)?$/);
      if (m && (m[1] || m[2])) return (+m[1] || 0) * 12 + (+m[2] || 0);
      return /^\d{1,2}([.,]\d{1,2})?$/.test(v) ? Math.round(parseFloat(v.replace(',', '.')) * 12) : 0;
    };
    const teksLama = b => [Math.floor(b / 12) ? `${Math.floor(b / 12)} tahun` : '', b % 12 ? `${b % 12} bulan` : ''].filter(Boolean).join(' ');
    const teksHafalan = d => d.hafalan_jenis === 'juz' ? `${String(juzAngka(d.hafalan_juz)).replace('.', ',')} juz`
      : d.hafalan_jenis === 'surah' ? `${+d.hafalan_surah || 0} surah pendek (kurang dari 1 juz)` : 'Belum ada hafalan';
    // NISN/NIK yang sudah terdaftar (diperiksa ke server; hanya jawaban ya/tidak)
    const TERDAFTAR = {};
    const kunciCek = (j, v) => `${modeUji() ? 'uji:' : ''}${j}:${v}`;
    const PESAN_GANDA = j => `${j} ini sudah terdaftar. Satu ${j} hanya dapat didaftarkan sekali. Bila keliru, hubungi panitia untuk mereset data pendaftaran sebelumnya.`;
    async function periksaTerdaftar() {
      const nisn = digit(D.nisn), nik = digit(D.nik);
      const okNisn = /^\d{10}$/.test(nisn), okNik = /^\d{16}$/.test(nik);
      if (!(okNisn && !(kunciCek('nisn', nisn) in TERDAFTAR)) && !(okNik && !(kunciCek('nik', nik) in TERDAFTAR))) return;
      try {
        const { data, error } = await sb.rpc('cek_terdaftar', { p_nisn: okNisn ? nisn : null, p_nik: okNik ? nik : null, p_uji: modeUji() });
        if (error || !data?.ok) return;   // bila belum dipasang atau sedang padat, server tetap memeriksa saat formulir dikirim
        if (okNisn) TERDAFTAR[kunciCek('nisn', nisn)] = !!data.nisn;
        if (okNik) TERDAFTAR[kunciCek('nik', nik)] = !!data.nik;
      } catch (e) {}
    }
    // Berkas yang menjadi wajib karena isian tertentu
    const prestasiTerisi = () => D.prestasi.filter(p => (p.nama || '').trim());
    const syaratBerkas = b => b.kunci === 'rekomendasi' && D.ada_rekomendasi ? 'Wajib karena Anda mengisi pemberi rekomendasi.'
      : b.kunci === 'sertifikat' && prestasiTerisi().length ? 'Wajib karena Anda mengisi prestasi. Gabungkan semua bukti dalam satu berkas.' : '';
    const wajibBerkas = b => !manualNyata() && (!!b.wajib || !!syaratBerkas(b));
    const acuanUsia = cfg.usia?.acuan || '2027-07-01';
    const batasUsia = j => ({ min: cfg.usia?.[j]?.min ?? (j === 'SMP' ? 11 : 14), maks: cfg.usia?.[j]?.maks ?? (j === 'SMP' ? 15 : 18) });
    const V = {
      nama_lengkap: v => !POLA_NAMA.test((v || '').trim()) && ['err', 'Nama 3–100 huruf; hanya huruf, spasi, titik, koma, petik, dan strip.'],
      nisn: v => !/^\d{10}$/.test(v || '') ? ['err', 'NISN harus tepat 10 digit angka.'] : TERDAFTAR[kunciCek('nisn', v)] && ['err', PESAN_GANDA('NISN')],
      nik: v => {
        if (!/^\d{16}$/.test(v || '')) return ['err', 'NIK harus tepat 16 digit angka.'];
        if (!PROV_SAH.includes(v.slice(0, 2))) return ['err', 'Dua digit awal NIK bukan kode provinsi yang sah.'];
        if (TERDAFTAR[kunciCek('nik', v)]) return ['err', PESAN_GANDA('NIK')];
        if (D.tanggal_lahir) {
          const [y, m, d] = D.tanggal_lahir.split('-');
          const dd = +v.slice(6, 8), mm = v.slice(8, 10), yy = v.slice(10, 12);
          const hari = dd > 40 ? dd - 40 : dd, perempuan = dd > 40;
          if (hari !== +d || mm !== m || yy !== y.slice(2)) return ['warn', `Tanggal lahir pada NIK (${String(hari).padStart(2, '0')}/${mm}/${yy}) berbeda dengan tanggal lahir yang diisi. Mohon diperiksa.`];
          if (D.bagian && perempuan !== (D.bagian === 'putri')) return ['warn', `Kode jenis kelamin pada NIK menunjukkan ${perempuan ? 'perempuan' : 'laki-laki'}, sedangkan pilihan Anda ${D.bagian}. Mohon diperiksa.`];
        }
      },
      tempat_lahir: v => (v || '').trim().length < 3 && ['err', 'Tempat lahir wajib diisi (ketik untuk mencari kabupaten/kota).'],
      tanggal_lahir: v => {
        if (!v) return ['err', 'Tanggal lahir wajib diisi.'];
        if (v > fmt.isoTgl()) return ['err', 'Tanggal lahir tidak boleh setelah hari ini.'];
        if (!D.jenjang) return;
        const u = usiaPada(v, acuanUsia), { min, maks } = batasUsia(D.jenjang);
        const teks = `${Math.floor(u)} tahun per ${fmt.tgl(new Date(acuanUsia + 'T00:00:00'))}`;
        if (u < min - 1 || u >= maks + 2) return ['err', `Usia ${teks}, di luar batas jenjang ${D.jenjang} (${min}–${maks} tahun).`];
        if (u < min || u >= maks + 1) return ['warn', `Usia ${teks}; batas wajar jenjang ${D.jenjang} ${min}–${maks} tahun. Panitia akan meninjau.`];
      },
      rt: v => !/^\d{1,3}$/.test(v || '') && ['err', 'RT berisi 1–3 digit angka.'],
      rw: v => !/^\d{1,3}$/.test(v || '') && ['err', 'RW berisi 1–3 digit angka.'],
      kode_pos: v => !/^\d{5}$/.test(v || '') && ['err', 'Kode pos harus tepat 5 digit.'],
      alamat_jalan: v => (v || '').trim().length < 3 && ['err', 'Tulis nama jalan/lorong dan nomor rumah.'],
      asal_sekolah: v => (v || '').trim().length < 3 && ['err', 'Asal sekolah wajib diisi.'],
      npsn_sekolah: v => v && !/^\d{8}$/.test(v) && ['err', 'NPSN harus tepat 8 digit (boleh dikosongkan).'],
      nama_ayah: v => !POLA_NAMA.test((v || '').trim()) && ['err', 'Nama ayah 3–100 huruf.'],
      nama_ibu: v => !POLA_NAMA.test((v || '').trim()) && ['err', 'Nama ibu 3–100 huruf.'],
      pekerjaan_ayah: v => !v && ['err', 'Pilih pekerjaan ayah.'],
      pekerjaan_ibu: v => !v && ['err', 'Pilih pekerjaan ibu.'],
      email: v => !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test((v || '').trim()) && ['err', 'Alamat email belum benar, contoh: nama@gmail.com'],
      email2: v => (v || '').trim().toLowerCase() !== (D.email || '').trim().toLowerCase() && ['err', 'Email tidak sama dengan yang diketik pertama.'],
      no_wa: v => !/^628\d{7,11}$/.test(normalWA(v)) && ['err', 'Nomor WhatsApp diawali 08 atau +62, 10–13 digit.'],
      darurat_nama: v => !POLA_NAMA.test((v || '').trim()) && ['err', 'Nama orang terkait wajib diisi dengan huruf (3–100 huruf, tanpa angka).'],
      darurat_hubungan: v => !v && ['err', 'Pilih hubungan dengan calon santri.'],
      darurat_no: v => !/^628\d{7,11}$/.test(normalWA(v)) ? ['err', 'Nomor kontak darurat diawali 08 atau +62, 10–13 digit.']
        : normalWA(v) === normalWA(D.no_wa) && ['warn', 'Nomor kontak darurat sama dengan nomor WhatsApp utama. Sebaiknya nomor lain.'],
      pondok_sebelumnya: v => D.pernah_mondok && (v || '').trim().length < 3 && ['err', 'Tulis nama pondok sebelumnya.'],
      lama_mondok: v => { if (!D.pernah_mondok) return; const b = lamaBulan(v); return (b < 1 || b > 180) && ['err', 'Isi lama mondok dalam tahun, misalnya 1,5 (menjadi 1 tahun 6 bulan) atau 0,5 (6 bulan).']; },
      hafalan_jenis: v => !v && ['err', 'Pilih keadaan hafalan Al-Qur\'an calon santri.'],
      hafalan_juz: v => { if (D.hafalan_jenis !== 'juz') return; const n = juzAngka(v); return (isNaN(n) || n < 1 || n > 30 || n * 2 !== Math.floor(n * 2)) && ['err', 'Isi 1–30 juz (boleh setengah, misalnya 2,5). Bila kurang dari 1 juz, pilih "Kurang dari 1 juz".']; },
      hafalan_surah: v => D.hafalan_jenis === 'surah' && !(/^\d{1,3}$/.test(v || '') && +v >= 1 && +v <= 114) && ['err', 'Isi jumlah surah yang sudah dihafal (1–114).'],
      sumber_info: v => !(v && v.length) && ['err', 'Pilih minimal satu sumber informasi SPMB.'],
      perekomendasi: v => D.ada_rekomendasi && !POLA_NAMA.test((v || '').trim()) && ['err', 'Nama pemberi rekomendasi 3–100 huruf, tanpa angka.'],
      perekomendasi_peran: v => D.ada_rekomendasi && (v || '').trim().length < 3 && ['err', 'Isi jabatan/kedudukan pemberi rekomendasi.']
    };
    Object.keys(KOMBO).filter(k => !KOMBO[k].bebas).forEach(k => {
      V[k] = v => !v ? ['err', `Pilih ${NAMA_KOLOM[k]} dari daftar.`] : !D._kode[k] && ['err', `Pilih ${NAMA_KOLOM[k]} dari daftar yang muncul saat mengetik.`];
    });
    const KOLOM_LANGKAH = [
      [],
      ['nama_lengkap', 'nisn', 'nik', 'tempat_lahir', 'tanggal_lahir', 'asal_provinsi', 'asal_kabupaten', 'provinsi', 'kabupaten', 'kecamatan', 'desa', 'alamat_jalan', 'rt', 'rw', 'kode_pos', 'asal_sekolah', 'npsn_sekolah'],
      ['nama_ayah', 'pekerjaan_ayah', 'nama_ibu', 'pekerjaan_ibu', 'email', 'email2', 'no_wa', 'darurat_nama', 'darurat_hubungan', 'darurat_no'],
      ['pondok_sebelumnya', 'lama_mondok', 'hafalan_jenis', 'hafalan_juz', 'hafalan_surah', 'sumber_info', 'perekomendasi', 'perekomendasi_peran']
    ];

    /* ---------- Pembuat kolom ---------- */
    const bantu = t => t ? `<small class="bantu">${t}</small>` : '';
    const wajib = '<span class="req">*</span>';
    const kolom = (k, label, { tipe = 'text', mode = '', maks = 100, contoh = '', b = '', opsional = false, full = false, kunci = false, daftar = '', satuan = '' } = {}) => `
      <div class="field${full ? ' full' : ''}${kunci ? ' terkunci' : ''}" data-f="${k}"><label for="k_${k}">${label}${opsional ? ' <span class="muted">(opsional)</span>' : ` ${wajib}`}</label>
        ${satuan ? '<div class="isian-satuan">' : ''}<input class="input" id="k_${k}" name="${k}" type="${tipe}" value="${esc(D[k] ?? '')}" ${mode ? `inputmode="${mode}"` : ''} maxlength="${DIGIT_SAJA[k] ? maks + 12 : maks}" ${contoh ? `placeholder="${esc(contoh)}"` : ''} ${kunci ? 'readonly' : ''} ${daftar ? `list="${daftar}"` : ''} autocomplete="off">${satuan ? `<span>${satuan}</span></div>` : ''}
        ${bantu(b)}<small class="pesan"></small></div>`;
    const pilihan = (k, label, opsi, { b = '', full = false } = {}) => `
      <div class="field${full ? ' full' : ''}" data-f="${k}"><label for="k_${k}">${label} ${wajib}</label>
        <select class="select" id="k_${k}" name="${k}"><option value="">— Pilih —</option>${opsi.map(o => `<option ${o === D[k] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>
        ${bantu(b)}<small class="pesan"></small></div>`;
    const kombo = (k, label, { b = '', contoh = 'Ketik untuk mencari', full = false, kunci = false } = {}) => `
      <div class="field kombo${full ? ' full' : ''}${kunci ? ' terkunci' : ''}" data-f="${k}" data-kombo="${k}"><label for="k_${k}">${label} ${wajib}</label>
        <div class="kombo-wadah"><input class="input" id="k_${k}" name="${k}" value="${esc(D[k] ?? '')}" placeholder="${esc(contoh)}" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" ${kunci ? 'readonly' : ''}>
          <i class="ph-duotone ${kunci ? 'ph-lock-simple' : 'ph-magnifying-glass'} kombo-ikon"></i><ul class="kombo-daftar" role="listbox" hidden></ul></div>
        ${bantu(b)}<small class="pesan"></small></div>`;
    const subjudul = (ic, t, teks) => `<h3 class="daftar-sub"><i class="ph-duotone ${ic}" style="color:${t}"></i>${teks}</h3>`;

    /* ---------- Isi tiap langkah ---------- */
    const rupiah = n => 'Rp ' + fmt.angka(n || 0);
    const kuotaDari = (j, b) => (info.kuota || []).find(x => x.jenjang === j && x.bagian === b) || {};
    const biayaUntuk = (j, b) => biaya.filter(x => x.wajib && (x.jenjang === 'semua' || x.jenjang === j) && (x.bagian === 'semua' || x.bagian === b));

    const HAL = [
      // 1. Pilihan
      () => {
        const kartuPilih = (k, v, judul, sub, ic, t, mati) => `<label class="pilih-kartu${mati ? ' mati' : ''}" style="--tone:${t}">
          <input type="radio" name="${k}" value="${v}" ${D[k] === v ? 'checked' : ''} ${mati ? 'disabled' : ''}>
          <span class="ic-box"><i class="ph-duotone ${ic}"></i></span><span><b>${judul}</b><small>${sub}</small></span><i class="ph-duotone ph-check-circle centang"></i></label>`;
        const sisaTeks = (j, b) => { const q = kuotaDari(j, b); return q.kuota == null ? '' : q.sisa === 0 ? ' · Kuota penuh' : ` · Sisa ${q.sisa} kursi`; };
        const penuh = (j, b) => !modeUji() && kuotaDari(j, b).kuota != null && kuotaDari(j, b).sisa === 0;
        const bj = D.jenjang && D.bagian ? biayaUntuk(D.jenjang, D.bagian) : [];
        return `
          ${subjudul('ph-graduation-cap', 'var(--c1)', 'Jenjang pendidikan')}
          <div class="pilih-kisi" data-f="jenjang">
            ${kartuPilih('jenjang', 'SMP', 'SMP', 'Tingkat SMP/MTs (kelas 7)', 'ph-backpack', 'var(--c1)')}
            ${kartuPilih('jenjang', 'SMA', 'SMA', 'Tingkat SMA/MA (kelas 10)', 'ph-graduation-cap', 'var(--c2)')}
          </div><small class="pesan" data-pesan="jenjang"></small>
          ${subjudul('ph-users', 'var(--c4)', 'Putra atau putri')}
          <div class="pilih-kisi" data-f="bagian">
            ${kartuPilih('bagian', 'putra', 'Putra', 'Santri laki-laki' + (D.jenjang ? sisaTeks(D.jenjang, 'putra') : ''), 'ph-gender-male', 'var(--c5)', D.jenjang && penuh(D.jenjang, 'putra'))}
            ${kartuPilih('bagian', 'putri', 'Putri', 'Santri perempuan' + (D.jenjang ? sisaTeks(D.jenjang, 'putri') : ''), 'ph-gender-female', 'var(--c4)', D.jenjang && penuh(D.jenjang, 'putri'))}
          </div><small class="pesan" data-pesan="bagian"></small>
          <div class="gel-info">
            <span class="ic-box" style="--tone:var(--c2)"><i class="ph-duotone ph-flag-banner"></i></span>
            <div><small>Gelombang</small><b>${esc(gel?.nama || 'Mode uji coba panitia')}</b>
              ${gel ? `<span>Ditutup ${tsPanjang(gel.tutup)}</span>` : ''}</div>
            ${bj.length ? `<div class="gel-biaya"><small>Biaya pendaftaran</small><b>${rupiah(bj.reduce((a, x) => a + +x.nominal, 0))}</b></div>` : ''}
          </div>
          ${cfg.catatan_formulir ? `<div class="note info" style="margin-top:14px"><i class="ph-duotone ph-info"></i><div>${esc(cfg.catatan_formulir)}</div></div>` : ''}
          <div class="note" style="margin-top:14px"><i class="ph-duotone ph-lightbulb"></i><div>Siapkan foto/scan <b>${(cfg.berkas || []).filter(b => b.wajib).map(b => esc(b.label)).join(', ')}</b>. Isian tersimpan otomatis di perangkat ini, jadi Anda dapat melanjutkan kapan saja.</div></div>`;
      },
      // 2. Data santri
      () => `
        ${subjudul('ph-identification-card', 'var(--c3)', 'Identitas calon santri')}
        <div class="grid-form">
          ${kolom('nama_lengkap', 'Nama lengkap sesuai akta kelahiran', { full: 1, contoh: 'Muhammad Fathir Al-Ghifari' })}
          ${kolom('nisn', 'NISN', { mode: 'numeric', maks: 10, contoh: '10 digit', b: 'Nomor Induk Siswa Nasional. Dapat dicek di nisn.data.kemdikbud.go.id' })}
          ${kolom('nik', 'NIK calon santri', { mode: 'numeric', maks: 16, contoh: '16 digit', b: 'Nomor Induk Kependudukan pada Kartu Keluarga.' })}
          ${kombo('tempat_lahir', 'Tempat lahir (kabupaten/kota)', { contoh: 'Ketik, misalnya Gowa' })}
          <div class="field" data-f="tanggal_lahir"><label for="k_tanggal_lahir">Tanggal lahir ${wajib}</label>
            <input class="input" id="k_tanggal_lahir" name="tanggal_lahir" type="date" value="${esc(D.tanggal_lahir || '')}" max="${fmt.isoTgl()}">
            <small class="bantu">Jenis kelamin: <b>${D.bagian === 'putri' ? 'Perempuan' : D.bagian === 'putra' ? 'Laki-laki' : '–'}</b> (sesuai pilihan putra/putri).</small><small class="pesan"></small></div>
        </div>
        ${subjudul('ph-map-trifold', 'var(--c5)', 'Asal daerah')}
        <div class="grid-form">${kombo('asal_provinsi', 'Provinsi asal')}${kombo('asal_kabupaten', 'Kabupaten/kota asal')}</div>
        ${subjudul('ph-house-line', 'var(--c1)', 'Alamat domisili')}
        <label class="check centang-kotak"><input type="checkbox" id="samakanAsal" ${D.samakan_asal ? 'checked' : ''}>
          <span>Provinsi dan kabupaten/kota domisili <b>sama dengan asal daerah</b><small>Centang agar tidak perlu memilih dua kali.</small></span></label>
        <div class="grid-form">
          ${kombo('provinsi', 'Provinsi', { kunci: D.samakan_asal, b: D.samakan_asal ? 'Mengikuti asal daerah.' : '' })}${kombo('kabupaten', 'Kabupaten/kota', { kunci: D.samakan_asal, b: D.samakan_asal ? 'Mengikuti asal daerah.' : '' })}${kombo('kecamatan', 'Kecamatan')}${kombo('desa', 'Desa/kelurahan')}
          ${kolom('alamat_jalan', 'Jalan / lorong dan nomor rumah', { full: 1, maks: 200, contoh: 'Jl. Poros Malino No. 12' })}
          ${kolom('dusun', 'Dusun / lingkungan', { opsional: 1, contoh: 'Dusun Bontorita' })}
          <div class="field tiga">
            ${['rt', 'rw'].map(k => `<div data-f="${k}"><label for="k_${k}">${k.toUpperCase()} ${wajib}</label><input class="input" id="k_${k}" name="${k}" inputmode="numeric" maxlength="12" value="${esc(D[k] || '')}" placeholder="001"><small class="pesan"></small></div>`).join('')}
            <div data-f="kode_pos"><label for="k_kode_pos">Kode pos ${wajib}</label><input class="input" id="k_kode_pos" name="kode_pos" inputmode="numeric" maxlength="16" value="${esc(D.kode_pos || '')}"><small class="pesan"></small></div>
          </div>
        </div>
        ${subjudul('ph-school', 'var(--c2)', 'Sekolah asal')}
        <div class="grid-form">
          ${kolom('asal_sekolah', 'Nama sekolah asal', { maks: 150, contoh: D.jenjang === 'SMA' ? 'SMP Negeri 1 Sungguminasa' : 'SD Negeri 1 Bontonompo' })}
          ${kolom('npsn_sekolah', 'NPSN sekolah asal', { mode: 'numeric', maks: 8, opsional: 1, contoh: '8 digit', b: 'Dapat dicek di referensi.data.kemdikbud.go.id' })}
        </div>`,
      // 3. Orang tua dan kontak
      () => `
        ${subjudul('ph-user', 'var(--c1)', 'Ayah')}
        <div class="grid-form">${kolom('nama_ayah', 'Nama ayah', { contoh: 'Nama lengkap ayah kandung' })}${pilihan('pekerjaan_ayah', 'Pekerjaan ayah', cfg.pekerjaan || [])}</div>
        ${subjudul('ph-user', 'var(--c4)', 'Ibu')}
        <div class="grid-form">${kolom('nama_ibu', 'Nama ibu', { contoh: 'Nama lengkap ibu kandung' })}${pilihan('pekerjaan_ibu', 'Pekerjaan ibu', cfg.pekerjaan || [])}</div>
        ${subjudul('ph-envelope-simple', 'var(--c3)', 'Kontak orang tua / wali')}
        <div class="grid-form">
          ${kolom('email', 'Email', { tipe: 'email', mode: 'email', contoh: 'nama@gmail.com', b: 'Bukti pendaftaran dan informasi dikirim ke email ini.' })}
          ${kolom('email2', 'Ketik ulang email', { tipe: 'email', mode: 'email', contoh: 'Harus sama dengan email di samping' })}
          ${kolom('no_wa', 'Nomor WhatsApp', { tipe: 'tel', mode: 'tel', maks: 18, contoh: '08xxxxxxxxxx', b: 'Panitia menghubungi melalui nomor ini.' })}
        </div>
        ${subjudul('ph-first-aid-kit', 'var(--c7)', 'Kontak darurat (orang terkait)')}
        <div class="grid-form">
          ${kolom('darurat_nama', 'Nama orang terkait', { contoh: 'Nama lengkap, misalnya Hasan Basri', b: 'Orang yang dapat dihubungi saat keadaan darurat. Hanya huruf, tanpa angka.' })}
          ${pilihan('darurat_hubungan', 'Hubungan dengan santri', HUBUNGAN)}
          ${kolom('darurat_no', 'Nomor HP / WhatsApp kontak darurat', { tipe: 'tel', mode: 'tel', maks: 18, contoh: '08xxxxxxxxxx' })}
        </div>`,
      // 4. Pertanyaan
      () => {
        if (D.pondok_sama) D.pondok_sebelumnya = D.asal_sekolah || '';
        const chip = (nama, nilai, label, cek) => `<label><input type="radio" name="${nama}" value="${nilai}" ${cek ? 'checked' : ''}>${label}</label>`;
        const lb = lamaBulan(D.lama_mondok);
        return `
        ${subjudul('ph-house-simple', 'var(--c2)', 'Riwayat mondok')}
        <div class="field full" data-f="pernah_mondok"><span class="label">Pernah mondok sebelumnya? ${wajib}</span>
          <div class="chips-select">${chip('pernah_mondok', 'tidak', 'Belum pernah', !D.pernah_mondok)}${chip('pernah_mondok', 'ya', 'Pernah', D.pernah_mondok)}</div></div>
        ${D.pernah_mondok ? `
          ${D.asal_sekolah ? `<label class="check centang-kotak"><input type="checkbox" id="pondokSama" ${D.pondok_sama ? 'checked' : ''}>
            <span>Sekolah asal <b>${esc(D.asal_sekolah)}</b> adalah pondok pesantren<small>Centang agar nama pondok tidak perlu ditulis ulang.</small></span></label>` : ''}
          <div class="grid-form">
            ${kolom('pondok_sebelumnya', 'Nama pondok sebelumnya', { maks: 150, kunci: D.pondok_sama, contoh: 'Pondok Pesantren …', b: D.pondok_sama ? 'Mengikuti sekolah asal.' : '' })}
            ${kolom('lama_mondok', 'Lama mondok', { mode: 'decimal', maks: 20, contoh: 'Dalam tahun, misalnya 1,5',
              b: `<span id="bantuLama">${lb ? `= <b>${teksLama(lb)}</b>` : 'Tulis dalam tahun: 1,5 = 1 tahun 6 bulan; 0,5 = 6 bulan.'}</span>` })}
          </div>` : ''}
        ${subjudul('ph-book-open-text', 'var(--c5)', 'Hafalan Al-Qur\'an')}
        <div class="field full" data-f="hafalan_jenis"><span class="label">Keadaan hafalan ${wajib}</span>
          <div class="chips-select">${chip('hafalan_jenis', 'juz', '1 juz atau lebih', D.hafalan_jenis === 'juz')}${chip('hafalan_jenis', 'surah', 'Kurang dari 1 juz (surah pendek)', D.hafalan_jenis === 'surah')}${chip('hafalan_jenis', 'belum', 'Belum ada hafalan', D.hafalan_jenis === 'belum')}</div>
          <small class="pesan"></small></div>
        ${D.hafalan_jenis === 'juz' ? `<div class="grid-form">${kolom('hafalan_juz', 'Jumlah hafalan', { mode: 'decimal', maks: 4, contoh: 'Misalnya 10', satuan: 'Juz', b: 'Hanya angka. Boleh setengah, misalnya 2,5.' })}</div>` : ''}
        ${D.hafalan_jenis === 'surah' ? `<div class="grid-form">${kolom('hafalan_surah', 'Jumlah surah yang dihafal', { mode: 'numeric', maks: 3, contoh: 'Misalnya 12', satuan: 'Surah', b: 'Hitung semua surah yang sudah dihafal. Contoh: An-Nas sampai Al-Fil = 10 surah.' })}</div>` : ''}
        ${subjudul('ph-megaphone', 'var(--c3)', 'Informasi SPMB')}
        <div class="field full" data-f="sumber_info"><span class="label">Dari mana mengetahui informasi SPMB? ${wajib} <span class="muted">(boleh pilih lebih dari satu)</span></span>
          <div class="chips-select cek-banyak">${(cfg.sumber_info || []).map(x => `<label><input type="checkbox" name="sumber_info" value="${esc(x)}" ${D.sumber_info.includes(x) ? 'checked' : ''}><i class="ph-duotone ph-square kosong"></i><i class="ph-duotone ph-check-square penuh"></i>${esc(x)}</label>`).join('')}</div>
          <small class="pesan"></small></div>
        ${subjudul('ph-handshake', 'var(--c1)', 'Rekomendasi')}
        <div class="field full" data-f="ada_rekomendasi"><span class="label">Ada yang merekomendasikan calon santri?</span>
          <div class="chips-select">${chip('ada_rekomendasi', 'tidak', 'Tidak ada', !D.ada_rekomendasi)}${chip('ada_rekomendasi', 'ya', 'Ada pemberi rekomendasi', D.ada_rekomendasi)}</div></div>
        ${D.ada_rekomendasi ? `
          <div class="grid-form">
            ${kolom('perekomendasi', 'Nama pemberi rekomendasi', { contoh: 'Nama lengkap, misalnya Ust. Ahmad Syarif' })}
            ${kolom('perekomendasi_peran', 'Jabatan / kedudukan', { maks: 80, contoh: 'Pilih atau ketik', daftar: 'daftarPeran', b: 'Misalnya Pengurus Wahdah Islamiyah, ustadz pondok, atau alumni.' })}
          </div>
          <datalist id="daftarPeran">${PERAN_REKOM.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
          <div class="note info"><i class="ph-duotone ph-file-text"></i><div><b>Surat rekomendasi wajib diunggah</b> pada langkah Berkas.</div></div>` : ''}
        ${subjudul('ph-trophy', 'var(--c6)', 'Prestasi (opsional)')}
        <div class="note info"><i class="ph-duotone ph-certificate"></i><div>Setiap prestasi wajib dibuktikan dengan sertifikat, piagam, atau surat keterangan.
          <b>Gabungkan semua bukti menjadi satu berkas</b> (sebaiknya PDF), lalu unggah sekali pada langkah Berkas.
          Tips: fitur <i>Pindai</i> di aplikasi Google Drive dapat memotret beberapa lembar menjadi satu PDF.</div></div>
        <div id="daftarPrestasi"></div>
        <button type="button" class="btn sm ghost" id="tambahPrestasi"><i class="ph-duotone ph-plus-circle" style="color:var(--c6)"></i>Tambah prestasi</button>`;
      },
      // 5. Berkas
      () => {
        const bj = biayaUntuk(D.jenjang, D.bagian);
        const rek = rekening.filter(r => r.bagian === 'semua' || r.bagian === D.bagian);
        return `
          ${bj.length || rek.length ? `<div class="bayar-kotak">
            ${bj.length ? `<div class="bayar-rincian"><small>Biaya pendaftaran ${esc(D.jenjang || '')} ${esc(D.bagian || '')}</small>
              ${bj.map(x => `<div><span>${esc(x.komponen)}</span><b>${rupiah(x.nominal)}</b></div>`).join('')}
              <div class="total"><span>Total transfer</span><b>${rupiah(bj.reduce((a, x) => a + +x.nominal, 0))}</b></div></div>` : ''}
            ${rek.length ? `<div class="bayar-rek">${rek.map(r => `<div class="rek-item"><span class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-bank"></i></span>
              <div><small>${esc(r.bank)}</small><b>${esc(r.nomor_rekening)}</b><span>a.n. ${esc(r.atas_nama)}</span>${r.keterangan ? `<em>${esc(r.keterangan)}</em>` : ''}</div>
              <button type="button" class="icon-btn plain" data-salin="${esc(digit(r.nomor_rekening))}" title="Salin nomor rekening" aria-label="Salin nomor rekening"><i class="ph-duotone ph-copy"></i></button></div>`).join('')}</div>` : ''}
          </div>` : ''}
          <p class="muted" style="margin:0 0 12px;font-size:13.5px"><i class="ph-duotone ph-info"></i> Foto otomatis diperkecil sebelum dikirim. PDF maksimal 5 MB. Pastikan tulisan terbaca jelas.</p>
          <div class="berkas-daftar">${[...(cfg.berkas || [])].sort((a, b) => wajibBerkas(b) - wajibBerkas(a)).map(b => kartuBerkas(b)).join('')}</div>`;
      },
      // 6. Periksa dan kirim
      () => ringkasan()
    ];

    const kartuBerkas = b => {
      const x = st.berkas[b.kunci];
      return `<div class="berkas-kartu${x ? ' ada' : ''}" data-berkas="${b.kunci}" data-f="berkas_${b.kunci}">
        <div class="berkas-prev">${x ? (x.thumb ? `<img alt="" src="${x.thumb}">` : '<i class="ph-duotone ph-file-pdf"></i>') : `<i class="ph-duotone ${b.jenis === 'gambar' ? 'ph-image' : 'ph-file-arrow-up'}"></i>`}</div>
        <div class="berkas-teks"><b>${esc(b.label)} ${wajibBerkas(b) ? wajib : '<span class="muted">(opsional)</span>'}</b>
          ${syaratBerkas(b) ? `<small class="alasan"><i class="ph-duotone ph-info"></i> ${syaratBerkas(b)}</small>` : ''}
          <span class="berkas-status">${x ? `<i class="ph-duotone ph-check-circle" style="color:var(--ok)"></i> ${esc(x.nama)} · ${Math.max(1, Math.round(x.ukuran / 1024))} KB` : (b.jenis === 'gambar' ? 'Foto (JPG/PNG)' : b.kunci === 'sertifikat' ? 'Satu PDF gabungan semua bukti (maks. 5 MB)' : 'Foto (JPG/PNG) atau PDF')}</span>
          <small class="pesan"></small></div>
        <label class="btn sm ${x ? 'ghost' : ''}"><i class="ph-duotone ${x ? 'ph-arrows-clockwise' : 'ph-upload-simple'}"></i>${x ? 'Ganti' : 'Pilih'}
          <input type="file" hidden accept="${b.jenis === 'gambar' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'}"></label>
      </div>`;
    };

    function ringkasan() {
      const baris = (l, v) => `<div><span>${l}</span><b>${esc(v || '–')}</b></div>`;
      const blok = (i, isiB) => `<div class="ringkas-blok"><div class="ringkas-kepala"><span class="ic-box" style="--tone:${LANGKAH[i][2]}"><i class="ph-duotone ${LANGKAH[i][1]}"></i></span><b>${LANGKAH[i][0]}</b>
        <button type="button" class="btn sm ghost" data-ke="${i}"><i class="ph-duotone ph-pencil-simple"></i>Ubah</button></div><div class="ringkas-isi">${isiB}</div></div>`;
      const alamat = [D.alamat_jalan, D.dusun, `RT ${D.rt || '–'} / RW ${D.rw || '–'}`, D.desa, `Kec. ${D.kecamatan || '–'}`, D.kabupaten, D.provinsi, D.kode_pos].filter(Boolean).join(', ');
      const peringatan = daftarPeringatan();
      return `
        ${blok(0, baris('Jenjang', D.jenjang) + baris('Putra/putri', D.bagian === 'putra' ? 'Putra' : D.bagian === 'putri' ? 'Putri' : '') + baris('Gelombang', gel?.nama || 'Uji coba'))}
        ${blok(1, baris('Nama lengkap', D.nama_lengkap) + baris('NISN', D.nisn) + baris('NIK', D.nik) + baris('Tempat, tanggal lahir', `${D.tempat_lahir || '–'}, ${D.tanggal_lahir ? fmt.tglPanjang(new Date(D.tanggal_lahir + 'T00:00:00')) : '–'}`)
          + baris('Asal daerah', `${D.asal_kabupaten || '–'}, ${D.asal_provinsi || '–'}`) + baris('Alamat domisili', alamat) + baris('Sekolah asal', `${D.asal_sekolah || '–'}${D.npsn_sekolah ? ` (NPSN ${D.npsn_sekolah})` : ''}`))}
        ${blok(2, baris('Ayah', `${D.nama_ayah || '–'} · ${D.pekerjaan_ayah || '–'}`) + baris('Ibu', `${D.nama_ibu || '–'} · ${D.pekerjaan_ibu || '–'}`) + baris('Email', D.email)
          + baris('WhatsApp', D.no_wa ? '+' + normalWA(D.no_wa) : '') + baris('Orang terkait (darurat)', `${D.darurat_nama || '–'} (${D.darurat_hubungan || '–'}) · +${normalWA(D.darurat_no)}`))}
        ${blok(3, baris('Riwayat mondok', D.pernah_mondok ? `${D.pondok_sebelumnya}${D.lama_mondok ? `, ${D.lama_mondok}` : ''}` : 'Belum pernah') + baris('Hafalan', teksHafalan(D))
          + baris('Sumber informasi', D.sumber_info.join(', ')) + baris('Rekomendasi', D.ada_rekomendasi ? `${D.perekomendasi} (${D.perekomendasi_peran})` : 'Tidak ada')
          + baris('Prestasi', D.prestasi.filter(p => p.nama).map(p => `${p.nama} (${p.tingkat}, ${p.tahun})`).join('; ') || 'Tidak ada'))}
        ${blok(4, (cfg.berkas || []).map(b => baris(b.label, st.berkas[b.kunci] ? '✓ Terunggah' : wajibBerkas(b) ? 'BELUM DIUNGGAH' : 'Tidak ada')).join(''))}
        ${peringatan.length ? `<div class="note"><i class="ph-duotone ph-warning"></i><div><b>Perlu diperhatikan:</b><ul style="margin:4px 0 0;padding-left:18px">${peringatan.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          <label class="check" style="margin-top:8px"><input type="checkbox" id="setujuPeringatan" ${st.okPeringatan ? 'checked' : ''}>Saya sudah memeriksa dan data tersebut memang benar.</label></div></div>` : ''}
        <label class="check pernyataan" data-f="setuju"><input type="checkbox" id="setuju" ${D.setuju ? 'checked' : ''}><span>${esc(cfg.pernyataan || 'Saya menyatakan data yang diisi benar.')}</span></label>
        <small class="pesan" data-pesan="setuju"></small>`;
    }

    /* ---------- Kerangka formulir ---------- */
    W.innerHTML = `
      <div id="pitaPanitia"></div>
      <div id="pitaDraf"></div>
      <div class="kartu daftar-kartu">
        <ol class="stepper-daftar" id="stepper"></ol>
        <div class="stepper-hp"><b id="judulLangkah"></b><span id="nomorLangkah"></span><i class="bar"><i id="barLangkah"></i></i></div>
        <form id="fDaftar" novalidate autocomplete="off"><div id="isiLangkah"></div></form>
        <div class="daftar-aksi">
          <button type="button" class="btn ghost" id="btnKembali"><i class="ph-duotone ph-arrow-left"></i>Kembali</button>
          <span class="muted simpan-status" id="statusSimpan"></span>
          <button type="button" class="btn" id="btnLanjut"></button>
        </div>
      </div>`;

    if (dipulihkan && st.waktu) {
      $('#pitaDraf').innerHTML = `<div class="note info"><i class="ph-duotone ph-floppy-disk"></i><div>Melanjutkan isian yang tersimpan ${fmt.relatif(st.waktu)}.
        <button type="button" class="tautan-btn" id="mulaiBaru">Mulai dari awal</button></div></div>`;
      $('#mulaiBaru').onclick = async () => {
        if (!(await konfirmasi('Mulai dari awal?', 'Semua isian dan berkas yang sudah diunggah di perangkat ini dikosongkan.', 'Mulai dari awal', true))) return;
        localStorage.removeItem(KUNCI_DRAF); location.reload();
      };
    }
    function tampilPitaPanitia() {
      const el = $('#pitaPanitia'); if (!el || !panitia) return;
      el.innerHTML = `<div class="note info pita-uji"><i class="ph-duotone ${modeUji() ? 'ph-flask' : 'ph-user-circle-plus'}"></i><div><b>Anda masuk sebagai panitia.</b> ${wajibUji
        ? 'Pendaftaran belum dibuka untuk umum, sehingga kiriman dari formulir ini tersimpan sebagai <b>data uji coba</b> (nomor berawalan UJI-).'
        : `<label class="check" style="margin:4px 0 0"><input type="checkbox" id="tandaUji" ${st.uji ? 'checked' : ''}>Simpan sebagai data uji coba (nomor berawalan UJI-)</label>
          ${adminP ? (modeUji() ? '<small class="muted">Hapus centang untuk menginput pendaftar sungguhan, misalnya yang mendaftar langsung di kantor.</small>'
            : `<small><b>Input pendaftar sungguhan.</b> Berkas boleh dilengkapi kemudian di dashboard (menu Pendaftar).${!info.dibuka ? ' Pendaftaran untuk umum sedang ditutup; input panitia tetap tersimpan pada gelombang terakhir.' : ''}</small>`)
          : '<small class="muted">Hapus centang bila Anda menginput pendaftar sungguhan.</small>'}`}</div></div>`;
      $('#tandaUji')?.addEventListener('change', e => { st.uji = e.target.checked; simpanDraf(); tampilPitaPanitia(); render(); });
    }
    tampilPitaPanitia();

    const form = $('#fDaftar');
    const stepper = $('#stepper');
    let maksDicapai = st.langkah;

    function render() {
      const L = st.langkah;
      maksDicapai = Math.max(maksDicapai, L);
      stepper.innerHTML = LANGKAH.map(([l, ic, t], i) => `<li class="${i < L ? 'selesai' : i === L ? 'aktif' : ''}${i <= maksDicapai && i !== L ? ' bisa' : ''}" data-ke="${i}" style="--tone:${t}">
        <span class="no">${i < L ? '<i class="ph-duotone ph-check"></i>' : i + 1}</span><span class="lbl">${l}</span></li>`).join('');
      $('#judulLangkah').textContent = LANGKAH[L][0];
      $('#nomorLangkah').textContent = `Langkah ${L + 1} dari ${LANGKAH.length}`;
      $('#barLangkah').style.width = `${(L + 1) / LANGKAH.length * 100}%`;
      $('#isiLangkah').innerHTML = HAL[L]();
      $('#btnKembali').style.visibility = L ? 'visible' : 'hidden';
      $('#btnLanjut').innerHTML = L === LANGKAH.length - 1 ? '<i class="ph-duotone ph-paper-plane-tilt"></i>Kirim pendaftaran'
        : `Selanjutnya: ${LANGKAH[L + 1][0]}<i class="ph-duotone ph-arrow-right"></i>`;
      if (L === 3) renderPrestasi();
      pasangKombo();
      // tampilkan ulang status kolom yang sudah terisi
      (KOLOM_LANGKAH[L] || []).forEach(k => { if (D[k]) cekKolom(k, false); });
    }

    const salinAsal = () => {
      const ubahKab = D._kode.kabupaten !== D._kode.asal_kabupaten;
      D.provinsi = D.asal_provinsi || ''; D.kabupaten = D.asal_kabupaten || '';
      ['provinsi', 'kabupaten'].forEach(k => { const a = D._kode['asal_' + k]; if (a) D._kode[k] = a; else delete D._kode[k]; });
      if (ubahKab) { D.kecamatan = D.desa = D.kode_wilayah = ''; delete D._kode.kecamatan; delete D._kode.desa; }
      ['provinsi', 'kabupaten', 'kecamatan', 'desa'].forEach(k => { const i = form.querySelector(`[name="${k}"]`); if (i) i.value = D[k] || ''; });
    };
    /* ---------- Kombo (pencarian wilayah) ---------- */
    function pasangKombo() {
      form.querySelectorAll('[data-kombo]').forEach(box => {
        const k = box.dataset.kombo, K = KOMBO[k];
        const input = box.querySelector('input'), ul = box.querySelector('ul');
        if (input.readOnly) return;
        let opsi = [], aktif = -1;
        const muatOpsi = async () => { try { opsi = await K.opsi(); } catch (e) { opsi = []; toast(pesanGalat(e), 'err'); } };
        const norm = s => String(s).toLowerCase().replace(/^(kab\.|kota|kabupaten)\s+/, '').replace(/[^a-z0-9 ]/g, '');
        const tampil = async () => {
          if (K.induk && !D._kode[K.induk]) { ul.innerHTML = `<li class="kosong">Pilih ${NAMA_KOLOM[K.induk]} terlebih dahulu</li>`; ul.hidden = false; return; }
          if (!opsi.length) { ul.innerHTML = '<li class="kosong"><span class="spinner" style="width:14px;height:14px"></span> Memuat…</li>'; ul.hidden = false; await muatOpsi(); }
          const q = norm(input.value);
          const cocok = (q ? opsi.filter(o => norm(o.v).includes(q) || o.v.toLowerCase().includes(input.value.toLowerCase())).sort((a, b) => norm(a.v).indexOf(q) - norm(b.v).indexOf(q)) : opsi).slice(0, 60);
          aktif = -1;
          ul.innerHTML = cocok.length ? cocok.map((o, i) => `<li role="option" data-i="${opsi.indexOf(o)}"><span>${esc(o.v)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</li>`).join('')
            : `<li class="kosong">${K.bebas ? 'Tidak ada di daftar; ketikan Anda tetap dipakai.' : 'Tidak ditemukan. Periksa ejaan.'}</li>`;
          ul.hidden = false; input.setAttribute('aria-expanded', 'true');
        };
        const tutup = () => { ul.hidden = true; input.setAttribute('aria-expanded', 'false'); };
        const pilih = o => {
          const lama = D._kode[k];
          D[k] = o.v; D._kode[k] = o.kode; input.value = o.v; tutup();
          if (lama !== o.kode) (K.anak || []).forEach(a => { D[a] = ''; delete D._kode[a]; const i = form.querySelector(`[name="${a}"]`); if (i) i.value = ''; });
          if (k === 'desa') { D.kode_wilayah = o.kode; if (o.kp) { D.kode_pos = o.kp; const kp = form.querySelector('[name=kode_pos]'); if (kp) { kp.value = o.kp; cekKolom('kode_pos', false); } } }
          if (k.startsWith('asal_') && D.samakan_asal) salinAsal();
          cekKolom(k, true); simpanDraf();
        };
        input.addEventListener('focus', tampil);
        input.addEventListener('input', () => { D[k] = input.value; if (!K.bebas) delete D._kode[k]; tampil(); simpanDraf(); });
        input.addEventListener('keydown', e => {
          const li = [...ul.querySelectorAll('li[data-i]')];
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); aktif = Math.max(0, Math.min(li.length - 1, aktif + (e.key === 'ArrowDown' ? 1 : -1))); li.forEach((x, i) => x.classList.toggle('aktif', i === aktif)); li[aktif]?.scrollIntoView({ block: 'nearest' }); }
          if (e.key === 'Enter') { e.preventDefault(); const pilihLi = li[aktif] || (li.length === 1 ? li[0] : null); if (pilihLi) pilih(opsi[+pilihLi.dataset.i]); }
          if (e.key === 'Escape') tutup();
        });
        ul.addEventListener('mousedown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); pilih(opsi[+li.dataset.i]); } });
        input.addEventListener('blur', () => setTimeout(() => {
          tutup();
          // ketikan persis sama dengan salah satu opsi dianggap memilih
          if (!D._kode[k] && input.value.trim() && opsi.length) { const o = opsi.find(x => x.v.toLowerCase() === input.value.trim().toLowerCase()); if (o) return pilih(o); }
          cekKolom(k, true);
        }, 120));
      });
    }

    /* ---------- Validasi ---------- */
    function tulisPesan(k, hasil) {
      const box = form.querySelector(`[data-f="${k}"]`); if (!box) return;
      const pesan = box.querySelector('.pesan') || form.querySelector(`[data-pesan="${k}"]`);
      const input = box.querySelector('input,select');
      box.classList.toggle('salah', hasil?.[0] === 'err'); box.classList.toggle('awas', hasil?.[0] === 'warn');
      if (input) { input.classList.toggle('bad', hasil?.[0] === 'err'); input.classList.toggle('warn', hasil?.[0] === 'warn'); input.classList.toggle('good', !hasil && !!input.value); }
      if (pesan) { pesan.textContent = hasil ? hasil[1] : ''; pesan.className = 'pesan' + (hasil ? (hasil[0] === 'err' ? ' err' : ' wrn') : ''); }
    }
    function cekKolom(k, tampilkan = true) {
      const f = V[k]; if (!f) return null;
      const hasil = f(D[k] ?? '') || null;
      if (tampilkan || hasil?.[0] !== 'err') tulisPesan(k, hasil);
      return hasil;
    }
    function daftarPeringatan() {
      const p = [];
      [1, 2].forEach(l => KOLOM_LANGKAH[l].forEach(k => { const h = V[k]?.(D[k] ?? ''); if (h && h[0] === 'warn') p.push(h[1]); }));
      return p;
    }
    function cekLangkah(L) {
      const salah = [];
      if (L === 0) {
        if (!D.jenjang) { salah.push('jenjang'); tulisPesan('jenjang', ['err', 'Pilih jenjang SMP atau SMA.']); }
        if (!D.bagian) { salah.push('bagian'); tulisPesan('bagian', ['err', 'Pilih putra atau putri.']); }
        const q = D.jenjang && D.bagian && kuotaDari(D.jenjang, D.bagian);
        if (q && q.kuota != null && q.sisa === 0 && !modeUji()) { salah.push('bagian'); tulisPesan('bagian', ['err', `Kuota ${D.jenjang} ${D.bagian} sudah penuh.`]); }
      } else if (L === 4) {
        (cfg.berkas || []).filter(b => wajibBerkas(b) && !st.berkas[b.kunci]).forEach(b => { salah.push('berkas_' + b.kunci); const box = form.querySelector(`[data-berkas="${b.kunci}"]`); box?.classList.add('salah'); const ps = box?.querySelector('.pesan'); if (ps) { ps.textContent = 'Wajib diunggah.'; ps.className = 'pesan err'; } });
      } else if (L === 5) {
        if (daftarPeringatan().length && !$('#setujuPeringatan')?.checked) { salah.push('setujuPeringatan'); toast('Centang konfirmasi pada kotak "Perlu diperhatikan".', 'warn'); }
        if (!D.setuju) { salah.push('setuju'); tulisPesan('setuju', ['err', 'Centang pernyataan persetujuan untuk mengirim.']); }
      } else {
        (KOLOM_LANGKAH[L] || []).forEach(k => { const h = cekKolom(k, true); if (h?.[0] === 'err') salah.push(k); });
      }
      return salah;
    }
    const gulirKe = k => {
      const el = form.querySelector(`[data-f="${k}"]`) || $(`#${k}`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => el.querySelector?.('input,select')?.focus({ preventScroll: true }), 350); }
    };

    /* ---------- Isian ---------- */
    const DIGIT_SAJA = { nisn: 10, nik: 16, rt: 3, rw: 3, kode_pos: 5, npsn_sekolah: 8, hafalan_surah: 3 };
    form.addEventListener('input', e => {
      const t = e.target, k = t.name; if (!k || t.type === 'file' || t.closest('[data-kombo]') || t.closest('.prestasi-baris')) return;
      if (DIGIT_SAJA[k]) { const v = digit(t.value).slice(0, DIGIT_SAJA[k]); if (v !== t.value) t.value = v; }
      if (k === 'hafalan_juz' || k === 'lama_mondok') { const v = t.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/, '$1'); if (v !== t.value) t.value = v; }
      if (NAMA_SAJA.includes(k)) {
        const v = t.value.replace(BUKAN_HURUF_NAMA, '');
        if (v !== t.value) { const pos = Math.max(0, (t.selectionStart || v.length) - (t.value.length - v.length)); t.value = v; t.setSelectionRange(pos, pos); tulisPesan(k, ['err', 'Kolom nama hanya dapat diisi huruf (tanpa angka).']); }
      }
      if (t.type === 'radio' || t.type === 'checkbox') return;
      if (k === 'lama_mondok') { const b = lamaBulan(t.value), el = $('#bantuLama'); if (el) el.innerHTML = b ? `= <b>${teksLama(b)}</b>` : 'Tulis dalam tahun: 1,5 = 1 tahun 6 bulan; 0,5 = 6 bulan.'; }
      if (k === 'asal_sekolah' && D.pondok_sama) D.pondok_sebelumnya = t.value;
      D[k] = t.value;
      // kolom yang sudah ditandai salah diperiksa ulang saat diketik
      if (t.closest('.salah,.awas')) cekKolom(k, true);
      if (k === 'email' && D.email2) cekKolom('email2', true);
      if (k === 'tanggal_lahir' && D.nik) cekKolom('nik', true);
      simpanDraf();
    });
    form.addEventListener('change', e => {
      const t = e.target, k = t.name;
      if (t.type === 'radio') {
        if (k === 'pernah_mondok') D.pernah_mondok = t.value === 'ya';
        else if (k === 'ada_rekomendasi') D.ada_rekomendasi = t.value === 'ya';
        else D[k] = t.value;
        tulisPesan(k, null); simpanDraf();
        if (['jenjang', 'bagian', 'pernah_mondok', 'hafalan_jenis', 'ada_rekomendasi'].includes(k)) render();
        return;
      }
      if (t.name === 'sumber_info') { D.sumber_info = [...form.querySelectorAll('[name=sumber_info]:checked')].map(x => x.value); cekKolom('sumber_info', true); simpanDraf(); return; }
      if (t.id === 'pondokSama') { D.pondok_sama = t.checked; if (t.checked) D.pondok_sebelumnya = D.asal_sekolah || ''; simpanDraf(); render(); return; }
      if (t.id === 'samakanAsal') {
        if (t.checked && !D._kode.asal_kabupaten) { t.checked = false; toast('Pilih dulu provinsi dan kabupaten/kota asal di atas.', 'warn'); gulirKe(D._kode.asal_provinsi ? 'asal_kabupaten' : 'asal_provinsi'); return; }
        D.samakan_asal = t.checked; if (t.checked) salinAsal();
        simpanDraf(); render(); if (t.checked) setTimeout(() => gulirKe('kecamatan'), 50);
        return;
      }
      if (t.id === 'setuju') { D.setuju = t.checked; tulisPesan('setuju', null); simpanDraf(); return; }
      if (t.id === 'setujuPeringatan') { st.okPeringatan = t.checked; simpanDraf(); return; }
      if (t.tagName === 'SELECT' && k) { D[k] = t.value; cekKolom(k, true); simpanDraf(); }
    });
    form.addEventListener('focusin', e => {
      const t = e.target;
      if (t.name === 'lama_mondok' && /[a-z]/i.test(t.value)) { const b = lamaBulan(t.value); if (b) t.value = String(Math.round(b / 12 * 100) / 100).replace('.', ','); }
    });
    form.addEventListener('focusout', e => {
      const t = e.target, k = t.name; if (!k || t.closest('[data-kombo]') || t.type === 'radio' || t.type === 'file') return;
      if (['no_wa', 'darurat_no'].includes(k) && t.value && /^628\d{7,11}$/.test(normalWA(t.value))) { const n = normalWA(t.value); t.value = '0' + n.slice(2); D[k] = t.value; }
      if (NAMA_SAJA.includes(k)) { t.value = t.value.replace(/\s+/g, ' ').trim(); D[k] = t.value; }
      if (k === 'hafalan_juz' && t.value !== '' && !isNaN(juzAngka(t.value))) { t.value = String(Math.round(juzAngka(t.value) * 2) / 2).replace('.', ','); D[k] = t.value; }
      if (k === 'hafalan_surah' && t.value !== '') { t.value = String(+t.value); D[k] = t.value; }
      if (k === 'lama_mondok' && lamaBulan(t.value)) { t.value = teksLama(lamaBulan(t.value)); D[k] = t.value; }
      if ((k === 'nisn' || k === 'nik') && V[k](D[k] ?? '')?.[0] !== 'err') periksaTerdaftar().then(() => { cekKolom('nisn', !!D.nisn); if (D.nik) cekKolom('nik', true); });
      // ditunda sedikit agar klik tombol tidak hilang karena tata letak bergeser saat pesan galat berubah
      if (D[k] !== undefined || V[k]) setTimeout(() => cekKolom(k, true), 200);
      simpanDraf();
    });
    form.addEventListener('click', async e => {
      const ke = e.target.closest('[data-ke]'); if (ke) return pindah(+ke.dataset.ke);
      const sl = e.target.closest('[data-salin]');
      if (sl) { navigator.clipboard?.writeText(sl.dataset.salin).then(() => toast('Nomor rekening disalin.'), () => toast('Nomor: ' + sl.dataset.salin, 'info')); return; }
      if (e.target.closest('#tambahPrestasi')) {
        if (D.prestasi.length >= 10) return toast('Prestasi paling banyak 10 baris.', 'warn');
        D.prestasi.push({ nama: '', tingkat: 'Kabupaten/Kota', tahun: String(new Date().getFullYear()) }); renderPrestasi(); simpanDraf();
        $('#daftarPrestasi .prestasi-baris:last-child input')?.focus();
      }
      const hp = e.target.closest('[data-hapus-prestasi]');
      if (hp) { D.prestasi.splice(+hp.dataset.hapusPrestasi, 1); renderPrestasi(); simpanDraf(); }
    });
    stepper.addEventListener('click', e => { const li = e.target.closest('li.bisa'); if (li) pindah(+li.dataset.ke); });

    function renderPrestasi() {
      const box = $('#daftarPrestasi'); if (!box) return;
      const th = new Date().getFullYear();
      box.innerHTML = D.prestasi.map((p, i) => `<div class="prestasi-baris">
        <input class="input" data-p="nama" data-i="${i}" value="${esc(p.nama)}" maxlength="120" placeholder="Nama lomba dan juara, misalnya Juara 1 MTQ Tartil" aria-label="Nama prestasi">
        <select class="select" data-p="tingkat" data-i="${i}" aria-label="Tingkat">${TINGKAT.map(t => `<option ${t === p.tingkat ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select class="select" data-p="tahun" data-i="${i}" aria-label="Tahun">${Array.from({ length: th - 2014 }, (_, j) => th - j).map(y => `<option ${String(y) === String(p.tahun) ? 'selected' : ''}>${y}</option>`).join('')}</select>
        <button type="button" class="icon-btn plain" data-hapus-prestasi="${i}" title="Hapus" aria-label="Hapus prestasi"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button></div>`).join('')
        || '<p class="muted" style="font-size:13.5px;margin:0 0 10px">Belum ada. Tambahkan bila calon santri pernah meraih prestasi.</p>';
      box.querySelectorAll('[data-p]').forEach(x => x.addEventListener(x.tagName === 'SELECT' ? 'change' : 'input', () => { D.prestasi[+x.dataset.i][x.dataset.p] = x.value; simpanDraf(); }));
    }

    /* ---------- Unggah berkas ---------- */
    async function pastikanToken() {
      const lama = st.token;
      const { data, error } = await sb.rpc('minta_token_unggah', { p_token_lama: lama || null });
      if (error) throw error;
      if (lama && data !== lama && Object.keys(st.berkas).length) {
        st.berkas = {}; toast('Sesi unggah sebelumnya sudah berakhir. Mohon unggah ulang berkas.', 'warn', 7000);
      }
      st.token = data; simpanDraf(true); return data;
    }
    const thumbDari = file => new Promise(ok => {
      if (!file.type.startsWith('image/')) return ok('');
      const u = URL.createObjectURL(file), img = new Image();
      img.onload = () => { const s = Math.min(1, 160 / Math.max(img.width, img.height)); const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * s), height: Math.round(img.height * s) });
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.7)); };
      img.onerror = () => { URL.revokeObjectURL(u); ok(''); }; img.src = u;
    });
    form.addEventListener('change', async e => {
      const inp = e.target; if (inp.type !== 'file') return;
      const box = inp.closest('[data-berkas]'), jenis = box.dataset.berkas, file = inp.files[0]; inp.value = '';
      if (!file) return;
      const def = (cfg.berkas || []).find(b => b.kunci === jenis) || {};
      const status = box.querySelector('.berkas-status'), pesan = box.querySelector('.pesan');
      box.classList.remove('salah'); box.classList.add('sibuk'); pesan.textContent = ''; pesan.className = 'pesan';
      status.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span> Mengunggah… jangan tutup halaman';
      try {
        const token = await pastikanToken();
        const [h, thumb] = await Promise.all([unggahBerkasPendaftar(file, { token, jenis, hanyaGambar: def.jenis === 'gambar' }), thumbDari(file)]);
        st.berkas[jenis] = { id: h.id, nama: file.name.slice(0, 60), ukuran: h.ukuran, mime: h.mime, thumb };
        simpanDraf(true);
        box.outerHTML = kartuBerkas(def);
        toast(`${def.label} terunggah.`);
      } catch (err) {
        box.classList.remove('sibuk'); box.classList.add('salah');
        status.textContent = st.berkas[jenis] ? 'Berkas sebelumnya tetap dipakai.' : 'Belum terunggah.';
        pesan.textContent = pesanGalat(err); pesan.className = 'pesan err';
      }
    });

    /* ---------- Pindah langkah ---------- */
    async function pindah(ke) {
      if (ke === st.langkah) return;
      if (ke > st.langkah) {
        // semua langkah yang dilewati harus valid
        for (let L = st.langkah; L < ke; L++) {
          if (L !== st.langkah) { st.langkah = L; render(); }
          if (L === 1) await periksaTerdaftar();
          const salah = cekLangkah(L);
          if (salah.length) { toast('Masih ada isian yang perlu diperbaiki.', 'err'); gulirKe(salah[0]); return; }
          // peringatan di langkah ini: minta konfirmasi sekali
          const warn = (KOLOM_LANGKAH[L] || []).map(k => V[k]?.(D[k] ?? '')).filter(h => h && h[0] === 'warn').map(h => h[1]);
          const baruW = warn.filter(w => !st.ok.includes(w));
          if (baruW.length) {
            const lanjut = await konfirmasi('Mohon periksa kembali', `${baruW.map(w => '• ' + esc(w)).join('<br>')}<br><br>Anda tetap dapat melanjutkan bila data sudah benar; panitia akan melihat tanda ini saat verifikasi.`, 'Data sudah benar, lanjutkan');
            if (!lanjut) { gulirKe((KOLOM_LANGKAH[L] || []).find(k => V[k]?.(D[k] ?? '')?.[0] === 'warn')); return; }
            st.ok.push(...baruW);
          }
        }
      }
      st.langkah = ke; simpanDraf(); render();
      $('.daftar-kartu').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    $('#btnKembali').onclick = () => pindah(st.langkah - 1);
    $('#btnLanjut').onclick = () => st.langkah < LANGKAH.length - 1 ? pindah(st.langkah + 1) : kirim();

    /* ---------- Kirim ---------- */
    async function kirim() {
      // periksa semua langkah sekali lagi
      await periksaTerdaftar();
      for (let L = 0; L < LANGKAH.length; L++) {
        const salah = L === st.langkah ? cekLangkah(L) : cekDiam(L);
        if (salah.length) { if (L !== st.langkah) { st.langkah = L; render(); cekLangkah(L); } toast('Masih ada isian yang perlu diperbaiki.', 'err'); gulirKe(salah[0]); return; }
      }
      const tombol = $('#btnLanjut'); tombol.disabled = true; tombol.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-color:#fff4;border-top-color:#fff"></span> Mengirim…';
      const p = {
        ...Object.fromEntries(Object.entries(D).filter(([k]) => !k.startsWith('_') && !['email2', 'samakan_asal', 'pondok_sama', 'ada_rekomendasi', 'hafalan_jenis'].includes(k))),
        nisn: digit(D.nisn), nik: digit(D.nik), no_wa: normalWA(D.no_wa), darurat_no: normalWA(D.darurat_no),
        email: (D.email || '').trim().toLowerCase(),
        hafalan_juz: D.hafalan_jenis === 'juz' ? juzAngka(D.hafalan_juz) || 0 : 0, hafalan_surah: D.hafalan_jenis === 'surah' ? +D.hafalan_surah || 0 : 0,
        pondok_sebelumnya: D.pernah_mondok ? (D.pondok_sama ? D.asal_sekolah : D.pondok_sebelumnya) : '',
        lama_mondok: D.pernah_mondok ? teksLama(lamaBulan(D.lama_mondok)) : '',
        sumber_info: D.sumber_info, darurat_nama: (D.darurat_nama || '').replace(/\s+/g, ' ').trim(),
        perekomendasi: D.ada_rekomendasi ? (D.perekomendasi || '').replace(/\s+/g, ' ').trim() : '', perekomendasi_peran: D.ada_rekomendasi ? (D.perekomendasi_peran || '').trim() : '',
        prestasi: D.prestasi.filter(x => (x.nama || '').trim()).map(x => ({ nama: x.nama.trim(), tingkat: x.tingkat, tahun: +x.tahun })),
        berkas: Object.values(st.berkas).map(b => b.id), peringatan: daftarPeringatan(), setuju: !!D.setuju,
        uji: modeUji(), manual: adminP
      };
      try {
        if (!st.token) throw new Error('Sesi unggah tidak ditemukan. Unggah ulang berkas pada langkah Berkas.');
        const { data, error } = await sb.rpc('kirim_pendaftaran', { p_data: p, p_token: st.token });
        if (error) throw error;
        const simpan = { D: { ...D, _kode: undefined }, hasil: data, berkas: Object.fromEntries(Object.entries(st.berkas).map(([k, v]) => [k, { nama: v.nama }])), token: st.token, gel: gel?.nama };
        selesaiKirim = true; clearTimeout(tSimpan);
        try { localStorage.setItem(KUNCI_TERAKHIR, JSON.stringify(simpan)); localStorage.removeItem(KUNCI_DRAF); } catch (e) {}
        tampilSukses(simpan.D, data, false, st.token);
      } catch (err) {
        tombol.disabled = false; render();
        const kol = err.hint || '';
        const L = kol.startsWith('berkas_') ? 4 : LANGKAH_KOLOM[kol];
        if (L != null && L !== st.langkah) { st.langkah = L; render(); }
        if (kol) { tulisPesan(kol, ['err', pesanGalat(err)]); gulirKe(kol); }
        toast(pesanGalat(err), 'err', 8000);
      }
    }
    // validasi tanpa menampilkan pesan (untuk langkah yang tidak sedang tampil)
    function cekDiam(L) {
      if (L === 0) return !D.jenjang || !D.bagian ? ['jenjang'] : [];
      if (L === 4) return (cfg.berkas || []).filter(b => wajibBerkas(b) && !st.berkas[b.kunci]).map(b => 'berkas_' + b.kunci);
      if (L === 5) return D.setuju ? [] : ['setuju'];
      return (KOLOM_LANGKAH[L] || []).filter(k => V[k]?.(D[k] ?? '')?.[0] === 'err');
    }

    /* ---------- Halaman sukses dan Bukti Pendaftaran ---------- */
    function tampilSukses(d, hasil, dariArsip, token) {
      document.querySelectorAll('.toasts .toast').forEach(t => t.remove());   // bersihkan peringatan formulir sebelumnya
      document.getElementById('waMelayang')?.style.setProperty('display', 'none');     // tombol konfirmasi WhatsApp sudah ada di halaman ini
      // Tombol konfirmasi WhatsApp: ke Ketua Panitia (cadangan: kontak panitia sesuai putra/putri)
      const kp = S.p.ketua_panitia || {};
      const cadangan = kontak.find(k => k.data.no_wa && (!k.data.bagian || k.data.bagian === 'Umum' || k.data.bagian.toLowerCase() === d.bagian));
      const noKetua = normalWA(kp.no_wa || cadangan?.data.no_wa || '');
      const namaKetua = kp.no_wa ? (kp.nama || 'Ketua Panitia') : cadangan?.judul || '';
      const pesanWA = [`Assalamu'alaikum warahmatullah.`, `Saya ingin mengonfirmasi pendaftaran SPMB ${ta}:`, '',
        `Nomor registrasi: *${hasil.no_registrasi}*`, `Nama calon santri: ${hasil.nama_lengkap || d.nama_lengkap}`,
        `Jenjang: ${d.jenjang} ${d.bagian === 'putra' ? 'Putra' : 'Putri'}`, `Gelombang: ${hasil.gelombang || gel?.nama || '-'}`, '',
        'Bukti pendaftaran sudah saya simpan. Mohon arahan selanjutnya. Jazakumullahu khairan.'].join('\n');
      const namaPdf = `Bukti Pendaftaran ${hasil.no_registrasi}.pdf`;
      let pdfData = null;
      W.innerHTML = `
        <div class="kartu sukses-daftar">
          <span class="ic-sukses"><i class="ph-duotone ph-check-circle"></i></span>
          <h2>${dariArsip ? 'Bukti pendaftaran' : 'Pendaftaran berhasil dikirim'}</h2>
          <p>Jazakumullahu khairan. Data ananda <b>${esc(hasil.nama_lengkap || d.nama_lengkap)}</b> sudah kami terima.</p>
          <div class="no-reg"><small>Nomor registrasi</small><b id="noReg">${esc(hasil.no_registrasi)}</b>
            <button type="button" class="btn sm ghost" id="salinNo"><i class="ph-duotone ph-copy"></i>Salin</button></div>
          ${hasil.uji ? '<p class="pill" style="--tone:var(--c6);margin:0 auto 10px">Data uji coba panitia</p>' : ''}
          <div class="aksi-sukses">
            <button type="button" class="aksi-besar" id="unduhPdf" style="--tone:var(--c7)" ${!dariArsip ? 'disabled' : ''}>
              <span class="ic-box"><i class="ph-duotone ph-file-pdf"></i></span>
              <span><b>Unduh Bukti Pendaftaran</b><small id="pdfKet">${dariArsip ? 'Berkas PDF ukuran F4' : '<span class="spinner" style="width:12px;height:12px"></span> Menyiapkan berkas PDF…'}</small></span>
              <i class="ph-duotone ph-download-simple panah"></i></button>
            ${noKetua.length >= 10 ? `<a class="aksi-besar wa" id="konfirmasiWA" style="--tone:#16a34a" target="_blank" rel="noopener" href="https://wa.me/${noKetua}?text=${encodeURIComponent(pesanWA)}">
              <span class="ic-box"><i class="ph-duotone ph-whatsapp-logo"></i></span>
              <span><b>Konfirmasi via WhatsApp</b><small>Kirim konfirmasi ke ${esc(namaKetua)}</small></span>
              <i class="ph-duotone ph-paper-plane-tilt panah"></i></a>` : ''}
          </div>
          <p class="muted" id="statusEmail" style="font-size:13.5px">${dariArsip ? '' : '<span class="spinner" style="width:14px;height:14px"></span> Mengirim email konfirmasi…'}</p>
          <div class="langkah-lanjut">
            <b>Langkah berikutnya</b>
            <ol><li><b>Unduh Bukti Pendaftaran</b> (berkas PDF) dan simpan di HP atau laptop.</li>
              ${noKetua.length >= 10 ? '<li>Tekan <b>Konfirmasi via WhatsApp</b> untuk memberi tahu Ketua Panitia bahwa Anda sudah mendaftar.</li>' : ''}
              <li>Panitia memeriksa berkas dan bukti pembayaran. Bila perlu perbaikan, kami menghubungi melalui WhatsApp ${d.no_wa ? `<b>+${esc(normalWA(d.no_wa))}</b>` : ''}.</li>
              <li>Pantau status dan jadwal tes di halaman <a href="cek-status.html?no=${encodeURIComponent(hasil.no_registrasi)}">Cek Status</a> dengan nomor registrasi dan tanggal lahir santri.</li></ol>
          </div>
          <p class="muted" style="font-size:12.5px;margin:0">PDF tidak dapat diunduh? <button type="button" class="tautan-btn" id="cetakBukti">Cetak bukti langsung dari peramban</button></p>
          ${adminP && hasil.id ? `<p style="margin:12px 0 0"><a class="btn sm ghost" href="dashboard.html#/pendaftar/${esc(hasil.id)}"><i class="ph-duotone ph-identification-card" style="color:var(--c4)"></i>Buka data ini di dashboard</a></p>` : ''}
          ${dariArsip ? '' : '<p class="muted" style="font-size:12.5px;margin-top:10px">Ingin mendaftarkan anak lain? <a href="daftar.html">Isi formulir baru</a></p>'}
        </div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      $('#salinNo').onclick = () => navigator.clipboard?.writeText(hasil.no_registrasi).then(() => toast('Nomor registrasi disalin.'), () => {});
      $('#cetakBukti').onclick = () => cetakBukti(d, hasil);
      $('#konfirmasiWA')?.addEventListener('click', () => toast('WhatsApp dibuka. Tekan kirim pada pesan yang sudah terisi.', 'info'));
      const tombolPdf = $('#unduhPdf'), ket = $('#pdfKet');
      const siapUnduh = () => { tombolPdf.disabled = false; ket.textContent = 'Berkas PDF ukuran F4 · siap diunduh'; };
      // PDF dibuat di peramban dari tata letak yang sama dengan cetak; cadangan: dibuat Apps Script
      const opsiBukti = opsiBuktiDari(d, hasil);
      const buatPdf = async () => pdfData || (pdfData = await buatPdfDokumen(opsiBukti));
      tombolPdf.onclick = async () => {
        try {
          if (!pdfData) {
            tombolPdf.disabled = true; ket.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Menyiapkan berkas PDF…';
            try { await buatPdf(); }
            catch (e) { if (!token) throw e; pdfData = (await ambilBuktiPdf({ token })).pdf; }
            if (!pdfData) throw new Error('PDF belum dapat dibuat.');
          }
          simpanPdf(pdfData, namaPdf); siapUnduh();
          toast('Bukti Pendaftaran tersimpan di folder Unduhan (Download).');
        } catch (err) {
          siapUnduh(); ket.textContent = 'Coba lagi, atau pakai "Cetak bukti langsung" di bawah';
          toast(`${pesanGalat(err)} Gunakan tombol "Cetak bukti langsung", lalu pilih Simpan sebagai PDF.`, 'err', 8000);
        }
      };
      if (!dariArsip && token) (async () => {
        let pdfPeramban = null;
        try { pdfPeramban = await buatPdf(); siapUnduh(); } catch (e) { console.warn('PDF peramban gagal, memakai cadangan Apps Script', e); }
        await konfirmasiPendaftaran(token, pdfPeramban).then(k => {
          if (!pdfData && k.pdf) pdfData = k.pdf;
          siapUnduh();
          $('#statusEmail').innerHTML = k.email ? `<i class="ph-duotone ph-envelope-simple-open" style="color:var(--ok)"></i> Email konfirmasi dan bukti pendaftaran juga terkirim ke <b>${esc((d.email || '').trim().toLowerCase())}</b>. Periksa juga folder Spam.`
            : `<i class="ph-duotone ph-info"></i> ${esc(k.pesan || 'Email konfirmasi tidak terkirim.')} Simpan bukti dengan tombol di atas.`;
        }).catch(() => { siapUnduh(); $('#statusEmail').innerHTML = '<i class="ph-duotone ph-info"></i> Email konfirmasi belum terkirim. Pendaftaran tetap tersimpan; simpan bukti dengan tombol di atas.'; });
      })();
    }

    // Data pendaftar untuk Bukti Pendaftaran (isi yang sama untuk cetak, PDF, dan dashboard)
    function opsiBuktiDari(d, hasil) {
      const berkasAda = terakhirBerkas(hasil) || st.berkas;
      return dokumenBukti({
        ...d, no_registrasi: hasil.no_registrasi, nama_lengkap: hasil.nama_lengkap || d.nama_lengkap, dibuat_pada: hasil.dibuat_pada, uji: hasil.uji,
        gelombang: hasil.gelombang || gel?.nama || '', no_wa: normalWA(d.no_wa), email: (d.email || '').trim().toLowerCase(),
        hafalan_juz: d.hafalan_jenis ? (d.hafalan_jenis === 'juz' ? juzAngka(d.hafalan_juz) : 0) : d.hafalan_juz,
        hafalan_surah: d.hafalan_jenis === 'surah' ? +d.hafalan_surah || 0 : 0
      }, Object.keys(berkasAda || {}), S.p);
    }
    function cetakBukti(d, hasil) { cetakDokumen(opsiBuktiDari(d, hasil)); }
    const terakhirBerkas = hasil => { try { const x = JSON.parse(localStorage.getItem(KUNCI_TERAKHIR) || 'null'); return x?.hasil?.no_registrasi === hasil.no_registrasi ? x.berkas : null; } catch (e) { return null; } };

    // Pendaftaran terakhir dari perangkat ini: tautan untuk mengunduh ulang buktinya
    if (!tertutup && terakhir?.hasil && !dipulihkan) {
      $('#pitaDraf').innerHTML = `<div class="note info"><i class="ph-duotone ph-receipt"></i><div>Pendaftaran terakhir dari perangkat ini: <b>${esc(terakhir.hasil.no_registrasi)}</b> (${esc(terakhir.hasil.nama_lengkap || '')}).
        <button type="button" class="tautan-btn" id="lihatTerakhir">Unduh ulang buktinya</button></div></div>`;
      $('#lihatTerakhir').onclick = () => tampilSukses(terakhir.D, terakhir.hasil, true, terakhir.token);
    }
    if (tertutup) tampilTutup(); else render();
  };

  /* ---------- Bantu umum ---------- */
  function juzAngka(v) { return parseFloat(String(v ?? '').replace(',', '.')); }
  function tsPanjang(ts) {
    if (!ts) return '–';
    const s = new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Makassar' });
    return `${window.SPMB.fmt.tglPanjang(new Date(s.slice(0, 10) + 'T00:00:00'))} pukul ${s.slice(11, 16).replace(':', '.')} WITA`;
  }
  function hitungMundur(root) {
    const el = root.querySelector('[data-hitung]'); if (!el) return;
    const sasaran = new Date(el.dataset.hitung).getTime();
    const tik = () => {
      const s = Math.max(0, Math.floor((sasaran - Date.now()) / 1000));
      if (!s) { el.innerHTML = '<a class="btn" href="daftar.html">Pendaftaran dibuka, muat ulang</a>'; return clearInterval(t); }
      const b = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
      el.innerHTML = ['hari', 'jam', 'menit', 'detik'].map((l, i) => `<span><b>${String(b[i]).padStart(2, '0')}</b>${l}</span>`).join('');
    };
    const t = setInterval(tik, 1000); tik();
  }
})();
