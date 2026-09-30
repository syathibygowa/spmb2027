/* =====================================================================
   SELEKSI (Fase 4 · Langkah 2–3)
   - Menu Seleksi (Admin, Superadmin): sesi tes, penguji, peserta, Kartu
     Peserta Tes, Daftar Hadir, Lembar Penilaian, WhatsApp jadwal/pengingat
     berurutan, validasi nilai, bobot nilai akhir.
   - Menu Penilaian (Penguji, juga Admin/Superadmin yang ditugaskan):
     peserta di sesi yang ditugaskan, kehadiran, isi nilai bidangnya.
   Dimuat sesudah pendaftar.js dan sebelum dashboard.js; dashboard
   memanggil SPMB_MODUL.seleksi() dan SPMB_MODUL.penilaian().
   ===================================================================== */
(function () {
  'use strict';
  const { sb, CFG, fmt, esc, toast, dialog, konfirmasi, pesanGalat, muatPengaturan, cetakHtml, cetakDokumen,
          buatPdfHtml, simpanPdf, penandaTangan, gambar } = window.SPMB;
  const $ = (s, r = document) => r.querySelector(s);
  const UI = window.SPMB_UI;

  /* ---------- Label, warna, format ---------- */
  // Bidang tes diatur Superadmin (Seleksi > Bidang dan Bobot); ikon dan warna dipilih otomatis
  const IKON_BIDANG = { tahfizh: 'ph-book-open-text', tertulis: 'ph-pencil-line', wawancara: 'ph-chats-circle', praktik_ibadah: 'ph-hands-praying',
    bahasa_arab: 'ph-translate', psikotes: 'ph-brain', baca_quran: 'ph-book-bookmark', kesehatan: 'ph-heartbeat', minat_bakat: 'ph-star' };
  const WARNA_BIDANG = ['var(--c5)', 'var(--c1)', 'var(--c4)', 'var(--c3)', 'var(--c6)', 'var(--c2)', 'var(--c7)', 'var(--c8)'];
  let BIDANG = {}, URUT_BIDANG = [], BOBOT = {};
  function siapkanBidang(peng) {
    const cfg = peng?.seleksi || {};
    const daftar = Array.isArray(cfg.bidang) && cfg.bidang.length ? cfg.bidang
      : [{ kunci: 'tahfizh', label: 'Tahfizh' }, { kunci: 'tertulis', label: 'Tes Tertulis' }, { kunci: 'wawancara', label: 'Wawancara' }];
    BIDANG = Object.fromEntries(daftar.map((b, i) => [b.kunci, [b.label || b.kunci, b.ikon || IKON_BIDANG[b.kunci] || 'ph-exam', b.warna || WARNA_BIDANG[i % WARNA_BIDANG.length], b.keterangan || '']]));
    URUT_BIDANG = daftar.map(b => b.kunci);
    BOBOT = cfg.bobot || {};
  }
  siapkanBidang(null);
  const bobotB = (j, b) => +((BOBOT[j] || {})[b] ?? 0);
  // Bidang yang diujikan (bobot > 0) di salah satu jenjang
  const bidangAktif = () => URUT_BIDANG.filter(b => bobotB('SMP', b) > 0 || bobotB('SMA', b) > 0);
  const MODE = { offline: ['Tatap muka', 'ph-map-pin', 'var(--c3)'], online: ['Daring', 'ph-video-camera', 'var(--c2)'] };
  const ST_NILAI = {
    menunggu: ['Menunggu validasi', 'var(--c6)', 'ph-hourglass-medium'],
    disetujui: ['Disetujui', 'var(--ok)', 'ph-seal-check'],
    dikembalikan: ['Dikembalikan', 'var(--c7)', 'ph-arrow-u-up-left']
  };
  const ST_PESERTA = {
    terdaftar: ['Terdaftar', 'var(--c1)'], berkas_kurang: ['Berkas kurang', 'var(--c3)'], berkas_diverifikasi: ['Berkas terverifikasi', 'var(--c5)'],
    pembayaran_dikonfirmasi: ['Siap tes', 'var(--ok)'], ikut_tes: ['Ikut tes', 'var(--c2)'], nilai_divalidasi: ['Nilai lengkap', 'var(--c2)'],
    lulus: ['Lulus', 'var(--ok)'], cadangan: ['Cadangan', 'var(--c6)'], tidak_lulus: ['Tidak lulus', 'var(--c8)'],
    daftar_ulang_menunggu: ['Menunggu daftar ulang', 'var(--c3)'], daftar_ulang_selesai: ['Daftar ulang selesai', 'var(--ok)']
  };
  const SIAP_TES = ['pembayaran_dikonfirmasi', 'ikut_tes', 'nilai_divalidasi'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const pill = (l, t, ic) => `<span class="pill" style="--tone:${t}">${ic ? `<i class="ph-duotone ${ic}"></i>` : ''}${esc(l)}</span>`;
  const bagianL = b => b === 'putra' ? 'Putra' : b === 'putri' ? 'Putri' : 'Putra dan putri';
  const jenjangL = j => j === 'semua' ? 'SMP dan SMA' : j;
  const dIso = iso => new Date(String(iso).slice(0, 10) + 'T00:00:00');
  const tglIso = iso => iso ? fmt.tgl(dIso(iso)) : '–';
  const tglPanjangIso = iso => iso ? fmt.tglPanjang(dIso(iso)) : '–';
  const hariTglIso = iso => iso ? `${HARI[dIso(iso).getDay()]}, ${fmt.tglPanjang(dIso(iso))}` : '–';
  const jamT = j => j ? String(j).slice(0, 5).replace(':', '.') : '';
  const rentangJam = s => s.jam_selesai ? `${jamT(s.jam_mulai)}–${jamT(s.jam_selesai)}` : jamT(s.jam_mulai);
  const hariIni = () => fmt.isoTgl();
  const angkaN = n => n == null || n === '' ? '–' : String(+n).replace('.', ',');
  const alamatSitus = () => (CFG.alamatSitus || location.href.replace(/\/[^/]*$/, '')).replace(/\/$/, '');
  const bidangL = b => (BIDANG[b] || [String(b).replace(/_/g, ' ')])[0];
  const ikonB = b => (BIDANG[b] || [])[1] || 'ph-exam';
  const warnaB = b => (BIDANG[b] || [])[2] || 'var(--c8)';
  const pillBidang = b => pill(bidangL(b), warnaB(b), ikonB(b));
  const tempatSesi = s => s.mode === 'online' ? `${s.tempat || 'Daring'}${s.tautan ? ` (${s.tautan})` : ''}` : (s.tempat || 'Tempat menyusul');
  const statusSesi = s => {
    const t = hariIni();
    if (s.tanggal === t) return ['Hari ini', 'var(--c7)', 'ph-lightning'];
    if (s.tanggal < t) return ['Selesai', 'var(--c8)', 'ph-check-circle'];
    const hari = Math.round((dIso(s.tanggal) - dIso(t)) / 864e5);
    return [hari === 1 ? 'Besok' : `${hari} hari lagi`, 'var(--c1)', 'ph-clock'];
  };

  // Teks jadwal untuk WhatsApp: satu baris per sesi
  function teksJadwalTes(daftarSesi, peng) {
    if (peng) siapkanBidang(peng);
    return (daftarSesi || []).filter(Boolean).sort((a, b) => (a.tanggal + a.jam_mulai).localeCompare(b.tanggal + b.jam_mulai)).map(s =>
      `• ${(s.bidang || []).map(bidangL).join(', ')}: ${hariTglIso(s.tanggal)} pukul ${rentangJam(s)} WITA, ${s.mode === 'online' ? `daring melalui ${s.tempat || 'tautan berikut'}${s.tautan ? ' ' + s.tautan : ''}` : s.tempat || 'tempat menyusul'}`
    ).join('\n');
  }
  Object.assign(UI, { teksJadwalTes, siapkanBidang });

  const galat = err => {
    const m = String(err?.message || err || '');
    if (/duplicate key.*peserta_sesi/i.test(m)) return 'Peserta tersebut sudah ada di sesi ini.';
    if (/duplicate key.*penguji_sesi/i.test(m)) return 'Penguji tersebut sudah ditugaskan untuk bidang ini.';
    if (/sesi_tes_jam/.test(m)) return 'Jam selesai harus setelah jam mulai.';
    return pesanGalat(err);
  };

  window.SPMB_MODUL = window.SPMB_MODUL || {};

  /* =================================================================
     DATA BERSAMA
     ================================================================= */
  const SEL = { gel: '', uji: false };      // bertahan selama dashboard terbuka

  async function muatGelombang() {
    const { data, error } = await sb.from('gelombang').select('id,nama,urutan,tes_mulai,tes_selesai,pengumuman,hasil_terbit_pada,diarsipkan_pada')
      .is('diarsipkan_pada', null).order('urutan').order('id');
    if (error) throw error;
    if (!SEL.gel || !data.find(g => g.id == SEL.gel)) SEL.gel = String((data.find(g => !g.hasil_terbit_pada) || data[0] || {}).id || '');
    return data;
  }
  const opsiGel = gels => gels.map(g => `<option value="${g.id}" ${g.id == SEL.gel ? 'selected' : ''}>${esc(g.nama)}</option>`).join('');

  async function muatSesi(gelId) {
    const { data, error } = await sb.from('sesi_tes').select('*, penguji_sesi(pengguna_id,bidang), peserta_sesi(pendaftar_id,hadir,catatan)')
      .eq('gelombang_id', gelId).order('tanggal').order('jam_mulai').order('id');
    if (error) throw error;
    return data;
  }
  async function muatPendaftarGel(gelId) {
    const { data, error } = await sb.from('pendaftar')
      .select('id,no_registrasi,nama_lengkap,jenjang,bagian,status,uji,asal_kabupaten,asal_sekolah,tempat_lahir,tanggal_lahir,no_wa,darurat_no,darurat_nama,hafalan_juz,verif_berkas,verif_bayar,dibuat_pada')
      .eq('gelombang_id', gelId).not('status', 'in', '(dibatalkan,mengundurkan_diri)').order('nama_lengkap').limit(3000);
    if (error) throw error;
    return data;
  }
  async function muatPanitia() {
    const { data } = await sb.from('profil_pengguna').select('id,nama_lengkap,email,peran,bidang_penguji,aktif,no_wa').eq('aktif', true).order('nama_lengkap');
    return data || [];
  }

  /* =================================================================
     DOKUMEN: KARTU PESERTA TES, DAFTAR HADIR, LEMBAR PENILAIAN
     ================================================================= */
  function kopMini(k = {}) {
    if (k.mode === 'gambar' && k.gambar_kop) return `<div class="kt-kop gambar"><img alt="" src="${esc(k.gambar_kop)}"></div>`;
    const logo = u => u ? `<img alt="" src="${esc(u)}">` : '<span></span>';
    return `<div class="kt-kop">${logo(k.logo_kiri)}<div>${k.baris_1 ? `<div class="k1">${esc(k.baris_1)}</div>` : ''}
      ${k.baris_2 ? `<div class="k2">${esc(k.baris_2)}</div>` : ''}${k.baris_3 ? `<div class="k2">${esc(k.baris_3)}</div>` : ''}
      ${k.baris_info ? `<div class="k3">${esc(k.baris_info)}</div>` : ''}</div>${logo(k.logo_kanan || p_logo)}</div>`;
  }
  let p_logo = '';

  const KETENTUAN_BAWAAN = [
    'Hadir 30 menit sebelum tes dimulai dan membawa kartu ini.',
    'Berpakaian muslim/muslimah yang rapi dan sopan.',
    'Membawa alat tulis dan mushaf Al-Qur\'an.',
    'Tes daring: pastikan koneksi internet dan kamera menyala.'
  ];

  // Satu kartu (setengah halaman F4). p: pendaftar, sesi: sesi yang diikuti, peng: pengaturan
  function kartuTes(p, sesi, peng, gelNama) {
    p_logo = peng.kop_surat?.logo_kanan || peng.identitas?.logo || '';
    const ta = peng.identitas?.tahun_ajaran || '';
    const ttd = penandaTangan('kartu_tes', peng, p.jenjang);
    const kolom = ttd.length === 1 ? [{}, ttd[0]] : ttd;
    const catatanSesi = [...new Set(sesi.map(s => s.catatan).filter(Boolean))];
    const ketentuan = catatanSesi.length ? catatanSesi : KETENTUAN_BAWAAN;
    const baris = (a, b, kelas = '') => `<tr><td>${a}</td><td class="${kelas}">${esc(b || '–')}</td></tr>`;
    return `
      <div class="kartu-tes">
        ${kopMini(peng.kop_surat || {})}
        <div class="kt-judul">Kartu Peserta Tes Seleksi<small>SPMB Tahun Ajaran ${esc(ta)}${gelNama ? ' · ' + esc(gelNama) : ''}${p.uji ? ' · DATA UJI COBA' : ''}</small></div>
        <div class="kt-isi">
          <div class="kt-foto">Pas foto<br>3 × 4</div>
          <table class="kt-data"><colgroup><col style="width:30%"><col></colgroup><tbody>
            ${baris('Nomor registrasi', p.no_registrasi, 'kt-no')}
            ${baris('Nama lengkap', p.nama_lengkap)}
            ${baris('Tempat, tanggal lahir', `${p.tempat_lahir || '–'}, ${tglPanjangIso(p.tanggal_lahir)}`)}
            ${baris('Jenjang', `${p.jenjang} ${bagianL(p.bagian)}`)}
            ${baris('Asal sekolah', p.asal_sekolah)}
          </tbody></table>
        </div>
        <table class="kt-jadwal"><colgroup><col style="width:6%"><col style="width:22%"><col style="width:27%"><col style="width:13%"><col></colgroup>
          <thead><tr><th>No</th><th>Bidang tes</th><th>Hari, tanggal</th><th>Jam (WITA)</th><th>Tempat / media</th></tr></thead>
          <tbody>${sesi.length ? sesi.map((s, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc((s.bidang || []).map(bidangL).join(', '))}</td>
            <td>${esc(hariTglIso(s.tanggal))}</td><td style="text-align:center">${esc(rentangJam(s))}</td><td>${esc(tempatSesi(s))}</td></tr>`).join('')
            : '<tr><td colspan="5" style="text-align:center">Jadwal tes menyusul</td></tr>'}</tbody></table>
        <div class="kt-bawah">
          <div class="kt-ketentuan"><b>Ketentuan:</b><ol>${ketentuan.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
          <div class="kt-ttd">${kolom.map((t, i) => `<div>${t.jabatan ? `${i === kolom.length - 1 ? `Gowa, ${fmt.tglPanjang(new Date())}<br>` : '<br>'}${esc(t.jabatan)}<div class="spasi"></div><b>${esc(t.nama || '..............................')}</b>${t.nip ? `<br>${esc(t.nip)}` : ''}` : ''}</div>`).join('')}</div>
        </div>
      </div>`;
  }
  function htmlKartu(daftar, peng, gelNama) {
    return `<div class="kartu-cetak">${daftar.map(({ p, sesi }, i) => kartuTes(p, sesi, peng, gelNama) + (i % 2 === 0 && i < daftar.length - 1 ? '<div class="kt-potong">gunting di sini</div>' : i % 2 === 1 && i < daftar.length - 1 ? '<div class="halaman-baru"></div>' : '')).join('')}</div>`;
  }
  async function kartuCetakAtauPdf(daftar, gelNama, pdf) {
    if (!daftar.length) return toast('Tidak ada peserta untuk dibuatkan kartu.', 'warn');
    const peng = await muatPengaturan();
    const html = htmlKartu(daftar, peng, gelNama);
    if (!pdf) return cetakHtml(html);
    const t = toast(`Menyusun PDF ${daftar.length} kartu…`, 'info', 60000);
    try {
      const data = await buatPdfHtml(html, { judul: 'Kartu Peserta Tes' });
      simpanPdf(data, daftar.length === 1 ? `Kartu Tes ${daftar[0].p.no_registrasi} ${daftar[0].p.nama_lengkap}.pdf` : `Kartu Tes ${gelNama || ''} (${daftar.length} peserta).pdf`);
    } catch (err) { toast(galat(err), 'err', 6000); }
    finally { t.remove(); }
  }

  function metaSesi(s, gelNama, ta) {
    return `Tahun Ajaran ${esc(ta)} · ${esc(gelNama || '')}<br>Sesi: <b>${esc(s.nama)}</b> · ${esc(hariTglIso(s.tanggal))} pukul ${esc(rentangJam(s))} WITA · ${esc(MODE[s.mode][0])}: ${esc(tempatSesi(s))}<br>
      Bidang: ${esc((s.bidang || []).map(bidangL).join(', '))} · Jenjang: ${esc(jenjangL(s.jenjang))} ${s.bagian !== 'semua' ? esc(bagianL(s.bagian)) : ''}`;
  }
  async function daftarHadir(s, peserta, gelNama, pdf) {
    const peng = await muatPengaturan(), ta = peng.identitas?.tahun_ajaran || '', kp = peng.ketua_panitia || {};
    const opsi = {
      judul: 'Daftar Hadir Peserta Tes Seleksi', meta: metaSesi(s, gelNama, ta),
      isi: `<table><colgroup><col style="width:6%"><col style="width:25%"><col style="width:31%"><col style="width:10%"><col style="width:28%"></colgroup>
        <thead><tr><th>No</th><th>No. registrasi</th><th>Nama peserta</th><th>Jenjang</th><th>Tanda tangan</th></tr></thead>
        <tbody>${peserta.map((p, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(p.no_registrasi)}</td><td>${esc(p.nama_lengkap)}</td>
          <td style="text-align:center">${esc(p.jenjang)} ${p.bagian === 'putra' ? 'Pa' : 'Pi'}</td><td style="height:22pt"><span style="display:inline-block;${i % 2 ? 'margin-left:18mm' : ''}">${i + 1}.</span></td></tr>`).join('')}</tbody></table>
        <p style="font-size:9.5pt;margin:6px 0 0">Jumlah peserta: ${peserta.length} orang · Hadir: ........ orang · Tidak hadir: ........ orang</p>`,
      ttd: [{ jabatan: 'Mengetahui, Ketua Panitia SPMB,', nama: kp.nama, nip: kp.niy ? 'NIY. ' + kp.niy : '' }, { jabatan: 'Pengawas / Penguji,', nama: '' }]
    };
    return pdf ? unduh(opsi, `Daftar Hadir ${s.nama}.pdf`) : cetakDokumen(opsi);
  }
  async function lembarNilai(s, bidang, peserta, nilaiPer, namaPenguji, gelNama, pdf) {
    const peng = await muatPengaturan(), ta = peng.identitas?.tahun_ajaran || '', kp = peng.ketua_panitia || {};
    const tahfizh = bidang === 'tahfizh';
    const opsi = {
      judul: `Lembar Penilaian ${bidangL(bidang)}`, meta: metaSesi(s, gelNama, ta),
      isi: `<table><colgroup><col style="width:6%"><col style="width:20%"><col style="width:${tahfizh ? 28 : 34}%"><col style="width:12%">${tahfizh ? '<col style="width:12%">' : ''}<col></colgroup>
        <thead><tr><th>No</th><th>No. registrasi</th><th>Nama peserta</th><th>Nilai (0–100)</th>${tahfizh ? '<th>Hafalan diuji (juz)</th>' : ''}<th>Catatan</th></tr></thead>
        <tbody>${peserta.map((p, i) => { const n = (nilaiPer[p.id] || {})[bidang];
          return `<tr><td style="text-align:center">${i + 1}</td><td>${esc(p.no_registrasi)}</td><td>${esc(p.nama_lengkap)}</td>
            <td style="text-align:center;height:20pt">${n ? esc(angkaN(n.nilai)) : ''}</td>${tahfizh ? `<td style="text-align:center">${n?.hafalan_diuji != null ? esc(angkaN(n.hafalan_diuji)) : ''}</td>` : ''}<td>${esc(n?.catatan || '')}</td></tr>`; }).join('')}</tbody></table>`,
      ttd: [{ jabatan: 'Mengetahui, Ketua Panitia SPMB,', nama: kp.nama, nip: kp.niy ? 'NIY. ' + kp.niy : '' }, { jabatan: `Penguji ${bidangL(bidang)},`, nama: namaPenguji || '' }]
    };
    return pdf ? unduh(opsi, `Lembar Nilai ${bidangL(bidang)} ${s.nama}.pdf`) : cetakDokumen(opsi);
  }
  async function unduh(opsi, nama) {
    const t = toast('Menyusun PDF…', 'info', 60000);
    try { simpanPdf(await window.SPMB.buatPdfDokumen(opsi), nama); } catch (err) { toast(galat(err), 'err', 6000); } finally { t.remove(); }
  }
  // Pilihan cetak atau PDF
  async function pilihCetak(judul, fungsi) {
    const h = await dialog({ judul, ikon: 'ph-printer', tone: 'var(--c1)',
      isi: '<p style="margin:0">Cetak langsung ke printer (kertas F4) atau simpan sebagai PDF?</p>',
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Unduh PDF', ikon: 'ph-file-pdf', kelas: 'ghost', nilai: 'pdf' }, { label: 'Cetak', ikon: 'ph-printer', nilai: 'cetak' }] });
    if (h) await fungsi(h === 'pdf');
  }

  /* =================================================================
     WHATSAPP BERURUTAN (jadwal tes, pengingat tes)
     ================================================================= */
  async function waBerurutan(daftar, awalTemplat, gelNama) {
    if (!daftar.length) return toast('Tidak ada penerima.', 'warn');
    const peng = await muatPengaturan(true);
    const T = peng.templat_wa || {}, id_ = peng.identitas || {};
    const pilihan = ['jadwal_tes', 'pengingat_tes'].filter(x => T[x]);
    if (!pilihan.length) return toast('Templat WhatsApp Jadwal Tes belum ada. Periksa Pengaturan SPMB > Templat WhatsApp.', 'err');
    const { data: log } = await sb.from('log_wa').select('pendaftar_id,templat,pada').in('pendaftar_id', daftar.map(x => x.p.id)).in('templat', pilihan).order('pada', { ascending: false });
    const terkirim = {}; (log || []).forEach(l => { const k = l.pendaftar_id + l.templat; if (!terkirim[k]) terkirim[k] = l.pada; });
    let i = 0, templat = pilihan.includes(awalTemplat) ? awalTemplat : pilihan[0], jml = 0;
    const situs = alamatSitus();
    const dataPesan = x => ({
      nama: x.p.nama_lengkap, no_registrasi: x.p.no_registrasi, jenjang: `${x.p.jenjang} ${bagianL(x.p.bagian)}`, gelombang: gelNama || '',
      jadwal_tes: teksJadwalTes(x.sesi), tautan_status: `${situs}/cek-status.html?no=${encodeURIComponent(x.p.no_registrasi)}`,
      nama_lembaga: id_.nama_lembaga || '', tahun_ajaran: id_.tahun_ajaran || ''
    });
    // lompati yang sudah pernah dikirimi templat ini
    const mulaiDari = n => { let j = n; while (j < daftar.length && terkirim[daftar[j].p.id + templat]) j++; return j < daftar.length ? j : n; };
    i = mulaiDari(0);
    await dialog({
      judul: 'Kirim WhatsApp berurutan', ikon: 'ph-whatsapp-logo', tone: '#16a34a', lebar: true,
      isi: `<div class="wa-urut">
        <div class="chips-select" id="waTpl">${pilihan.map(x => `<label><input type="radio" name="tpl" value="${x}" ${x === templat ? 'checked' : ''}>${esc(T[x].judul || x)}</label>`).join('')}</div>
        <div class="wa-urut-kepala"><b id="waNo"></b><div class="gr-kemajuan" style="flex:1"><i id="waBar" style="--gr-w:#16a34a"></i></div></div>
        <div class="wa-kirim"><div>
          <div class="wa-penerima" id="waPenerima"></div>
          <div class="field"><label>Isi pesan (dapat diubah)</label><textarea class="textarea" id="waIsi" rows="9"></textarea></div></div>
          <div class="wa-layar"><div class="wa-gelembung" id="waPrev"></div></div></div>
        <p class="muted kecil" style="margin:6px 0 0"><i class="ph-duotone ph-info"></i> Setiap klik <b>Buka WhatsApp</b> membuka satu percakapan di tab baru dan tercatat di riwayat pendaftar. Kembali ke tab ini untuk penerima berikutnya.</p>
      </div>`,
      tombol: [
        { label: 'Selesai', kelas: 'ghost', nilai: true },
        { label: 'Sebelumnya', ikon: 'ph-caret-left', kelas: 'ghost', aksi: root => { if (i > 0) { i--; tampil(root); } return false; } },
        { label: 'Lewati', ikon: 'ph-skip-forward', kelas: 'ghost', aksi: root => { if (i < daftar.length - 1) { i++; tampil(root); } else toast('Ini penerima terakhir.', 'info'); return false; } },
        { label: 'Buka WhatsApp', ikon: 'ph-paper-plane-tilt', kelas: 'wa-btn', aksi: async root => {
          const x = daftar[i], nomor = String(x.p.no_wa || '').replace(/\D/g, ''), pesan = root.querySelector('#waIsi').value.trim();
          if (!nomor) { toast('Nomor WhatsApp peserta ini kosong.', 'warn'); return false; }
          window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`, '_blank', 'noopener');
          const { error } = await sb.from('log_wa').insert({ pendaftar_id: x.p.id, templat, nomor, pesan });
          if (error) toast('Riwayat WhatsApp tidak tersimpan: ' + galat(error), 'warn');
          terkirim[x.p.id + templat] = new Date().toISOString(); jml++;
          if (i < daftar.length - 1) i++; else toast(`Selesai. ${jml} pesan dibuka.`, 'ok');
          tampil(root); return false;
        } }
      ],
      saatBuka: root => {
        root.querySelectorAll('[name=tpl]').forEach(r => r.onchange = () => { templat = r.value; tampil(root); });
        root.querySelector('#waIsi').oninput = e => { root.querySelector('#waPrev').innerHTML = UI.formatWA(e.target.value); };
        tampil(root);
      }
    });
    function tampil(root) {
      const x = daftar[i], sudah = terkirim[x.p.id + templat];
      root.querySelector('#waNo').textContent = `${i + 1} / ${daftar.length}`;
      root.querySelector('#waBar').style.width = `${Math.round((i + 1) / daftar.length * 100)}%`;
      root.querySelector('#waPenerima').innerHTML = `<b>${esc(x.p.nama_lengkap)}</b> <span class="mono muted">${esc(x.p.no_registrasi)}</span>
        <div>${x.p.no_wa ? `<i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i> +${esc(x.p.no_wa)}` : '<span style="color:var(--danger)">Nomor WhatsApp kosong</span>'}
        ${sudah ? pill('Sudah dikirim ' + fmt.tglJam(sudah), 'var(--ok)', 'ph-check') : ''}${!x.sesi.length ? pill('Belum dijadwalkan', 'var(--c7)', 'ph-warning') : ''}</div>`;
      const ta = root.querySelector('#waIsi');
      ta.value = UI.isiTemplat(T[templat]?.isi || '', dataPesan(x));
      root.querySelector('#waPrev').innerHTML = UI.formatWA(ta.value);
    }
  }

  /* =================================================================
     MENU SELEKSI (Admin, Superadmin)
     ================================================================= */
  const TAB = [
    ['sesi', 'Sesi Tes', 'ph-calendar-check', 'var(--c2)'],
    ['nilai', 'Nilai dan Validasi', 'ph-list-checks', 'var(--c5)'],
    ['peringkat', 'Peringkat dan Keputusan', 'ph-ranking', 'var(--c3)'],
    ['bidang', 'Bidang dan Bobot', 'ph-scales', 'var(--c6)']
  ];
  window.SPMB_MODUL.seleksi = async (k, api) => {
    siapkanBidang(api.S.pengaturan);
    if (api.param) return halSesi(k, api, +api.param);
    const tab = (location.hash.match(/[?&]tab=(\w+)/) || [])[1] || 'sesi';
    k.innerHTML = `
      <div class="tabs" role="tablist">${TAB.map(([id, l, ic, t]) => `<button role="tab" data-tab="${id}" aria-selected="${id === tab}"><i class="ph-duotone ${ic}" style="color:${t}"></i>${l}</button>`).join('')}</div>
      <div id="isiTab"></div>`;
    k.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { location.hash = '#/seleksi?tab=' + b.dataset.tab; });
    api.setFab(null);
    await ({ sesi: tabSesi, nilai: tabNilai, peringkat: tabPeringkat, bidang: tabBidang, bobot: tabBidang }[tab] || tabSesi)($('#isiTab'), api);
  };

  /* ---------- Tab Sesi Tes ---------- */
  async function tabSesi(el, api) {
    const gels = await muatGelombang();
    if (!gels.length) {
      el.innerHTML = `<div class="card"><div class="empty"><i class="ph-duotone ph-flag-banner"></i><b>Belum ada gelombang</b>Superadmin membuat gelombang di Pengaturan SPMB, lalu sesi tes dapat dibuat di sini.</div></div>`;
      return;
    }
    el.innerHTML = `
      <div class="page-head">
        <select class="select" id="sGel" aria-label="Gelombang" style="max-width:240px">${opsiGel(gels)}</select>
        <label class="check uji-saklar"><input type="checkbox" id="sUji" ${SEL.uji ? 'checked' : ''}>Data uji</label>
        <div class="spacer"></div>
        <button class="btn sm ghost" id="btnWaSemua"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i><span class="hide-sm">WA jadwal semua</span></button>
        <button class="btn sm ghost" id="btnKartuSemua"><i class="ph-duotone ph-identification-badge" style="color:var(--c4)"></i><span class="hide-sm">Kartu semua peserta</span></button>
        <button class="btn sm" id="btnSesiBaru"><i class="ph-duotone ph-plus"></i>Tambah sesi</button>
      </div>
      <div class="stats stats-seleksi" id="sStat"></div>
      <div id="sCakupan"></div>
      <div id="sDaftar" class="sesi-daftar"></div>
      <div class="note info" style="margin-top:14px"><i class="ph-duotone ph-info"></i><div>
        Buat satu sesi untuk setiap waktu dan tempat tes. Satu sesi dapat menguji beberapa bidang sekaligus (misalnya pagi Tahfizh dan Tes Tertulis), atau buat sesi terpisah per bidang.
        Peserta yang dijadwalkan otomatis berstatus <b>Ikut tes</b>, dan Penguji menerima notifikasi penugasan.</div></div>`;
    let sesi = [], pendaftar = [], panitia = [];
    const gelNama = () => (gels.find(g => g.id == SEL.gel) || {}).nama || '';

    const render = () => {
      const P = pendaftar.filter(p => p.uji === SEL.uji);
      const siap = P.filter(p => SIAP_TES.includes(p.status));
      const idSesi = new Set(sesi.flatMap(s => s.peserta_sesi.map(x => x.pendaftar_id)));
      const terjadwal = siap.filter(p => idSesi.has(p.id));
      const belumLunas = P.filter(p => ['terdaftar', 'berkas_kurang', 'berkas_diverifikasi'].includes(p.status)).length;
      $('#sStat').innerHTML = [
        ['Siap tes (terverifikasi lengkap)', siap.length, 'ph-seal-check', 'var(--ok)'],
        ['Sudah dijadwalkan', terjadwal.length, 'ph-calendar-check', 'var(--c2)'],
        ['Belum dijadwalkan', siap.length - terjadwal.length, 'ph-calendar-x', 'var(--c7)'],
        ['Sesi tes', sesi.length, 'ph-chalkboard-teacher', 'var(--c1)'],
        ['Belum terverifikasi lengkap', belumLunas, 'ph-hourglass-medium', 'var(--c6)']
      ].map(([l, n, ic, t]) => `<div class="stat" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b>${fmt.angka(n)}</b><span>${l}</span></div>`).join('');

      // Cakupan per bidang: siapa yang belum punya sesi untuk bidang itu
      const kurang = URUT_BIDANG.map(b => {
        const orang = siap.filter(p => bobotB(p.jenjang, b) > 0
          && !sesi.some(s => s.bidang.includes(b) && s.peserta_sesi.some(x => x.pendaftar_id === p.id)));
        return [b, orang];
      }).filter(([, o]) => o.length);
      $('#sCakupan').innerHTML = kurang.length ? `<div class="note"><i class="ph-duotone ph-warning"></i><div><b>Belum semua peserta terjadwal di setiap bidang tes.</b>
        <div class="pill-baris" style="margin-top:6px">${kurang.map(([b, o]) => `<button type="button" class="pill tombol-pill" data-kurang="${b}" style="--tone:${warnaB(b)}"><i class="ph-duotone ${ikonB(b)}"></i>${esc(bidangL(b))}: ${o.length} peserta</button>`).join('')}</div></div></div>` : '';
      $('#sCakupan').querySelectorAll('[data-kurang]').forEach(b => b.onclick = () => {
        const o = kurang.find(x => x[0] === b.dataset.kurang)[1];
        dialog({ judul: `Belum terjadwal: ${bidangL(b.dataset.kurang)}`, ikon: 'ph-calendar-x', tone: 'var(--c7)',
          isi: `<ol class="daftar-rapat">${o.map(p => `<li><b>${esc(p.nama_lengkap)}</b> <span class="mono muted">${esc(p.no_registrasi)}</span> · ${p.jenjang} ${bagianL(p.bagian)}</li>`).join('')}</ol>
            <p class="muted kecil">Buka sesi yang menguji bidang ini, lalu klik <b>Tambah peserta</b>.</p>`, tombol: [{ label: 'Tutup', nilai: null }] });
      });

      const nama = id => (panitia.find(u => u.id === id) || {}).nama_lengkap || 'Panitia';
      $('#sDaftar').innerHTML = sesi.length ? sesi.map(s => {
        const [st, stT, stI] = statusSesi(s);
        const jml = s.peserta_sesi.filter(x => (pendaftar.find(p => p.id === x.pendaftar_id) || {}).uji === SEL.uji).length;
        const semua = s.peserta_sesi.length, hadir = s.peserta_sesi.filter(x => x.hadir === true).length;
        const pengujiB = s.bidang.map(b => `<div class="sesi-penguji-baris">${pillBidang(b)}<span>${s.penguji_sesi.filter(x => x.bidang === b).map(x => esc(nama(x.pengguna_id))).join(', ') || '<em class="muted">Belum ada penguji</em>'}</span></div>`).join('');
        return `<a class="card sesi-kartu${s.tanggal < hariIni() ? ' redup' : ''}" href="#/seleksi/${s.id}">
          <div class="sesi-kepala"><span class="sesi-tgl"><b>${dIso(s.tanggal).getDate()}</b><small>${fmt.tglPanjang(dIso(s.tanggal)).split(' ')[1].slice(0, 3)}</small></span>
            <div class="teks"><b>${esc(s.nama)}</b><small>${esc(hariTglIso(s.tanggal))} · ${esc(rentangJam(s))} WITA</small></div>
            ${pill(st, stT, stI)}</div>
          <div class="pill-baris">${pill(MODE[s.mode][0], MODE[s.mode][2], MODE[s.mode][1])}${pill(jenjangL(s.jenjang) + (s.bagian !== 'semua' ? ' ' + bagianL(s.bagian) : ''), 'var(--c8)', 'ph-users-three')}
            <span class="muted kecil sesi-tempat"><i class="ph-duotone ${MODE[s.mode][1]}"></i>${esc(s.mode === 'online' ? (s.tempat || 'Daring') : (s.tempat || 'Tempat belum diisi'))}</span></div>
          <div class="sesi-penguji">${pengujiB}</div>
          <div class="sesi-kaki"><span><i class="ph-duotone ph-users" style="color:var(--c2)"></i><b>${fmt.angka(jml)}</b> peserta${SEL.uji ? ' uji' : ''}${s.kapasitas ? ` <span class="muted">/ ${s.kapasitas} kursi</span>` : ''}${semua !== jml ? ` <span class="muted">(+${semua - jml} ${SEL.uji ? 'sungguhan' : 'uji'})</span>` : ''}</span>
            ${hadir ? `<span><i class="ph-duotone ph-check-circle" style="color:var(--ok)"></i>${hadir} hadir</span>` : ''}
            <span class="buka">Buka <i class="ph-duotone ph-caret-right"></i></span></div>
          ${s.kapasitas ? UI_kemajuan(semua, s.kapasitas) : ''}
        </a>`;
      }).join('') : `<div class="card"><div class="empty"><i class="ph-duotone ph-calendar-plus"></i><b>Belum ada sesi tes di ${esc(gelNama())}</b>Klik <b>Tambah sesi</b> untuk membuat jadwal tes pertama.</div></div>`;
    };
    const muat = async () => {
      [sesi, pendaftar, panitia] = await Promise.all([muatSesi(SEL.gel), muatPendaftarGel(SEL.gel), muatPanitia()]);
      render();
    };
    await muat();
    $('#sGel').onchange = async e => { SEL.gel = e.target.value; await muat(); };
    $('#sUji').onchange = e => { SEL.uji = e.target.checked; render(); };
    const baru = async () => { const id = await formSesi(null, gels, sesi.length); if (id) { toast('Sesi tes ditambahkan.'); location.hash = '#/seleksi/' + id; } };
    $('#btnSesiBaru').onclick = baru;
    api.setFab(baru, 'ph-plus', 'Tambah sesi');
    const pesertaDenganSesi = () => pendaftar.filter(p => p.uji === SEL.uji && sesi.some(s => s.peserta_sesi.some(x => x.pendaftar_id === p.id)))
      .map(p => ({ p, sesi: sesi.filter(s => s.peserta_sesi.some(x => x.pendaftar_id === p.id)) }))
      .sort((a, b) => a.p.jenjang.localeCompare(b.p.jenjang) || a.p.bagian.localeCompare(b.p.bagian) || a.p.nama_lengkap.localeCompare(b.p.nama_lengkap));
    $('#btnKartuSemua').onclick = () => pilihCetak('Kartu peserta tes (semua sesi)', pdf => kartuCetakAtauPdf(pesertaDenganSesi(), gelNama(), pdf));
    $('#btnWaSemua').onclick = () => waBerurutan(pesertaDenganSesi(), 'jadwal_tes', gelNama());
  }
  const UI_kemajuan = (n, maks) => `<span class="gr-kemajuan sesi-bar"><i style="width:${Math.min(100, Math.round(n / maks * 100))}%;--gr-w:${n >= maks ? 'var(--danger)' : 'var(--c2)'}"></i></span>`;

  /* ---------- Formulir sesi ---------- */
  async function formSesi(s, gels, jumlahSesi = 0) {
    const baru = !s;
    s = s || { gelombang_id: +SEL.gel, bidang: bidangAktif().length ? bidangAktif() : [...URUT_BIDANG], mode: 'offline', jenjang: 'semua', bagian: 'semua' };
    const adaPeserta = !baru && (s.peserta_sesi || []).length > 0;
    return dialog({
      judul: baru ? 'Tambah sesi tes' : `Ubah ${s.nama}`, ikon: 'ph-calendar-check', tone: 'var(--c2)', lebar: true,
      isi: `<form id="fSesi" novalidate><div class="grid-form">
        <div class="field"><label>Nama sesi <span class="req">*</span></label><input class="input" name="nama" maxlength="80" value="${esc(s.nama || `Sesi ${jumlahSesi + 1}`)}" placeholder="Contoh: Sesi 1 Putra"></div>
        <div class="field"><label>Gelombang</label><select class="select" name="gelombang_id" ${adaPeserta ? 'disabled' : ''}>${gels.map(g => `<option value="${g.id}" ${g.id == s.gelombang_id ? 'selected' : ''}>${esc(g.nama)}</option>`).join('')}</select>
          ${adaPeserta ? '<small>Tidak dapat diubah karena sesi sudah berisi peserta.</small>' : ''}</div>
        <div class="field"><label>Tanggal <span class="req">*</span></label><input class="input" type="date" name="tanggal" value="${esc(s.tanggal || '')}" ${baru ? 'data-default-today' : ''}></div>
        <div class="field"><label>Jam (WITA) <span class="req">*</span></label><div class="pasangan">
          <input class="input" type="time" name="jam_mulai" value="${esc(jamT(s.jam_mulai).replace('.', ':'))}" ${baru ? 'data-default-now' : ''} aria-label="Jam mulai">
          <input class="input" type="time" name="jam_selesai" value="${esc(jamT(s.jam_selesai).replace('.', ':'))}" aria-label="Jam selesai"></div><small>Jam mulai dan jam selesai (boleh kosong).</small></div>
        <div class="field full"><span class="label">Bidang yang diujikan <span class="req">*</span></span>
          <div class="chips-select">${[...new Set([...URUT_BIDANG, ...s.bidang])].map(b => `<label><input type="checkbox" name="bidang" value="${b}" ${s.bidang.includes(b) ? 'checked' : ''}><i class="ph-duotone ${(BIDANG[b] || [0, 'ph-exam'])[1]}" style="color:${(BIDANG[b] || [0, 0, 'var(--c8)'])[2]}"></i>${esc(bidangL(b))}${bidangAktif().length && !bidangAktif().includes(b) ? ' <small class="muted">(bobot 0)</small>' : ''}</label>`).join('')}</div></div>
        <div class="field full"><span class="label">Mode tes</span>
          <div class="chips-select">${Object.entries(MODE).map(([v, [l, ic, t]]) => `<label><input type="radio" name="mode" value="${v}" ${s.mode === v ? 'checked' : ''}><i class="ph-duotone ${ic}" style="color:${t}"></i>${l}</label>`).join('')}</div></div>
        <div class="field"><label id="lTempat">Tempat / ruang</label><input class="input" name="tempat" maxlength="120" value="${esc(s.tempat || '')}"></div>
        <div class="field" data-online><label>Tautan rapat</label><input class="input" name="tautan" type="url" maxlength="300" value="${esc(s.tautan || '')}" placeholder="https://meet.google.com/…"><small>Tampil di Cek Status dan Kartu Peserta.</small></div>
        <div class="field"><label>Jenjang peserta</label><select class="select" name="jenjang">${['semua', 'SMP', 'SMA'].map(v => `<option value="${v}" ${s.jenjang === v ? 'selected' : ''}>${jenjangL(v)}</option>`).join('')}</select></div>
        <div class="field"><label>Putra / putri</label><select class="select" name="bagian">${['semua', 'putra', 'putri'].map(v => `<option value="${v}" ${s.bagian === v ? 'selected' : ''}>${bagianL(v)}</option>`).join('')}</select></div>
        <div class="field"><label>Kapasitas kursi</label><input class="input" type="number" inputmode="numeric" min="1" max="1000" name="kapasitas" value="${esc(s.kapasitas ?? '')}" placeholder="Tanpa batas"></div>
        <div class="field full"><label>Ketentuan / catatan untuk peserta</label><textarea class="textarea" name="catatan" rows="3" maxlength="600" placeholder="Satu ketentuan per baris. Kosong = ketentuan bawaan di Kartu Peserta.">${esc(s.catatan || '')}</textarea></div>
      </div><div id="fErr"></div></form>`,
      saatBuka: root => {
        SPMB.isiTanggalBawaan(root);
        const f = root.querySelector('#fSesi');
        const atur = () => { const on = f.querySelector('[name=mode]:checked').value === 'online';
          root.querySelector('[data-online]').style.display = on ? '' : 'none';
          root.querySelector('#lTempat').textContent = on ? 'Media (Zoom, Google Meet, video call WA)' : 'Tempat / ruang';
          f.elements.tempat.placeholder = on ? 'Contoh: Google Meet' : 'Contoh: Aula Pondok Putra'; };
        f.querySelectorAll('[name=mode]').forEach(r => r.onchange = atur); atur();
      },
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: baru ? 'Simpan sesi' : 'Simpan perubahan', ikon: 'ph-floppy-disk', aksi: async root => {
        const f = root.querySelector('#fSesi'), v = n => (f.elements[n]?.value || '').trim();
        const d = {
          nama: v('nama'), gelombang_id: +(adaPeserta ? s.gelombang_id : v('gelombang_id')), tanggal: v('tanggal'), jam_mulai: v('jam_mulai'), jam_selesai: v('jam_selesai') || null,
          bidang: [...f.querySelectorAll('[name=bidang]:checked')].map(x => x.value), mode: f.querySelector('[name=mode]:checked').value,
          tempat: v('tempat'), tautan: v('tautan'), jenjang: v('jenjang'), bagian: v('bagian'), kapasitas: v('kapasitas') ? +v('kapasitas') : null, catatan: v('catatan')
        };
        if (d.mode === 'offline') d.tautan = '';
        const err = [];
        if (d.nama.length < 2) err.push('Nama sesi minimal 2 karakter.');
        if (!d.tanggal) err.push('Isi tanggal tes (dd/mm/yyyy).');
        if (!d.jam_mulai) err.push('Isi jam mulai (HH.MM).');
        if (d.jam_selesai && d.jam_selesai <= d.jam_mulai) err.push('Jam selesai harus setelah jam mulai.');
        if (!d.bidang.length) err.push('Pilih minimal satu bidang tes.');
        if (d.tautan && !/^https?:\/\/\S+$/.test(d.tautan)) err.push('Tautan rapat harus diawali https://');
        if (d.kapasitas != null && (d.kapasitas < 1 || d.kapasitas > 1000)) err.push('Kapasitas 1 sampai 1000.');
        root.querySelector('#fErr').innerHTML = err.length ? `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${err.map(esc).join('<br>')}</div></div>` : '';
        if (err.length) return false;
        const q = baru ? sb.from('sesi_tes').insert(d).select('id').single() : sb.from('sesi_tes').update(d).eq('id', s.id).select('id').single();
        const { data, error } = await q;
        if (error) throw new Error(galat(error));
        return data.id;
      } }]
    });
  }

  /* ---------- Halaman satu sesi ---------- */
  async function halSesi(k, api, id) {
    const [{ data: s, error }, gels, panitia] = await Promise.all([
      sb.from('sesi_tes').select('*, penguji_sesi(pengguna_id,bidang), peserta_sesi(pendaftar_id,hadir,catatan)').eq('id', id).maybeSingle(),
      muatGelombang(), muatPanitia()
    ]);
    if (error) throw error;
    if (!s) { k.innerHTML = `<div class="card"><div class="empty"><i class="ph-duotone ph-calendar-x"></i><b>Sesi tidak ditemukan</b><a href="#/seleksi">Kembali ke daftar sesi</a></div></div>`; return; }
    SEL.gel = String(s.gelombang_id);
    const g = gels.find(x => x.id === s.gelombang_id) || {};
    const [pendaftar, semuaSesi, nilaiRes] = await Promise.all([
      muatPendaftarGel(s.gelombang_id), muatSesi(s.gelombang_id),
      sb.from('nilai_tes').select('id,pendaftar_id,bidang,nilai,status,hafalan_diuji,catatan').in('pendaftar_id', s.peserta_sesi.map(x => x.pendaftar_id).concat(['00000000-0000-0000-0000-000000000000']))
    ]);
    const nilaiPer = {}; (nilaiRes.data || []).forEach(n => { (nilaiPer[n.pendaftar_id] = nilaiPer[n.pendaftar_id] || {})[n.bidang] = n; });
    const byId = Object.fromEntries(pendaftar.map(p => [p.id, p]));
    const peserta = s.peserta_sesi.map(x => ({ ...byId[x.pendaftar_id], hadir: x.hadir })).filter(p => p.id)
      .sort((a, b) => a.jenjang.localeCompare(b.jenjang) || a.bagian.localeCompare(b.bagian) || a.nama_lengkap.localeCompare(b.nama_lengkap));
    const namaU = uid => (panitia.find(u => u.id === uid) || {}).nama_lengkap || 'Panitia';
    const [st, stT, stI] = statusSesi(s);
    api.setFab(() => tambahPeserta(), 'ph-user-plus', 'Tambah peserta');
    document.getElementById('pgJudul').textContent = s.nama;

    k.innerHTML = `
      <a class="kembali" href="#/seleksi"><i class="ph-duotone ph-arrow-left"></i>Semua sesi tes</a>
      <div class="card sesi-detail">
        <div class="sesi-kepala"><span class="sesi-tgl besar"><b>${dIso(s.tanggal).getDate()}</b><small>${fmt.tglPanjang(dIso(s.tanggal)).split(' ')[1].slice(0, 3)}</small></span>
          <div class="teks"><h2>${esc(s.nama)}</h2><small>${esc(g.nama || '')} · ${esc(hariTglIso(s.tanggal))} · ${esc(rentangJam(s))} WITA</small>
            <div class="pill-baris">${pill(st, stT, stI)}${pill(MODE[s.mode][0], MODE[s.mode][2], MODE[s.mode][1])}${s.bidang.map(pillBidang).join('')}
              ${pill(jenjangL(s.jenjang) + (s.bagian !== 'semua' ? ' ' + bagianL(s.bagian) : ''), 'var(--c8)', 'ph-users-three')}</div></div>
          <button class="icon-btn plain" id="btnUbahSesi" title="Ubah sesi" aria-label="Ubah sesi"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></button>
          <button class="icon-btn plain" id="btnHapusSesi" title="Hapus sesi" aria-label="Hapus sesi"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button></div>
        <div class="sesi-info">
          <div><i class="ph-duotone ${MODE[s.mode][1]}" style="color:${MODE[s.mode][2]}"></i><span>${s.mode === 'online' ? 'Media' : 'Tempat'}</span><b>${esc(s.tempat || '–')}</b></div>
          ${s.mode === 'online' ? `<div><i class="ph-duotone ph-link" style="color:var(--c2)"></i><span>Tautan rapat</span><b>${s.tautan ? `<a href="${esc(s.tautan)}" target="_blank" rel="noopener">${esc(s.tautan)}</a>` : '–'}</b></div>` : ''}
          <div><i class="ph-duotone ph-armchair" style="color:var(--c3)"></i><span>Kapasitas</span><b>${s.kapasitas ? `${peserta.length} / ${s.kapasitas} kursi` : `${peserta.length} peserta (tanpa batas)`}</b></div>
          ${s.catatan ? `<div class="penuh"><i class="ph-duotone ph-note" style="color:var(--c6)"></i><span>Ketentuan</span><b>${esc(s.catatan).replace(/\n/g, '<br>')}</b></div>` : ''}
        </div>
        <div class="bilah-aksi" style="margin:12px 0 0">
          <button class="btn sm ghost" id="btnKartu"><i class="ph-duotone ph-identification-badge" style="color:var(--c4)"></i>Kartu peserta</button>
          <button class="btn sm ghost" id="btnHadir"><i class="ph-duotone ph-list-checks" style="color:var(--c1)"></i>Daftar hadir</button>
          <button class="btn sm ghost" id="btnLembar"><i class="ph-duotone ph-clipboard-text" style="color:var(--c5)"></i>Lembar penilaian</button>
          <button class="btn sm ghost" id="btnWaJadwal"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i>WA jadwal</button>
          <button class="btn sm ghost" id="btnWaIngat"><i class="ph-duotone ph-alarm" style="color:var(--c3)"></i>WA pengingat</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-chalkboard-teacher"></i></div><div><h3>Penguji</h3><p>Setiap bidang dapat diuji lebih dari satu orang</p></div>
          <button class="btn sm ghost" id="btnTambahPenguji" style="margin-left:auto"><i class="ph-duotone ph-user-plus" style="color:var(--c5)"></i>Tugaskan penguji</button></div>
        <div class="penguji-kisi">${s.bidang.map(b => `<div class="penguji-bidang" style="--tone:${warnaB(b)}"><div class="judul"><i class="ph-duotone ${ikonB(b)}"></i>${esc(bidangL(b))}</div>
          ${s.penguji_sesi.filter(x => x.bidang === b).map(x => `<div class="penguji-orang"><span class="avatar kecil">${esc(SPMB.inisial(namaU(x.pengguna_id)))}</span><span>${esc(namaU(x.pengguna_id))}</span>
            <button class="icon-btn plain" data-lepas="${x.pengguna_id}|${b}" title="Lepaskan" aria-label="Lepaskan penguji"><i class="ph-duotone ph-x-circle" style="color:var(--danger)"></i></button></div>`).join('') || '<p class="muted kecil" style="margin:4px 0">Belum ada penguji</p>'}</div>`).join('')}</div>
      </div>

      <div class="card">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c2)"><i class="ph-duotone ph-users-three"></i></div><div><h3>Peserta</h3><p id="infoPeserta"></p></div>
          <button class="btn sm" id="btnTambahPeserta" style="margin-left:auto"><i class="ph-duotone ph-user-plus"></i><span class="hide-sm">Tambah peserta</span></button></div>
        <div class="field cari-besar" style="margin:0 0 10px"><i class="ph-duotone ph-magnifying-glass"></i><input class="input" id="cariPeserta" type="search" placeholder="Cari nama atau nomor registrasi…"></div>
        <div class="table-wrap"><table class="tbl tbl-peserta-sesi"><thead><tr><th class="c">No</th><th>Peserta</th><th class="hide-sm">Asal sekolah</th><th class="c">Kehadiran</th>
          ${s.bidang.map(b => `<th class="c">${esc(bidangL(b))}</th>`).join('')}<th class="c">Aksi</th></tr></thead><tbody id="tbPeserta"></tbody></table></div>
      </div>`;

    const renderPeserta = () => {
      const q = ($('#cariPeserta').value || '').toLowerCase();
      const rows = peserta.filter(p => !q || p.nama_lengkap.toLowerCase().includes(q) || p.no_registrasi.toLowerCase().includes(q));
      const hadir = peserta.filter(p => p.hadir === true).length, absen = peserta.filter(p => p.hadir === false).length;
      $('#infoPeserta').textContent = `${peserta.length} peserta · ${hadir} hadir · ${absen} tidak hadir`;
      $('#tbPeserta').innerHTML = rows.length ? rows.map((p, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td><b>${esc(p.nama_lengkap)}</b>${p.uji ? ' <span class="pill" style="--tone:var(--c6)">Uji</span>' : ''}<br><small class="mono muted">${esc(p.no_registrasi)}</small> <small class="muted">· ${p.jenjang} ${bagianL(p.bagian)}</small></td>
        <td class="hide-sm">${esc(p.asal_sekolah || '–')}</td>
        <td class="c"><div class="hadir-pilih" role="group" aria-label="Kehadiran">
          <button type="button" data-hadir="${p.id}|1" aria-pressed="${p.hadir === true}" title="Hadir"><i class="ph-duotone ph-check"></i></button>
          <button type="button" data-hadir="${p.id}|0" aria-pressed="${p.hadir === false}" title="Tidak hadir"><i class="ph-duotone ph-x"></i></button></div></td>
        ${s.bidang.map(b => { const n = (nilaiPer[p.id] || {})[b]; return `<td class="c">${n ? `<span class="nilai-sel" style="--tone:${ST_NILAI[n.status][1]}" title="${ST_NILAI[n.status][0]}"><i class="ph-duotone ${ST_NILAI[n.status][2]}"></i>${esc(angkaN(n.nilai))}</span>` : '<span class="muted">–</span>'}</td>`; }).join('')}
        <td class="c aksi-sel">
          <button class="icon-btn plain" data-kartu="${p.id}" title="Kartu peserta" aria-label="Kartu peserta"><i class="ph-duotone ph-identification-badge" style="color:var(--c4)"></i></button>
          <a class="icon-btn plain" href="#/pendaftar/${p.id}" title="Detail pendaftar" aria-label="Detail pendaftar"><i class="ph-duotone ph-arrow-square-out" style="color:var(--c1)"></i></a>
          <button class="icon-btn plain" data-keluar="${p.id}" title="Keluarkan dari sesi" aria-label="Keluarkan dari sesi"><i class="ph-duotone ph-user-minus" style="color:var(--danger)"></i></button></td></tr>`).join('')
        : `<tr><td colspan="${5 + s.bidang.length}"><div class="empty" style="padding:22px"><i class="ph-duotone ph-users-three"></i><b>${peserta.length ? 'Tidak ada yang cocok' : 'Belum ada peserta'}</b>${peserta.length ? '' : 'Klik Tambah peserta untuk memilih calon santri yang siap tes.'}</div></td></tr>`;
    };
    renderPeserta();
    $('#cariPeserta').oninput = renderPeserta;

    const segarkan = () => halSesi(k, api, id);
    $('#btnUbahSesi').onclick = async () => { if (await formSesi(s, gels)) { toast('Sesi disimpan.'); segarkan(); } };
    $('#btnHapusSesi').onclick = async () => {
      if (!(await konfirmasi('Hapus sesi ini?', `Sesi <b>${esc(s.nama)}</b> beserta daftar peserta dan penugasan pengujinya akan dihapus. Sesi yang sudah memiliki nilai tidak dapat dihapus.`, 'Hapus sesi', true))) return;
      const { error } = await sb.from('sesi_tes').delete().eq('id', s.id);
      if (error) return toast(galat(error), 'err', 7000);
      toast('Sesi dihapus.'); location.hash = '#/seleksi';
    };

    // Penguji
    $('#btnTambahPenguji').onclick = async () => {
      const calon = panitia.filter(u => u.peran !== 'penguji' || s.bidang.some(b => (u.bidang_penguji || []).includes(b)));
      const hasil = await dialog({
        judul: 'Tugaskan penguji', ikon: 'ph-chalkboard-teacher', tone: 'var(--c5)',
        isi: `<div class="field"><label>Bidang</label><select class="select" id="pjBidang">${s.bidang.map(b => `<option value="${b}">${esc(bidangL(b))}</option>`).join('')}</select></div>
          <div class="field"><label>Penguji</label><select class="select" id="pjOrang"></select>
          <small>Akun Penguji tampil sesuai bidang di data penggunanya. Admin dan Superadmin juga dapat menjadi penguji.</small></div>`,
        saatBuka: root => {
          const isi = () => { const b = root.querySelector('#pjBidang').value;
            const pilih = calon.filter(u => u.peran !== 'penguji' || (u.bidang_penguji || []).includes(b)).filter(u => !s.penguji_sesi.some(x => x.pengguna_id === u.id && x.bidang === b));
            root.querySelector('#pjOrang').innerHTML = pilih.length ? pilih.map(u => `<option value="${u.id}">${esc(u.nama_lengkap || u.email)} · ${u.peran === 'penguji' ? 'Penguji' : u.peran === 'admin' ? 'Admin' : 'Superadmin'}</option>`).join('') : '<option value="">Tidak ada akun yang tersedia untuk bidang ini</option>'; };
          root.querySelector('#pjBidang').onchange = isi; isi();
        },
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Tugaskan', ikon: 'ph-check', aksi: root => {
          const d = { sesi_id: s.id, pengguna_id: root.querySelector('#pjOrang').value, bidang: root.querySelector('#pjBidang').value };
          if (!d.pengguna_id) { toast('Pilih penguji. Tambahkan akun Penguji di menu Pengguna bila belum ada.', 'warn'); return false; }
          return d;
        } }]
      });
      if (!hasil) return;
      const { error } = await sb.from('penguji_sesi').insert(hasil);
      if (error) return toast(galat(error), 'err', 6000);
      toast('Penguji ditugaskan dan menerima notifikasi.'); segarkan();
    };
    k.querySelectorAll('[data-lepas]').forEach(b => b.onclick = async () => {
      const [uid, bid] = b.dataset.lepas.split('|');
      if (!(await konfirmasi('Lepaskan penguji?', `${esc(namaU(uid))} tidak lagi menguji ${esc(bidangL(bid))} di sesi ini. Nilai yang sudah diisinya tetap tersimpan.`, 'Lepaskan'))) return;
      const { error } = await sb.from('penguji_sesi').delete().match({ sesi_id: s.id, pengguna_id: uid, bidang: bid });
      if (error) return toast(galat(error), 'err'); segarkan();
    });

    // Peserta
    $('#btnTambahPeserta').onclick = () => tambahPeserta();
    async function tambahPeserta() {
      const sudahBidang = id => semuaSesi.filter(x => x.id !== s.id && x.bidang.some(b => s.bidang.includes(b)) && x.peserta_sesi.some(y => y.pendaftar_id === id));
      const dasar = pendaftar.filter(p => !s.peserta_sesi.some(x => x.pendaftar_id === p.id)
        && (s.jenjang === 'semua' || p.jenjang === s.jenjang) && (s.bagian === 'semua' || p.bagian === s.bagian)
        && !['lulus', 'cadangan', 'tidak_lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai'].includes(p.status));
      const sisaKursi = s.kapasitas ? s.kapasitas - s.peserta_sesi.length : Infinity;
      const hasil = await dialog({
        judul: `Tambah peserta ke ${s.nama}`, ikon: 'ph-user-plus', tone: 'var(--c2)', lebar: true,
        isi: `<div class="page-head" style="margin:0 0 10px">
            <div class="field cari-besar" style="margin:0;flex:1"><i class="ph-duotone ph-magnifying-glass"></i><input class="input" id="tpCari" type="search" placeholder="Cari nama atau nomor…"></div>
            <label class="check"><input type="checkbox" id="tpUji" ${SEL.uji ? 'checked' : ''}>Data uji</label>
            <label class="check"><input type="checkbox" id="tpBelum">Tampilkan yang belum terverifikasi</label></div>
          <div class="bilah-aksi" style="margin:0 0 8px"><label class="check"><input type="checkbox" id="tpSemua">Pilih semua yang tampil</label><div class="spacer"></div><span class="muted kecil" id="tpInfo"></span></div>
          <div class="pilih-peserta" id="tpDaftar"></div>`,
        saatBuka: root => {
          const render = () => {
            const q = root.querySelector('#tpCari').value.toLowerCase(), uji = root.querySelector('#tpUji').checked, belum = root.querySelector('#tpBelum').checked;
            const rows = dasar.filter(p => p.uji === uji && (belum || SIAP_TES.includes(p.status)) && (!q || p.nama_lengkap.toLowerCase().includes(q) || p.no_registrasi.toLowerCase().includes(q)));
            root.querySelector('#tpDaftar').innerHTML = rows.length ? rows.map(p => { const lain = sudahBidang(p.id), st = ST_PESERTA[p.status] || [p.status, 'var(--c8)'];
              return `<label class="pilih-baris${lain.length ? ' nonaktif' : ''}"><input type="checkbox" value="${p.id}" ${lain.length ? 'disabled' : ''}>
                <span><b>${esc(p.nama_lengkap)}</b> <small class="mono muted">${esc(p.no_registrasi)}</small><br><small class="muted">${p.jenjang} ${bagianL(p.bagian)} · ${esc(p.asal_kabupaten || '–')}</small>
                ${lain.length ? `<br><small style="color:var(--c7)">Sudah di ${esc(lain.map(x => x.nama).join(', '))}</small>` : ''}</span>${pill(st[0], st[1])}</label>`; }).join('')
              : '<div class="empty" style="padding:20px"><i class="ph-duotone ph-user-circle-dashed"></i><b>Tidak ada calon peserta</b>Semua peserta yang sesuai sudah dijadwalkan, atau belum ada yang terverifikasi lengkap.</div>';
            hitung();
          };
          const hitung = () => { const n = root.querySelectorAll('#tpDaftar input:checked').length;
            root.querySelector('#tpInfo').innerHTML = `${n} dipilih${sisaKursi !== Infinity ? ` · sisa kursi ${sisaKursi}` : ''}${n > sisaKursi ? ' <b style="color:var(--danger)">melebihi kapasitas</b>' : ''}`; };
          ['#tpCari', '#tpUji', '#tpBelum'].forEach(x => root.querySelector(x).addEventListener('input', render));
          root.querySelector('#tpSemua').onchange = e => { root.querySelectorAll('#tpDaftar input:not(:disabled)').forEach(c => c.checked = e.target.checked); hitung(); };
          root.querySelector('#tpDaftar').addEventListener('change', hitung);
          render();
        },
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Tambahkan', ikon: 'ph-check', aksi: root => {
          const ids = [...root.querySelectorAll('#tpDaftar input:checked')].map(c => c.value);
          if (!ids.length) { toast('Pilih minimal satu peserta.', 'warn'); return false; }
          if (ids.length > sisaKursi) { toast(`Sisa kursi hanya ${sisaKursi}. Kurangi pilihan atau ubah kapasitas sesi.`, 'warn'); return false; }
          return ids;
        } }]
      });
      if (!hasil) return;
      const { error } = await sb.from('peserta_sesi').insert(hasil.map(pid => ({ sesi_id: s.id, pendaftar_id: pid })));
      if (error) return toast(galat(error), 'err', 7000);
      toast(`${hasil.length} peserta ditambahkan ke ${s.nama}.`); segarkan();
    }
    $('#tbPeserta').addEventListener('click', async e => {
      const h = e.target.closest('[data-hadir]'), kl = e.target.closest('[data-keluar]'), kt = e.target.closest('[data-kartu]');
      if (h) {
        const [pid, v] = h.dataset.hadir.split('|'), p = peserta.find(x => x.id === pid);
        const baru = (v === '1') === p.hadir ? null : v === '1';
        const { error } = await sb.rpc('tandai_hadir', { p_sesi: s.id, p_pendaftar: pid, p_hadir: baru });
        if (error) return toast(galat(error), 'err');
        p.hadir = baru; renderPeserta();
      } else if (kl) {
        const p = peserta.find(x => x.id === kl.dataset.keluar);
        if (!(await konfirmasi('Keluarkan dari sesi?', `${esc(p.nama_lengkap)} dikeluarkan dari ${esc(s.nama)}. Peserta yang sudah dinilai tidak dapat dikeluarkan.`, 'Keluarkan'))) return;
        const { error } = await sb.from('peserta_sesi').delete().match({ sesi_id: s.id, pendaftar_id: p.id });
        if (error) return toast(galat(error), 'err', 7000);
        toast('Peserta dikeluarkan dari sesi.'); segarkan();
      } else if (kt) {
        const p = peserta.find(x => x.id === kt.dataset.kartu);
        pilihCetak(`Kartu peserta ${p.nama_lengkap}`, pdf => kartuCetakAtauPdf([{ p, sesi: semuaSesi.filter(x => x.peserta_sesi.some(y => y.pendaftar_id === p.id)) }], g.nama, pdf));
      }
    });
    const daftarKartu = () => peserta.map(p => ({ p, sesi: semuaSesi.filter(x => x.peserta_sesi.some(y => y.pendaftar_id === p.id)) }));
    $('#btnKartu').onclick = () => pilihCetak(`Kartu peserta ${s.nama}`, pdf => kartuCetakAtauPdf(daftarKartu(), g.nama, pdf));
    $('#btnHadir').onclick = () => pilihCetak('Daftar hadir', pdf => daftarHadir(s, peserta, g.nama, pdf));
    $('#btnLembar').onclick = async () => {
      const b = s.bidang.length === 1 ? s.bidang[0] : await dialog({ judul: 'Lembar penilaian', ikon: 'ph-clipboard-text', tone: 'var(--c5)', isi: '<p style="margin:0">Pilih bidang tes:</p>',
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, ...s.bidang.map(x => ({ label: bidangL(x), ikon: ikonB(x), kelas: 'ghost', nilai: x }))] });
      if (!b) return;
      const penguji = s.penguji_sesi.filter(x => x.bidang === b).map(x => namaU(x.pengguna_id));
      pilihCetak(`Lembar penilaian ${bidangL(b)}`, pdf => lembarNilai(s, b, peserta, nilaiPer, penguji.length === 1 ? penguji[0] : '', g.nama, pdf));
    };
    $('#btnWaJadwal').onclick = () => waBerurutan(daftarKartu(), 'jadwal_tes', g.nama);
    $('#btnWaIngat').onclick = () => waBerurutan(daftarKartu(), 'pengingat_tes', g.nama);
  }

  /* ---------- Tab Nilai dan Validasi ---------- */
  const SARING_N = { st: 'menunggu', jb: '', q: '' };
  async function tabNilai(el, api) {
    const gels = await muatGelombang();
    if (!gels.length) { el.innerHTML = '<div class="card"><div class="empty"><i class="ph-duotone ph-flag-banner"></i><b>Belum ada gelombang</b></div></div>'; return; }
    el.innerHTML = `
      <div class="page-head saring-pendaftar">
        <select class="select" id="nGel" aria-label="Gelombang">${opsiGel(gels)}</select>
        <select class="select" id="nJB" aria-label="Jenjang"><option value="">SMP dan SMA</option>${['SMP putra', 'SMP putri', 'SMA putra', 'SMA putri'].map(x => `<option value="${x}">${x.replace('putra', 'Putra').replace('putri', 'Putri')}</option>`).join('')}</select>
        <select class="select" id="nSt" aria-label="Status nilai">
          <option value="">Semua peserta</option><option value="menunggu">Ada nilai menunggu validasi</option><option value="dikembalikan">Ada nilai dikembalikan</option>
          <option value="belum">Ada bidang belum dinilai</option><option value="lengkap">Nilai lengkap</option><option value="tanpa_sesi">Belum dijadwalkan</option></select>
        <div class="field cari-besar" style="margin:0"><i class="ph-duotone ph-magnifying-glass"></i><input class="input" id="nCari" type="search" placeholder="Cari nama atau nomor…" value="${esc(SARING_N.q)}"></div>
        <label class="check uji-saklar"><input type="checkbox" id="nUji" ${SEL.uji ? 'checked' : ''}>Data uji</label>
      </div>
      <div class="stats stats-seleksi" id="nStat"></div>
      <div class="bilah-aksi">
        <label class="check"><input type="checkbox" id="nPilihSemua">Pilih semua</label><span class="muted" id="nInfo"></span><div class="spacer"></div>
        <button class="btn sm ghost" id="nSegarkan"><i class="ph-duotone ph-arrows-clockwise" style="color:var(--c5)"></i><span class="hide-sm">Muat ulang</span></button>
        <button class="btn sm" id="nSetujui" disabled><i class="ph-duotone ph-seal-check"></i>Setujui nilai terpilih</button>
      </div>
      <div class="table-wrap"><table class="tbl tbl-nilai"><thead id="nTh"></thead>
        <tbody id="nTb"><tr><td colspan="7"><span class="spinner"></span> Memuat…</td></tr></tbody></table></div>
      <p class="muted kecil" style="margin-top:10px"><i class="ph-duotone ph-info"></i> Klik angka nilai untuk melihat catatan penguji, menyetujui, mengembalikan, atau mengubahnya. Nilai yang disetujui terkunci bagi Penguji.
        Nilai akhir dihitung dari bobot tiap jenjang dan baru muncul bila semua bidang disetujui.</p>`;
    $('#nJB').value = SARING_N.jb; $('#nSt').value = SARING_N.st;
    let data = [], kolom = [];
    const bobotJ = BOBOT;
    const cocok = r => {
      const bw = URUT_BIDANG.filter(b => bobotB(r.jenjang, b) > 0);
      const st = SARING_N.st, n = r.nilai || {};
      if (SARING_N.jb && `${r.jenjang} ${r.bagian}` !== SARING_N.jb) return false;
      if (SARING_N.q && !(`${r.nama_lengkap} ${r.no_registrasi}`.toLowerCase().includes(SARING_N.q.toLowerCase()))) return false;
      if (st === 'menunggu') return Object.values(n).some(x => x.status === 'menunggu');
      if (st === 'dikembalikan') return Object.values(n).some(x => x.status === 'dikembalikan');
      if (st === 'belum') return r.sesi.length && bw.some(b => !n[b]);
      if (st === 'lengkap') return r.lengkap;
      if (st === 'tanpa_sesi') return !r.sesi.length;
      return true;
    };
    const idMenunggu = r => Object.values(r.nilai || {}).filter(x => x.status === 'menunggu').map(x => x.id);
    const render = () => {
      const semua = data;
      const rows = semua.filter(cocok);
      const nilaiSemua = semua.flatMap(r => Object.values(r.nilai || {}));
      $('#nStat').innerHTML = [
        ['', 'Peserta seleksi', semua.length, 'ph-users-three', 'var(--c1)'],
        ['menunggu', 'Nilai menunggu validasi', nilaiSemua.filter(x => x.status === 'menunggu').length, 'ph-hourglass-medium', 'var(--c6)'],
        ['dikembalikan', 'Nilai dikembalikan', nilaiSemua.filter(x => x.status === 'dikembalikan').length, 'ph-arrow-u-up-left', 'var(--c7)'],
        ['belum', 'Peserta belum lengkap dinilai', semua.filter(r => r.sesi.length && !r.lengkap).length, 'ph-pencil-line', 'var(--c3)'],
        ['lengkap', 'Nilai lengkap', semua.filter(r => r.lengkap).length, 'ph-seal-check', 'var(--ok)']
      ].map(([f, l, n, ic, t]) => `<button type="button" class="stat${SARING_N.st === f && f ? ' dipilih' : ''}" data-st="${f}" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b>${fmt.angka(n)}</b><span>${l}</span></button>`).join('');
      $('#nStat').querySelectorAll('[data-st]').forEach(b => b.onclick = () => { SARING_N.st = b.dataset.st; $('#nSt').value = SARING_N.st; render(); });
      kolom = [...new Set([...bidangAktif(), ...semua.flatMap(r => Object.keys(r.nilai || {}))])].sort((a, b) => URUT_BIDANG.indexOf(a) - URUT_BIDANG.indexOf(b));
      const bobotT = b => { const v = [...new Set(['SMP', 'SMA'].map(j => bobotB(j, b)))]; return `bobot ${v.join(' / ')}%`; };
      $('#nTh').innerHTML = `<tr><th class="c" style="width:34px"></th><th>Peserta</th>${kolom.map(b => `<th class="c">${esc(bidangL(b))}<br><small class="muted">${bobotT(b)}</small></th>`).join('')}<th class="c">Nilai akhir</th><th class="hide-sm">Status</th></tr>`;
      $('#nInfo').textContent = `${rows.length} dari ${semua.length} peserta`;
      $('#nTb').innerHTML = rows.length ? rows.map(r => {
        const menunggu = idMenunggu(r), st = ST_PESERTA[r.status] || [r.status, 'var(--c8)'];
        const dijadwal = new Set(r.sesi.flatMap(x => x.bidang));
        return `<tr>
          <td class="c">${menunggu.length ? `<input type="checkbox" data-pilih="${menunggu.join(',')}" aria-label="Pilih">` : ''}</td>
          <td><b>${esc(r.nama_lengkap)}</b><br><small class="mono muted">${esc(r.no_registrasi)}</small> <small class="muted">· ${r.jenjang} ${bagianL(r.bagian)}</small></td>
          ${kolom.map(b => { const n = (r.nilai || {})[b], wajib = bobotB(r.jenjang, b) > 0;
            if (!wajib && !n) return '<td class="c"><span class="muted kecil">tidak diujikan</span></td>';
            if (n) return `<td class="c"><button type="button" class="nilai-sel tombol" data-nilai="${r.id}|${b}" style="--tone:${ST_NILAI[n.status][1]}" title="${ST_NILAI[n.status][0]}${n.nama_pengisi ? ' · ' + esc(n.nama_pengisi) : ''}"><i class="ph-duotone ${ST_NILAI[n.status][2]}"></i>${esc(angkaN(n.nilai))}</button></td>`;
            return `<td class="c">${dijadwal.has(b) ? `<button type="button" class="nilai-kosong" data-nilai="${r.id}|${b}" title="Isi nilai">+ isi</button>` : '<span class="muted kecil">belum dijadwalkan</span>'}</td>`; }).join('')}
          <td class="c"><b>${r.nilai_akhir != null ? esc(angkaN(r.nilai_akhir)) : '<span class="muted">–</span>'}</b></td>
          <td class="hide-sm">${pill(st[0], st[1])}</td></tr>`;
      }).join('') : `<tr><td colspan="${kolom.length + 4}"><div class="empty" style="padding:22px"><i class="ph-duotone ph-list-checks"></i><b>Tidak ada data</b>${SARING_N.st === 'menunggu' ? 'Tidak ada nilai yang menunggu validasi.' : 'Ubah saringan untuk melihat peserta lain.'}</div></td></tr>`;
      hitungPilih();
    };
    const hitungPilih = () => { const ids = pilihan(); $('#nSetujui').disabled = !ids.length; $('#nSetujui').innerHTML = `<i class="ph-duotone ph-seal-check"></i>Setujui ${ids.length ? ids.length + ' ' : ''}nilai terpilih`; };
    const pilihan = () => [...el.querySelectorAll('[data-pilih]:checked')].flatMap(c => c.dataset.pilih.split(',').map(Number));
    const muat = async () => {
      const { data: d, error } = await sb.rpc('rekap_seleksi', { p_gelombang: +SEL.gel, p_uji: SEL.uji });
      if (error) throw error;
      data = d || []; render();
    };
    await muat();
    $('#nGel').onchange = e => { SEL.gel = e.target.value; muat().catch(err => toast(galat(err), 'err')); };
    $('#nUji').onchange = e => { SEL.uji = e.target.checked; muat().catch(err => toast(galat(err), 'err')); };
    $('#nJB').onchange = e => { SARING_N.jb = e.target.value; render(); };
    $('#nSt').onchange = e => { SARING_N.st = e.target.value; render(); };
    $('#nCari').oninput = e => { SARING_N.q = e.target.value; render(); };
    $('#nSegarkan').onclick = () => muat();
    $('#nPilihSemua').onchange = e => { el.querySelectorAll('[data-pilih]').forEach(c => c.checked = e.target.checked); hitungPilih(); };
    $('#nTb').addEventListener('change', hitungPilih);
    $('#nSetujui').onclick = async () => {
      const ids = pilihan(); if (!ids.length) return;
      if (!(await konfirmasi('Setujui nilai?', `${ids.length} nilai akan disetujui dan terkunci bagi Penguji.`, 'Setujui'))) return;
      const { data: n, error } = await sb.rpc('validasi_nilai', { p_ids: ids, p_aksi: 'setujui', p_catatan: '' });
      if (error) return toast(galat(error), 'err', 6000);
      toast(`${n} nilai disetujui.`); $('#nPilihSemua').checked = false; muat();
    };
    $('#nTb').addEventListener('click', async e => {
      const b = e.target.closest('[data-nilai]'); if (!b) return;
      const [pid, bid] = b.dataset.nilai.split('|'), r = data.find(x => x.id === pid);
      if (await dialogNilaiAdmin(r, bid)) muat();
    });
  }

  // Dialog nilai untuk Admin: lihat, ubah, setujui, kembalikan, buka kunci, hapus
  async function dialogNilaiAdmin(r, bid) {
    const n = (r.nilai || {})[bid];
    const tahfizh = bid === 'tahfizh';
    const { data: rinci } = n ? await sb.from('nilai_tes').select('*').eq('id', n.id).maybeSingle() : { data: null };
    const x = rinci || {};
    return dialog({
      judul: `${bidangL(bid)} · ${r.nama_lengkap}`, ikon: ikonB(bid), tone: warnaB(bid),
      isi: `<p class="muted" style="margin:0 0 10px"><span class="mono">${esc(r.no_registrasi)}</span> · ${r.jenjang} ${bagianL(r.bagian)}${r.hafalan_juz ? ` · hafalan saat mendaftar ${esc(angkaN(r.hafalan_juz))} juz` : ''}</p>
        ${n ? `<div class="pill-baris" style="margin-bottom:10px">${pill(ST_NILAI[x.status || n.status][0], ST_NILAI[x.status || n.status][1], ST_NILAI[x.status || n.status][2])}
          <span class="muted kecil">Diisi ${esc(x.nama_pengisi || 'panitia')}${x.diisi_pada ? ' · ' + esc(fmt.tglJam(x.diisi_pada)) + ' WITA' : ''}${x.nama_validator ? ` · divalidasi ${esc(x.nama_validator)}` : ''}</span></div>
          ${x.catatan_validasi ? `<div class="note"><i class="ph-duotone ph-chat-circle-text"></i><div><b>Catatan validasi:</b> ${esc(x.catatan_validasi)}</div></div>` : ''}` : '<div class="note info"><i class="ph-duotone ph-info"></i><div>Belum ada nilai. Admin dapat mengisinya langsung, misalnya dari lembar penilaian manual.</div></div>'}
        <div class="grid-form">
          <div class="field"><label>Nilai (0–100) <span class="req">*</span></label><input class="input" id="nvNilai" type="number" inputmode="decimal" min="0" max="100" step="0.5" value="${esc(x.nilai ?? '')}"></div>
          ${tahfizh ? `<div class="field"><label>Hafalan yang diuji (juz)</label><input class="input" id="nvHafal" type="number" inputmode="decimal" min="0" max="30" step="0.5" value="${esc(x.hafalan_diuji ?? '')}"></div>` : '<div></div>'}
          <div class="field full"><label>Catatan penguji</label><textarea class="textarea" id="nvCatatan" rows="3" maxlength="1000">${esc(x.catatan || '')}</textarea></div>
          <div class="field full"><label>Catatan validasi (wajib bila dikembalikan)</label><input class="input" id="nvValid" maxlength="300" placeholder="Misalnya: nilai tidak sesuai lembar manual"></div>
        </div>`,
      tombol: [
        { label: 'Tutup', kelas: 'ghost', nilai: false },
        ...(n ? [{ label: 'Hapus', ikon: 'ph-trash', kelas: 'ghost', aksi: async () => {
          if (!(await konfirmasi('Hapus nilai ini?', 'Nilai dihapus dan peserta kembali berstatus belum dinilai untuk bidang ini.', 'Hapus', true))) return false;
          const { error } = await sb.rpc('hapus_nilai', { p_id: n.id }); if (error) throw new Error(galat(error)); toast('Nilai dihapus.'); return true; } }] : []),
        ...(n && (x.status || n.status) === 'disetujui' ? [{ label: 'Buka kunci', ikon: 'ph-lock-simple-open', kelas: 'ghost', aksi: async root => {
          const { error } = await sb.rpc('validasi_nilai', { p_ids: [n.id], p_aksi: 'buka', p_catatan: root.querySelector('#nvValid').value.trim() }); if (error) throw new Error(galat(error));
          toast('Kunci dibuka. Nilai kembali menunggu validasi.'); return true; } }] : []),
        ...(n && (x.status || n.status) !== 'dikembalikan' ? [{ label: 'Kembalikan', ikon: 'ph-arrow-u-up-left', kelas: 'ghost', aksi: async root => {
          const c = root.querySelector('#nvValid').value.trim();
          if (c.length < 3) { toast('Tuliskan catatan validasi untuk penguji.', 'warn'); root.querySelector('#nvValid').focus(); return false; }
          const { error } = await sb.rpc('validasi_nilai', { p_ids: [n.id], p_aksi: 'kembalikan', p_catatan: c }); if (error) throw new Error(galat(error));
          toast('Nilai dikembalikan ke penguji.'); return true; } }] : []),
        { label: n && (x.status || n.status) === 'menunggu' ? 'Setujui' : 'Simpan dan setujui', ikon: 'ph-seal-check', aksi: async root => {
          const v = root.querySelector('#nvNilai').value, h = root.querySelector('#nvHafal')?.value;
          if (v === '' || +v < 0 || +v > 100) { toast('Nilai harus 0 sampai 100.', 'warn'); return false; }
          const berubah = !n || +v !== +x.nilai || (tahfizh && (h === '' ? null : +h) !== (x.hafalan_diuji == null ? null : +x.hafalan_diuji)) || root.querySelector('#nvCatatan').value.trim() !== (x.catatan || '');
          if (!berubah && n) {
            const { error } = await sb.rpc('validasi_nilai', { p_ids: [n.id], p_aksi: 'setujui', p_catatan: root.querySelector('#nvValid').value.trim() }); if (error) throw new Error(galat(error));
          } else {
            const { error } = await sb.rpc('simpan_nilai', { p_pendaftar: r.id, p_bidang: bid, p_nilai: +v, p_hafalan: h === '' || h == null ? null : +h,
              p_catatan: root.querySelector('#nvCatatan').value.trim(), p_rincian: {}, p_setujui: true });
            if (error) throw new Error(galat(error));
          }
          toast('Nilai disetujui.'); return true;
        } }
      ]
    });
  }

  /* ---------- Tab Peringkat dan Keputusan ---------- */
  const KELOMPOK = [['SMP', 'putra'], ['SMP', 'putri'], ['SMA', 'putra'], ['SMA', 'putri']];
  const TONE_KLP = { 'SMP-putra': 'var(--c1)', 'SMP-putri': 'var(--c4)', 'SMA-putra': 'var(--c5)', 'SMA-putri': 'var(--c2)' };
  const HASIL = { lulus: ['Lulus', 'var(--ok)', 'ph-confetti'], cadangan: ['Cadangan', 'var(--c6)', 'ph-hourglass-medium'], tidak_lulus: ['Tidak lulus', 'var(--c8)', 'ph-hand-heart'] };
  const SUDAH = ['lulus', 'cadangan', 'tidak_lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai'];
  const hasilDari = st => st === 'daftar_ulang_menunggu' || st === 'daftar_ulang_selesai' ? 'lulus' : st;

  async function muatGelLengkap(id) {
    const { data, error } = await sb.from('gelombang').select('*').eq('id', id).maybeSingle();
    if (error) throw error; return data;
  }

  async function tabPeringkat(el, api) {
    const gels = await muatGelombang();
    if (!gels.length) { el.innerHTML = '<div class="card"><div class="empty"><i class="ph-duotone ph-flag-banner"></i><b>Belum ada gelombang</b></div></div>'; return; }
    const isSuper = api.S.profil.peran === 'superadmin';
    let data = [], g = null;
    el.innerHTML = `
      <div class="page-head">
        <select class="select" id="rGel" aria-label="Gelombang" style="max-width:240px">${opsiGel(gels)}</select>
        <label class="check uji-saklar"><input type="checkbox" id="rUji" ${SEL.uji ? 'checked' : ''}>Data uji</label>
        <div class="spacer"></div>
        <button class="btn sm ghost" id="rDataDok"><i class="ph-duotone ph-file-text" style="color:var(--c6)"></i>Data dokumen</button>
        <button class="btn sm ghost" id="rRekap"><i class="ph-duotone ph-table" style="color:var(--c1)"></i>Rekap nilai</button>
        <button class="btn sm ghost" id="rBA"><i class="ph-duotone ph-notebook" style="color:var(--c5)"></i>Berita acara</button>
        <button class="btn sm ghost" id="rSK"><i class="ph-duotone ph-seal-check" style="color:var(--c4)"></i>SK penetapan</button>
      </div>
      <div id="rStatus"></div>
      <div class="stats stats-pendaftar" id="rStat"></div>
      <div class="bilah-aksi">
        <button class="btn sm" id="rOtomatis"><i class="ph-duotone ph-magic-wand"></i>Tetapkan semua sesuai peringkat</button>
        <span class="muted kecil">Keputusan tetap dapat diubah satu per satu sebelum diterbitkan.</span><div class="spacer"></div>
        ${!isSuper ? '<button class="btn sm ghost" id="rAjukan"><i class="ph-duotone ph-paper-plane-tilt" style="color:var(--c2)"></i>Ajukan ke Superadmin</button>' : ''}
      </div>
      <div class="bilah-pilih hidden" id="rPilih">
        <b id="rJml"></b><div class="spacer"></div>
        ${Object.entries(HASIL).map(([k, [l, t, ic]]) => `<button class="btn sm ghost" data-massal="${k}"><i class="ph-duotone ${ic}" style="color:${t}"></i>${l}</button>`).join('')}
        <button class="btn sm ghost" data-massal="batal"><i class="ph-duotone ph-arrow-counter-clockwise" style="color:var(--c7)"></i>Batalkan keputusan</button>
      </div>
      <div id="rDaftar"></div>
      <p class="muted kecil" style="margin-top:10px"><i class="ph-duotone ph-info"></i> Peringkat per jenjang dan putra/putri: nilai akhir, lalu nilai Tahfizh, lalu jumlah hafalan, lalu waktu mendaftar.
        Rekomendasi mengikuti garis kuota gelombang${api.S.pengaturan.seleksi?.nilai_minimal != null ? ` dan nilai minimal ${angkaN(api.S.pengaturan.seleksi.nilai_minimal)}` : ''}. Hasil tidak terlihat publik sampai Superadmin menerbitkan pengumuman.</p>`;

    const terkunci = () => !!g?.hasil_terbit_pada && !isSuper;
    const render = () => {
      const kol = [...new Set([...bidangAktif(), ...data.flatMap(r => Object.keys(r.nilai || {}))])].sort((a, b) => URUT_BIDANG.indexOf(a) - URUT_BIDANG.indexOf(b));
      const n = (f) => data.filter(f).length;
      $('#rStat').innerHTML = [
        ['Peserta seleksi', data.length, 'ph-users-three', 'var(--c1)'],
        ['Nilai lengkap', n(r => r.lengkap), 'ph-list-checks', 'var(--c5)'],
        ['Lulus', n(r => hasilDari(r.status) === 'lulus'), 'ph-confetti', 'var(--ok)'],
        ['Cadangan', n(r => r.status === 'cadangan'), 'ph-hourglass-medium', 'var(--c6)'],
        ['Tidak lulus', n(r => r.status === 'tidak_lulus'), 'ph-hand-heart', 'var(--c8)'],
        ['Belum diputuskan', n(r => !SUDAH.includes(r.status)), 'ph-question', 'var(--c7)']
      ].map(([l, v, ic, t]) => `<div class="stat" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b>${fmt.angka(v)}</b><span>${l}</span></div>`).join('');
      $('#rStatus').innerHTML = g.hasil_terbit_pada
        ? `<div class="note ok-note"><i class="ph-duotone ph-megaphone"></i><div><b>Hasil ${esc(g.nama)} sudah diterbitkan</b> ${fmt.tglJam(g.hasil_terbit_pada)} WITA.${isSuper ? ' Sebagai Superadmin Anda masih dapat mengubah keputusan; perubahan langsung terlihat publik.' : ' Keputusan terkunci; perubahan hanya oleh Superadmin.'}</div></div>`
        : g.diajukan_pada ? `<div class="note info"><i class="ph-duotone ph-paper-plane-tilt"></i><div>Hasil sudah diajukan ke Superadmin pada ${fmt.tglJam(g.diajukan_pada)} WITA. Superadmin menerbitkannya di menu <b>Pengumuman</b>.</div></div>` : '';
      $('#rOtomatis').disabled = terkunci();
      const kelompok = KELOMPOK.map(([j, b]) => ({ j, b, rows: data.filter(r => r.jenjang === j && r.bagian === b) })).filter(x => x.rows.length);
      $('#rDaftar').innerHTML = kelompok.length ? kelompok.map(({ j, b, rows }) => {
        const kuota = rows[0].kuota, lengkap = rows.filter(r => r.lengkap), belum = rows.filter(r => !r.lengkap);
        const hit = h => rows.filter(r => hasilDari(r.status) === h).length;
        const lebih = kuota != null && hit('lulus') > kuota;
        const baris = r => { const hs = HASIL[hasilDari(r.status)];
          return `<tr class="${r.lengkap ? '' : 'redup-baris'}">
            <td class="c">${terkunci() || ['daftar_ulang_menunggu', 'daftar_ulang_selesai'].includes(r.status) ? '' : `<input type="checkbox" data-pilih="${r.id}" aria-label="Pilih">`}</td>
            <td class="c"><b class="peringkat">${r.peringkat ?? '–'}</b></td>
            <td><b>${esc(r.nama_lengkap)}</b><br><small class="mono muted reg-kecil">${esc(r.no_registrasi)}</small>${r.asal_sekolah ? ` <small class="muted hide-sm">· ${esc(r.asal_sekolah)}</small>` : ''}
              <div class="show-sm" style="margin-top:4px">${hs ? pill(hs[0], hs[1], hs[2]) : r.rekomendasi ? `<small class="muted">Rekomendasi: ${HASIL[r.rekomendasi][0]}</small>` : '<small class="muted">Nilai belum lengkap</small>'}</div></td>
            ${kol.map(k => { const x = (r.nilai || {})[k]; return `<td class="c hide-sm">${x ? `<span style="color:${x.status === 'disetujui' ? 'inherit' : 'var(--c6)'}" title="${ST_NILAI[x.status][0]}">${esc(angkaN(x.nilai))}</span>` : bobotB(j, k) > 0 ? '<span class="muted">–</span>' : '<span class="muted kecil">·</span>'}</td>`; }).join('')}
            <td class="c"><b>${r.nilai_akhir != null ? esc(angkaN(r.nilai_akhir)) : '–'}</b></td>
            <td class="c hide-sm">${r.rekomendasi ? pill(HASIL[r.rekomendasi][0], HASIL[r.rekomendasi][1]) : '<span class="muted kecil">Nilai belum lengkap</span>'}</td>
            <td class="hide-sm">${hs ? pill(hs[0], hs[1], hs[2]) : '<span class="muted kecil">Belum</span>'}${r.status.startsWith('daftar_ulang') ? ' <small class="muted">(daftar ulang)</small>' : ''}
              ${r.hasil_catatan && r.hasil_catatan !== 'Sesuai peringkat' ? `<br><small class="muted">${esc(r.hasil_catatan)}</small>` : ''}</td>
            <td class="c aksi-sel">${terkunci() || r.status.startsWith('daftar_ulang') ? '' : Object.entries(HASIL).map(([k, [l, t, ic]]) =>
              `<button class="icon-btn plain${hasilDari(r.status) === k ? ' aktif-hasil' : ''}" data-satu="${r.id}|${k}" title="${l}" aria-label="${l}" style="--tone:${t}"><i class="ph-duotone ${ic}" style="color:${t}"></i></button>`).join('')}</td></tr>`; };
        const garis = kuota != null && lengkap.length > kuota ? lengkap.length : -1;
        return `<div class="card klp-kartu" style="--tone:${TONE_KLP[j + '-' + b]}">
          <div class="klp-kepala"><span class="ic-box"><i class="ph-duotone ${b === 'putra' ? 'ph-gender-male' : 'ph-gender-female'}"></i></span>
            <div class="teks"><h3>${j} ${bagianL(b)}</h3><small>${rows.length} peserta · ${lengkap.length} nilai lengkap · kuota ${kuota == null ? 'tanpa batas' : kuota + ' kursi'}</small></div>
            <div class="pill-baris">${Object.entries(HASIL).map(([k, [l, t]]) => pill(`${l} ${hit(k)}`, t)).join('')}${lebih ? pill('Lulus melebihi kuota', 'var(--danger)', 'ph-warning') : ''}</div>
            ${terkunci() ? '' : `<button class="btn sm ghost" data-klp="${j}-${b}"><i class="ph-duotone ph-magic-wand" style="color:var(--tone)"></i><span class="hide-sm">Sesuai peringkat</span></button>`}</div>
          <div class="table-wrap"><table class="tbl tbl-peringkat"><thead><tr><th class="c" style="width:34px">${terkunci() ? '' : `<input type="checkbox" data-semua="${j}-${b}" aria-label="Pilih semua">`}</th><th class="c">Rank</th><th>Peserta</th>
            ${kol.map(k => `<th class="c hide-sm">${esc(bidangL(k))}<br><small class="muted">${bobotB(j, k)}%</small></th>`).join('')}<th class="c">Nilai akhir</th><th class="c hide-sm">Rekomendasi</th><th class="hide-sm">Keputusan</th><th class="c"></th></tr></thead>
            <tbody>${lengkap.map((r, i) => baris(r) + (kuota != null && i + 1 === kuota && i + 1 < lengkap.length ? `<tr class="garis-kuota"><td colspan="${kol.length + 7}"><span>Garis kuota · ${kuota} kursi</span></td></tr>` : '')).join('')}
              ${belum.length ? `<tr class="pemisah"><td colspan="${kol.length + 7}">Nilai belum lengkap (${belum.length})</td></tr>${belum.map(baris).join('')}` : ''}</tbody></table></div>
        </div>`;
      }).join('') : `<div class="card"><div class="empty"><i class="ph-duotone ph-ranking"></i><b>Belum ada peserta seleksi</b>Peserta muncul setelah terverifikasi lengkap atau dijadwalkan tes.</div></div>`;
      hitungPilih();
    };
    const pilihan = () => [...el.querySelectorAll('[data-pilih]:checked')].map(c => c.dataset.pilih);
    const hitungPilih = () => { const n = pilihan().length; $('#rPilih').classList.toggle('hidden', !n); $('#rJml').textContent = `${n} peserta dipilih`; };
    const muat = async () => {
      const [gl, r] = await Promise.all([muatGelLengkap(+SEL.gel), sb.rpc('rekap_seleksi', { p_gelombang: +SEL.gel, p_uji: SEL.uji })]);
      if (r.error) throw r.error;
      g = gl; data = r.data || []; render();
    };
    await muat();
    $('#rGel').onchange = e => { SEL.gel = e.target.value; muat().catch(err => toast(galat(err), 'err')); };
    $('#rUji').onchange = e => { SEL.uji = e.target.checked; muat().catch(err => toast(galat(err), 'err')); };

    const tetapkan = async (ids, h, tanya = true) => {
      let catatan = '';
      if (tanya) {
        const hs = h === 'batal' ? ['Batalkan keputusan', 'var(--c7)', 'ph-arrow-counter-clockwise'] : HASIL[h];
        const v = await dialog({ judul: `${hs[0]}: ${ids.length} peserta`, ikon: hs[2], tone: hs[1],
          isi: h === 'batal' ? '<p style="margin:0">Keputusan dikosongkan dan peserta kembali ke status seleksi.</p>'
            : `<div class="field"><label>Catatan keputusan (boleh kosong)</label><input class="input" id="hCat" maxlength="200" placeholder="Contoh: Naik dari cadangan, pertimbangan hafalan"></div>`,
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Tetapkan', ikon: 'ph-check', aksi: root => ({ c: root.querySelector('#hCat')?.value.trim() || '' }) }] });
        if (!v) return; catatan = v.c;
      }
      const { data: n, error } = await sb.rpc('tetapkan_hasil', { p_ids: ids, p_hasil: h, p_catatan: catatan });
      if (error) return toast(galat(error), 'err', 7000);
      toast(`${n} keputusan disimpan.`); await muat();
    };
    $('#rDaftar').addEventListener('click', async e => {
      const s1 = e.target.closest('[data-satu]'), k = e.target.closest('[data-klp]');
      if (s1) { const [id, h] = s1.dataset.satu.split('|'); const r = data.find(x => x.id === id);
        if (hasilDari(r.status) === h) return;
        if (!r.lengkap && !(await konfirmasi('Nilai belum lengkap', `${esc(r.nama_lengkap)} belum memiliki nilai lengkap. Tetap tetapkan <b>${HASIL[h][0]}</b>?`, 'Tetap tetapkan'))) return;
        await tetapkan([id], h, false); }
      if (k) await otomatis(k.dataset.klp);
    });
    $('#rDaftar').addEventListener('change', e => {
      const sm = e.target.closest('[data-semua]');
      if (sm) e.target.closest('table').querySelectorAll('[data-pilih]').forEach(c => c.checked = sm.checked);
      hitungPilih();
    });
    el.querySelectorAll('[data-massal]').forEach(b => b.onclick = () => tetapkan(pilihan(), b.dataset.massal));
    async function otomatis(klp) {
      const sudah = data.filter(r => (!klp || `${r.jenjang}-${r.bagian}` === klp) && ['lulus', 'cadangan', 'tidak_lulus'].includes(r.status)).length;
      const v = await dialog({ judul: klp ? `Tetapkan ${klp.replace('-', ' ')} sesuai peringkat` : 'Tetapkan semua sesuai peringkat', ikon: 'ph-magic-wand', tone: 'var(--c3)',
        isi: `<p style="margin:0 0 10px">Peserta dengan nilai lengkap diberi keputusan sesuai kolom <b>Rekomendasi</b> (garis kuota${api.S.pengaturan.seleksi?.nilai_minimal != null ? ' dan nilai minimal' : ''}). Peserta yang nilainya belum lengkap tidak diubah.</p>
          ${sudah ? `<label class="check"><input type="checkbox" id="oTimpa">Ganti juga ${sudah} keputusan yang sudah ada</label>` : ''}`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Tetapkan', ikon: 'ph-check', aksi: root => ({ timpa: !!root.querySelector('#oTimpa')?.checked }) }] });
      if (!v) return;
      const { data: h, error } = await sb.rpc('tetapkan_sesuai_rekomendasi', { p_gelombang: +SEL.gel, p_uji: SEL.uji, p_kelompok: klp || null, p_timpa: v.timpa });
      if (error) return toast(galat(error), 'err', 7000);
      toast(`Ditetapkan: lulus ${h.lulus}, cadangan ${h.cadangan}, tidak lulus ${h.tidak_lulus}.`); await muat();
    }
    $('#rOtomatis').onclick = () => otomatis(null);
    if ($('#rAjukan')) $('#rAjukan').onclick = async () => {
      if (g.hasil_terbit_pada) return toast('Hasil gelombang ini sudah diterbitkan.', 'info');
      const belum = data.filter(r => !SUDAH.includes(r.status)).length;
      const v = await dialog({ judul: 'Ajukan hasil ke Superadmin', ikon: 'ph-paper-plane-tilt', tone: 'var(--c2)',
        isi: `${belum ? `<div class="note"><i class="ph-duotone ph-warning"></i><div>Masih ada <b>${belum}</b> peserta yang belum diputuskan.</div></div>` : ''}
          <p style="margin:0 0 10px">Superadmin menerima notifikasi untuk memeriksa dan menerbitkan hasil ${esc(g.nama)}.</p>
          <div class="field"><label>Catatan untuk Superadmin</label><textarea class="textarea" id="ajCat" rows="3" maxlength="400"></textarea></div>`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Ajukan', ikon: 'ph-paper-plane-tilt', aksi: root => ({ c: root.querySelector('#ajCat').value.trim() }) }] });
      if (!v) return;
      const { error } = await sb.rpc('ajukan_penerbitan', { p_gelombang: +SEL.gel, p_catatan: v.c });
      if (error) return toast(galat(error), 'err', 6000);
      toast('Hasil diajukan. Superadmin menerima notifikasi.'); await muat();
    };
    $('#rDataDok').onclick = async () => { if (await formDokumen(g)) await muat(); };
    $('#rRekap').onclick = async () => {
      const klp = await pilihKelompok(data, 'Rekap nilai seleksi'); if (klp == null) return;
      pilihCetak('Rekap nilai seleksi', pdf => dokRekap(g, data, klp, pdf));
    };
    $('#rBA').onclick = () => pilihCetak('Berita acara penetapan', pdf => dokBA(g, data, pdf));
    $('#rSK').onclick = () => {
      if (!data.some(r => hasilDari(r.status) === 'lulus')) return toast('Belum ada peserta yang ditetapkan lulus.', 'warn');
      pilihCetak('SK penetapan hasil seleksi', pdf => dokSK(g, data, pdf));
    };
  }

  async function pilihKelompok(data, judul) {
    const ada = KELOMPOK.filter(([j, b]) => data.some(r => r.jenjang === j && r.bagian === b));
    if (ada.length <= 1) return '';
    return dialog({ judul, ikon: 'ph-table', tone: 'var(--c1)', isi: '<p style="margin:0">Pilih kelompok yang dicetak. <b>Semua</b> mencetak tiap kelompok di halaman tersendiri.</p>',
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Semua', ikon: 'ph-stack', nilai: '' },
        ...ada.map(([j, b]) => ({ label: `${j} ${bagianL(b)}`, kelas: 'ghost', nilai: `${j}-${b}` }))] });
  }

  // Data dokumen: nomor/tanggal SK dan Berita Acara, tempat rapat, konsiderans
  const MENIMBANG = 'a. bahwa seleksi penerimaan santri baru telah dilaksanakan sesuai jadwal dan ketentuan yang ditetapkan panitia;\nb. bahwa berdasarkan hasil tes seleksi dan rapat panitia perlu menetapkan calon santri baru yang dinyatakan lulus;\nc. bahwa untuk keperluan tersebut perlu ditetapkan dengan Surat Keputusan.';
  const MENGINGAT = '1. Program kerja dan pedoman Penerimaan Murid Baru Pondok Pesantren tahun ajaran berjalan;\n2. Surat Keputusan Pimpinan Pondok tentang pembentukan Panitia Penerimaan Murid Baru;\n3. Hasil rapat penetapan kelulusan panitia.';
  async function formDokumen(g) {
    const d = g.dokumen_hasil || {};
    return dialog({ judul: `Data dokumen ${g.nama}`, ikon: 'ph-file-text', tone: 'var(--c6)', lebar: true,
      isi: `<form id="fDok" novalidate><div class="grid-form">
        <div class="field"><label>Nomor SK</label><input class="input" name="nomor_sk" maxlength="80" value="${esc(d.nomor_sk || g.nomor_sk || '')}" placeholder="Contoh: 012/SK/SPMB-IAS/X/2026"></div>
        <div class="field"><label>Tanggal SK</label><input class="input" type="date" name="tanggal_sk" value="${esc(d.tanggal_sk || '')}" data-default-today></div>
        <div class="field"><label>Nomor Berita Acara</label><input class="input" name="nomor_ba" maxlength="80" value="${esc(d.nomor_ba || '')}" placeholder="Contoh: 013/BA/SPMB-IAS/X/2026"></div>
        <div class="field"><label>Tanggal rapat / Berita Acara</label><input class="input" type="date" name="tanggal_ba" value="${esc(d.tanggal_ba || '')}" data-default-today></div>
        <div class="field"><label>Jam rapat (WITA)</label><input class="input" type="time" name="jam_rapat" value="${esc(d.jam_rapat || '')}" data-default-now></div>
        <div class="field"><label>Tempat rapat</label><input class="input" name="tempat_rapat" maxlength="120" value="${esc(d.tempat_rapat || '')}" placeholder="Contoh: Ruang Rapat Pondok"></div>
        <div class="field full"><label>Menimbang (SK)</label><textarea class="textarea" name="menimbang" rows="4">${esc(d.menimbang || MENIMBANG)}</textarea></div>
        <div class="field full"><label>Mengingat (SK)</label><textarea class="textarea" name="mengingat" rows="4">${esc(d.mengingat || MENGINGAT)}</textarea></div>
        <div class="field full"><label>Catatan tambahan Berita Acara</label><textarea class="textarea" name="catatan_ba" rows="2" maxlength="600" placeholder="Boleh kosong">${esc(d.catatan_ba || '')}</textarea></div>
      </div></form>`,
      saatBuka: root => window.SPMB.isiTanggalBawaan(root),
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
        const f = root.querySelector('#fDok'), v = n => f.elements[n].value.trim();
        const body = Object.fromEntries(['nomor_sk', 'tanggal_sk', 'nomor_ba', 'tanggal_ba', 'jam_rapat', 'tempat_rapat', 'menimbang', 'mengingat', 'catatan_ba'].map(k => [k, v(k)]));
        const { data, error } = await sb.rpc('atur_dokumen_hasil', { p_gelombang: g.id, p_data: body });
        if (error) throw new Error(galat(error));
        g.dokumen_hasil = data; g.nomor_sk = data.nomor_sk; toast('Data dokumen disimpan.'); return true;
      } }] });
  }

  const tglDok = iso => iso ? fmt.tglPanjang(dIso(iso)) : '.................';
  const barisT = (t) => esc(t || '').split('\n').filter(x => x.trim()).map(x => `<div class="sk-butir">${x.replace(/^([a-z0-9]+[.)])\s*/i, '<span>$1</span>')}</div>`).join('');

  async function dokRekap(g, data, klp, pdf) {
    const peng = await muatPengaturan(), ta = peng.identitas?.tahun_ajaran || '';
    const kelompok = KELOMPOK.filter(([j, b]) => (!klp || klp === `${j}-${b}`) && data.some(r => r.jenjang === j && r.bagian === b));
    const docs = kelompok.map(([j, b]) => {
      const rows = data.filter(r => r.jenjang === j && r.bagian === b).sort((x, y) => (x.peringkat ?? 1e9) - (y.peringkat ?? 1e9) || x.nama_lengkap.localeCompare(y.nama_lengkap));
      const kol = URUT_BIDANG.filter(k => bobotB(j, k) > 0 || rows.some(r => (r.nilai || {})[k]));
      const w = Math.min(10, Math.max(6, Math.floor(36 / Math.max(1, kol.length + 1))));
      const sisa = 100 - 5 - w * (kol.length + 1) - 6 - 12;
      return {
        judul: 'Rekap Nilai Seleksi Calon Santri Baru', nomor: g.dokumen_hasil?.nomor_ba ? '' : '',
        meta: `Tahun Ajaran ${esc(ta)} · ${esc(g.nama)} · <b>${j} ${bagianL(b)}</b> · Kuota: ${rows[0].kuota ?? 'tanpa batas'}${SEL.uji ? ' · <b>DATA UJI COBA</b>' : ''}<br>
          Bobot: ${kol.map(k => `${esc(bidangL(k))} ${bobotB(j, k)}%`).join(', ')}`,
        isi: `<table><colgroup><col style="width:5%"><col style="width:${sisa}%">${kol.map(() => `<col style="width:${w}%">`).join('')}<col style="width:${w}%"><col style="width:6%"><col style="width:12%"></colgroup>
          <thead><tr><th>No</th><th>Nama peserta / No. registrasi</th>${kol.map(k => `<th>${esc(bidangL(k))}</th>`).join('')}<th>Nilai akhir</th><th>Rank</th><th>Keputusan</th></tr></thead>
          <tbody>${rows.map((r, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(r.nama_lengkap)}<br><span style="font-size:8pt">${esc(r.no_registrasi)}</span></td>
            ${kol.map(k => `<td style="text-align:center">${(r.nilai || {})[k] ? esc(angkaN(r.nilai[k].nilai)) : '–'}</td>`).join('')}
            <td style="text-align:center">${r.nilai_akhir != null ? esc(angkaN(r.nilai_akhir)) : '–'}</td><td style="text-align:center">${r.peringkat ?? '–'}</td>
            <td style="text-align:center">${HASIL[hasilDari(r.status)] ? HASIL[hasilDari(r.status)][0] : 'Belum'}</td></tr>`).join('')}</tbody></table>
          <p style="font-size:9pt;margin:6px 0 0">Jumlah: ${rows.length} peserta · Lulus ${rows.filter(r => hasilDari(r.status) === 'lulus').length} · Cadangan ${rows.filter(r => r.status === 'cadangan').length} · Tidak lulus ${rows.filter(r => r.status === 'tidak_lulus').length}</p>`,
        ttd: penandaTangan('rekap_nilai', peng, j), tanggal: g.dokumen_hasil?.tanggal_ba || null
      };
    });
    if (pdf) { const t = toast('Menyusun PDF…', 'info', 60000); try { simpanPdf(await window.SPMB.buatPdfBanyak(docs, 'Rekap Nilai Seleksi'), `Rekap Nilai ${g.nama}${klp ? ' ' + klp : ''}.pdf`); } catch (e) { toast(galat(e), 'err'); } finally { t.remove(); } }
    else window.SPMB.cetakBanyakDokumen(docs);
  }

  async function dokBA(g, data, pdf) {
    const peng = await muatPengaturan(), ta = peng.identitas?.tahun_ajaran || '', d = g.dokumen_hasil || {};
    const tgl = d.tanggal_ba ? dIso(d.tanggal_ba) : new Date();
    const rekap = KELOMPOK.map(([j, b]) => { const rows = data.filter(r => r.jenjang === j && r.bagian === b);
      return { l: `${j} ${bagianL(b)}`, kuota: rows[0]?.kuota, n: rows.length, tes: rows.filter(r => Object.keys(r.nilai || {}).length).length,
        lulus: rows.filter(r => hasilDari(r.status) === 'lulus').length, cad: rows.filter(r => r.status === 'cadangan').length, tl: rows.filter(r => r.status === 'tidak_lulus').length }; }).filter(x => x.n);
    const jml = k => rekap.reduce((a, x) => a + (x[k] || 0), 0);
    const bid = bidangAktif();
    const opsi = {
      judul: 'Berita Acara Penetapan Hasil Seleksi', nomor: d.nomor_ba || '',
      meta: SEL.uji ? '<b>DATA UJI COBA</b>' : '',
      isi: `<p style="text-align:justify;line-height:1.6">Pada hari ini ${HARI[tgl.getDay()]}, tanggal ${fmt.tglPanjang(tgl)}${d.jam_rapat ? `, pukul ${esc(jamT(d.jam_rapat))} WITA` : ''}, bertempat di ${esc(d.tempat_rapat || peng.identitas?.nama_lembaga || 'pondok')},
        Panitia Penerimaan Murid Baru ${esc(peng.identitas?.nama_lembaga || '')} Tahun Ajaran ${esc(ta)} telah melaksanakan rapat penetapan hasil seleksi calon santri baru <b>${esc(g.nama)}</b>.</p>
        <p style="text-align:justify;line-height:1.6">Penetapan didasarkan pada hasil tes seleksi bidang ${bid.map(b => `${esc(bidangL(b))}`).join(', ')} dengan bobot nilai sesuai ketentuan panitia, serta memperhatikan kuota setiap jenjang dan putra/putri. Rapat menetapkan hasil sebagai berikut:</p>
        <table><colgroup><col style="width:6%"><col style="width:22%"><col style="width:12%"><col style="width:15%"><col style="width:15%"><col style="width:15%"><col style="width:15%"></colgroup>
          <thead><tr><th>No</th><th>Jenjang</th><th>Kuota</th><th>Peserta tes</th><th>Lulus</th><th>Cadangan</th><th>Tidak lulus</th></tr></thead>
          <tbody>${rekap.map((x, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${x.l}</td><td style="text-align:center">${x.kuota ?? '–'}</td><td style="text-align:center">${x.tes}</td>
            <td style="text-align:center">${x.lulus}</td><td style="text-align:center">${x.cad}</td><td style="text-align:center">${x.tl}</td></tr>`).join('')}
            <tr><td></td><td><b>Jumlah</b></td><td></td><td style="text-align:center"><b>${jml('tes')}</b></td><td style="text-align:center"><b>${jml('lulus')}</b></td><td style="text-align:center"><b>${jml('cad')}</b></td><td style="text-align:center"><b>${jml('tl')}</b></td></tr></tbody></table>
        <p style="text-align:justify;line-height:1.6">Daftar nama peserta beserta nilai dan keputusannya tercantum dalam Rekap Nilai Seleksi yang merupakan bagian tidak terpisahkan dari berita acara ini.
          Nama-nama calon santri yang dinyatakan lulus ditetapkan dengan Surat Keputusan${d.nomor_sk ? ` Nomor ${esc(d.nomor_sk)}` : ''}.</p>
        ${d.catatan_ba ? `<p style="text-align:justify;line-height:1.6">${esc(d.catatan_ba)}</p>` : ''}
        <p style="text-align:justify;line-height:1.6">Demikian berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>`,
      ttd: penandaTangan('berita_acara', peng), tanggal: d.tanggal_ba || null
    };
    return pdf ? unduh(opsi, `Berita Acara ${g.nama}.pdf`) : cetakDokumen(opsi);
  }

  async function dokSK(g, data, pdf) {
    const peng = await muatPengaturan(), ta = peng.identitas?.tahun_ajaran || '', d = g.dokumen_hasil || {};
    const nama = peng.identitas?.nama_lembaga || '';
    const ttd = penandaTangan('sk', peng), tgl = d.tanggal_sk || null;
    const judulSK = `Penetapan Calon Santri Baru yang Dinyatakan Lulus Seleksi Penerimaan Murid Baru Tahun Ajaran ${ta} ${g.nama}`;
    const du = g.daftar_ulang_mulai ? (g.daftar_ulang_selesai && g.daftar_ulang_selesai !== g.daftar_ulang_mulai ? `${tglDok(g.daftar_ulang_mulai)} sampai ${tglDok(g.daftar_ulang_selesai)}` : tglDok(g.daftar_ulang_mulai)) : 'waktu yang ditetapkan panitia';
    const lulus = data.filter(r => hasilDari(r.status) === 'lulus'), cad = data.filter(r => r.status === 'cadangan');
    const utama = {
      judul: 'Keputusan Ketua Panitia Penerimaan Murid Baru', nomor: d.nomor_sk || '',
      meta: SEL.uji ? '<b>DATA UJI COBA</b>' : '',
      isi: `<div class="sk-tentang">TENTANG<br>${esc(judulSK.toUpperCase())}</div>
        <div class="sk-tentang" style="font-weight:700;margin-top:8px">KETUA PANITIA PENERIMAAN MURID BARU<br>${esc(nama.toUpperCase())}</div>
        <table class="sk-tabel"><colgroup><col style="width:17%"><col style="width:3%"><col></colgroup><tbody>
          <tr><td>Menimbang</td><td>:</td><td>${barisT(d.menimbang || MENIMBANG)}</td></tr>
          <tr><td>Mengingat</td><td>:</td><td>${barisT(d.mengingat || MENGINGAT)}</td></tr>
          <tr><td colspan="3" style="text-align:center;font-weight:700;padding:8pt 0 4pt">MEMUTUSKAN</td></tr>
          <tr><td>Menetapkan</td><td>:</td><td><b>KEPUTUSAN KETUA PANITIA TENTANG ${esc(judulSK.toUpperCase())}.</b></td></tr>
          <tr><td>KESATU</td><td>:</td><td>Menetapkan ${lulus.length} (${esc(terbilang(lulus.length))}) calon santri sebagaimana tercantum dalam Lampiran I keputusan ini sebagai calon santri baru yang dinyatakan <b>LULUS</b> seleksi.</td></tr>
          ${cad.length ? `<tr><td>KEDUA</td><td>:</td><td>Menetapkan ${cad.length} (${esc(terbilang(cad.length))}) calon santri sebagaimana tercantum dalam Lampiran II sebagai <b>CADANGAN</b>, yang dapat diterima apabila terdapat kursi yang kosong.</td></tr>` : ''}
          <tr><td>${cad.length ? 'KETIGA' : 'KEDUA'}</td><td>:</td><td>Calon santri yang dinyatakan lulus wajib melakukan daftar ulang pada ${esc(du)}. Calon santri yang tidak melakukan daftar ulang sampai batas waktu tersebut dianggap mengundurkan diri.</td></tr>
          <tr><td>${cad.length ? 'KEEMPAT' : 'KETIGA'}</td><td>:</td><td>Keputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diperbaiki sebagaimana mestinya.</td></tr>
        </tbody></table>`,
      ttd, tanggal: tgl
    };
    const lampiran = (no, judul, rows) => ({
      judul: `Lampiran ${no}`, nomor: '',
      meta: `Keputusan Ketua Panitia Penerimaan Murid Baru Nomor ${esc(d.nomor_sk || '.................')} tanggal ${tglDok(tgl) === '.................' ? fmt.tglPanjang(new Date()) : tglDok(tgl)}<br><b>${esc(judul)}</b>${SEL.uji ? ' · <b>DATA UJI COBA</b>' : ''}`,
      isi: KELOMPOK.map(([j, b]) => { const rs = rows.filter(r => r.jenjang === j && r.bagian === b).sort((x, y) => (x.peringkat ?? 1e9) - (y.peringkat ?? 1e9));
        return rs.length ? `<p style="font-weight:700;margin:10px 0 4px">${j} ${bagianL(b)} (${rs.length} orang)</p>
          <table><colgroup><col style="width:6%"><col style="width:40%"><col style="width:24%"><col style="width:30%"></colgroup>
          <thead><tr><th>No</th><th>Nama calon santri / No. registrasi</th><th>Asal daerah</th><th>Asal sekolah</th></tr></thead>
          <tbody>${rs.map((r, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(r.nama_lengkap)}<br><span style="font-size:8pt">${esc(r.no_registrasi)}</span></td><td>${esc(r.asal || '–')}</td><td>${esc(r.asal_sekolah || '–')}</td></tr>`).join('')}</tbody></table>` : ''; }).join(''),
      ttd, tanggal: tgl
    });
    const docs = [utama, lampiran('I', 'Daftar calon santri baru yang dinyatakan lulus seleksi', lulus)];
    if (cad.length) docs.push(lampiran('II', 'Daftar calon santri cadangan', cad));
    if (pdf) { const t = toast('Menyusun PDF…', 'info', 60000); try { simpanPdf(await window.SPMB.buatPdfBanyak(docs, 'SK Penetapan Hasil Seleksi'), `SK Penetapan ${g.nama}.pdf`); } catch (e) { toast(galat(e), 'err'); } finally { t.remove(); } }
    else window.SPMB.cetakBanyakDokumen(docs);
  }

  // Bilangan terbilang (Bahasa Indonesia) untuk jumlah di SK
  function terbilang(n) {
    const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    n = Math.floor(n);
    if (n < 12) return n === 0 ? 'nol' : s[n];
    if (n < 20) return terbilang(n - 10) + ' belas';
    if (n < 100) return terbilang(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
    if (n < 200) return 'seratus' + (n > 100 ? ' ' + terbilang(n - 100) : '');
    if (n < 1000) return terbilang(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
    if (n < 2000) return 'seribu' + (n > 1000 ? ' ' + terbilang(n - 1000) : '');
    return terbilang(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
  }

  /* ---------- Tab Bidang dan Bobot ---------- */
  async function tabBidang(el, api) {
    const peng = await muatPengaturan(true);
    api.S.pengaturan = peng; siapkanBidang(peng);
    const cfg = peng.seleksi || {};
    const isSuper = api.S.profil.peran === 'superadmin';
    let daftar = URUT_BIDANG.map(k => ({ kunci: k, label: BIDANG[k][0], keterangan: BIDANG[k][3], SMP: bobotB('SMP', k), SMA: bobotB('SMA', k), baru: false }));
    // bidang yang sudah dipakai (tidak dapat dihapus)
    const [a, b2, c] = await Promise.all([
      sb.from('sesi_tes').select('bidang'), sb.from('nilai_tes').select('bidang'), sb.from('profil_pengguna').select('bidang_penguji')]);
    const dipakai = new Set([...(a.data || []).flatMap(x => x.bidang), ...(b2.data || []).map(x => x.bidang), ...(c.data || []).flatMap(x => x.bidang_penguji || [])]);
    const dis = isSuper ? '' : 'disabled';
    const render = () => {
      el.innerHTML = `
      <form class="card" id="fBidang" novalidate style="max-width:900px">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c6)"><i class="ph-duotone ph-scales"></i></div><div><h3>Bidang tes dan bobot nilai akhir</h3>
          <p>Nilai akhir = jumlah (bobot × nilai) ÷ 100. Bobot tiap jenjang berjumlah 100%.</p></div></div>
        ${!isSuper ? '<div class="note info"><i class="ph-duotone ph-lock-simple"></i><div>Bidang dan bobot hanya dapat diubah Superadmin. Admin dapat melihatnya di sini.</div></div>' : ''}
        <div class="table-wrap"><table class="tbl tbl-bidang"><thead><tr><th>Bidang tes</th><th class="hide-sm">Keterangan</th><th class="c">SMP (%)</th><th class="c">SMA (%)</th><th class="c"></th></tr></thead><tbody>
          ${daftar.map((x, i) => `<tr>
            <td><div class="bidang-nama"><span class="ic-box kecil" style="--tone:${warnaB(x.kunci) || WARNA_BIDANG[i % 8]}"><i class="ph-duotone ${ikonB(x.kunci)}"></i></span>
              <input class="input" data-i="${i}" data-f="label" value="${esc(x.label)}" maxlength="40" ${dis} aria-label="Nama bidang"></div>
              <small class="muted mono">${esc(x.kunci)}</small></td>
            <td class="hide-sm"><input class="input" data-i="${i}" data-f="keterangan" value="${esc(x.keterangan || '')}" maxlength="120" placeholder="Boleh kosong" ${dis}></td>
            ${['SMP', 'SMA'].map(j => `<td class="c"><input class="input kecil-angka" type="number" inputmode="numeric" min="0" max="100" step="1" data-i="${i}" data-f="${j}" value="${x[j]}" ${dis}></td>`).join('')}
            <td class="c">${isSuper ? (dipakai.has(x.kunci) && !x.baru ? `<span class="muted kecil" title="Sudah dipakai di sesi, nilai, atau data Penguji. Beri bobot 0 bila tidak lagi diujikan."><i class="ph-duotone ph-lock-simple"></i></span>`
              : `<button type="button" class="icon-btn plain" data-hapus="${i}" title="Hapus bidang" aria-label="Hapus bidang"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>`) : ''}</td></tr>`).join('')}
          <tr><td><b>Jumlah</b></td><td class="hide-sm"></td>${['SMP', 'SMA'].map(j => `<td class="c"><b data-jumlah="${j}"></b></td>`).join('')}<td></td></tr>
        </tbody></table></div>
        ${isSuper ? `<button type="button" class="btn sm ghost" id="btnBidangBaru" style="margin-top:10px" ${daftar.length >= 8 ? 'disabled' : ''}><i class="ph-duotone ph-plus-circle" style="color:var(--c6)"></i>Tambah bidang tes</button>` : ''}
        <div class="note info" style="margin-top:12px"><i class="ph-duotone ph-lightbulb"></i><div>
          <b>Hanya dua tes?</b> Beri bobot 0 pada bidang yang tidak diujikan; bidang itu tidak wajib dinilai dan tidak muncul di tabel nilai.
          <b>Tambah tes baru?</b> Klik <b>Tambah bidang tes</b>, lalu bagi ulang bobotnya. Bidang yang sudah dipakai (ikon gembok) tidak dapat dihapus, tetapi dapat diberi bobot 0.
          Setelah menambah bidang, centang bidang itu pada data akun Penguji di menu Pengguna.</div></div>
        <h4 class="sub-form"><i class="ph-duotone ph-flag-checkered" style="color:var(--c2)"></i>Batas rekomendasi kelulusan (dipakai di Peringkat)</h4>
        <div class="grid-form">
          <div class="field"><label>Nilai akhir minimal</label><input class="input" type="number" inputmode="decimal" min="0" max="100" step="0.5" name="nilai_minimal" value="${esc(cfg.nilai_minimal ?? '')}" placeholder="Tanpa batas" ${dis}><small>Di bawah nilai ini direkomendasikan tidak lulus walau kuota masih ada.</small></div>
          <div class="field"><label>Jumlah cadangan maksimal per kelompok</label><input class="input" type="number" inputmode="numeric" min="0" max="500" name="cadangan_maks" value="${esc(cfg.cadangan_maks ?? '')}" placeholder="Tanpa batas" ${dis}><small>Kelompok = jenjang × putra/putri.</small></div>
        </div>
        ${isSuper ? '<div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan bidang dan bobot</button></div>' : ''}
      </form>`;
      const f = $('#fBidang');
      const jumlah = () => ['SMP', 'SMA'].forEach(j => { const t = daftar.reduce((a2, x) => a2 + (+x[j] || 0), 0);
        const e = f.querySelector(`[data-jumlah="${j}"]`); e.textContent = t + '%'; e.style.color = t === 100 ? 'var(--ok)' : 'var(--danger)'; });
      f.addEventListener('input', e => { const t = e.target; if (t.dataset.i == null) return; const x = daftar[+t.dataset.i];
        x[t.dataset.f] = ['SMP', 'SMA'].includes(t.dataset.f) ? (t.value === '' ? 0 : +t.value) : t.value; jumlah(); });
      jumlah();
      f.querySelectorAll('[data-hapus]').forEach(bt => bt.onclick = async () => {
        const x = daftar[+bt.dataset.hapus];
        if (!(await konfirmasi('Hapus bidang?', `Bidang <b>${esc(x.label)}</b> dihapus dari daftar setelah Anda menekan Simpan.`, 'Hapus'))) return;
        daftar.splice(+bt.dataset.hapus, 1); render();
      });
      $('#btnBidangBaru') && ($('#btnBidangBaru').onclick = async () => {
        const nama = await dialog({ judul: 'Tambah bidang tes', ikon: 'ph-plus-circle', tone: 'var(--c6)',
          isi: `<div class="field"><label>Nama bidang <span class="req">*</span></label><input class="input" id="bbNama" maxlength="40" placeholder="Contoh: Praktik Ibadah"></div>
            <div class="field"><label>Keterangan</label><input class="input" id="bbKet" maxlength="120" placeholder="Contoh: Wudhu, shalat, dan doa harian"></div>`,
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Tambahkan', ikon: 'ph-check', aksi: root => {
            const n = root.querySelector('#bbNama').value.trim(); if (n.length < 2) { toast('Nama bidang minimal 2 karakter.', 'warn'); return false; }
            return { n, k: root.querySelector('#bbKet').value.trim() }; } }] });
        if (!nama) return;
        let kunci = nama.n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'b_$1').slice(0, 30) || 'bidang';
        if (kunci.length < 2) kunci = 'bidang_' + kunci;
        let u = kunci, n = 2; while (daftar.some(x => x.kunci === u)) u = (kunci.slice(0, 27) + '_' + n++);
        daftar.push({ kunci: u, label: nama.n, keterangan: nama.k, SMP: 0, SMA: 0, baru: true });
        BIDANG[u] = [nama.n, IKON_BIDANG[u] || 'ph-exam', WARNA_BIDANG[(daftar.length - 1) % 8], nama.k];
        render();
        toast('Bidang ditambahkan. Bagi ulang bobotnya lalu tekan Simpan.', 'info');
      });
      f.onsubmit = async e => {
        e.preventDefault();
        for (const j of ['SMP', 'SMA']) {
          if (daftar.some(x => !Number.isInteger(+x[j]) || +x[j] < 0 || +x[j] > 100)) return toast('Bobot berupa bilangan bulat 0–100.', 'err');
          const t = daftar.reduce((a2, x) => a2 + +x[j], 0); if (t !== 100) return toast(`Jumlah bobot ${j} harus 100% (sekarang ${t}%).`, 'err');
        }
        if (daftar.some(x => String(x.label).trim().length < 2)) return toast('Nama bidang minimal 2 karakter.', 'err');
        const lamaB = Object.fromEntries((cfg.bidang || []).map(x => [x.kunci, x]));
        const nm = f.elements.nilai_minimal.value, cm = f.elements.cadangan_maks.value;
        const nilai = { ...cfg,
          bidang: daftar.map(x => ({ ...(lamaB[x.kunci] || {}), kunci: x.kunci, label: String(x.label).trim(), keterangan: String(x.keterangan || '').trim() })),
          bobot: Object.fromEntries(['SMP', 'SMA'].map(j => [j, Object.fromEntries(daftar.map(x => [x.kunci, +x[j]]))])),
          nilai_minimal: nm === '' ? null : +nm, cadangan_maks: cm === '' ? null : +cm };
        const { error } = await sb.from('pengaturan').update({ nilai }).eq('kunci', 'seleksi');
        if (error) return toast(galat(error), 'err', 7000);
        api.S.pengaturan = await muatPengaturan(true); siapkanBidang(api.S.pengaturan);
        toast('Bidang dan bobot disimpan.'); tabBidang(el, api);
      };
    };
    render();
  }

  /* =================================================================
     MENU PENILAIAN (Penguji; juga Admin/Superadmin yang ditugaskan)
     ================================================================= */
  const SARING_P = { f: '', q: '' };
  window.SPMB_MODUL.penilaian = async (k, api) => {
    siapkanBidang(api.S.pengaturan);
    const { data, error } = await sb.rpc('peserta_saya', { p_sesi: null });
    if (error) throw error;
    const daftar = data || [];
    api.setFab(null);
    if (!daftar.length) {
      k.innerHTML = `<div class="card"><div class="empty"><i class="ph-duotone ph-chalkboard-teacher"></i><b>Belum ada penugasan</b>
        Anda belum ditugaskan menguji di sesi tes mana pun. Penugasan dari Admin akan muncul di sini dan di notifikasi.
        ${api.S.profil.peran !== 'penguji' ? '<br><a href="#/seleksi">Buka menu Seleksi</a> untuk mengatur sesi dan penguji.' : ''}</div></div>`;
      return;
    }
    const qs = new URLSearchParams(location.hash.split('?')[1] || '');
    const kini = hariIni();
    const bawaan = daftar.find(x => x.sesi.tanggal === kini) || daftar.find(x => x.sesi.tanggal > kini) || daftar[daftar.length - 1];
    let pilih = daftar.find(x => String(x.sesi.id) === qs.get('sesi')) || bawaan;
    const total = x => x.peserta.length * (x.bidang_saya || []).length;
    const selesai = x => x.peserta.reduce((a, p) => a + (x.bidang_saya || []).filter(b => p.nilai[b]).length, 0);

    k.innerHTML = `
      <div class="chip-tab sesi-pilih" role="tablist">${daftar.map(x => { const [st, t] = statusSesi(x.sesi);
        return `<button type="button" role="tab" data-sesi="${x.sesi.id}" aria-selected="${x === pilih}"><b>${esc(x.sesi.nama)}</b><small>${esc(tglIso(x.sesi.tanggal))} · ${esc(jamT(x.sesi.jam_mulai))} · <span style="color:${t}">${esc(st)}</span></small>
          <span class="count-mini">${selesai(x)}/${total(x)}</span></button>`; }).join('')}</div>
      <div id="pIsi"></div>`;
    k.querySelectorAll('[data-sesi]').forEach(b => b.onclick = () => {
      pilih = daftar.find(x => String(x.sesi.id) === b.dataset.sesi);
      k.querySelectorAll('[data-sesi]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      history.replaceState(null, '', '#/penilaian?sesi=' + pilih.sesi.id); tampilSesi();
    });
    k.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });

    function tampilSesi() {
      const x = pilih, s = x.sesi, bs = x.bidang_saya || [];
      const t = total(x), sl = selesai(x);
      $('#pIsi').innerHTML = `
        <div class="card sesi-detail">
          <div class="sesi-kepala"><span class="sesi-tgl besar"><b>${dIso(s.tanggal).getDate()}</b><small>${fmt.tglPanjang(dIso(s.tanggal)).split(' ')[1].slice(0, 3)}</small></span>
            <div class="teks"><h2>${esc(s.nama)}</h2><small>${esc(s.gelombang)} · ${esc(hariTglIso(s.tanggal))} · ${esc(rentangJam(s))} WITA</small>
              <div class="pill-baris">${pill(MODE[s.mode][0], MODE[s.mode][2], MODE[s.mode][1])}<span class="muted kecil">Bidang Anda:</span>${bs.map(pillBidang).join('')}</div></div></div>
          <div class="sesi-info">
            <div><i class="ph-duotone ${MODE[s.mode][1]}" style="color:${MODE[s.mode][2]}"></i><span>${s.mode === 'online' ? 'Media' : 'Tempat'}</span><b>${esc(s.tempat || '–')}</b></div>
            ${s.mode === 'online' && s.tautan ? `<div><i class="ph-duotone ph-link" style="color:var(--c2)"></i><span>Tautan rapat</span><b><a class="btn sm" href="${esc(s.tautan)}" target="_blank" rel="noopener"><i class="ph-duotone ph-video-camera"></i>Buka rapat</a></b></div>` : ''}
            <div><i class="ph-duotone ph-chart-donut" style="color:var(--c5)"></i><span>Kemajuan penilaian</span><b id="pKemajuan">${sl} dari ${t} nilai terisi</b><span id="pBar">${UI_kemajuan(sl, Math.max(1, t))}</span></div>
          </div>
          ${s.terkunci ? '<div class="note"><i class="ph-duotone ph-lock-simple"></i><div>Hasil gelombang ini sudah diterbitkan. Nilai tidak dapat diubah lagi.</div></div>' : ''}
        </div>
        <div class="page-head">
          <div class="chip-tab kecil" role="tablist">${[['', 'Semua'], ['belum', 'Belum dinilai'], ['dikembalikan', 'Dikembalikan'], ['menunggu', 'Menunggu validasi'], ['disetujui', 'Disetujui']]
            .map(([v, l]) => `<button type="button" data-f="${v}" aria-selected="${SARING_P.f === v}">${l}</button>`).join('')}</div>
          <div class="field cari-besar" style="margin:0;flex:1;min-width:180px"><i class="ph-duotone ph-magnifying-glass"></i><input class="input" id="pCari" type="search" placeholder="Cari nama atau nomor…" value="${esc(SARING_P.q)}"></div>
          <button class="btn sm ghost" id="pLembar"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Lembar / rekap nilai</button>
        </div>
        <div class="nilai-daftar" id="pDaftar"></div>`;
      const render = () => {
        const sl2 = selesai(x);
        if ($('#pKemajuan')) { $('#pKemajuan').textContent = `${sl2} dari ${t} nilai terisi`; $('#pBar').innerHTML = UI_kemajuan(sl2, Math.max(1, t)); }
        const q = SARING_P.q.toLowerCase();
        const rows = x.peserta.filter(p => (!q || `${p.nama_lengkap} ${p.no_registrasi}`.toLowerCase().includes(q)) && (!SARING_P.f
          || (SARING_P.f === 'belum' ? bs.some(b => !p.nilai[b]) : bs.some(b => p.nilai[b]?.status === SARING_P.f))));
        $('#pDaftar').innerHTML = rows.length ? rows.map(p => `
          <div class="card nilai-kartu">
            <div class="nilai-kepala"><span class="avatar kecil">${esc(SPMB.inisial(p.nama_lengkap))}</span>
              <div class="teks"><b>${esc(p.nama_lengkap)}</b>${p.uji ? ' <span class="pill" style="--tone:var(--c6)">Uji</span>' : ''}<small><span class="mono">${esc(p.no_registrasi)}</span> · ${p.jenjang} ${bagianL(p.bagian)}${p.asal_sekolah ? ' · ' + esc(p.asal_sekolah) : ''}</small>
                <small>Hafalan saat mendaftar: ${+p.hafalan_juz >= 1 ? esc(angkaN(p.hafalan_juz)) + ' juz' : 'kurang dari 1 juz'}${p.pernah_mondok ? ' · pernah mondok' : ''}</small></div>
              <div class="hadir-pilih" role="group" aria-label="Kehadiran">
                <button type="button" data-hadir="${p.id}|1" aria-pressed="${p.hadir === true}" title="Hadir" ${s.terkunci ? 'disabled' : ''}><i class="ph-duotone ph-check"></i><span class="hide-sm">Hadir</span></button>
                <button type="button" data-hadir="${p.id}|0" aria-pressed="${p.hadir === false}" title="Tidak hadir" ${s.terkunci ? 'disabled' : ''}><i class="ph-duotone ph-x"></i></button></div></div>
            <div class="nilai-bidang">${bs.map(b => { const n = p.nilai[b];
              return `<button type="button" class="nilai-slot${n ? ' ada' : ''}" data-isi="${p.id}|${b}" style="--tone:${n ? ST_NILAI[n.status][1] : warnaB(b)}" ${s.terkunci ? 'disabled' : ''}>
                <span class="lbl"><i class="ph-duotone ${ikonB(b)}"></i>${esc(bidangL(b))}</span>
                ${n ? `<b>${esc(angkaN(n.nilai))}</b><small><i class="ph-duotone ${ST_NILAI[n.status][2]}"></i>${ST_NILAI[n.status][0]}</small>` : '<b class="kosong">Isi nilai</b><small>Belum dinilai</small>'}
                ${n?.status === 'dikembalikan' && n.catatan_validasi ? `<em>${esc(n.catatan_validasi)}</em>` : ''}</button>`; }).join('')}</div>
          </div>`).join('') : `<div class="card"><div class="empty"><i class="ph-duotone ph-check-circle"></i><b>${x.peserta.length ? 'Tidak ada yang cocok' : 'Belum ada peserta di sesi ini'}</b></div></div>`;
      };
      render();
      $('#pIsi').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { SARING_P.f = b.dataset.f; $('#pIsi').querySelectorAll('[data-f]').forEach(y => y.setAttribute('aria-selected', String(y === b))); render(); });
      $('#pCari').oninput = e => { SARING_P.q = e.target.value; render(); };
      $('#pLembar').onclick = async () => {
        const b = bs.length === 1 ? bs[0] : await dialog({ judul: 'Lembar / rekap nilai', ikon: 'ph-clipboard-text', tone: 'var(--c5)', isi: '<p style="margin:0">Pilih bidang:</p>',
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, ...bs.map(y => ({ label: bidangL(y), ikon: ikonB(y), kelas: 'ghost', nilai: y }))] });
        if (!b) return;
        const nilaiPer = Object.fromEntries(x.peserta.map(p => [p.id, p.nilai]));
        pilihCetak(`Lembar penilaian ${bidangL(b)}`, pdf => lembarNilai({ ...s, bidang: [b], jenjang: 'semua', bagian: 'semua' }, b, x.peserta, nilaiPer, api.S.profil.nama_lengkap, s.gelombang, pdf));
      };
      $('#pDaftar').addEventListener('click', async e => {
        const h = e.target.closest('[data-hadir]'), isi = e.target.closest('[data-isi]');
        if (h) {
          const [pid, v] = h.dataset.hadir.split('|'), p = x.peserta.find(y => y.id === pid);
          const baru = (v === '1') === p.hadir ? null : v === '1';
          const { error } = await sb.rpc('tandai_hadir', { p_sesi: s.id, p_pendaftar: pid, p_hadir: baru });
          if (error) return toast(galat(error), 'err');
          p.hadir = baru; render();
        } else if (isi) {
          const [pid, b] = isi.dataset.isi.split('|');
          await isiNilai(pid, b);
        }
      });
      async function isiNilai(pid, b) {
        const p = x.peserta.find(y => y.id === pid), n = p.nilai[b], tahfizh = b === 'tahfizh';
        const kunci = n?.status === 'disetujui';
        const urutan = x.peserta.filter(y => !y.nilai[b] && y.id !== pid && y.hadir !== false);
        const hasil = await dialog({
          judul: `${bidangL(b)} · ${p.nama_lengkap}`, ikon: ikonB(b), tone: warnaB(b),
          isi: `<p class="muted" style="margin:0 0 10px"><span class="mono">${esc(p.no_registrasi)}</span> · ${p.jenjang} ${bagianL(p.bagian)}</p>
            ${kunci ? '<div class="note"><i class="ph-duotone ph-lock-simple"></i><div>Nilai ini sudah divalidasi Admin dan terkunci. Hubungi Admin bila perlu diubah.</div></div>' : ''}
            ${n?.status === 'dikembalikan' ? `<div class="note err"><i class="ph-duotone ph-arrow-u-up-left"></i><div><b>Dikembalikan Admin:</b> ${esc(n.catatan_validasi || '')}</div></div>` : ''}
            ${p.hadir === false ? '<div class="note"><i class="ph-duotone ph-warning"></i><div>Peserta ini ditandai tidak hadir.</div></div>' : ''}
            <form id="fNilai" novalidate><div class="grid-form">
              <div class="field"><label>Nilai (0–100) <span class="req">*</span></label><input class="input nilai-besar" name="nilai" type="number" inputmode="decimal" min="0" max="100" step="0.5" value="${esc(n?.nilai ?? '')}" ${kunci ? 'disabled' : ''}></div>
              ${tahfizh ? `<div class="field"><label>Hafalan yang diuji (juz)</label><input class="input" name="hafalan" type="number" inputmode="decimal" min="0" max="30" step="0.5" value="${esc(n?.hafalan_diuji ?? (+p.hafalan_juz || ''))}" ${kunci ? 'disabled' : ''}></div>` : '<div></div>'}
              <div class="field full"><label>Catatan</label><textarea class="textarea" name="catatan" rows="3" maxlength="1000" placeholder="${tahfizh ? 'Kelancaran, tajwid, makharijul huruf…' : b === 'wawancara' ? 'Motivasi, kesiapan mondok, dukungan orang tua…' : 'Catatan hasil tes…'}" ${kunci ? 'disabled' : ''}>${esc(n?.catatan || '')}</textarea></div>
            </div></form>`,
          tombol: kunci ? [{ label: 'Tutup', nilai: null }] : [
            { label: 'Batal', kelas: 'ghost', nilai: null },
            ...(urutan.length ? [{ label: 'Simpan & berikutnya', ikon: 'ph-arrow-right', kelas: 'ghost', aksi: async root => (await simpan(root)) ? 'lanjut' : false }] : []),
            { label: 'Simpan nilai', ikon: 'ph-floppy-disk', aksi: async root => (await simpan(root)) ? 'ok' : false }
          ]
        });
        async function simpan(root) {
          const f = root.querySelector('#fNilai'), v = f.elements.nilai.value, h = f.elements.hafalan?.value;
          if (v === '' || isNaN(+v) || +v < 0 || +v > 100) { toast('Nilai harus 0 sampai 100.', 'warn'); f.elements.nilai.focus(); return false; }
          if (h && (+h < 0 || +h > 30)) { toast('Hafalan yang diuji 0 sampai 30 juz.', 'warn'); return false; }
          const { data: baru, error } = await sb.rpc('simpan_nilai', { p_pendaftar: pid, p_bidang: b, p_nilai: +v, p_hafalan: h === '' || h == null ? null : +h,
            p_catatan: f.elements.catatan.value.trim(), p_rincian: {}, p_setujui: false });
          if (error) throw new Error(galat(error));
          p.nilai[b] = { id: baru.id, nilai: baru.nilai, hafalan_diuji: baru.hafalan_diuji, catatan: baru.catatan, status: baru.status, catatan_validasi: baru.catatan_validasi };
          toast(`Nilai ${bidangL(b)} ${p.nama_lengkap} tersimpan.`);
          return true;
        }
        if (hasil) {
          render();
          k.querySelectorAll('[data-sesi]').forEach(bt => { if (bt.dataset.sesi == s.id) bt.querySelector('.count-mini').textContent = `${selesai(x)}/${total(x)}`; });
          if (hasil === 'lanjut' && urutan.length) isiNilai(urutan[0].id, b);
        }
      }
    }
    tampilSesi();
  };
})();
