/* =====================================================================
   SPMB · JEMBATAN UNGGAH (Google Apps Script) · versi 3.4
   Pondok Pesantren Tahfizhul Qur'an Imam Asy-Syathiby Wahdah Islamiyah Gowa

   Tugas:
   1. Konten situs  : menerima gambar dari Superadmin (sesi Supabase).
   2. Pendaftar     : menerima berkas dari pengunjung TANPA akun, memakai
                      token unggah sekali pakai dari Supabase.
   3. Konfirmasi    : setelah formulir terkirim, merapikan folder berkas
                      santri dan mengirim email konfirmasi + Bukti
                      Pendaftaran (PDF ukuran F4).
   4. Lihat berkas  : Admin/Superadmin melihat berkas pendaftar yang
                      tersimpan privat di Drive.
   4b. Bukti PDF    : Bukti Pendaftaran utama dibuat di peramban (sama dengan
                      hasil cetak) lalu dikirim ke sini untuk lampiran email.
                      Pembuatan lewat Google Docs hanya cadangan.
   4c. Nama berkas  : berkas santri di Drive diberi nama
                      "Nama Santri - Jenis Berkas - Nomor urut".
   4d. Daftar ulang : (3.3) berkas daftar ulang langsung masuk folder santri
                      dengan pola nama yang sama; rapikanBerkasDaftarUlang()
                      memindahkan berkas lama dari folder _Draf/du-*.
   4e. Unduhan      : (3.4) Admin/Superadmin mengunggah berkas Pusat Unduhan
                      (PDF, gambar, Word, Excel, PowerPoint) ke folder
                      "Unduhan"; berkas dibagikan "siapa saja dengan link".
   5. Penjaga       : menyapa Supabase setiap hari agar tidak dijeda.

   Keamanan: berkas pendaftar TIDAK dibagikan ke publik. Berkas ini TIDAK
   memuat kunci rahasia apa pun; semua pemeriksaan dilakukan Supabase.
   ===================================================================== */

const PENGATURAN = {
  SUPABASE_URL: 'https://fhnkjzjrdxwbzdjkdopa.supabase.co',
  SUPABASE_KEY: 'sb_publishable_F5RxacaK3vxRFsxykAHE8Q_1--iFxxv', // kunci publik
  FOLDER_INDUK: '1CDoSwzcKma-GfGoR50ocI8EpSsvrl30w',                // folder "SPMB 2027"
  ALAMAT_SITUS: 'https://syathibygowa.github.io/spmb2027',
  ZONA_WAKTU: 'Asia/Makassar',
  VERSI: '3.4 (Fase 5)'
};

const FOLDER_PENDAFTAR = 'Berkas Pendaftar';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIME_PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const EKSTENSI = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf',
  [MIME_DOCX]: '.docx', [MIME_XLSX]: '.xlsx', [MIME_PPTX]: '.pptx' };

// Unggahan dengan sesi panitia
const KEPERLUAN = {
  konten: {
    folder: 'Konten Situs', peran: ['superadmin'], peranHapus: ['superadmin'], publik: true, maksMB: 10,
    jenis: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  },
  unduhan: {                   // Pusat Unduhan situs (brosur, panduan, formulir)
    folder: 'Unduhan', peran: ['superadmin', 'admin'], peranHapus: ['superadmin', 'admin'], publik: true, maksMB: 15,
    jenis: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', MIME_DOCX, MIME_XLSX, MIME_PPTX]
  },
  pendaftar_admin: {           // Admin mengganti/menambah berkas milik pendaftar
    folder: FOLDER_PENDAFTAR, peran: ['superadmin', 'admin'], peranHapus: ['superadmin', 'admin'], publik: false, maksMB: 10,
    jenis: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  }
};
// Unggahan pengunjung (tanpa akun)
const BATAS_PENDAFTAR = {
  jenis: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  maksGambarMB: 3,   // gambar sudah dikompres di browser (biasanya < 1 MB)
  maksPdfMB: 5
};


/* =====================================================================
   TITIK MASUK
   ===================================================================== */
function doGet() {
  return jawab({ ok: true, layanan: 'SPMB Jembatan Unggah', versi: PENGATURAN.VERSI, waktu: sekarang() });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (req.aksi) {
      case 'unggah':     return jawab(req.keperluan === 'pendaftar' ? unggahPendaftar(req) : unggah(req));
      case 'hapus':      return jawab(hapus(req));
      case 'konfirmasi': return jawab(konfirmasi(req));
      case 'lihat':      return jawab(lihat(req));
      case 'bukti':      return jawab(bukti(req));
      case 'gambar_kop': return jawab(gambarKop(req));
      case 'periksa':    return jawab({ ok: true, peran: periksaPeran(req.token), versi: PENGATURAN.VERSI, kuota_email: MailApp.getRemainingDailyQuota() });
      default:           return jawab({ ok: false, error: 'Perintah tidak dikenal.' });
    }
  } catch (err) {
    return jawab({ ok: false, error: String((err && err.message) || err) });
  }
}


/* =====================================================================
   1. UNGGAH OLEH PANITIA (konten situs, berkas pendaftar oleh Admin)
   ===================================================================== */
function unggah(req) {
  const k = KEPERLUAN[req.keperluan || 'konten'];
  if (!k) throw new Error('Keperluan unggah tidak dikenal.');
  const peran = periksaPeran(req.token);
  if (k.peran.indexOf(peran) < 0) throw new Error('Akun Anda tidak berhak mengunggah berkas ini.');

  const berkas = bacaBerkas(req, k.jenis, k.maksMB, k.maksMB);
  let folder;
  if (req.keperluan === 'pendaftar_admin') {
    const no = String(req.bagian || '');
    if (!/^[A-Za-z0-9\-/_.]{5,60}$/.test(no)) throw new Error('Nomor registrasi tidak valid.');
    folder = folderSantri(no) || subfolder(subfolder(folderPendaftar(), '_Tambahan'), bersihkan(no));
  } else {
    folder = subfolder(subfolder(folderInduk(), k.folder), bersihkan(req.bagian || 'umum'));
  }
  let nama = cap() + '-' + bersihkan(req.nama || 'berkas');
  if (req.keperluan === 'unduhan') nama = namaBebas(bersihNama(String(req.nama || 'berkas').replace(/\.[a-z0-9]{2,5}$/i, '')).slice(0, 90) || 'berkas', folder, EKSTENSI[berkas.mime] || '');
  if (req.keperluan === 'pendaftar_admin' && req.santri && req.label) {
    nama = namaBebas(namaBerkasSantri(req.santri, req.label, req.bagian), folder, EKSTENSI[berkas.mime] || '');
  }
  const file = folder.createFile(Utilities.newBlob(berkas.bytes, berkas.mime, nama));
  if (k.publik) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const id = file.getId();
  return {
    ok: true, id: id, nama: nama, mime: berkas.mime, ukuran: berkas.bytes.length,
    url: k.publik && berkas.mime.indexOf('image/') === 0 ? 'https://lh3.googleusercontent.com/d/' + id : file.getUrl(),
    lihat: file.getUrl()
  };
}


/* =====================================================================
   2. UNGGAH OLEH PENDAFTAR (tanpa akun, dengan token unggah)
   ===================================================================== */
function unggahPendaftar(req) {
  const token = String(req.token_unggah || '');
  if (!/^[0-9a-f-]{36}$/.test(token)) throw new Error('Sesi formulir tidak dikenal. Muat ulang halaman formulir.');
  const jenis = String(req.jenis || '');
  if (!/^[a-z_]{2,30}$/.test(jenis)) throw new Error('Jenis berkas tidak dikenal.');

  const cek = rpc('cek_token_unggah', { p_token: token });
  if (!cek || !cek.ok) throw new Error((cek && cek.error) || 'Sesi formulir tidak berlaku. Muat ulang halaman formulir.');

  const berkas = bacaBerkas(req, BATAS_PENDAFTAR.jenis, BATAS_PENDAFTAR.maksGambarMB, BATAS_PENDAFTAR.maksPdfMB);
  const ext = EKSTENSI[berkas.mime];
  let folder, nama;
  if (cek.daftar_ulang) {
    // Daftar ulang: langsung ke folder santri, "Nama Santri - Jenis Berkas - Nomor urut"
    const no = String(cek.no_registrasi || '');
    folder = denganKunci(function () { return folderSantri(no) || subfolder(subfolder(folderPendaftar(), '_Daftar Ulang'), bersihNama(no)); });
    nama = namaBebas(namaBerkasSantri(cek.nama_lengkap || no, labelBerkas(jenis), no), folder, ext);
  } else {
    folder = denganKunci(function () { return subfolder(subfolder(folderPendaftar(), '_Draf'), cek.folder); });
    nama = jenis + '-' + cap() + ext;
  }
  const file = folder.createFile(Utilities.newBlob(berkas.bytes, berkas.mime, nama));   // privat, tidak dibagikan
  const id = file.getId(), url = file.getUrl();

  try {
    rpc('catat_unggah_pendaftar', {
      p_token: token, p_jenis: jenis, p_drive_id: id, p_nama: String(cek.daftar_ulang ? nama : (req.nama || nama)).slice(0, 150),
      p_url: url, p_mime: berkas.mime, p_ukuran: berkas.bytes.length
    });
  } catch (err) {
    file.setTrashed(true);
    throw err;
  }
  return { ok: true, id: id, nama: nama, mime: berkas.mime, ukuran: berkas.bytes.length, url: url };
}


/* =====================================================================
   3. KONFIRMASI: rapikan folder dan kirim email + Bukti Pendaftaran
   ===================================================================== */
function konfirmasi(req) {
  const token = String(req.token_unggah || '');
  if (!/^[0-9a-f-]{36}$/.test(token)) throw new Error('Sesi formulir tidak dikenal.');
  const d = rpc('data_konfirmasi', { p_token: token });
  if (!d || !d.ok) throw new Error((d && d.error) || 'Data pendaftaran tidak ditemukan.');
  const p = d.pendaftar;

  // a. Folder draf -> "Berkas Pendaftar/SMP Putra/SPMB27-SMP-P-0001 - Nama"
  const namaFolder = p.no_registrasi + ' - ' + p.nama_lengkap;
  const kelompok = p.uji ? '_Uji Coba' : p.jenjang + ' ' + (p.bagian === 'putra' ? 'Putra' : 'Putri');
  denganKunci(function () {
    const tujuan = subfolder(folderPendaftar(), kelompok);
    const draf = subfolder(folderPendaftar(), '_Draf').getFoldersByName(d.folder_draf);
    while (draf.hasNext()) {            // biasanya satu; lebih dari satu bila pernah terbuat ganda
      const f = draf.next();
      f.setName(namaFolder);
      f.moveTo(tujuan);
    }
  });

  const peng = pengaturanPublik();

  // b. Nama berkas di Drive: "Nama Santri - Jenis Berkas - Nomor urut"
  try { gantiNamaBerkas(token, p, d.berkas, peng); } catch (e) { Logger.log('Ganti nama berkas gagal: ' + e); }

  // c. Bukti Pendaftaran PDF: utamakan yang dibuat peramban (sama persis dengan hasil cetak)
  let pdf = null, dariPeramban = false;
  if (req.pdf) { try { pdf = pdfDariPeramban(req.pdf, p.no_registrasi); dariPeramban = true; } catch (e) { Logger.log('PDF peramban ditolak: ' + e); } }
  if (!pdf) { try { pdf = buktiPdf(p, d.berkas, peng); } catch (e) { Logger.log('PDF gagal dibuat: ' + e); } }

  // d. Email (sekali saja)
  let email = false, pesan = '';
  if (d.sudah_email) {
    pesan = 'Email konfirmasi sudah pernah dikirim.';
  } else if (MailApp.getRemainingDailyQuota() < 1) {
    pesan = 'Kuota email harian habis. Panitia akan menghubungi melalui WhatsApp.';
  } else if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(p.email || '')) {
    pesan = 'Alamat email tidak valid.';
  } else {
    kirimEmailKonfirmasi(p, pdf, peng);
    rpc('tandai_email_terkirim', { p_token: token });
    email = true;
  }
  return { ok: true, email: email, pesan: pesan, no_registrasi: p.no_registrasi, pdf: dariPeramban ? null : pdfDataURL(pdf) };
}

function kirimEmailKonfirmasi(p, pdf, peng) {
  const id = peng.identitas || {}, kp = peng.ketua_panitia || {};
  const lembaga = id.nama_lembaga || 'Pondok Pesantren Imam Asy-Syathiby';
  const ta = id.tahun_ajaran || '';
  const kontak = kontakPanitia(p.bagian);
  const uji = p.uji ? '[UJI COBA] ' : '';
  const tautanStatus = PENGATURAN.ALAMAT_SITUS + '/cek-status.html?no=' + encodeURIComponent(p.no_registrasi);
  const baris = [
    ['Nomor registrasi', '<b style="font-size:16px;color:#c7332f">' + esc(p.no_registrasi) + '</b>'],
    ['Nama lengkap', esc(p.nama_lengkap)],
    ['Jenjang', esc(p.jenjang) + ' · ' + (p.bagian === 'putra' ? 'Putra' : 'Putri')],
    ['Gelombang', esc(p.gelombang || '-')],
    ['Tanggal daftar', tglJam(p.dibuat_pada) + ' WITA']
  ];
  if (p.tes_mulai) baris.push(['Jadwal tes', tglPanjang(p.tes_mulai) + (p.tes_selesai && p.tes_selesai !== p.tes_mulai ? ' – ' + tglPanjang(p.tes_selesai) : '')]);

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f1416;max-width:600px;margin:auto">' +
    '<div style="background:linear-gradient(120deg,#b8262a,#ee7b45);color:#fff;padding:18px 20px;border-radius:12px 12px 0 0">' +
    '<div style="font-size:12px;opacity:.9">' + esc(lembaga) + '</div>' +
    '<div style="font-size:20px;font-weight:bold;margin-top:4px">' + uji + 'Pendaftaran Diterima</div></div>' +
    '<div style="border:1px solid #eadbd5;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">' +
    '<p>Assalamu\'alaikum warahmatullah.</p>' +
    '<p>Terima kasih, pendaftaran ananda <b>' + esc(p.nama_lengkap) + '</b> pada SPMB ' + esc(ta) + ' telah kami terima dengan data berikut:</p>' +
    '<table style="border-collapse:collapse;width:100%;margin:10px 0">' +
    baris.map(function (b) { return '<tr><td style="padding:7px 10px;border:1px solid #eadbd5;background:#f7eeea;width:38%">' + b[0] + '</td><td style="padding:7px 10px;border:1px solid #eadbd5">' + b[1] + '</td></tr>'; }).join('') +
    '</table>' +
    '<p><b>Langkah berikutnya</b></p><ol style="padding-left:20px;margin-top:0">' +
    '<li>Simpan nomor registrasi dan Bukti Pendaftaran terlampir.</li>' +
    '<li>Panitia memeriksa berkas dan bukti pembayaran. Bila ada yang perlu diperbaiki, kami menghubungi melalui WhatsApp.</li>' +
    '<li>Pantau status dan jadwal tes melalui <a href="' + tautanStatus + '">halaman Cek Status</a> dengan nomor registrasi dan tanggal lahir santri.</li></ol>' +
    (kontak.length ? '<p><b>Kontak panitia</b><br>' + kontak.map(function (k) { return esc(k.nama) + ': <a href="https://wa.me/' + k.wa + '">+' + k.wa + '</a>'; }).join('<br>') + '</p>' : '') +
    '<p style="margin-bottom:0">Jazakumullahu khairan.<br>Panitia SPMB ' + esc(ta) + (kp.nama ? '<br>' + esc(kp.nama) : '') + '</p></div>' +
    '<p style="font-size:11px;color:#9a8a86;text-align:center">Email ini dikirim otomatis. Mohon tidak membalas email ini.</p></div>';

  const lampiran = pdf ? [pdf] : [];

  MailApp.sendEmail({
    to: p.email,
    subject: uji + 'Bukti Pendaftaran ' + p.no_registrasi + ' · SPMB ' + ta,
    htmlBody: html,
    name: 'Panitia SPMB ' + (id.nama_singkat || 'Imam Asy-Syathiby'),
    attachments: lampiran
  });
}


/* ---------- Bukti Pendaftaran (PDF F4, margin 2 cm) ---------- */
function buktiPdf(p, berkas, peng) {
  const id = peng.identitas || {}, kop = peng.kop_surat || {}, kp = peng.ketua_panitia || {}, spmb = peng.spmb || {};
  const labelBerkas = {};
  (spmb.berkas || []).forEach(function (b) { labelBerkas[b.kunci] = b.label; });

  const doc = DocumentApp.create('Bukti Pendaftaran ' + p.no_registrasi);
  const body = doc.getBody();
  const PT = 72 / 2.54;                                 // 1 cm = 28,35 pt
  body.setPageWidth(8.5 * 72).setPageHeight(13 * 72)   // F4 8,5 x 13 inci
      .setMarginTop(2 * PT).setMarginBottom(2 * PT).setMarginLeft(2 * PT).setMarginRight(2 * PT);
  const gaya = {}; gaya[DocumentApp.Attribute.FONT_FAMILY] = 'Arial'; gaya[DocumentApp.Attribute.FONT_SIZE] = 10.5;
  body.setAttributes(gaya);

  // Kop surat: logo kiri | teks | logo kanan
  const kopT = body.appendTable([['', '', '']]);
  kopT.setBorderWidth(0);
  const lebar = 8.5 * 72 - 4 * PT;
  kopT.setColumnWidth(0, 62).setColumnWidth(2, 62).setColumnWidth(1, lebar - 124);
  const pasangLogo = function (sel, url) {
    if (!url) return;
    try {
      const blob = UrlFetchApp.fetch(url.replace(/=w\d+$/, '') + (url.indexOf('lh3.googleusercontent.com') >= 0 ? '=w200' : ''), { muteHttpExceptions: true }).getBlob();
      sel.getChild(0).asParagraph().appendInlineImage(blob).setWidth(56).setHeight(56);
      sel.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    } catch (e) { Logger.log('Logo gagal: ' + e); }
  };
  pasangLogo(kopT.getCell(0, 0), kop.logo_kiri);
  pasangLogo(kopT.getCell(0, 2), kop.logo_kanan || id.logo);
  const tengah = kopT.getCell(0, 1);
  const barisKop = [[kop.baris_1, false, 11], [kop.baris_2, true, 12.5], [kop.baris_3, true, 12.5], [kop.baris_info, false, 8.5]]
    .filter(function (x) { return x[0]; });
  if (!barisKop.length) barisKop.push([id.nama_lembaga || '', true, 12.5]);
  tengah.getChild(0).asParagraph().setText(barisKop[0][0]);
  for (let i = 1; i < barisKop.length; i++) tengah.appendParagraph(barisKop[i][0]);
  for (let i = 0; i < barisKop.length; i++) {
    const par = tengah.getChild(i).asParagraph();
    par.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(0).setSpacingBefore(0);
    par.editAsText().setBold(barisKop[i][1]).setFontSize(barisKop[i][2]);
  }
  body.appendHorizontalRule();

  const judul = body.appendParagraph('BUKTI PENDAFTARAN SANTRI BARU');
  judul.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(6).setSpacingAfter(0);
  judul.editAsText().setBold(true).setFontSize(13);
  const sub = body.appendParagraph('Tahun Ajaran ' + (id.tahun_ajaran || '') + ' · ' + (p.gelombang || '') + (p.uji ? ' · DATA UJI COBA' : ''));
  sub.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(10);
  sub.editAsText().setBold(false).setFontSize(10);

  // Tabel data (garis 0,5 pt, header tebal, isi reguler)
  const data = [
    ['Uraian', 'Keterangan'],
    ['Nomor registrasi', p.no_registrasi],
    ['Nama lengkap', p.nama_lengkap],
    ['NISN', p.nisn],
    ['Tempat, tanggal lahir', p.tempat_lahir + ', ' + tglPanjang(p.tanggal_lahir)],
    ['Jenjang / bagian', p.jenjang + ' / ' + (p.bagian === 'putra' ? 'Putra' : 'Putri')],
    ['Asal sekolah', p.asal_sekolah || '-'],
    ['Nama ayah / ibu', (p.nama_ayah || '-') + ' / ' + (p.nama_ibu || '-')],
    ['Nomor WhatsApp', '+' + p.no_wa],
    ['Email', p.email],
    ['Tanggal daftar', tglJam(p.dibuat_pada) + ' WITA']
  ];
  tabelRapi(body.appendTable(data), [0.34, 0.66], lebar);

  body.appendParagraph('').setSpacingAfter(0);
  const bk = body.appendParagraph('Berkas yang diunggah');
  bk.editAsText().setBold(true);
  const barisBerkas = [['No', 'Berkas', 'Status']].concat((berkas || []).map(function (b, i) {
    return [String(i + 1), labelBerkas[b.jenis] || b.jenis, 'Menunggu verifikasi'];
  }));
  tabelRapi(body.appendTable(barisBerkas), [0.08, 0.6, 0.32], lebar);

  const cat = body.appendParagraph('Catatan: simpan bukti ini. Status pendaftaran dan jadwal tes dapat dilihat di ' + PENGATURAN.ALAMAT_SITUS + '/cek-status.html dengan nomor registrasi dan tanggal lahir santri.');
  cat.setSpacingBefore(10); cat.editAsText().setFontSize(9).setBold(false);

  // Tanda tangan sejajar kiri–kanan
  const ttd = body.appendTable([
    ['', 'Gowa, ' + tglPanjang(p.dibuat_pada)],
    ['Calon santri / wali,', 'Ketua Panitia SPMB,'],
    ['\n\n\n', '\n\n\n'],
    ['(' + p.nama_lengkap + ')', kp.nama || '(............................................)'],
    ['', kp.niy ? 'NIY. ' + kp.niy : '']
  ]);
  ttd.setBorderWidth(0).setColumnWidth(0, lebar / 2).setColumnWidth(1, lebar / 2);
  for (let r = 0; r < ttd.getNumRows(); r++) for (let c = 0; c < 2; c++) {
    const par = ttd.getCell(r, c).getChild(0).asParagraph();
    par.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(0);
    par.editAsText().setBold(r === 3 && c === 1 && !!kp.nama);
  }
  const kaki = body.appendParagraph('Dicetak otomatis oleh sistem SPMB pada ' + sekarang() + ' WITA');
  kaki.setSpacingBefore(14).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  kaki.editAsText().setFontSize(8).setItalic(true);

  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  const pdf = file.getAs('application/pdf').setName('Bukti Pendaftaran ' + p.no_registrasi + '.pdf');
  file.setTrashed(true);
  return pdf;
}

function tabelRapi(t, proporsi, lebar) {
  t.setBorderWidth(0.5);
  proporsi.forEach(function (x, i) { t.setColumnWidth(i, lebar * x); });
  for (let r = 0; r < t.getNumRows(); r++) {
    for (let c = 0; c < t.getRow(r).getNumCells(); c++) {
      const sel = t.getCell(r, c);
      sel.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(5).setPaddingRight(5);
      sel.editAsText().setBold(r === 0).setFontSize(10);
      if (r === 0) sel.setBackgroundColor('#EFEFEF');
    }
  }
}


/* ---------- Label jenis berkas (pendaftaran + daftar ulang) ---------- */
function labelBerkas(jenis) {
  const peng = pengaturanPublik(), label = {};
  (((peng.spmb || {}).berkas) || []).concat(((peng.daftar_ulang || {}).berkas) || []).forEach(function (b) { label[b.kunci] = b.label; });
  return label[jenis] || String(jenis).replace(/_/g, ' ');
}

/* ---------- JALANKAN SEKALI (3.3): rapikan berkas daftar ulang lama ----------
   Memindahkan berkas dari "Berkas Pendaftar/_Draf/du-<nomor>" ke folder santri
   dan menamainya "Nama Santri - Jenis Berkas - Nomor urut". Aman diulang. */
function rapikanBerkasDaftarUlang() {
  const draf = subfolder(folderPendaftar(), '_Draf'), it = draf.getFolders();
  let pindah = 0, folderSelesai = 0;
  while (it.hasNext()) {
    const f = it.next(), nm = f.getName();
    if (nm.indexOf('du-') !== 0) continue;
    const no = nm.slice(3), tujuan = folderSantri(no) || subfolder(subfolder(folderPendaftar(), '_Daftar Ulang'), bersihNama(no));
    const santri = tujuan.getName().indexOf(no + ' - ') === 0 ? tujuan.getName().slice(no.length + 3) : no;
    const files = f.getFiles();
    while (files.hasNext()) {
      const file = files.next(), lama = file.getName();
      const jenis = (lama.match(/^([a-z_]+)-\d{8}-\d{6}/) || [])[1] || 'berkas';
      const ext = (lama.match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
      file.moveTo(tujuan);
      file.setName(namaBebas(namaBerkasSantri(santri, labelBerkas(jenis), no), tujuan, ext));
      pindah++;
    }
    if (!f.getFiles().hasNext() && !f.getFolders().hasNext()) { f.setTrashed(true); folderSelesai++; }
  }
  Logger.log('Selesai: ' + pindah + ' berkas dipindahkan, ' + folderSelesai + ' folder sementara dibuang.');
}

/* ---------- Nama berkas santri ---------- */
function bersihNama(t) { return String(t || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim(); }
function urutNomor(no) { const m = String(no || '').match(/(\d+)$/); return m ? m[1] : bersihNama(no); }
function namaBerkasSantri(nama, label, no) {
  return [bersihNama(nama).slice(0, 60), bersihNama(label).slice(0, 40), urutNomor(no)].filter(String).join(' - ');
}
// Tambah " (2)", " (3)" bila nama yang sama sudah ada di folder
function namaBebas(dasar, folder, ext) {
  let n = 1, nama = dasar + ext;
  while (folder.getFilesByName(nama).hasNext() && n < 50) { n++; nama = dasar + ' (' + n + ')' + ext; }
  return nama;
}
function gantiNamaBerkas(token, p, berkas, peng) {
  const label = {};
  ((peng.spmb || {}).berkas || []).forEach(function (b) { label[b.kunci] = b.label; });
  const hitung = {}, hasil = [];
  (berkas || []).forEach(function (b) {
    try {
      const file = DriveApp.getFileById(b.drive_id);
      const ext = (file.getName().match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
      hitung[b.jenis] = (hitung[b.jenis] || 0) + 1;
      const nama = namaBerkasSantri(p.nama_lengkap, label[b.jenis] || b.jenis, p.no_registrasi) + (hitung[b.jenis] > 1 ? ' (' + hitung[b.jenis] + ')' : '') + ext;
      if (file.getName() !== nama) file.setName(nama);
      hasil.push({ drive_id: b.drive_id, nama: nama });
    } catch (e) { Logger.log('Berkas ' + b.drive_id + ': ' + e); }
  });
  if (hasil.length) rpc('perbarui_nama_berkas', { p_token: token, p_daftar: hasil });
}
// PDF yang dibuat peramban: periksa bahwa benar PDF dan tidak terlalu besar
function pdfDariPeramban(dataURL, no) {
  const bytes = Utilities.base64Decode(String(dataURL).replace(/^data:[^,]*,/, ''));
  if (bytes.length < 500 || bytes.length > 4 * 1024 * 1024) throw new Error('Ukuran PDF tidak wajar.');
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) !== '%PDF-') throw new Error('Bukan berkas PDF.');
  return Utilities.newBlob(bytes, 'application/pdf', 'Bukti Pendaftaran ' + no + '.pdf');
}
// Logo kop surat untuk PDF di peramban (hanya gambar kop/logo yang terdaftar di pengaturan)
function gambarKop(req) {
  const peng = pengaturanPublik(), kop = peng.kop_surat || {}, id = peng.identitas || {};
  const url = String(req.url || '');
  if ([kop.logo_kiri, kop.logo_kanan, kop.gambar_kop, id.logo].filter(Boolean).indexOf(url) < 0) throw new Error('Gambar tidak dikenal.');
  const ambil = url.indexOf('lh3.googleusercontent.com') >= 0 ? url.replace(/=w\d+$/, '') + '=w600' : url;
  const res = UrlFetchApp.fetch(ambil, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Gambar kop tidak dapat diambil.');
  const blob = res.getBlob();
  if (blob.getBytes().length > 2 * 1024 * 1024) throw new Error('Gambar kop terlalu besar.');
  return { ok: true, data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}


/* =====================================================================
   4b. BUKTI PENDAFTARAN PDF UNTUK DIUNDUH
   - pendaftar: { aksi:'bukti', token_unggah }  (token dari formulirnya)
   - panitia  : { aksi:'bukti', id, token }      (sesi masuk dashboard)
   ===================================================================== */
function bukti(req) {
  let d;
  if (req.token_unggah) {
    const token = String(req.token_unggah);
    if (!/^[0-9a-f-]{36}$/.test(token)) throw new Error('Sesi formulir tidak dikenal.');
    d = rpc('data_konfirmasi', { p_token: token });
  } else {
    const peran = periksaPeran(req.token);
    if (['superadmin', 'admin'].indexOf(peran) < 0) throw new Error('Akun Anda tidak berhak mengunduh bukti pendaftaran.');
    d = rpcSesi(req.token, 'data_bukti', { p_id: String(req.id || '') });
  }
  if (!d || !d.ok) throw new Error((d && d.error) || 'Data pendaftaran tidak ditemukan.');
  const pdf = buktiPdf(d.pendaftar, d.berkas, pengaturanPublik());
  return { ok: true, nama: pdf.getName(), pdf: pdfDataURL(pdf) };
}

function pdfDataURL(pdf) {
  return pdf ? 'data:application/pdf;base64,' + Utilities.base64Encode(pdf.getBytes()) : null;
}


/* =====================================================================
   4. LIHAT BERKAS PENDAFTAR (Admin/Superadmin)
   ===================================================================== */
function lihat(req) {
  const peran = periksaPeran(req.token);
  if (['superadmin', 'admin'].indexOf(peran) < 0) throw new Error('Akun Anda tidak berhak melihat berkas pendaftar.');
  let file;
  try { file = DriveApp.getFileById(String(req.id || '')); } catch (e) { throw new Error('Berkas tidak ditemukan di Google Drive.'); }
  if (!berada(file, folderPendaftar().getId())) throw new Error('Berkas ini bukan berkas pendaftar.');
  if (file.getSize() > 10 * 1024 * 1024) throw new Error('Berkas terlalu besar untuk dipratinjau. Buka langsung di Google Drive.');
  const blob = file.getBlob();
  return { ok: true, nama: file.getName(), mime: blob.getContentType(), ukuran: file.getSize(),
           data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}


/* =====================================================================
   HAPUS (dipindah ke Sampah Drive, dapat dipulihkan 30 hari)
   ===================================================================== */
function hapus(req) {
  const k = KEPERLUAN[req.keperluan || 'konten'];
  if (!k) throw new Error('Keperluan tidak dikenal.');
  const peran = periksaPeran(req.token);
  if (k.peranHapus.indexOf(peran) < 0) throw new Error('Akun Anda tidak berhak menghapus berkas ini.');
  const ids = [].concat(req.ids || req.id || []);
  let jumlah = 0;
  const target = (k.folder === FOLDER_PENDAFTAR ? folderPendaftar() : subfolder(folderInduk(), k.folder)).getId();
  ids.slice(0, 200).forEach(function (fid) {
    try {
      const file = DriveApp.getFileById(String(fid));
      if (berada(file, target)) { file.setTrashed(true); jumlah++; }
    } catch (e) { /* sudah terhapus atau tidak ada */ }
  });
  if (!jumlah && ids.length === 1) throw new Error('Berkas tidak ditemukan atau berada di luar folder ' + k.folder + '.');
  return { ok: true, jumlah: jumlah, id: req.id };
}


/* =====================================================================
   SUPABASE
   ===================================================================== */
function periksaPeran(token) {
  if (!token) throw new Error('Sesi masuk tidak ditemukan. Silakan masuk kembali ke dashboard.');
  const res = UrlFetchApp.fetch(PENGATURAN.SUPABASE_URL + '/rest/v1/rpc/peran_saya', {
    method: 'post', contentType: 'application/json', payload: '{}',
    headers: { apikey: PENGATURAN.SUPABASE_KEY, Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Sesi masuk tidak sah atau sudah berakhir. Silakan masuk kembali.');
  const peran = JSON.parse(res.getContentText() || 'null');
  if (!peran) throw new Error('Akun Anda tidak aktif.');
  return peran;
}

// Panggil fungsi Supabase dengan sesi panitia yang sedang masuk
function rpcSesi(token, nama, args) {
  const res = UrlFetchApp.fetch(PENGATURAN.SUPABASE_URL + '/rest/v1/rpc/' + nama, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(args || {}),
    headers: { apikey: PENGATURAN.SUPABASE_KEY, Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  let j = null; try { j = JSON.parse(res.getContentText() || 'null'); } catch (e) {}
  if (res.getResponseCode() >= 300) throw new Error((j && j.message) || 'Supabase menolak permintaan (' + res.getResponseCode() + ').');
  return j;
}

// Panggil fungsi Supabase sebagai pengunjung (kunci publik saja)
function rpc(nama, args) {
  const res = UrlFetchApp.fetch(PENGATURAN.SUPABASE_URL + '/rest/v1/rpc/' + nama, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(args || {}),
    headers: { apikey: PENGATURAN.SUPABASE_KEY }, muteHttpExceptions: true
  });
  const teks = res.getContentText();
  let j = null; try { j = JSON.parse(teks || 'null'); } catch (e) {}
  if (res.getResponseCode() >= 300) throw new Error((j && j.message) || 'Layanan database tidak menjawab (kode ' + res.getResponseCode() + ').');
  return j;
}

function ambil(jalur) {
  const res = UrlFetchApp.fetch(PENGATURAN.SUPABASE_URL + '/rest/v1/' + jalur, { headers: { apikey: PENGATURAN.SUPABASE_KEY }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return [];
  return JSON.parse(res.getContentText() || '[]');
}

function pengaturanPublik() {
  const hasil = {};
  ambil('pengaturan?select=kunci,nilai&publik=eq.true').forEach(function (r) { hasil[r.kunci] = r.nilai; });
  return hasil;
}

function kontakPanitia(bagian) {
  const semua = ambil('konten_situs?select=judul,data&jenis=eq.kontak_panitia&tampil=eq.true&diarsipkan_pada=is.null&order=urutan');
  const cocok = semua.filter(function (k) {
    const b = String((k.data && k.data.bagian) || 'Umum').toLowerCase();
    return b === 'umum' || b === bagian;
  });
  return cocok.slice(0, 3).map(function (k) { return { nama: k.judul, wa: String((k.data && k.data.no_wa) || '').replace(/\D/g, '') }; })
              .filter(function (k) { return k.wa; });
}


/* =====================================================================
   PENJAGA SUPABASE (Fase 3 · Langkah 0)
   ===================================================================== */
function jagaSupabase() {
  const res = UrlFetchApp.fetch(
    PENGATURAN.SUPABASE_URL + '/rest/v1/pengaturan?select=kunci&kunci=eq.identitas',
    { headers: { apikey: PENGATURAN.SUPABASE_KEY }, muteHttpExceptions: true }
  );
  const kode = res.getResponseCode();
  Logger.log('Penjaga Supabase ' + sekarang() + ': kode ' + kode);
  if (kode !== 200) throw new Error('Supabase tidak menjawab normal (kode ' + kode + '). Periksa dashboard Supabase.');
}

// JALANKAN SEKALI dari editor: memasang jadwal harian pukul 06.00-07.00 WITA
function pasangPenjaga() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'jagaSupabase'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('jagaSupabase').timeBased().everyDays(1).atHour(6).inTimezone(PENGATURAN.ZONA_WAKTU).create();
  jagaSupabase();
  Logger.log('SIAP. Penjaga Supabase berjalan setiap hari pukul 06.00-07.00 WITA.');
}


/* =====================================================================
   BANTUAN
   ===================================================================== */
function folderInduk() { return DriveApp.getFolderById(PENGATURAN.FOLDER_INDUK); }
function folderPendaftar() { return subfolder(folderInduk(), FOLDER_PENDAFTAR); }

// Pembuatan folder dijalankan bergiliran agar unggahan bersamaan tidak membuat folder kembar
function denganKunci(fn) {
  const kunci = LockService.getScriptLock();
  kunci.waitLock(30000);
  try { return fn(); } finally { kunci.releaseLock(); }
}

function subfolder(induk, nama) {
  const it = induk.getFoldersByName(nama);
  return it.hasNext() ? it.next() : induk.createFolder(nama);
}

// Folder santri yang namanya diawali nomor registrasi
function folderSantri(no) {
  const induk = folderPendaftar();
  const it = induk.getFolders();
  while (it.hasNext()) {
    const kel = it.next();
    const isi = kel.getFolders();
    while (isi.hasNext()) {
      const f = isi.next();
      if (f.getName().indexOf(no + ' - ') === 0 || f.getName() === no) return f;
    }
  }
  return null;
}

function bacaBerkas(req, izin, maksGambarMB, maksPdfMB) {
  const mime = String(req.mime || '').toLowerCase();
  if (izin.indexOf(mime) < 0) throw new Error(izin.indexOf(MIME_DOCX) >= 0 ? 'Jenis berkas tidak diizinkan. Gunakan PDF, JPG, PNG, WEBP, Word, Excel, atau PowerPoint.' : 'Jenis berkas tidak diizinkan. Gunakan JPG, PNG, WEBP, atau PDF.');
  const isi = String(req.data || '').replace(/^data:[^,]*,/, '');
  const bytes = Utilities.base64Decode(isi);
  if (!bytes.length) throw new Error('Berkas kosong atau rusak.');
  const maks = mime === 'application/pdf' ? maksPdfMB : maksGambarMB;
  if (bytes.length > maks * 1024 * 1024) throw new Error('Ukuran berkas melebihi ' + maks + ' MB.');
  if (mime === 'application/pdf' && Utilities.newBlob(bytes.slice(0, 5)).getDataAsString() !== '%PDF-') throw new Error('Berkas PDF rusak atau bukan PDF.');
  if ([MIME_DOCX, MIME_XLSX, MIME_PPTX].indexOf(mime) >= 0 && Utilities.newBlob(bytes.slice(0, 2)).getDataAsString() !== 'PK') throw new Error('Berkas Office rusak atau bukan berkas Word/Excel/PowerPoint asli.');
  return { mime: mime, bytes: bytes };
}

// apakah file berada (langsung atau bertingkat) di dalam folder target
function berada(file, targetId) {
  const antre = [];
  const p = file.getParents();
  while (p.hasNext()) antre.push(p.next());
  for (let i = 0; i < antre.length && i < 20; i++) {
    const f = antre[i];
    if (f.getId() === targetId) return true;
    const atas = f.getParents();
    while (atas.hasNext()) antre.push(atas.next());
  }
  return false;
}

function bersihkan(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9.\-]+/g, '-').replace(/-+/g, '-').replace(/-\./g, '.').replace(/^-|-$/g, '').slice(0, 80) || 'berkas';
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function cap() { return Utilities.formatDate(new Date(), PENGATURAN.ZONA_WAKTU, 'yyyyMMdd-HHmmss'); }
function sekarang() { return Utilities.formatDate(new Date(), PENGATURAN.ZONA_WAKTU, 'dd/MM/yyyy HH.mm'); }
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function tglPanjang(s) {
  if (!s) return '-';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00+08:00') : new Date(s);
  const t = Utilities.formatDate(d, PENGATURAN.ZONA_WAKTU, 'd-M-yyyy').split('-');
  return t[0] + ' ' + BULAN[+t[1] - 1] + ' ' + t[2];
}
function tglJam(s) { return s ? Utilities.formatDate(new Date(s), PENGATURAN.ZONA_WAKTU, 'dd/MM/yyyy HH.mm') : '-'; }

function jawab(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


/* =====================================================================
   JALANKAN SEKALI dari editor (pilih "siapkan" lalu klik Jalankan)
   untuk memberi izin akses Drive, Dokumen, Email, dan internet,
   serta memeriksa folder.
   ===================================================================== */
function siapkan() {
  const induk = folderInduk();
  Logger.log('Folder induk: ' + induk.getName());

  const konten = subfolder(induk, KEPERLUAN.konten.folder);
  Logger.log('Folder konten: ' + konten.getName());
  Logger.log('Folder unduhan: ' + subfolder(induk, KEPERLUAN.unduhan.folder).getName());
  const pend = folderPendaftar();
  subfolder(pend, '_Draf'); subfolder(pend, '_Uji Coba');
  Logger.log('Folder pendaftar: ' + pend.getName() + ' (berisi _Draf dan _Uji Coba)');

  // uji membuat berkas lalu membuangnya
  const uji = konten.createFile('uji-jembatan.txt', 'Uji Jembatan Unggah ' + sekarang());
  uji.setTrashed(true);
  Logger.log('Uji buat berkas Drive: berhasil');

  // uji Google Dokumen -> PDF (untuk Bukti Pendaftaran)
  const doc = DocumentApp.create('uji-bukti');
  doc.getBody().appendParagraph('Uji');
  doc.saveAndClose();
  const f = DriveApp.getFileById(doc.getId());
  const pdf = f.getAs('application/pdf');
  f.setTrashed(true);
  Logger.log('Uji buat PDF: berhasil (' + pdf.getBytes().length + ' bita)');

  Logger.log('Sisa kuota email hari ini: ' + MailApp.getRemainingDailyQuota());

  const res = UrlFetchApp.fetch(PENGATURAN.SUPABASE_URL + '/rest/v1/rpc/cek_token_unggah', {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ p_token: '00000000-0000-0000-0000-000000000000' }),
    headers: { apikey: PENGATURAN.SUPABASE_KEY }, muteHttpExceptions: true
  });
  Logger.log('Uji koneksi Supabase (fungsi Fase 3): kode ' + res.getResponseCode() + (res.getResponseCode() === 200 ? ' (terhubung)' : ' — jalankan SQL 04 dan 05 dulu'));
  Logger.log('SIAP. Lanjutkan ke Terapkan > Kelola deployment > Edit > Versi baru.');
}
