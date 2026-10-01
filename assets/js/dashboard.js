/* =====================================================================
   DASHBOARD PANITIA SPMB (Fase 4)
   Menu: Beranda, Notifikasi, Pendaftar, Seleksi, Penilaian, Konten Situs, Pengaturan SPMB, Pengguna, Pengaturan, Log Aktivitas, Profil
   Halaman Konten Situs ada di berkas konten.js, Pengaturan SPMB di spmb.js, Pendaftar di pendaftar.js, Seleksi dan Penilaian di seleksi.js
   ===================================================================== */
(function () {
  'use strict';
  const { sb, CFG, fmt, esc, inisial, toast, dialog, konfirmasi, pesanGalat,
          muatPengaturan, logoPondok, pasangLogo, kopHTML, cetakDokumen, themeSegHTML } = window.SPMB;
  const $ = (s, r = document) => r.querySelector(s);
  const UI = window.SPMB_UI;              // komponen dari konten.js (unggah gambar, urutan)

  const NAMA_PERAN = { superadmin: 'Superadmin', admin: 'Admin', penguji: 'Penguji' };
  const TONE_PERAN = { superadmin: 'var(--c7)', admin: 'var(--c1)', penguji: 'var(--c5)' };
  // Nama bidang tes dari Pengaturan > seleksi.bidang (bisa 2–8 bidang)
  const NB = () => { const b = S.pengaturan?.seleksi?.bidang;
    return Array.isArray(b) && b.length ? Object.fromEntries(b.map(x => [x.kunci, x.label || x.kunci])) : { tahfizh: 'Tahfizh', tertulis: 'Tes Tertulis', wawancara: 'Wawancara' }; };
  const namaBidang = k => NB()[k] || String(k).replace(/_/g, ' ');
  const IKON_NOTIF = {
    info: ['ph-info', 'var(--c1)'], sukses: ['ph-check-circle', 'var(--ok)'],
    peringatan: ['ph-warning', 'var(--c6)'], penting: ['ph-siren', 'var(--c7)']
  };

  /* ---------- Daftar menu ---------- */
  const MENU = [
    { id: 'beranda',    label: 'Beranda',       ikon: 'ph-squares-four',            tone: 'var(--c1)', peran: ['superadmin', 'admin', 'penguji'], sub: 'Ringkasan dan statistik langsung' },
    { id: 'notifikasi', label: 'Notifikasi',    ikon: 'ph-bell-ringing',            tone: 'var(--c3)', peran: ['superadmin', 'admin', 'penguji'], sub: 'Pemberitahuan untuk akun Anda' },
    { id: 'pendaftar',  label: 'Pendaftar',     ikon: 'ph-identification-card',     tone: 'var(--c4)', peran: ['superadmin', 'admin'], sub: 'Data calon santri, verifikasi berkas dan pembayaran' },
    { id: 'seleksi',    label: 'Seleksi',       ikon: 'ph-exam',                    tone: 'var(--c2)', peran: ['superadmin', 'admin'], sub: 'Sesi tes, penguji, kartu peserta, dan validasi nilai' },
    { id: 'pengumuman', label: 'Pengumuman',    ikon: 'ph-megaphone',               tone: 'var(--c6)', peran: ['superadmin', 'admin'], sub: 'Penerbitan hasil seleksi, Surat Keterangan Lulus, dan WhatsApp hasil' },
    { id: 'daftarulang', label: 'Daftar Ulang', ikon: 'ph-clipboard-text',         tone: 'var(--c5)', peran: ['superadmin', 'admin'], sub: 'Verifikasi daftar ulang, kuitansi, dan rekap santri baru' },
    { id: 'keuangan',   label: 'Keuangan',      ikon: 'ph-wallet',                  tone: 'var(--ok)', peran: ['superadmin', 'admin'], sub: 'Tagihan, keringanan, pembayaran masuk, dan laporan keuangan' },
    { id: 'unduhan',    label: 'Unduhan',       ikon: 'ph-download-simple',         tone: 'var(--c2)', peran: ['superadmin', 'admin'], sub: 'Brosur, panduan, formulir, dan dokumen untuk calon santri' },
    { id: 'penilaian',  label: 'Penilaian',     ikon: 'ph-pencil-simple-line',      tone: 'var(--c5)', peran: ['superadmin', 'admin', 'penguji'], sub: 'Isi nilai peserta di sesi yang ditugaskan kepada Anda' },
    { id: 'konten',     label: 'Konten Situs',  ikon: 'ph-browsers',                tone: 'var(--c7)', peran: ['superadmin'], sub: 'Isi landing page, profil, berita, dan berkas' },
    { id: 'spmb',       label: 'Pengaturan SPMB', ikon: 'ph-flag-banner',          tone: 'var(--c3)', peran: ['superadmin'], sub: 'Gelombang, kuota, biaya, rekening, formulir, dan templat WhatsApp' },
    { id: 'pengguna',   label: 'Pengguna',      ikon: 'ph-users-three',             tone: 'var(--c2)', peran: ['superadmin'], sub: 'Akun Admin dan Penguji' },
    { id: 'pengaturan', label: 'Pengaturan',    ikon: 'ph-sliders-horizontal',      tone: 'var(--c5)', peran: ['superadmin'], sub: 'Identitas lembaga, kop surat, Ketua Panitia, integrasi' },
    { id: 'log',        label: 'Log Aktivitas', ikon: 'ph-clock-counter-clockwise', tone: 'var(--c6)', peran: ['superadmin'], sub: 'Riwayat perubahan penting' },
    { id: 'profil',     label: 'Profil Saya',   ikon: 'ph-user-circle',             tone: 'var(--c4)', peran: ['superadmin', 'admin', 'penguji'], sub: 'Data diri dan kata sandi' }
  ];
  // Menu fase berikutnya, ditampilkan sebagai penanda saja
  const SEGERA = [
  ];

  const S = { user: null, profil: null, pengaturan: {}, unread: 0, notifTerbaru: [], kanal: null, jamTimer: null, statTimer: null, param: '' };
  // Menu Penilaian hanya untuk akun yang ditugaskan sebagai penguji (peran apa pun)
  const bolehMenu = m => m.peran.includes(S.profil.peran) && (m.id !== 'penilaian' || S.penguji);
  async function cekPenguji() {
    const { data, error } = await sb.rpc('saya_penguji');
    if (!error) return !!data;
    // Cadangan bila SQL 15 belum dijalankan
    const { count } = await sb.from('penguji_sesi').select('sesi_id', { count: 'exact', head: true }).eq('pengguna_id', S.user.id);
    return (count || 0) > 0;
  }

  /* =================================================================
     MULAI
     ================================================================= */
  async function mulai() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return location.replace('masuk.html');
    S.user = session.user;

    const { data: profil, error } = await sb.from('profil_pengguna').select('*').eq('id', S.user.id).maybeSingle();
    if (error || !profil || !profil.aktif) {
      await sb.auth.signOut();
      alert('Akun Anda belum aktif atau telah dinonaktifkan. Hubungi Superadmin.');
      return location.replace('masuk.html');
    }
    S.profil = profil;
    S.pengaturan = await muatPengaturan().catch(() => ({}));
    S.penguji = await cekPenguji().catch(() => S.profil.peran === 'penguji');

    // Kerangka
    $('#themeSeg').innerHTML = themeSegHTML; SPMB.setTheme(SPMB.getTheme());
    pasangLogo($('#brandLogo'), logoPondok(S.pengaturan));
    SPMB.pasangFavicon(S.pengaturan.identitas?.logo);
    $('#brandNama').textContent = S.pengaturan.identitas?.nama_singkat || 'Imam Asy-Syathiby';
    $('#brandSub').textContent = 'Dashboard SPMB ' + (S.pengaturan.identitas?.tahun_ajaran || '');
    tampilkanPengguna();
    bangunMenu();
    $('#memuat').remove(); $('#app').classList.remove('hidden'); $('#bottomNav').classList.remove('hidden');

    // Interaksi kerangka
    $('#menuBtn').onclick = () => document.body.classList.add('nav-open');
    $('#scrim').onclick = () => document.body.classList.remove('nav-open');
    $('#btnKeluar').onclick = keluar;
    $('#btnLonceng').onclick = e => { e.stopPropagation(); bukaPanelNotif(); };

    await muatNotif();
    langganNotif();
    sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.replace('masuk.html'); });

    window.addEventListener('hashchange', rute);
    // Formulir pengguna di dialog: kolom bidang hanya tampil untuk Penguji
    new MutationObserver(() => {
      const r = document.querySelector('.modal #fPengguna');
      if (r && !r.dataset.siap) { r.dataset.siap = 1; aturTampilBidang(r); }
    }).observe(document.body, { childList: true });
    rute();
  }

  function tampilkanPengguna() {
    $('#uNama').textContent = S.profil.nama_lengkap || S.profil.email;
    $('#uPeran').textContent = NAMA_PERAN[S.profil.peran];
    $('#uAvatar').textContent = inisial(S.profil.nama_lengkap || S.profil.email);
  }

  async function keluar() {
    if (!(await konfirmasi('Keluar dari dashboard?', 'Anda perlu masuk kembali untuk membuka dashboard.', 'Keluar'))) return;
    await sb.auth.signOut();
    location.replace('masuk.html');
  }

  /* =================================================================
     MENU SAMPING DAN NAVIGASI BAWAH
     ================================================================= */
  function bangunMenu() {
    const utama = MENU.filter(bolehMenu);
    $('#nav').innerHTML = `
      <h5>Menu</h5>
      ${utama.map(m => `<a href="#/${m.id}" data-menu="${m.id}" style="--tone:${m.tone}">
          <span class="ni"><i class="ph-duotone ${m.ikon}"></i></span>${m.label}
          ${m.id === 'notifikasi' ? '<span class="count hidden" data-count></span>' : ''}</a>`).join('')}
      ${S.profil.peran !== 'penguji' && SEGERA.length ? `<h5>Segera hadir</h5>
      ${SEGERA.map(([l, ic, f]) => `<a aria-disabled="true" style="--tone:var(--c8);opacity:.55;cursor:default" title="Tersedia di ${f}">
          <span class="ni"><i class="ph-duotone ${ic}"></i></span>${l}<span class="pill" style="--tone:var(--c8);margin-left:auto;font-size:10.5px">${f}</span></a>`).join('')}` : ''}`;
    if (!$('#nav').dataset.siap) $('#nav').dataset.siap = 1, $('#nav').addEventListener('click', e => {
      if (e.target.closest('a[aria-disabled]')) e.preventDefault();
      if (e.target.closest('a[href]')) document.body.classList.remove('nav-open');
    });

    // Navigasi bawah HP: maksimal 4 menu + "Lainnya"
    const pilihan = (S.profil.peran !== 'penguji' ? ['beranda', 'pendaftar', 'notifikasi'] : S.penguji ? ['beranda', 'penilaian', 'notifikasi'] : ['beranda', 'notifikasi', 'profil'])
      .map(id => MENU.find(m => m.id === id));
    $('#bottomNav').innerHTML = pilihan.map(m => `
      <a href="#/${m.id}" data-menu="${m.id}" style="--tone:${m.tone}">
        <span class="pill-ic"><i class="ph-duotone ${m.ikon}"></i></span>${m.id === 'profil' ? 'Profil' : m.id === 'notifikasi' ? 'Notif' : m.label}
        ${m.id === 'notifikasi' ? '<span class="count hidden" data-count></span>' : ''}</a>`).join('') + `
      <button type="button" id="btnLainnya" style="--tone:var(--c8)"><span class="pill-ic"><i class="ph-duotone ph-dots-nine"></i></span>Lainnya</button>`;
    $('#btnLainnya').onclick = () => document.body.classList.add('nav-open');
  }

  function tandaiMenuAktif(id) {
    document.querySelectorAll('[data-menu]').forEach(a => a.classList.toggle('active', a.dataset.menu === id));
  }

  /* =================================================================
     RUTE HALAMAN
     ================================================================= */
  const HALAMAN = {};
  function rute() {
    const [id = 'beranda', ...sisa] = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'beranda').split('/');
    S.param = sisa.join('/');
    let m = MENU.find(x => x.id === id);
    if (!m || !bolehMenu(m)) { m = MENU[0]; S.param = ''; history.replaceState(null, '', '#/beranda'); }
    // Pindah tab di dalam halaman detail yang sama tidak perlu memuat ulang
    if (S.halamanKini === location.hash.split('?')[0] && S.param && k0()) return;
    S.halamanKini = location.hash.split('?')[0];
    clearInterval(S.jamTimer); clearInterval(S.statTimer);
    $('#pgJudul').textContent = m.label;
    $('#pgSub').textContent = m.sub;
    document.title = `${m.label} · Dashboard SPMB`;
    tandaiMenuAktif(m.id);
    setFab(null);
    window.scrollTo(0, 0);
    const k = $('#konten');
    k.innerHTML = '<div class="card"><div class="skeleton" style="height:18px;width:40%;margin-bottom:12px"></div><div class="skeleton" style="height:14px;width:80%"></div></div>';
    HALAMAN[m.id](k).catch(err => {
      k.innerHTML = `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(pesanGalat(err))}</div></div>`;
    });
  }
  const k0 = () => document.querySelector('#konten [role=tablist]');
  function setFab(aksi, ikon = 'ph-plus', label = 'Tambah') {
    const f = $('#fab');
    if (!aksi) { f.classList.add('hidden'); f.onclick = null; return; }
    f.classList.remove('hidden'); f.innerHTML = `<i class="ph-duotone ${ikon}"></i>`; f.setAttribute('aria-label', label); f.onclick = aksi;
  }

  /* =================================================================
     BERANDA
     ================================================================= */
  // Aksi cepat Beranda, dikelompokkan menurut tahap kerja panitia
  function aksiCepatHTML(isAdmin, isSuper) {
    const t = (href, ic, tone, label, sub = '', baru = false) => `<a class="ac-item" href="${href}"${baru ? ' target="_blank" rel="noopener"' : ''} style="--tone:${tone}">
      <span class="ic-box"><i class="ph-duotone ${ic}"></i></span><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></a>`;
    const grup = [];
    if (isAdmin) {
      grup.push(['Pendaftaran', 'ph-identification-card', [
        t('#/pendaftar', 'ph-list-checks', 'var(--c4)', 'Data pendaftar', 'Verifikasi berkas dan pembayaran'),
        t('daftar.html', 'ph-user-plus', 'var(--c2)', 'Input pendaftar', 'Bantu calon santri mendaftar', true),
        t('#/pendaftar?wa=1', 'ph-whatsapp-logo', 'var(--ok)', 'WhatsApp beruntun', 'Kabari banyak wali sekaligus')]]);
      grup.push(['Seleksi dan pengumuman', 'ph-exam', [
        t('#/seleksi', 'ph-calendar-check', 'var(--c2)', 'Sesi tes', 'Jadwal, peserta, penguji, grup WA'),
        t('#/seleksi?tab=nilai', 'ph-seal-check', 'var(--c6)', 'Validasi nilai', 'Setujui atau kembalikan nilai'),
        t('#/seleksi?tab=peringkat', 'ph-ranking', 'var(--c3)', 'Peringkat dan keputusan', 'Lulus, cadangan, tidak lulus'),
        t('#/pengumuman', 'ph-megaphone', 'var(--c7)', 'Pengumuman', 'Penerbitan hasil dan SKL')]]);
      grup.push(['Daftar ulang dan keuangan', 'ph-wallet', [
        t('#/daftarulang', 'ph-clipboard-text', 'var(--c5)', 'Daftar ulang', 'Verifikasi dan kuitansi'),
        t('#/keuangan?tab=tagihan', 'ph-receipt', 'var(--c1)', 'Tagihan santri', 'Catat pembayaran, keringanan'),
        t('#/keuangan', 'ph-chart-pie-slice', 'var(--ok)', 'Laporan keuangan', 'Dana masuk dan sisa tagihan'),
        t('presentasi.html', 'ph-presentation-chart', 'var(--c7)', 'Presentasi', 'Laporan perkembangan otomatis', true)]]);
    }
    if (S.penguji) grup.push(['Penilaian', 'ph-pencil-simple-line', [t('#/penilaian', 'ph-pencil-simple-line', 'var(--c5)', 'Isi nilai', 'Peserta sesi yang Anda uji')]]);
    if (isSuper) grup.push(['Situs dan pengaturan', 'ph-sliders-horizontal', [
      t('#/konten', 'ph-browsers', 'var(--c7)', 'Konten situs', 'Beranda, profil, galeri'),
      t('#/konten?m=berita', 'ph-pencil-line', 'var(--c3)', 'Tulis berita'),
      t('#/unduhan', 'ph-download-simple', 'var(--c2)', 'Unduhan', 'Brosur dan formulir'),
      t('#/spmb?tab=gelombang', 'ph-flag-banner', 'var(--c2)', 'Gelombang dan kuota'),
      t('#/spmb?tab=wa', 'ph-chat-circle-text', 'var(--ok)', 'Templat WhatsApp', 'Pesan, grup, pertemuan'),
      t('#/pengguna', 'ph-users-three', 'var(--c4)', 'Pengguna', 'Akun Admin dan Penguji'),
      t('#/pengaturan', 'ph-gear-six', 'var(--c5)', 'Pengaturan', 'Identitas, kop, integrasi'),
      t('#/log', 'ph-clock-counter-clockwise', 'var(--c6)', 'Log aktivitas')]]);
    else if (isAdmin) grup.push(['Lainnya', 'ph-dots-nine', [t('#/unduhan', 'ph-download-simple', 'var(--c2)', 'Unduhan', 'Brosur dan formulir')]]);
    grup.push(['Akun', 'ph-user-circle', [
      t('#/notifikasi', 'ph-bell-ringing', 'var(--c3)', 'Notifikasi'),
      t('#/profil', 'ph-key', 'var(--c4)', 'Profil dan kata sandi'),
      t('index.html', 'ph-globe', 'var(--c1)', 'Lihat situs publik', '', true)]]);
    return `<div class="ac-grup">${grup.map(([judul, ic, isi]) => `<section><h4><i class="ph-duotone ${ic}"></i>${judul}</h4><div class="ac-kisi">${isi.join('')}</div></section>`).join('')}</div>`;
  }

  HALAMAN.beranda = async k => {
    const p = S.profil;
    const jam = new Date().getHours();
    const salam = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
    const isSuper = p.peran === 'superadmin', isAdmin = p.peran !== 'penguji';

    k.innerHTML = `
      <div class="welcome">
        <h2>${salam}, ${esc((p.nama_lengkap || '').split(' ')[0] || NAMA_PERAN[p.peran])}</h2>
        <p>Anda masuk sebagai <b>${NAMA_PERAN[p.peran]}</b>${p.peran === 'penguji' && p.bidang_penguji?.length ? ` · Bidang ${p.bidang_penguji.map(b => namaBidang(b)).join(', ')}` : ''}.</p>
        <div class="clock"><span><i class="ph-duotone ph-calendar-blank"></i><span id="hariIni">${fmt.hariTgl()}</span></span>
          <span><i class="ph-duotone ph-clock"></i><span id="jamKini">${fmt.jam(new Date())}</span> WITA</span></div>
      </div>
      ${isAdmin ? `<div class="bilah-stat"><b><i class="ph-duotone ph-chart-line-up" style="color:var(--c5)"></i>Statistik pendaftar</b><div class="spacer"></div>
        <select class="select" id="statGel" aria-label="Gelombang"><option value="">Semua gelombang</option></select>
        <label class="check uji-saklar"><input type="checkbox" id="statUji">Data uji</label></div>` : ''}
      <div class="stats${isAdmin ? ' stats-pendaftar' : ''}" id="stats"></div>
      ${isAdmin ? '<div class="bilah-stat"><b><i class="ph-duotone ph-exam" style="color:var(--c2)"></i>Seleksi</b></div><div class="stats stats-pendaftar" id="statsSeleksi"></div>' : ''}
      <div id="sesiSaya"></div>
      ${isAdmin ? '<div class="grafik-kisi" id="grafik"></div>' : ''}
      ${isSuper ? '<div id="lengkapi"></div>' : ''}
      <div class="card aksi-cepat">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-lightning"></i></div><div><h3>Aksi cepat</h3><p>Pintasan pekerjaan panitia sesuai peran Anda</p></div></div>
        ${aksiCepatHTML(isAdmin, isSuper)}
      </div>`;

    // Jam berjalan (mengikuti jam perangkat)
    S.jamTimer = setInterval(() => {
      const j = $('#jamKini'); if (!j) return;
      j.textContent = fmt.jam(new Date()); $('#hariIni').textContent = fmt.hariTgl();
    }, 15000);

    // Statistik langsung
    const G = SPMB.grafik;
    const kartuStat = (kartu, tautan) => kartu.map(([l, n, ic, t, h]) => `
        <${h ? `a href="${h}"` : 'div'} class="stat" style="--tone:${t}"><span class="live">LIVE</span>
          <div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b>${fmt.angka(n)}</b><span>${l}</span></${h ? 'a' : 'div'}>`).join('');
    if (isAdmin) {
      const { data: gels } = await sb.from('gelombang').select('*').is('diarsipkan_pada', null).order('urutan');
      const ta = S.pengaturan.identitas?.tahun_ajaran;
      const daftarGel = (gels || []).filter(g => !g.tahun_ajaran || !ta || g.tahun_ajaran === ta);
      $('#statGel').innerHTML += daftarGel.map(g => `<option value="${g.id}">${esc(g.nama)}${g.uji ? ' (uji coba)' : ''}</option>`).join('');
      $('#statGel').onchange = () => { const g = daftarGel.find(x => String(x.id) === $('#statGel').value); if (g) $('#statUji').checked = !!g.uji; muatStat(); };
      $('#statUji').onchange = () => muatStat();
    }
    const muatStat = async () => {
      const el = $('#stats'); if (!el) return;
      if (!isAdmin) {
        const { data: t } = await sb.rpc('statistik_penguji');
        if (!$('#stats')) return;
        el.classList.add('stats-seleksi');
        const hp = S.penguji ? '#/penilaian' : '';
        if (!S.penguji && !$('#belumTugas')) el.insertAdjacentHTML('beforebegin', `<div class="note info" id="belumTugas"><i class="ph-duotone ph-info"></i><div>Anda belum ditugaskan sebagai penguji pada sesi tes tahun ajaran ini. Menu <b>Penilaian</b> akan muncul otomatis setelah Admin menugaskan Anda.</div></div>`);
        el.innerHTML = kartuStat([
          ['Sesi tes ditugaskan', t?.sesi || 0, 'ph-calendar-check', 'var(--c2)', hp],
          ['Sesi hari ini', t?.sesi_hari_ini || 0, 'ph-lightning', 'var(--c7)', hp],
          [`Nilai terisi dari ${fmt.angka(t?.tugas_nilai || 0)}`, t?.sudah_dinilai || 0, 'ph-pencil-simple-line', 'var(--c5)', hp],
          ['Dikembalikan Admin', t?.dikembalikan || 0, 'ph-arrow-u-up-left', 'var(--c3)', hp],
          ['Notifikasi belum dibaca', S.unread, 'ph-bell-ringing', 'var(--c1)', '#/notifikasi']]);
        return;
      }
      const gel = $('#statGel').value, uji = $('#statUji').checked;
      const { data: d, error } = await sb.rpc('statistik_dashboard', { p_gelombang: gel ? +gel : null, p_uji: uji });
      if (error || !d || !$('#stats')) return;
      const q = x => `#/pendaftar?st=${encodeURIComponent(x)}${uji ? '&uji=1' : ''}${gel ? '&gel=' + gel : ''}`;
      el.innerHTML = kartuStat([
        ['Total pendaftar', d.total, 'ph-users-three', 'var(--c1)', q('')],
        ['Mendaftar hari ini', d.hari_ini, 'ph-calendar-plus', 'var(--c2)', q('@hari')],
        ['Menunggu cek berkas', d.menunggu_berkas, 'ph-file-magnifying-glass', 'var(--c6)', q('@berkas')],
        ['Menunggu cek bayar', d.menunggu_bayar, 'ph-receipt', 'var(--c3)', q('@bayar')],
        ['Berkas kurang', d.berkas_kurang, 'ph-file-x', 'var(--c7)', q('berkas_kurang')],
        ['Terverifikasi lengkap', d.terverifikasi, 'ph-seal-check', 'var(--ok)', q('pembayaran_dikonfirmasi')]]);
      const qs = t => `#/seleksi?tab=${t}`;
      if ($('#statsSeleksi')) $('#statsSeleksi').innerHTML = kartuStat([
        ['Dijadwalkan tes', d.terjadwal || 0, 'ph-calendar-check', 'var(--c2)', qs('sesi')],
        ['Sudah dinilai', d.sudah_tes || 0, 'ph-exam', 'var(--c5)', qs('nilai')],
        ['Nilai menunggu validasi', d.nilai_menunggu || 0, 'ph-hourglass-medium', 'var(--c6)', qs('nilai')],
        ['Nilai lengkap', d.nilai_lengkap || 0, 'ph-list-checks', 'var(--c1)', qs('nilai')],
        ['Lulus', d.lulus || 0, 'ph-confetti', 'var(--ok)', q('lulus')],
        ['Cadangan', d.cadangan || 0, 'ph-hourglass-medium', 'var(--c3)', q('cadangan')]]);
      // Grafik
      const harian = (d.harian || []).map(h => ({ label: fmt.tgl(new Date(String(h.tanggal).slice(0, 10) + 'T00:00:00')).slice(0, 5), nilai: h.jumlah, tip: `${fmt.tglPanjang(new Date(String(h.tanggal).slice(0, 10) + 'T00:00:00'))}: ${fmt.angka(h.jumlah)} pendaftar` }));
      const jb = ['SMP', 'SMA'].map(j => ['putra', 'putri'].map(b => ({ j, b, n: (d.per_jenjang || []).find(x => x.jenjang === j && x.bagian === b)?.jumlah || 0 })));
      const maksJB = Math.max(1, ...jb.flat().map(x => x.n));
      const kuota = (d.kuota || []).filter(k => k.kuota != null);
      const kartu = (ic, t, judul, sub, isi, lebar) => `<div class="card grafik-kartu${lebar ? ' lebar' : ''}"><div class="card-head"><div class="ic-box" style="--tone:${t}"><i class="ph-duotone ${ic}"></i></div><div><h3>${judul}</h3><p>${sub}</p></div></div>${isi}</div>`;
      $('#grafik').innerHTML =
        kartu('ph-chart-bar', 'var(--c5)', 'Pendaftar 30 hari terakhir', `Total ${fmt.angka(harian.reduce((a, x) => a + x.nilai, 0))} pendaftar dalam 30 hari`,
          G.batang(harian) + G.tabel(['Tanggal', 'Pendaftar'], (d.harian || []).map(h => [fmt.tgl(new Date(String(h.tanggal).slice(0, 10) + 'T00:00:00')), h.jumlah])), true) +
        kartu('ph-gender-intersex', 'var(--c4)', 'Jenjang dan putra/putri', 'Jumlah pendaftar per kelompok',
          `<div class="gr-legenda"><span><i style="--c:var(--gr-putra)"></i>Putra</span><span><i style="--c:var(--gr-putri)"></i>Putri</span></div>
           <div class="gr-kelompok">${jb.map(grp => `<div class="gr-grup"><div class="gr-pasang">${grp.map(x => `<div class="gr-kolom" tabindex="0" data-tip="${x.j} ${x.b === 'putra' ? 'Putra' : 'Putri'}: ${fmt.angka(x.n)} pendaftar">
             <b>${fmt.angka(x.n)}</b><i style="height:${x.n ? Math.max(3, x.n / maksJB * 100) : 0}%;background:var(--gr-${x.b})"></i></div>`).join('')}</div><span>${grp[0].j}</span></div>`).join('')}</div>` +
          G.tabel(['Kelompok', 'Putra', 'Putri'], jb.map(grp => [grp[0].j, grp[0].n, grp[1].n]))) +
        kartu('ph-gauge', 'var(--c2)', 'Keterisian kuota', kuota.length ? 'Gelombang yang masih aktif' : 'Kuota belum diatur (tanpa batas)',
          kuota.length ? `<ul class="kuota-daftar">${kuota.map(k => { const persen = Math.round(k.terisi / Math.max(1, k.kuota) * 100);
            return `<li><div><b>${esc(k.gelombang)} · ${k.jenjang} ${k.bagian === 'putra' ? 'Putra' : 'Putri'}</b><span>${fmt.angka(k.terisi)} / ${fmt.angka(k.kuota)}${persen >= 90 ? ' <i class="ph-duotone ph-warning" style="color:var(--warn)"></i> hampir penuh' : ''}</span></div>${G.kemajuan(k.terisi, k.kuota, `var(--gr-${k.bagian})`)}</li>`; }).join('')}</ul>`
            + G.tabel(['Kelompok', 'Terisi', 'Kuota'], kuota.map(k => [`${k.gelombang} ${k.jenjang} ${k.bagian}`, k.terisi, k.kuota])) : '<p class="gr-kosong">Atur kuota di Pengaturan SPMB → Gelombang.</p>') +
        kartu('ph-map-pin-area', 'var(--c1)', 'Asal kabupaten/kota', '10 terbanyak',
          G.mendatar((d.per_kabupaten || []).map(x => ({ label: x.nama, nilai: x.jumlah }))) + G.tabel(['Kabupaten/kota', 'Pendaftar'], (d.per_kabupaten || []).map(x => [x.nama, x.jumlah]))) +
        kartu('ph-globe-hemisphere-east', 'var(--c3)', 'Asal provinsi', '10 terbanyak',
          G.mendatar((d.per_provinsi || []).map(x => ({ label: x.nama, nilai: x.jumlah }))) + G.tabel(['Provinsi', 'Pendaftar'], (d.per_provinsi || []).map(x => [x.nama, x.jumlah]))) +
        kartu('ph-megaphone', 'var(--c6)', 'Sumber informasi SPMB', 'Satu pendaftar dapat memilih lebih dari satu',
          G.mendatar([...(d.per_sumber || [])].sort((a, b) => b.jumlah - a.jumlah).map(x => ({ label: x.nama, nilai: x.jumlah })), { satuan: 'pilihan' }) + G.tabel(['Sumber', 'Jumlah'], (d.per_sumber || []).map(x => [x.nama, x.jumlah])));
    };
    await muatStat();
    S.statTimer = setInterval(muatStat, 30000);

    // Sesi tes terdekat yang ditugaskan kepada akun ini
    sb.rpc('peserta_saya', { p_sesi: null }).then(({ data }) => {
      const el = $('#sesiSaya'); if (!el || !data?.length) return;
      const kini = fmt.isoTgl(), dekat = data.filter(x => x.sesi.tanggal >= kini).slice(0, 4);
      if (!dekat.length) return;
      el.innerHTML = `<div class="card" style="margin-bottom:16px"><div class="card-head"><div class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-chalkboard-teacher"></i></div>
        <div><h3>Sesi tes Anda</h3><p>Jadwal menguji yang terdekat</p></div><a class="btn sm ghost" href="#/penilaian" style="margin-left:auto">Buka Penilaian</a></div>
        <div class="quick">${dekat.map(x => `<a href="#/penilaian?sesi=${x.sesi.id}"><span class="ic-box" style="--tone:var(--c2);width:34px;height:34px;font-size:18px"><i class="ph-duotone ${x.sesi.mode === 'online' ? 'ph-video-camera' : 'ph-map-pin'}"></i></span>
          <span><b>${esc(x.sesi.nama)}</b><br><small class="muted">${fmt.tgl(new Date(x.sesi.tanggal + 'T00:00:00'))} · ${String(x.sesi.jam_mulai).slice(0, 5).replace(':', '.')} WITA · ${x.peserta.length} peserta</small></span></a>`).join('')}</div></div>`;
    });
    HALAMAN.beranda.segarkanStat = muatStat;

    // Yang perlu dilengkapi Superadmin
    if (isSuper) {
      const id = S.pengaturan.identitas || {}, kop = S.pengaturan.kop_surat || {}, kp = S.pengaturan.ketua_panitia || {};
      const hitung = q => q.then(r => r.count || 0, () => 0);
      const [jmlAdmin, jmlGel, jmlBiaya, jmlRek] = await Promise.all([
        hitung(sb.from('profil_pengguna').select('id', { count: 'exact', head: true }).eq('peran', 'admin').eq('aktif', true)),
        hitung(sb.from('gelombang').select('id', { count: 'exact', head: true }).is('diarsipkan_pada', null).not('buka', 'is', null)),
        hitung(sb.from('rincian_biaya').select('id', { count: 'exact', head: true }).is('diarsipkan_pada', null).eq('tahap', 'pendaftaran')),
        hitung(sb.from('rekening').select('id', { count: 'exact', head: true }).is('diarsipkan_pada', null))
      ]);
      const tugas = [
        [!!id.alamat && !!id.telepon, 'Lengkapi alamat dan telepon lembaga', '#/pengaturan?tab=identitas'],
        [!!id.logo, 'Unggah logo pondok (logo situs, ikon tab, dan kop surat)', '#/pengaturan?tab=identitas'],
        [(jmlAdmin || 0) > 0, 'Tambahkan akun Admin panitia', '#/pengguna'],
        [!!kp.nama, 'Tunjuk Ketua Panitia (penanda tangan dokumen)', '#/pengaturan?tab=ketua'],
        [!!kp.no_wa, 'Isi nomor WhatsApp Ketua Panitia (tombol konfirmasi pendaftar)', '#/pengaturan?tab=ketua'],
        [jmlGel > 0, 'Atur gelombang: jadwal buka–tutup pendaftaran dan kuota', '#/spmb?tab=gelombang'],
        [jmlBiaya > 0, 'Isi rincian biaya tahap Pendaftaran', '#/spmb?tab=biaya'],
        [jmlRek > 0, 'Tambahkan rekening pembayaran', '#/spmb?tab=rekening']
      ];
      const sisa = tugas.filter(t => !t[0]);
      if (sisa.length) $('#lengkapi').innerHTML = `
        <div class="card" style="margin-bottom:16px">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c7)"><i class="ph-duotone ph-list-checks"></i></div>
            <div><h3>Yang perlu dilengkapi</h3><p>${tugas.length - sisa.length} dari ${tugas.length} selesai</p></div></div>
          <div class="quick">${sisa.map(t => `<a href="${t[2]}"><i class="ph-duotone ph-circle-dashed" style="font-size:20px;color:var(--c7)"></i>${t[1]}</a>`).join('')}</div>
        </div>`;
    }
  };

  /* =================================================================
     NOTIFIKASI: lonceng, panel, halaman, dan langganan langsung
     ================================================================= */
  async function muatNotif() {
    const [{ count }, { data }] = await Promise.all([
      sb.from('notifikasi').select('id', { count: 'exact', head: true }).eq('dibaca', false),
      sb.from('notifikasi').select('*').order('dibuat_pada', { ascending: false }).limit(10)
    ]);
    S.unread = count || 0; S.notifTerbaru = data || [];
    perbaruiLencana();
  }
  function perbaruiLencana() {
    const b = $('#badge');
    b.textContent = S.unread > 99 ? '99+' : S.unread;
    b.classList.toggle('hidden', !S.unread);
    document.querySelectorAll('[data-count]').forEach(c => { c.textContent = S.unread > 99 ? '99+' : S.unread; c.classList.toggle('hidden', !S.unread); });
    $('#btnLonceng i').className = `ph-duotone ${S.unread ? 'ph-bell-ringing' : 'ph-bell'}`;
  }
  function langganNotif() {
    S.kanal = sb.channel('notif-' + S.user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifikasi', filter: `penerima_id=eq.${S.user.id}` }, async payload => {
        if (payload.eventType === 'INSERT') {
          toast(payload.new.judul, 'info');
          // Penugasan/pencabutan sesi tes: segarkan menu Penilaian
          const lama = S.penguji; S.penguji = await cekPenguji().catch(() => lama);
          if (lama !== S.penguji) { bangunMenu(); tandaiMenuAktif((location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) || 'beranda'); perbaruiLencana(); }
        }
        await muatNotif();
        if (location.hash.startsWith('#/notifikasi')) HALAMAN.notifikasi.muatDaftar?.();
        HALAMAN.beranda.segarkanStat && location.hash.match(/^#?\/?(beranda)?$/) && HALAMAN.beranda.segarkanStat();
        if (/^#\/pendaftar\/?(\?|$)/.test(location.hash)) window.SPMB_MODUL.pendaftar?.segarkan?.();
        if ($('.notif-panel')) isiPanelNotif();
      })
      .subscribe();
  }
  const itemNotif = (n, aksi = false) => {
    const [ic, tone] = IKON_NOTIF[n.jenis] || IKON_NOTIF.info;
    return `<div class="notif ${n.dibaca ? '' : 'unread'}" data-nid="${n.id}" role="button" tabindex="0">
      <div class="ic-box" style="--tone:${tone}"><i class="ph-duotone ${ic}"></i></div>
      <div class="body"><b>${esc(n.judul)}</b>${n.pesan ? `<p>${esc(n.pesan)}</p>` : ''}<time title="${fmt.tglJam(n.dibuat_pada)}">${fmt.relatif(n.dibuat_pada)}</time></div>
      ${aksi ? `<div class="acts">${!n.dibaca ? `<button class="icon-btn plain" data-baca="${n.id}" title="Tandai dibaca" aria-label="Tandai dibaca"><i class="ph-duotone ph-check"></i></button>` : ''}
        <button class="icon-btn plain" data-hapus="${n.id}" title="Hapus" aria-label="Hapus"><i class="ph-duotone ph-trash"></i></button></div>` : ''}
    </div>`;
  };
  async function bukaNotif(id) {
    const n = S.notifTerbaru.find(x => x.id == id) || (HALAMAN.notifikasi.data || []).find(x => x.id == id);
    if (n && !n.dibaca) await sb.from('notifikasi').update({ dibaca: true, dibaca_pada: new Date().toISOString() }).eq('id', id);
    await muatNotif();
    tutupPanelNotif();
    if (n?.tautan) location.hash = n.tautan.replace(/^#?/, '#');
    else if (location.hash.startsWith('#/notifikasi')) HALAMAN.notifikasi.muatDaftar?.();
  }
  function isiPanelNotif() {
    const panel = $('.notif-panel'); if (!panel) return;
    panel.querySelector('.list').innerHTML = S.notifTerbaru.length
      ? S.notifTerbaru.map(n => itemNotif(n)).join('')
      : '<div class="empty"><i class="ph-duotone ph-bell-slash"></i><b>Belum ada notifikasi</b>Pemberitahuan baru akan muncul di sini.</div>';
    panel.querySelector('header .muted').textContent = S.unread ? `${S.unread} belum dibaca` : 'Semua sudah dibaca';
  }
  function bukaPanelNotif() {
    if ($('.notif-panel')) return tutupPanelNotif();
    const panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.innerHTML = `
      <header><div style="flex:1"><b>Notifikasi</b><div class="muted" style="font-size:12px"></div></div>
        <button class="btn sm ghost" data-semua><i class="ph-duotone ph-checks"></i>Tandai semua dibaca</button>
        <button class="icon-btn plain" data-tutup aria-label="Tutup"><i class="ph-duotone ph-x"></i></button></header>
      <div class="list"></div>
      <footer><a href="#/notifikasi">Lihat semua notifikasi</a></footer>`;
    document.body.appendChild(panel);
    isiPanelNotif();
    panel.addEventListener('click', async e => {
      e.stopPropagation();
      if (e.target.closest('[data-tutup]') || e.target.closest('footer a')) return tutupPanelNotif();
      if (e.target.closest('[data-semua]')) { await sb.rpc('tandai_semua_dibaca'); await muatNotif(); return isiPanelNotif(); }
      const it = e.target.closest('[data-nid]'); if (it) bukaNotif(it.dataset.nid);
    });
    setTimeout(() => document.addEventListener('click', tutupPanelNotif, { once: true }), 0);
  }
  function tutupPanelNotif() { $('.notif-panel')?.remove(); }

  HALAMAN.notifikasi = async k => {
    let filter = 'semua';
    k.innerHTML = `
      <div class="page-head">
        <div class="tabs" style="margin:0;border:0" role="tablist">
          <button role="tab" data-f="semua" aria-selected="true"><i class="ph-duotone ph-tray"></i>Semua</button>
          <button role="tab" data-f="belum" aria-selected="false"><i class="ph-duotone ph-envelope-simple"></i>Belum dibaca</button>
          <button role="tab" data-f="sudah" aria-selected="false"><i class="ph-duotone ph-envelope-simple-open"></i>Sudah dibaca</button>
        </div>
        <div class="spacer"></div>
        ${S.profil.peran !== 'penguji' ? '<button class="btn sm ghost" id="btnUji"><i class="ph-duotone ph-paper-plane-tilt"></i>Kirim notifikasi uji</button>' : ''}
        <button class="btn sm outline" id="btnSemua"><i class="ph-duotone ph-checks"></i>Tandai semua dibaca</button>
      </div>
      <div class="card" style="padding:0;overflow:hidden" id="daftarNotif"></div>`;

    const muatDaftar = async () => {
      let q = sb.from('notifikasi').select('*').order('dibuat_pada', { ascending: false }).limit(100);
      if (filter === 'belum') q = q.eq('dibaca', false);
      if (filter === 'sudah') q = q.eq('dibaca', true);
      const { data, error } = await q; if (error) throw error;
      HALAMAN.notifikasi.data = data;
      const el = $('#daftarNotif'); if (!el) return;
      el.innerHTML = data.length ? data.map(n => itemNotif(n, true)).join('')
        : `<div class="empty"><i class="ph-duotone ph-bell-slash"></i><b>${filter === 'belum' ? 'Tidak ada notifikasi yang belum dibaca' : 'Belum ada notifikasi'}</b>Pemberitahuan baru akan muncul di sini secara langsung.</div>`;
    };
    HALAMAN.notifikasi.muatDaftar = muatDaftar;
    await muatDaftar();

    k.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
      filter = b.dataset.f; k.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-selected', String(x === b))); muatDaftar();
    });
    $('#btnSemua').onclick = async () => { await sb.rpc('tandai_semua_dibaca'); await muatNotif(); muatDaftar(); toast('Semua notifikasi ditandai dibaca.'); };
    const uji = $('#btnUji');
    if (uji) uji.onclick = async () => {
      const { error } = await sb.rpc('kirim_notifikasi_ke_pengguna', { p_penerima: S.user.id, p_judul: 'Notifikasi uji berhasil', p_pesan: `Dikirim ${fmt.tglJam(new Date())}. Klik untuk membuka Beranda.`, p_jenis: 'sukses', p_tautan: '#/beranda' });
      if (error) toast(pesanGalat(error), 'err'); else toast('Notifikasi uji dikirim.');
    };
    $('#daftarNotif').addEventListener('click', async e => {
      const baca = e.target.closest('[data-baca]'), hapus = e.target.closest('[data-hapus]');
      if (baca) { e.stopPropagation(); await sb.from('notifikasi').update({ dibaca: true, dibaca_pada: new Date().toISOString() }).eq('id', baca.dataset.baca); await muatNotif(); return muatDaftar(); }
      if (hapus) { e.stopPropagation(); await sb.from('notifikasi').delete().eq('id', hapus.dataset.hapus); await muatNotif(); toast('Notifikasi dihapus.'); return muatDaftar(); }
      const it = e.target.closest('[data-nid]'); if (it) bukaNotif(it.dataset.nid);
    });
  };

  /* =================================================================
     KONTEN SITUS (Superadmin) · isi di konten.js
     ================================================================= */
  HALAMAN.konten = k => window.SPMB_MODUL.konten(k, { S, setFab, simpanPengaturan });

  /* =================================================================
     PENGATURAN SPMB (Superadmin) · isi di spmb.js
     ================================================================= */
  HALAMAN.spmb = k => window.SPMB_MODUL.spmb(k, { S, setFab, simpanPengaturan });

  /* =================================================================
     PENDAFTAR DAN VERIFIKASI (Admin, Superadmin) · isi di pendaftar.js
     ================================================================= */
  HALAMAN.pendaftar = k => window.SPMB_MODUL.pendaftar(k, { S, setFab, param: S.param });

  /* =================================================================
     SELEKSI (Admin, Superadmin) dan PENILAIAN (semua panitia) · isi di seleksi.js
     ================================================================= */
  HALAMAN.seleksi = k => window.SPMB_MODUL.seleksi(k, { S, setFab, param: S.param });
  HALAMAN.pengumuman = k => window.SPMB_MODUL.pengumuman(k, { S, setFab, param: S.param });
  HALAMAN.daftarulang = k => window.SPMB_MODUL.daftarulang(k, { S, setFab, param: S.param });
  HALAMAN.keuangan = k => window.SPMB_MODUL.keuangan(k, { S, setFab, param: S.param });
  HALAMAN.unduhan = k => window.SPMB_MODUL.unduhan(k, { S, setFab, param: S.param });
  HALAMAN.penilaian = k => window.SPMB_MODUL.penilaian(k, { S, setFab, param: S.param });

  /* =================================================================
     PENGGUNA (Superadmin)
     ================================================================= */
  async function panggilFungsiPengguna(body) {
    const { data, error } = await sb.functions.invoke(CFG.fungsiPengguna, { body });
    if (error) {
      let pesan = error.message;
      try { const j = await error.context?.json?.(); if (j?.error) pesan = j.error; } catch (e) {}
      if (/Failed to send a request|not found|404/i.test(pesan)) pesan = 'Layanan pengelola akun belum dipasang. Selesaikan Langkah 3 panduan.';
      throw new Error(pesan);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  const formPenggunaHTML = (u = {}) => `
    <form id="fPengguna" novalidate>
      <div class="grid-form">
        <div class="field full"><label>Nama lengkap (bergelar bila ada) <span class="req">*</span></label>
          <input class="input" name="nama_lengkap" value="${esc(u.nama_lengkap || '')}" required maxlength="100" placeholder="Contoh: Ahmad Fauzi, S.Pd."></div>
        <div class="field"><label>Email <span class="req">*</span></label>
          <input class="input" name="email" type="email" value="${esc(u.email || '')}" ${u.id ? 'readonly' : ''} required placeholder="nama@email.com"></div>
        <div class="field"><label>Nomor WhatsApp</label>
          <input class="input" name="no_wa" inputmode="tel" value="${esc(u.no_wa || '')}" placeholder="08xxxxxxxxxx"></div>
        <div class="field"><label>Peran <span class="req">*</span></label>
          <select class="select" name="peran">${['admin', 'penguji', 'superadmin'].map(r => `<option value="${r}" ${u.peran === r ? 'selected' : ''}>${NAMA_PERAN[r]}</option>`).join('')}</select></div>
        <div class="field"><label>Bagian</label>
          <select class="select" name="bagian">${[['umum', 'Umum (putra dan putri)'], ['putra', 'Putra'], ['putri', 'Putri']].map(([v, l]) => `<option value="${v}" ${u.bagian === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field full" data-bidang><span class="label">Bidang tes (khusus Penguji)</span>
          <div class="chips-select">${Object.entries({ ...NB(), ...Object.fromEntries((u.bidang_penguji || []).filter(b => !NB()[b]).map(b => [b, namaBidang(b)])) }).map(([v, l]) => `<label><input type="checkbox" name="bidang" value="${v}" ${(u.bidang_penguji || []).includes(v) ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
        <div class="field"><label>NIY</label><input class="input" name="niy" value="${esc(u.niy || '')}" placeholder="Nomor Induk Yayasan"></div>
        ${u.id ? `<div class="field"><span class="label">Status akun</span><label class="check"><input type="checkbox" name="aktif" ${u.aktif ? 'checked' : ''}>Akun aktif (dapat masuk)</label></div>`
               : `<div class="field"><label>Kata sandi awal <span class="req">*</span></label>
                   <div class="input-wrap"><input class="input" name="sandi" type="password" autocomplete="new-password" placeholder="Minimal 8 karakter">
                   <button type="button" class="toggle-pass" aria-label="Tampilkan kata sandi"><i class="ph-duotone ph-eye"></i></button></div>
                   <small>Sampaikan kepada yang bersangkutan, lalu minta ia menggantinya.</small></div>`}
      </div>
      <div id="fErr"></div>
    </form>`;

  function bacaFormPengguna(root, baru) {
    const f = root.querySelector('#fPengguna');
    const v = n => (f.elements[n]?.value || '').trim();
    const d = {
      nama_lengkap: v('nama_lengkap'), email: v('email').toLowerCase(), no_wa: v('no_wa').replace(/[\s.-]/g, '') || null,
      peran: v('peran'), bagian: v('bagian'), niy: v('niy') || null,
      bidang_penguji: [...f.querySelectorAll('[name=bidang]:checked')].map(x => x.value)
    };
    if (!baru) d.aktif = f.elements.aktif.checked; else d.sandi = f.elements.sandi.value;
    const err = [];
    if (d.nama_lengkap.length < 3) err.push('Nama lengkap minimal 3 karakter.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) err.push('Format email belum benar.');
    if (d.no_wa && !/^(08|\+?62)\d{8,11}$/.test(d.no_wa)) err.push('Nomor WhatsApp harus diawali 08 atau 62, 10–13 digit.');
    if (d.no_wa) d.no_wa = d.no_wa.replace(/^\+?62/, '62').replace(/^0/, '62');
    if (d.peran === 'penguji' && !d.bidang_penguji.length) err.push('Pilih minimal satu bidang tes untuk Penguji.');
    if (d.peran !== 'penguji') d.bidang_penguji = [];
    if (baru && (d.sandi.length < 8 || !/[A-Za-z]/.test(d.sandi) || !/\d/.test(d.sandi))) err.push('Kata sandi awal minimal 8 karakter, berisi huruf dan angka.');
    const box = root.querySelector('#fErr');
    box.innerHTML = err.length ? `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${err.map(esc).join('<br>')}</div></div>` : '';
    return err.length ? null : d;
  }
  function aturTampilBidang(root) {
    const sel = root.querySelector('[name=peran]'), bid = root.querySelector('[data-bidang]');
    const f = () => bid.style.display = sel.value === 'penguji' ? '' : 'none';
    sel.addEventListener('change', f); f();
  }

  HALAMAN.pengguna = async k => {
    k.innerHTML = `
      <div class="page-head">
        <div class="field" style="margin:0;flex:1;min-width:200px;max-width:340px"><input class="input" id="cari" type="search" placeholder="Cari nama atau email…"></div>
        <select class="select" id="fPeran" style="width:auto"><option value="">Semua peran</option><option value="superadmin">Superadmin</option><option value="admin">Admin</option><option value="penguji">Penguji</option></select>
        <div class="spacer"></div>
        <button class="btn" id="btnTambah"><i class="ph-duotone ph-user-plus"></i>Tambah pengguna</button>
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th>Pengguna</th><th>Peran</th><th class="hide-sm">Bagian / Bidang</th><th class="hide-sm">WhatsApp</th><th class="c">Status</th><th class="c">Aksi</th>
      </tr></thead><tbody id="tbPengguna"></tbody></table></div>
      <p class="muted" style="font-size:12.5px;margin-top:10px"><i class="ph-duotone ph-info"></i> Akun yang dinonaktifkan tidak dapat masuk, tetapi datanya tetap tersimpan.
        Pengguna yang sudah tidak berperan dapat <b>dihapus</b>; nilai dan riwayat verifikasi yang pernah ia isi tetap tersimpan atas namanya.</p>`;

    let semua = [];
    const kp = () => (S.pengaturan.ketua_panitia || {}).pengguna_id;
    const render = () => {
      const q = $('#cari').value.toLowerCase(), r = $('#fPeran').value;
      const rows = semua.filter(u => (!r || u.peran === r) && (!q || (u.nama_lengkap + ' ' + u.email).toLowerCase().includes(q)));
      $('#tbPengguna').innerHTML = rows.length ? rows.map(u => `
        <tr>
          <td><div class="who"><div class="avatar" style="${u.aktif ? '' : 'filter:grayscale(1);opacity:.6'}">${esc(inisial(u.nama_lengkap || u.email))}</div>
            <div><b>${esc(u.nama_lengkap || '(tanpa nama)')}${u.id === kp() ? ' <span class="pill" style="--tone:var(--c6)"><i class="ph-duotone ph-seal-check"></i>Ketua Panitia</span>' : ''}${u.id === S.user.id ? ' <span class="pill" style="--tone:var(--c8)">Anda</span>' : ''}</b><span>${esc(u.email)}</span></div></div></td>
          <td><span class="pill" style="--tone:${TONE_PERAN[u.peran]}">${NAMA_PERAN[u.peran]}</span></td>
          <td class="hide-sm">${u.bagian === 'umum' ? 'Umum' : u.bagian === 'putra' ? 'Putra' : 'Putri'}${u.bidang_penguji?.length ? `<br><span class="muted" style="font-size:12px">${u.bidang_penguji.map(b => namaBidang(b)).join(', ')}</span>` : ''}</td>
          <td class="hide-sm">${u.no_wa ? `<a href="https://wa.me/${esc(u.no_wa)}" target="_blank" rel="noopener" style="text-decoration:none"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i> ${esc(u.no_wa)}</a>` : '<span class="muted">–</span>'}</td>
          <td class="c">${u.aktif ? '<span class="pill" style="--tone:var(--ok)">Aktif</span>' : '<span class="pill" style="--tone:var(--c8)">Nonaktif</span>'}</td>
          <td class="c" style="white-space:nowrap">
            <button class="icon-btn plain" data-ubah="${u.id}" title="Ubah" aria-label="Ubah"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></button>
            <button class="icon-btn plain" data-sandi="${u.id}" title="Atur ulang kata sandi" aria-label="Atur ulang kata sandi"><i class="ph-duotone ph-key" style="color:var(--c6)"></i></button>
            ${u.id === S.user.id ? '' : `<button class="icon-btn plain" data-hapus="${u.id}" title="Hapus pengguna" aria-label="Hapus pengguna"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>`}
          </td>
        </tr>`).join('') : '<tr><td colspan="6"><div class="empty"><i class="ph-duotone ph-users-three"></i><b>Tidak ada pengguna yang cocok</b></div></td></tr>';
    };
    const muat = async () => {
      const { data, error } = await sb.from('profil_pengguna').select('*').order('peran').order('nama_lengkap');
      if (error) throw error; semua = data; render();
    };
    await muat();
    $('#cari').oninput = render; $('#fPeran').onchange = render;

    const tambah = async () => {
      const ok = await dialog({
        judul: 'Tambah pengguna', ikon: 'ph-user-plus', tone: 'var(--c2)', isi: formPenggunaHTML({ peran: 'admin', bagian: 'umum' }),
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, {
          label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
            const d = bacaFormPengguna(root, true); if (!d) return false;
            await panggilFungsiPengguna({ aksi: 'buat', ...d });
            return true;
          }
        }]
      });
      if (ok) { toast('Pengguna berhasil ditambahkan.'); await muat(); }
    };
    $('#btnTambah').onclick = tambah;
    setFab(tambah, 'ph-user-plus', 'Tambah pengguna');

    $('#tbPengguna').addEventListener('click', async e => {
      const bU = e.target.closest('[data-ubah]'), bS = e.target.closest('[data-sandi]'), bH = e.target.closest('[data-hapus]');
      if (bH) {
        const u = semua.find(x => x.id === bH.dataset.hapus);
        const { data: r, error } = await sb.rpc('ringkasan_pengguna', { p_id: u.id });
        if (error) return toast(pesanGalat(error), 'err', 6000);
        if (r.alasan_tolak) return dialog({ judul: 'Pengguna tidak dapat dihapus', ikon: 'ph-prohibit', tone: 'var(--danger)',
          isi: `<p style="margin:0">${esc(r.alasan_tolak)}</p>`, tombol: [{ label: 'Tutup', nilai: null }] });
        const jejak = [[r.penugasan_sesi, 'penugasan sebagai penguji sesi tes (akan dilepas)'], [r.nilai_diisi, 'nilai tes yang pernah diisi (tetap tersimpan)'], [r.verifikasi, 'catatan verifikasi berkas/pembayaran (tetap tersimpan)']].filter(x => +x[0]);
        const ok = await dialog({ judul: 'Hapus pengguna', ikon: 'ph-trash', tone: 'var(--danger)',
          isi: `<p style="margin:0 0 10px">Akun <b>${esc(u.nama_lengkap || u.email)}</b> (${esc(u.email)}, ${NAMA_PERAN[u.peran]}) akan dihapus permanen dan tidak dapat masuk lagi.</p>
            ${jejak.length ? `<div class="note"><i class="ph-duotone ph-info"></i><div>Jejak kerja pengguna ini:<br>${jejak.map(([n, l]) => `• ${n} ${l}`).join('<br>')}</div></div>` : ''}
            <p class="muted" style="margin:10px 0 6px;font-size:13px">Jika hanya ingin menghentikan sementara, gunakan <b>Ubah</b> lalu hilangkan centang <i>Akun aktif</i>.</p>
            <div class="field"><label>Ketik <b>HAPUS</b> untuk menegaskan</label><input class="input" id="tegasHapus" autocomplete="off"></div><div id="fErr"></div>`,
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, { label: 'Hapus permanen', ikon: 'ph-trash', kelas: 'danger', aksi: async root => {
            if (root.querySelector('#tegasHapus').value.trim().toUpperCase() !== 'HAPUS') { root.querySelector('#fErr').innerHTML = '<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>Ketik HAPUS untuk melanjutkan.</div></div>'; return false; }
            await panggilFungsiPengguna({ aksi: 'hapus', id: u.id }); return true; } }] });
        if (ok) { toast('Pengguna dihapus.'); await muat(); }
        return;
      }
      if (bU) {
        const u = semua.find(x => x.id === bU.dataset.ubah);
        const ok = await dialog({
          judul: 'Ubah pengguna', ikon: 'ph-pencil-simple', tone: 'var(--c1)', isi: formPenggunaHTML(u),
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, {
            label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
              const d = bacaFormPengguna(root, false); if (!d) return false;
              delete d.email;
              const { error } = await sb.from('profil_pengguna').update(d).eq('id', u.id);
              if (error) throw error;
              if (u.id !== S.user.id && d.peran !== u.peran)
                await sb.rpc('kirim_notifikasi_ke_pengguna', { p_penerima: u.id, p_judul: 'Peran akun Anda diubah', p_pesan: `Peran Anda sekarang: ${NAMA_PERAN[d.peran]}.`, p_jenis: 'info', p_tautan: '#/profil' });
              return true;
            }
          }]
        });
        if (ok) {
          toast('Data pengguna disimpan.');
          if (u.id === S.user.id) { const { data } = await sb.from('profil_pengguna').select('*').eq('id', u.id).single(); S.profil = data; tampilkanPengguna(); }
          await muat();
        }
      }
      if (bS) {
        const u = semua.find(x => x.id === bS.dataset.sandi);
        const ok = await dialog({
          judul: 'Atur ulang kata sandi', ikon: 'ph-key', tone: 'var(--c6)',
          isi: `<p style="margin:0 0 12px">Buat kata sandi baru untuk <b>${esc(u.nama_lengkap || u.email)}</b>.</p>
            <div class="field"><label>Kata sandi baru <span class="req">*</span></label>
            <div class="input-wrap"><input class="input" id="sandiBaru" type="password" autocomplete="new-password" placeholder="Minimal 8 karakter, huruf dan angka">
            <button type="button" class="toggle-pass" aria-label="Tampilkan kata sandi"><i class="ph-duotone ph-eye"></i></button></div></div><div id="fErr"></div>`,
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, {
            label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
              const s = root.querySelector('#sandiBaru').value;
              if (s.length < 8 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) { root.querySelector('#fErr').innerHTML = '<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>Minimal 8 karakter, berisi huruf dan angka.</div></div>'; return false; }
              await panggilFungsiPengguna({ aksi: 'ubah_sandi', id: u.id, sandi: s });
              return true;
            }
          }]
        });
        if (ok) toast('Kata sandi berhasil diatur ulang.');
      }
    });
  };

  /* =================================================================
     PENGATURAN (Superadmin)
     ================================================================= */
  async function simpanPengaturan(kunci, nilai) {
    const { error } = await sb.from('pengaturan').update({ nilai }).eq('kunci', kunci);
    if (error) throw error;
    S.pengaturan = await muatPengaturan(true);
  }

  HALAMAN.pengaturan = async k => {
    const tabAwal = (location.hash.match(/tab=(\w+)/) || [])[1] || 'identitas';
    k.innerHTML = `
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="identitas"><i class="ph-duotone ph-buildings" style="color:var(--c1)"></i>Identitas lembaga</button>
        <button role="tab" data-tab="tahun"><i class="ph-duotone ph-calendar-star" style="color:var(--c7)"></i>Tahun ajaran</button>
        <button role="tab" data-tab="kop"><i class="ph-duotone ph-identification-card" style="color:var(--c5)"></i>Kop surat</button>
        <button role="tab" data-tab="ketua"><i class="ph-duotone ph-seal-check" style="color:var(--c6)"></i>Ketua Panitia</button>
        <button role="tab" data-tab="ttd"><i class="ph-duotone ph-signature" style="color:var(--c4)"></i>Penanda tangan</button>
        <button role="tab" data-tab="integrasi"><i class="ph-duotone ph-plugs-connected" style="color:var(--c2)"></i>Integrasi</button>
        <a class="icon-btn plain tab-presentasi" href="presentasi.html" target="_blank" rel="noopener" title="Presentasi perkembangan SPMB" aria-label="Presentasi perkembangan SPMB"><i class="ph-duotone ph-presentation-chart" style="color:var(--c7)"></i></a>
      </div>
      <div id="isiTab"></div>`;
    const buka = tab => {
      k.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      (({ identitas: tabIdentitas, tahun: tabTahunAjaran, kop: tabKop, ketua: tabKetua, ttd: tabTtd, integrasi: tabIntegrasi })[tab] || tabIdentitas)($('#isiTab'));
    };
    k.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { history.replaceState(null, '', '#/pengaturan?tab=' + b.dataset.tab); buka(b.dataset.tab); });
    buka(tabAwal);
  };

  const inp = (nama, label, nilai, attr = '', bantuan = '') => `
    <div class="field ${attr.includes('full') ? 'full' : ''}"><label for="i_${nama}">${label}</label>
      <input class="input" id="i_${nama}" name="${nama}" value="${esc(nilai || '')}" ${attr.replace('full', '')}>
      ${bantuan ? `<small>${bantuan}</small>` : ''}</div>`;

  function tabIdentitas(el) {
    const id = S.pengaturan.identitas || {}, ms = id.media_sosial || {};
    el.innerHTML = `
      <form class="card" id="fId" novalidate>
        <div class="card-head"><div class="ic-box" style="--tone:var(--c1)"><i class="ph-duotone ph-buildings"></i></div><div><h3>Identitas lembaga</h3><p>Tampil di situs, dashboard, email, dan dokumen cetak</p></div></div>
        <div class="grid-form">
          ${inp('nama_lembaga', 'Nama lembaga lengkap', id.nama_lembaga, 'full')}
          ${inp('nama_singkat', 'Nama singkat', id.nama_singkat)}
          ${inp('tagline', 'Tagline', id.tagline)}
          ${inp('npsn', 'NPSN', id.npsn, 'inputmode="numeric" maxlength="8"')}
          ${inp('nspp', 'NSPP', id.nspp, 'inputmode="numeric"')}
          ${inp('tahun_ajaran', 'Tahun ajaran SPMB', SPMB.taAktif(S.pengaturan), 'readonly', 'Diganti melalui tab <a href="#/pengaturan?tab=tahun" data-ke-tahun>Tahun ajaran</a> agar gelombang dan arsip ikut tertata.')}
          ${inp('telepon', 'Telepon / WhatsApp kantor', id.telepon, 'inputmode="tel"')}
          ${inp('email', 'Email lembaga', id.email, 'type="email"')}
          <div class="field full"><label for="i_alamat">Alamat lengkap</label><textarea class="textarea" id="i_alamat" name="alamat" style="min-height:70px">${esc(id.alamat || '')}</textarea></div>
          ${UI.inputGambar('logo', 'Logo pondok', id.logo, { bagian: 'identitas', maksSisi: 512, bantuan: 'PNG berlatar transparan, bentuk persegi. Dipakai di situs, ikon tab browser, dan kop surat (logo kanan bila kosong).' })}
          ${inp('video_profil', 'Tautan video profil YouTube', id.video_profil, 'full')}
          ${inp('peta_lokasi', 'Tautan Google Maps', id.peta_lokasi, 'full')}
        </div>
        <h4 style="font-size:14px;margin:6px 0 12px"><i class="ph-duotone ph-share-network" style="color:var(--c4)"></i> Media sosial</h4>
        <div class="grid-form">
          ${inp('youtube', '<i class="ph-duotone ph-youtube-logo" style="color:#e11d1d"></i> YouTube', ms.youtube)}
          ${inp('instagram', '<i class="ph-duotone ph-instagram-logo" style="color:#c2336b"></i> Instagram', ms.instagram)}
          ${inp('facebook', '<i class="ph-duotone ph-facebook-logo" style="color:#1877f2"></i> Facebook', ms.facebook)}
          ${inp('tiktok', '<i class="ph-duotone ph-tiktok-logo"></i> TikTok', ms.tiktok)}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan identitas</button></div>
      </form>`;
    UI.pasangPemilihGambar(el);
    $('#fId').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, v = n => f.elements[n].value.trim();
      if (v('npsn') && !/^\d{8}$/.test(v('npsn'))) return toast('NPSN harus 8 digit angka.', 'err');
      const nilai = { ...id, nama_lembaga: v('nama_lembaga'), nama_singkat: v('nama_singkat'), tagline: v('tagline'), npsn: v('npsn'), nspp: v('nspp'),
        tahun_ajaran: id.tahun_ajaran || v('tahun_ajaran'), telepon: v('telepon'), email: v('email'), alamat: v('alamat'), logo: v('logo'),
        video_profil: v('video_profil'), peta_lokasi: v('peta_lokasi'),
        media_sosial: { ...ms, youtube: v('youtube'), instagram: v('instagram'), facebook: v('facebook'), tiktok: v('tiktok') } };
      try { await simpanPengaturan('identitas', nilai); toast('Identitas lembaga disimpan.'); pasangLogo($('#brandLogo'), logoPondok(S.pengaturan)); SPMB.pasangFavicon(nilai.logo); $('#brandNama').textContent = nilai.nama_singkat; }
      catch (err) { toast(pesanGalat(err), 'err'); }
    };
  }

  /* ---------- Tahun ajaran: aktif, arsip, dan pergantian tahun (Superadmin) ---------- */
  async function tabTahunAjaran(el) {
    el.innerHTML = '<div class="card"><div class="skeleton" style="height:18px;width:40%"></div></div>';
    const { data: r, error } = await sb.rpc('ringkasan_tahun_ajaran');
    if (error) { el.innerHTML = `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(pesanGalat(error))}<br>Pastikan SQL 15 sudah dijalankan di Supabase.</div></div>`; return; }
    const aktif = r.aktif, saran = SPMB.taBerikutnya(aktif);
    const daftar = r.daftar || [];
    el.innerHTML = `
      <div class="grid-2" style="align-items:start">
        <div class="card">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c7)"><i class="ph-duotone ph-calendar-star"></i></div><div><h3>Tahun ajaran aktif</h3><p>Dipakai di situs, formulir, nomor registrasi, statistik, dan dokumen cetak</p></div></div>
          <div class="ta-besar" style="font-size:34px;font-weight:800;color:var(--c7);margin:4px 0 12px">${esc(aktif)}</div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Tahun ajaran</th><th>Gelombang</th><th>Pendaftar</th><th>Santri baru</th><th></th></tr></thead>
            <tbody>${daftar.length ? daftar.map(x => `<tr><td><b>${esc(x.tahun_ajaran)}</b></td><td>${fmt.angka(x.gelombang)}</td><td>${fmt.angka(x.pendaftar)}</td><td>${fmt.angka(x.santri_baru)}</td>
              <td>${x.tahun_ajaran === aktif ? '<span class="pill" style="--tone:var(--ok)">Aktif</span>' : '<span class="pill" style="--tone:var(--c8)">Arsip</span>'}</td></tr>`).join('')
              : '<tr><td colspan="5" class="muted">Belum ada data.</td></tr>'}</tbody></table></div>
          <p class="muted" style="font-size:13px;margin:10px 0 0">Data tahun sebelumnya tetap tersimpan dan dapat dibuka di menu <b>Pendaftar</b> (pilihan Tahun ajaran), termasuk ekspor Excel.</p>
        </div>
        <form class="card" id="fTaBaru" novalidate>
          <div class="card-head"><div class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-arrow-circle-right"></i></div><div><h3>Mulai tahun ajaran baru</h3><p>Lakukan sekali setahun, setelah SPMB ${esc(aktif)} selesai</p></div></div>
          <div class="field"><label for="taBaru">Tahun ajaran baru</label><input class="input mono" id="taBaru" value="${esc(saran)}" placeholder="${esc(saran)}" maxlength="9" inputmode="numeric" style="max-width:200px">
            <small>Format tahun/tahun, misalnya ${esc(saran)}.</small></div>
          <label class="check" style="margin:4px 0 12px"><input type="checkbox" id="taSalin" checked>Salin gelombang, kuota, dan biaya khusus gelombang ke tahun baru (tanggal digeser otomatis)</label>
          <div class="note info"><i class="ph-duotone ph-info"></i><div>Yang terjadi:
            <ul style="margin:6px 0 0;padding-left:18px">
              <li>Gelombang ${esc(aktif)} diarsipkan dan formulirnya ditutup.</li>
              <li>Nomor registrasi, SKL, dan kuitansi dimulai lagi dari 0001 untuk tahun baru.</li>
              <li>Tanggal acuan usia digeser satu tahun; mode daftar ulang kembali ke <b>Sesuai jadwal</b>.</li>
              <li>Biaya umum, rekening, formulir, templat WhatsApp, konten situs, dan akun panitia tetap dipakai.</li>
            </ul>
            Setelahnya, periksa tanggal gelombang baru di <b>Pengaturan SPMB</b> lalu buka formulirnya.</div></div>
          <div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-calendar-plus"></i>Mulai tahun ajaran baru</button></div>
        </form>
      </div>`;
    $('#fTaBaru').onsubmit = async e => {
      e.preventDefault();
      const ta = $('#taBaru').value.trim(), salin = $('#taSalin').checked;
      if (!/^\d{4}\/\d{4}$/.test(ta) || SPMB.tahunAwalTA(ta) + 1 !== +ta.slice(5)) return toast(`Tulis tahun ajaran dengan format ${saran}.`, 'err');
      if (SPMB.tahunAwalTA(ta) <= SPMB.tahunAwalTA(aktif)) return toast(`Tahun ajaran baru harus setelah ${aktif}.`, 'err');
      const ok = await dialog({ judul: 'Mulai tahun ajaran ' + ta, ikon: 'ph-calendar-star', tone: 'var(--c7)',
        isi: `<p style="margin:0 0 10px">SPMB akan berpindah dari <b>${esc(aktif)}</b> ke <b>${esc(ta)}</b>. Langkah ini tidak dapat dibatalkan dari dashboard.</p>
          <div class="field"><label for="taKetik">Ketik <b>${esc(ta)}</b> untuk melanjutkan</label><input class="input mono" id="taKetik" autocomplete="off"></div>`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, { label: 'Mulai sekarang', ikon: 'ph-check', aksi: async root => {
          if (root.querySelector('#taKetik').value.trim() !== ta) { toast('Ketik tahun ajaran persis seperti yang tertulis.', 'err'); return false; }
          const { data, error: e2 } = await sb.rpc('mulai_tahun_ajaran', { p_ta: ta, p_salin: salin }); if (e2) throw e2;
          return data;
        } }] });
      if (!ok) return;
      toast(`Tahun ajaran ${ok.baru} aktif. ${ok.diarsipkan} gelombang diarsipkan, ${ok.disalin} disalin.`, 'ok', 8000);
      S.pengaturan = await muatPengaturan(true);
      $('#brandSub').textContent = 'Dashboard SPMB ' + SPMB.taAktif(S.pengaturan);
      S.penguji = await cekPenguji().catch(() => S.penguji); bangunMenu(); tandaiMenuAktif('pengaturan');
      tabTahunAjaran(el);
    };
  }

  function tabKop(el) {
    const kop = { ...(S.pengaturan.kop_surat || {}) };
    el.innerHTML = `
      <div class="grid-2" style="align-items:start">
        <form class="card" id="fKop" novalidate>
          <div class="card-head"><div class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-identification-card"></i></div><div><h3>Kop surat</h3><p>Dipakai di semua dokumen cetak F4</p></div></div>
          <div class="field"><span class="label">Bentuk kop</span>
            <div class="chips-select">
              <label><input type="radio" name="mode" value="susun" ${kop.mode !== 'gambar' ? 'checked' : ''}>Disusun dari teks dan logo</label>
              <label><input type="radio" name="mode" value="gambar" ${kop.mode === 'gambar' ? 'checked' : ''}>Satu gambar kop utuh</label>
            </div></div>
          <div data-mode="gambar">${UI.inputGambar('gambar_kop', 'Gambar kop utuh', kop.gambar_kop, { bagian: 'kop', maksSisi: 2400, bantuan: 'Gambar mendatar selebar kertas, sudah memuat logo dan teks.' })}</div>
          <div data-mode="susun">
            ${UI.inputGambar('logo_kiri', 'Logo kiri', kop.logo_kiri, { bagian: 'kop', maksSisi: 512 })}
            ${UI.inputGambar('logo_kanan', 'Logo kanan', kop.logo_kanan, { bagian: 'kop', maksSisi: 512, bantuan: 'Kosong = logo pondok dari Identitas.' })}
            ${inp('baris_1', 'Baris 1 (instansi penaung)', kop.baris_1)}
            ${inp('baris_2', 'Baris 2 (nama lembaga)', kop.baris_2)}
            ${inp('baris_3', 'Baris 3 (lanjutan nama lembaga)', kop.baris_3)}
            ${inp('baris_info', 'Baris informasi', kop.baris_info)}
            <div class="grid-form">
              ${inp('pita_teks', 'Teks pita (alamat)', kop.pita_teks, '', 'Kosong = garis ganda biasa.')}
              <div class="field"><label>Warna pita</label><div class="color-input"><input type="color" name="pita_warna" value="${esc(kop.pita_warna || '#F8E02F')}"><span class="muted" style="font-size:13px">${esc(kop.pita_warna || '#F8E02F')}</span></div></div>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">
            <button class="btn ghost" type="button" id="btnCetakUji"><i class="ph-duotone ph-printer"></i>Cetak uji (F4)</button>
            <button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan kop surat</button>
          </div>
        </form>
        <div class="card" style="position:sticky;top:calc(var(--appbar-h) + 16px)">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-eye"></i></div><div><h3>Pratinjau</h3><p>Berubah langsung saat diketik</p></div></div>
          <div id="pratinjauKop"></div>
        </div>
      </div>`;
    const f = $('#fKop');
    UI.pasangPemilihGambar(f);
    const baca = () => {
      const v = n => f.elements[n]?.value.trim() ?? '';
      Object.assign(kop, { mode: f.querySelector('[name=mode]:checked').value, gambar_kop: v('gambar_kop'), logo_kiri: v('logo_kiri'), logo_kanan: v('logo_kanan'),
        baris_1: v('baris_1'), baris_2: v('baris_2'), baris_3: v('baris_3'), baris_info: v('baris_info'), pita_teks: v('pita_teks'), pita_warna: f.elements.pita_warna.value.toUpperCase() });
      return kop;
    };
    const segar = () => {
      baca();
      f.querySelectorAll('[data-mode]').forEach(d => d.style.display = d.dataset.mode === kop.mode ? '' : 'none');
      f.querySelector('.color-input span').textContent = kop.pita_warna;
      $('#pratinjauKop').innerHTML = kopHTML({ ...kop, logo_kanan: kop.logo_kanan || logoPondok(S.pengaturan) });
    };
    f.addEventListener('input', segar); segar();
    f.onsubmit = async e => {
      e.preventDefault();
      try { await simpanPengaturan('kop_surat', baca()); toast('Kop surat disimpan.'); } catch (err) { toast(pesanGalat(err), 'err'); }
    };
    $('#btnCetakUji').onclick = async () => {
      const kp = S.pengaturan.ketua_panitia || {};
      const cadangan = S.pengaturan.kop_surat;
      // cetak uji memakai isian yang sedang tampil, meskipun belum disimpan
      S.pengaturan.kop_surat = { ...baca(), logo_kanan: kop.logo_kanan || logoPondok(S.pengaturan) };
      await cetakDokumen({
        judul: 'Contoh Dokumen Cetak', nomor: `001/SPMB/${new Date().getFullYear()}`,
        meta: `Tahun Ajaran: ${esc(S.pengaturan.identitas?.tahun_ajaran || '')} &nbsp;·&nbsp; Tanggal: ${fmt.tglPanjang(new Date())}`,
        isi: `<table><thead><tr><th style="width:7%">No</th><th style="width:33%">Nama</th><th style="width:20%">Jenjang</th><th style="width:20%">Tanggal</th><th style="width:20%">Keterangan</th></tr></thead>
          <tbody>${[1, 2, 3].map(i => `<tr><td style="text-align:center">${i}</td><td>Contoh Nama Santri ${i}</td><td>SMP</td><td>${fmt.tgl(new Date())}</td><td>Uji cetak</td></tr>`).join('')}</tbody></table>`,
        ttd: [{ jabatan: 'Mengetahui, Pimpinan Pondok', nama: '' }, { jabatan: 'Ketua Panitia SPMB', nama: kp.nama, nip: kp.niy ? 'NIY. ' + kp.niy : '' }]
      });
      S.pengaturan.kop_surat = cadangan;
    };
  }

  async function tabKetua(el) {
    const kp = S.pengaturan.ketua_panitia || {};
    const { data: admin } = await sb.from('profil_pengguna').select('id,nama_lengkap,email,niy,no_wa').eq('peran', 'admin').eq('aktif', true).order('nama_lengkap');
    el.innerHTML = `
      <form class="card" id="fKetua" novalidate style="max-width:640px">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c6)"><i class="ph-duotone ph-seal-check"></i></div><div><h3>Ketua Panitia</h3><p>Satu-satunya penanda tangan di semua dokumen cetak</p></div></div>
        ${!admin?.length ? `<div class="note"><i class="ph-duotone ph-warning"></i><div>Belum ada akun Admin aktif. Tambahkan Admin di menu <a href="#/pengguna">Pengguna</a>, lalu kembali ke sini.</div></div>` : ''}
        <div class="field"><label for="kSel">Pilih dari akun Admin</label>
          <select class="select" id="kSel" name="pengguna_id"><option value="">— Pilih Admin —</option>
          ${(admin || []).map(a => `<option value="${a.id}" data-nama="${esc(a.nama_lengkap)}" data-niy="${esc(a.niy || '')}" data-wa="${esc(a.no_wa || '')}" ${kp.pengguna_id === a.id ? 'selected' : ''}>${esc(a.nama_lengkap || a.email)}</option>`).join('')}</select></div>
        ${inp('nama', 'Nama lengkap bergelar (seperti tertulis di dokumen)', kp.nama)}
        ${inp('niy', 'NIY', kp.niy)}
        ${inp('no_wa', 'Nomor WhatsApp Ketua Panitia', kp.no_wa ? '0' + String(kp.no_wa).replace(/^62/, '') : '', 'inputmode="tel" placeholder="08xxxxxxxxxx"', 'Dipakai tombol <b>Konfirmasi via WhatsApp</b> setelah pendaftar mengirim formulir.')}
        <div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan Ketua Panitia</button></div>
      </form>`;
    const f = $('#fKetua');
    $('#kSel').onchange = e => {
      const o = e.target.selectedOptions[0];
      if (o?.dataset.nama) { f.elements.nama.value = o.dataset.nama; if (o.dataset.niy) f.elements.niy.value = o.dataset.niy; if (o.dataset.wa) f.elements.no_wa.value = '0' + o.dataset.wa.replace(/^62/, ''); }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const nilai = { pengguna_id: f.elements.pengguna_id.value || null, nama: f.elements.nama.value.trim(), niy: f.elements.niy.value.trim(), no_wa: SPMB.nomorWA(f.elements.no_wa.value) };
      if (nilai.no_wa && !/^628\d{7,11}$/.test(nilai.no_wa)) return toast('Nomor WhatsApp Ketua Panitia diawali 08, 10–13 digit.', 'err');
      if (!nilai.pengguna_id) return toast('Pilih akun Admin terlebih dahulu.', 'err');
      if (nilai.nama.length < 3) return toast('Nama Ketua Panitia wajib diisi.', 'err');
      try {
        await simpanPengaturan('ketua_panitia', nilai);
        await sb.rpc('kirim_notifikasi_ke_pengguna', { p_penerima: nilai.pengguna_id, p_judul: 'Anda ditunjuk sebagai Ketua Panitia', p_pesan: 'Nama Anda akan tercantum sebagai penanda tangan dokumen SPMB.', p_jenis: 'penting', p_tautan: '#/profil' });
        toast('Ketua Panitia disimpan.');
      } catch (err) { toast(pesanGalat(err), 'err'); }
    };
  }

  const DOK_TTD = [
    ['kartu_tes', 'Kartu Peserta Tes'], ['rekap_nilai', 'Rekap Nilai Seleksi'], ['berita_acara', 'Berita Acara Penetapan Hasil'],
    ['sk', 'SK Penetapan Hasil Seleksi'], ['skl', 'Surat Keterangan Lulus'], ['bukti_du', 'Bukti Daftar Ulang'],
    ['kuitansi', 'Kuitansi Pembayaran'], ['rekap_pendaftar', 'Rekap Pendaftar dan Santri Baru'],
    ['profil_santri', 'Profil Santri'], ['laporan_keuangan', 'Laporan Keuangan']];
  const PILIH_TTD = [['tanpa', 'Tanpa (hanya Ketua Panitia)'], ['direktur', 'Direktur'], ['kepala_smp', 'Kepala SMP'], ['kepala_sma', 'Kepala SMA'], ['kepala_jenjang', 'Kepala sesuai jenjang santri']];
  function tabTtd(el) {
    const pt = S.pengaturan.penandatangan || {}, pej = pt.pejabat || {}, dok = pt.dokumen || {};
    const kp = S.pengaturan.ketua_panitia || {};
    const orang = (k, bawaan) => { const x = pej[k] || {}; return `
      <div class="card ttd-pejabat"><h4 class="sub-form" style="margin-top:0"><i class="ph-duotone ph-user-circle" style="color:var(--c4)"></i>${esc(bawaan)}</h4>
        ${inp(k + '_jabatan', 'Jabatan (seperti tertulis di dokumen)', x.jabatan || bawaan)}
        ${inp(k + '_nama', 'Nama lengkap bergelar', x.nama, 'placeholder="Kosong = garis titik-titik"')}
        ${inp(k + '_niy', 'NIY / NIP', x.niy)}</div>`; };
    el.innerHTML = `
      <form id="fTtd" novalidate>
        <div class="card" style="margin-bottom:14px">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c4)"><i class="ph-duotone ph-signature"></i></div><div><h3>Penanda tangan dokumen</h3>
            <p>Kolom kanan selalu Ketua Panitia (${esc(kp.nama || 'belum ditunjuk')}). Kolom kiri dipilih per jenis dokumen di bawah.</p></div></div>
          <div class="ttd-kisi">${orang('direktur', 'Direktur')}${orang('kepala_smp', 'Kepala SMP')}${orang('kepala_sma', 'Kepala SMA')}</div>
        </div>
        <div class="card">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c1)"><i class="ph-duotone ph-files"></i></div><div><h3>Kolom kiri tiap dokumen</h3><p>Kedua tanda tangan tampil sejajar di bagian bawah dokumen</p></div></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Dokumen</th><th>Penanda tangan kiri</th></tr></thead><tbody>
            ${DOK_TTD.map(([k, l]) => `<tr><td>${esc(l)}</td><td><select class="select" name="dok_${k}">${PILIH_TTD.map(([v, t]) => `<option value="${v}" ${(dok[k] || 'tanpa') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td></tr>`).join('')}
          </tbody></table></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px">
            <button class="btn ghost" type="button" id="btnUjiTtd"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Cetak contoh</button>
            <button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan penanda tangan</button></div>
        </div>
      </form>`;
    const f = $('#fTtd');
    const baca = () => ({
      pejabat: Object.fromEntries(['direktur', 'kepala_smp', 'kepala_sma'].map(k => [k, { jabatan: f.elements[k + '_jabatan'].value.trim(), nama: f.elements[k + '_nama'].value.trim(), niy: f.elements[k + '_niy'].value.trim() }])),
      dokumen: Object.fromEntries(DOK_TTD.map(([k]) => [k, f.elements['dok_' + k].value]))
    });
    f.onsubmit = async e => {
      e.preventDefault();
      const nilai = baca();
      if (Object.values(nilai.pejabat).some(x => x.jabatan.length < 3)) return toast('Jabatan pejabat wajib diisi.', 'err');
      try { await simpanPengaturan('penandatangan', { ...pt, ...nilai }); toast('Penanda tangan disimpan.'); } catch (err) { toast(pesanGalat(err), 'err'); }
    };
    $('#btnUjiTtd').onclick = () => {
      const p = { ...S.pengaturan, penandatangan: { ...pt, ...baca() } };
      cetakDokumen({ judul: 'Contoh Penanda Tangan', meta: 'Kolom kiri mengikuti pilihan untuk <b>SK Penetapan Hasil Seleksi</b>.',
        isi: '<p>Contoh isi dokumen.</p>', ttd: SPMB.penandaTangan('sk', p, 'SMP') });
    };
  }

  function tabIntegrasi(el) {
    const ig = S.pengaturan.integrasi || {};
    el.innerHTML = `
      <form class="card" id="fIntegrasi" novalidate style="max-width:760px">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c2)"><i class="ph-duotone ph-plugs-connected"></i></div>
          <div><h3>Apps Script Jembatan Unggah</h3><p>Layanan penyimpan berkas ke Google Drive pondok</p></div></div>
        <div class="field"><label for="i_gas">URL aplikasi web Apps Script</label>
          <input class="input" id="i_gas" name="apps_script_url" value="${esc(ig.apps_script_url || '')}" placeholder="${esc(CFG.appsScriptUrl || 'https://script.google.com/macros/s/…/exec')}">
          <small>Kosongkan untuk memakai alamat bawaan di config.js. Isi hanya bila Apps Script diterapkan ulang dengan alamat baru.</small></div>
        <div id="hasilPeriksa"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">
          <button class="btn ghost" type="button" id="btnPeriksa"><i class="ph-duotone ph-pulse" style="color:var(--c5)"></i>Periksa koneksi</button>
          <button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan</button>
        </div>
      </form>
      <div class="note info" style="max-width:760px;margin-top:16px"><i class="ph-duotone ph-shield-check"></i><div>Unggahan konten membawa sesi masuk Anda dan diperiksa ke Supabase oleh Apps Script. Pendaftar mengunggah berkas memakai token sekali pakai dari formulir; berkasnya tersimpan <b>privat</b> di folder Berkas Pendaftar dan hanya dapat dibuka panitia.</div></div>`;
    const f = $('#fIntegrasi');
    f.onsubmit = async e => {
      e.preventDefault();
      const url = f.elements.apps_script_url.value.trim();
      if (url && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return toast('Alamat harus berbentuk https://script.google.com/macros/s/…/exec', 'err');
      try { await simpanPengaturan('integrasi', { ...ig, apps_script_url: url }); toast('Integrasi disimpan.'); } catch (err) { toast(pesanGalat(err), 'err'); }
    };
    $('#btnPeriksa').onclick = async () => {
      const box = $('#hasilPeriksa');
      box.innerHTML = '<div class="note info"><span class="spinner" style="width:18px;height:18px"></span><div>Menghubungi Apps Script…</div></div>';
      try {
        const j = await SPMB.kirimKeJembatan({ aksi: 'periksa' });
        box.innerHTML = `<div class="note" style="background:var(--ok-soft);border-color:color-mix(in srgb,var(--ok) 35%,transparent)"><i class="ph-duotone ph-check-circle" style="color:var(--ok)"></i><div><b>Terhubung.</b> Apps Script versi ${esc(j.versi)} mengenali Anda sebagai <b>${esc(NAMA_PERAN[j.peran] || j.peran)}</b>.${j.kuota_email != null ? ` Sisa kuota email hari ini: <b>${j.kuota_email}</b>.` : ''}${/^([12]\.|3\.[0-3]\b)/.test(j.versi) ? '<br><b>Perhatian:</b> ini masih versi lama. Terapkan Apps Script versi 3.4 agar unggahan Pusat Unduhan berjalan.' : ''}</div></div>`;
      } catch (err) {
        box.innerHTML = `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div><b>Belum terhubung.</b> ${esc(pesanGalat(err))}</div></div>`;
      }
    };
    ujiAlurPendaftaran(el);
  }

  /* ---------- Simulasi dan data uji (satu bagian): buat, uji teknis, hapus ---------- */
  function ujiAlurPendaftaran(el) {
    const KUNCI_SIM = 'spmb-simulasi-terakhir';
    const simpanSim = d => { try { d ? localStorage.setItem(KUNCI_SIM, JSON.stringify(d)) : localStorage.removeItem(KUNCI_SIM); } catch (e) {} };
    const bacaSim = () => { try { return JSON.parse(localStorage.getItem(KUNCI_SIM) || 'null'); } catch (e) { return null; } };
    el.insertAdjacentHTML('beforeend', `
      <div class="card sim-kartu" style="max-width:980px;margin-top:16px">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c7)"><i class="ph-duotone ph-users-four"></i></div>
          <div><h3>Simulasi dan data uji coba</h3><p>Bahan simulasi bersama panitia: satu rombel calon santri dan akun penguji yang dapat masuk, sudah melewati seluruh alur SPMB</p></div></div>
        <div class="sim-status" id="simStatus"><span class="spinner" style="width:16px;height:16px"></span> Memeriksa data uji…</div>
        <div class="sim-isi">
          <div class="sim-langkah">
            <b>Yang dibuat</b>
            <ul>
              <li><i class="ph-duotone ph-flag-banner" style="color:var(--c2)"></i><span><b>Gelombang Simulasi</b> (tidak tampil di situs) beserta kuota dan biaya contoh</span></li>
              <li><i class="ph-duotone ph-identification-card" style="color:var(--c4)"></i><span>Calon santri SMP dan SMA, putra dan putri, dengan status beragam: belum diperiksa, berkas kurang, menunggu pembayaran, ikut tes, lulus, cadangan, tidak lulus</span></li>
              <li><i class="ph-duotone ph-chalkboard-teacher" style="color:var(--c5)"></i><span>Akun penguji (ustadz untuk sesi putra, ustadzah untuk sesi putri) yang <b>dapat masuk</b> dengan kata sandi bersama</span></li>
              <li><i class="ph-duotone ph-calendar-check" style="color:var(--c3)"></i><span>4 sesi tes lengkap dengan grup WhatsApp, nilai, keputusan, SK, dan pengumuman</span></li>
              <li><i class="ph-duotone ph-clipboard-text" style="color:var(--ok)"></i><span>Daftar ulang (lunas, cicil, menunggu, perbaikan), keringanan, dan pembayaran</span></li>
            </ul>
          </div>
          <div class="sim-atur">
            <div class="grid-form" style="gap:12px">
              <div class="field" style="margin:0"><label for="simSantri">Jumlah calon santri</label><input class="input" id="simSantri" type="number" min="8" max="120" value="32" inputmode="numeric"><small>32 = satu rombel</small></div>
              <div class="field" style="margin:0"><label for="simPenguji">Jumlah penguji</label><input class="input" id="simPenguji" type="number" min="2" max="12" value="6" inputmode="numeric"><small>Separuh putra, separuh putri</small></div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
              <button class="btn" type="button" id="btnSimulasi"><i class="ph-duotone ph-rocket-launch"></i>Buat data simulasi</button>
              <button class="btn ghost" type="button" id="btnHapusUji"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i>Hapus semua data uji</button>
            </div>
          </div>
        </div>
        <div id="hasilSimulasi"></div>
        <details class="sim-teknis">
          <summary><i class="ph-duotone ph-wrench" style="color:var(--c3)"></i>Uji teknis unggah berkas dan email (opsional)</summary>
          <p class="muted" style="font-size:13.5px;margin:10px 0">Membuat satu pendaftar uji pada gelombang yang <b>formulirnya sedang dibuka</b>, mengunggah 5 berkas contoh ke Google Drive, lalu mengirim email konfirmasi ke ${esc(S.user.email)}. Pakai untuk memastikan Apps Script dan email berjalan.</p>
          <ol class="uji-langkah" id="ujiLangkah">
            ${['Meminta token unggah', 'Mengunggah 5 berkas contoh ke Google Drive (tanpa sesi masuk, seperti pengunjung)', 'Mengirim formulir uji dan membuat nomor registrasi', 'Merapikan folder berkas dan mengirim email + Bukti Pendaftaran PDF']
              .map((t, i) => `<li data-l="${i}"><span class="st"><i class="ph-duotone ph-circle-dashed"></i></span>${t}</li>`).join('')}
          </ol>
          <div id="ujiHasil"></div>
          <div style="display:flex;justify-content:flex-end"><button class="btn ghost" type="button" id="btnUjiAlur"><i class="ph-duotone ph-play-circle" style="color:var(--c3)"></i>Jalankan uji teknis</button></div>
        </details>
      </div>`);

    const segarJumlah = async () => {
      const [{ data: st }, { data: gu }] = await Promise.all([sb.rpc('statistik_dashboard'), sb.from('gelombang').select('id,nama').eq('uji', true)]);
      const n = st?.data_uji ?? 0, ada = (gu || []).length > 0;
      $('#simStatus').innerHTML = n || ada
        ? `<i class="ph-duotone ph-flask" style="color:var(--c6)"></i><span>Data uji tersimpan: <b>${fmt.angka(n)} pendaftar</b>${ada ? ` pada <b>${esc(gu[0].nama)}</b>` : ''}. Pilih gelombang ini (Data uji tercentang otomatis) di menu Pendaftar, Seleksi, Pengumuman, Daftar Ulang, dan Keuangan.</span>`
        : '<i class="ph-duotone ph-check-circle" style="color:var(--ok)"></i><span>Belum ada data uji. Sistem siap dipakai untuk pendaftaran sungguhan.</span>';
      $('#btnHapusUji').disabled = !n && !ada;
      $('#btnSimulasi').disabled = ada;
      $('#btnSimulasi').title = ada ? 'Hapus data uji dulu untuk membuat simulasi baru' : '';
    };
    segarJumlah().catch(() => {});

    const tampilHasil = d => {
      if (!d) { $('#hasilSimulasi').innerHTML = ''; return; }
      const wali = d.akun_wali || [], pj = d.akun_penguji || [];
      $('#hasilSimulasi').innerHTML = `
        <div class="note" style="background:var(--ok-soft);border-color:color-mix(in srgb,var(--ok) 35%,transparent);margin-top:16px"><i class="ph-duotone ph-check-circle" style="color:var(--ok)"></i><div>
          <b>Data simulasi siap</b>: ${fmt.angka(d.santri)} calon santri dan ${fmt.angka(d.penguji)} penguji pada ${esc(d.gelombang)}${d.dibuat ? ` (dibuat ${fmt.tglJam(d.dibuat)})` : ''}.
          ${d.catatan ? `<br>${esc(d.catatan)}` : ''}<br>Simpan daftar akun di bawah (tombol <b>Unduh Excel</b>); kata sandi penguji hanya ditampilkan di perangkat ini.</div></div>
        ${pj.length ? `<h4 class="sim-sub"><i class="ph-duotone ph-chalkboard-teacher" style="color:var(--c5)"></i>Akun penguji${d.kata_sandi ? ` · kata sandi: <code class="sim-sandi">${esc(d.kata_sandi)}</code>` : ''}</h4>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Email (untuk masuk)</th><th>Sesi</th><th>Bidang</th></tr></thead><tbody>
            ${pj.map(a => `<tr><td>${esc(a.nama)}</td><td class="mono">${esc(a.email)}</td><td>${a.bagian === 'putri' ? 'Putri' : 'Putra'}</td><td>${esc((a.bidang || []).map(namaBidang).join(', '))}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <h4 class="sim-sub"><i class="ph-duotone ph-users-three" style="color:var(--c4)"></i>Akun wali untuk Cek Status, Pengumuman, dan Daftar Ulang (${fmt.angka(wali.length)})</h4>
        <div class="table-wrap sim-gulir"><table class="tbl"><thead><tr><th>No registrasi</th><th>Nama</th><th>Kelompok</th><th>Tanggal lahir</th><th>Status</th></tr></thead><tbody>
          ${wali.map(a => `<tr><td class="mono">${esc(a.no_registrasi)}</td><td>${esc(a.nama)}</td><td>${esc(a.jenjang || '')} ${a.bagian === 'putri' ? 'Putri' : a.bagian ? 'Putra' : ''}</td><td>${fmt.tgl(new Date(a.tanggal_lahir + 'T00:00:00'))}</td><td>${esc(String(a.status).replace(/_/g, ' '))}</td></tr>`).join('')}</tbody></table></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:12px">
          <button class="btn ghost" type="button" id="simTutup"><i class="ph-duotone ph-eye-slash"></i>Sembunyikan</button>
          <button class="btn ghost" type="button" id="simXlsx"><i class="ph-duotone ph-microsoft-excel-logo" style="color:var(--ok)"></i>Unduh Excel daftar akun</button></div>`;
      $('#simTutup').onclick = () => { $('#hasilSimulasi').innerHTML = ''; };
      $('#simXlsx').onclick = () => SPMB.unduhXlsx(`Akun Simulasi SPMB ${fmt.tgl(new Date()).replace(/\//g, '-')}`, [
        { nama: 'Penguji', judul: 'Akun Penguji Simulasi', sub: `Kata sandi bersama: ${d.kata_sandi || '(tidak tersedia)'} · masuk melalui halaman Masuk Panitia`,
          kolom: [{ j: 'No', w: 5, t: 'angka' }, { j: 'Nama', w: 34 }, { j: 'Email', w: 28 }, { j: 'Kata sandi', w: 16 }, { j: 'Sesi', w: 10 }, { j: 'Bidang', w: 28 }],
          baris: pj.map((a, i) => [i + 1, a.nama, a.email, d.kata_sandi || '', a.bagian === 'putri' ? 'Putri' : 'Putra', (a.bidang || []).map(namaBidang).join(', ')]) },
        { nama: 'Wali', judul: 'Akun Wali Simulasi', sub: 'Dipakai di halaman Cek Status, Pengumuman, dan Daftar Ulang (nomor registrasi + tanggal lahir)',
          kolom: [{ j: 'No', w: 5, t: 'angka' }, { j: 'No registrasi', w: 22 }, { j: 'Nama', w: 32 }, { j: 'Jenjang', w: 9 }, { j: 'Bagian', w: 9 }, { j: 'NISN', w: 14 }, { j: 'Tanggal lahir', w: 14, t: 'tgl' }, { j: 'Status', w: 22 }],
          baris: wali.map((a, i) => [i + 1, a.no_registrasi, a.nama, a.jenjang || '', a.bagian === 'putri' ? 'Putri' : 'Putra', a.nisn, a.tanggal_lahir, String(a.status).replace(/_/g, ' ')]) }]);
    };
    tampilHasil(bacaSim());

    $('#btnSimulasi').onclick = async e => {
      const b = e.currentTarget, n = +$('#simSantri').value, np = +$('#simPenguji').value;
      if (!(n >= 8 && n <= 120)) return toast('Jumlah calon santri 8 sampai 120.', 'err');
      if (!(np >= 2 && np <= 12)) return toast('Jumlah penguji 2 sampai 12.', 'err');
      if (!(await konfirmasi('Buat data simulasi?', `Sistem membuat Gelombang Simulasi, ${n} calon santri, ${np} akun penguji yang dapat masuk, sesi tes, nilai, pengumuman, daftar ulang, keringanan, dan pembayaran contoh. Semuanya dapat dihapus kembali dengan tombol Hapus semua data uji.`, 'Buat sekarang'))) return;
      b.disabled = true; b.innerHTML = '<span class="spinner" style="width:16px;height:16px"></span>Memproses…';
      try {
        const { data, error } = await sb.rpc('isi_data_simulasi', { p_santri: n, p_penguji: np }); if (error) throw error;
        data.dibuat = new Date().toISOString(); simpanSim(data); tampilHasil(data);
        toast('Data simulasi siap dicoba.', 'ok', 6000);
        S.penguji = await cekPenguji().catch(() => S.penguji); bangunMenu(); tandaiMenuAktif('pengaturan');
      } catch (err) { toast(/isi_data_simulasi|schema cache/.test(err.message || '') ? 'Fungsi simulasi belum ada. Jalankan SQL 17 di Supabase terlebih dahulu.' : pesanGalat(err), 'err', 8000); }
      finally { b.innerHTML = '<i class="ph-duotone ph-rocket-launch"></i>Buat data simulasi'; segarJumlah().catch(() => {}); }
    };

    const tanda = (i, st) => {
      const li = el.querySelector(`#ujiLangkah [data-l="${i}"]`); if (!li) return;
      li.className = st;
      li.querySelector('.st').innerHTML = { jalan: '<span class="spinner" style="width:16px;height:16px"></span>', ok: '<i class="ph-duotone ph-check-circle"></i>', gagal: '<i class="ph-duotone ph-x-circle"></i>' }[st] || '<i class="ph-duotone ph-circle-dashed"></i>';
    };

    // Gambar contoh bertuliskan nama berkas
    const gambarContoh = label => new Promise(ok => {
      const c = Object.assign(document.createElement('canvas'), { width: 600, height: 400 });
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 600, 400); grad.addColorStop(0, '#b8262a'); grad.addColorStop(1, '#f4a04f');
      g.fillStyle = grad; g.fillRect(0, 0, 600, 400);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 34px sans-serif'; g.fillText('BERKAS UJI COBA', 300, 170);
      g.font = '26px sans-serif'; g.fillText(label, 300, 220); g.font = '18px sans-serif'; g.fillText(fmt.tglJam(new Date()), 300, 260);
      c.toBlob(b => ok(new File([b], label.toLowerCase().replace(/\W+/g, '-') + '.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.8);
    });

    $('#btnUjiAlur').onclick = async e => {
      const tombol = e.currentTarget; tombol.disabled = true;
      el.querySelectorAll('#ujiLangkah li').forEach((li, i) => tanda(i, ''));
      $('#ujiHasil').innerHTML = '';
      let langkah = 0;
      try {
        const cfg = (await muatPengaturan(true)).spmb || {};
        tanda(0, 'jalan');
        const { data: token, error: eTok } = await sb.rpc('minta_token_unggah', { p_token_lama: null });
        if (eTok) throw eTok;
        tanda(0, 'ok'); langkah = 1; tanda(1, 'jalan');

        const wajib = (cfg.berkas || []).filter(b => b.wajib);
        const ids = [];
        for (const b of wajib) {
          const h = await SPMB.unggahBerkasPendaftar(await gambarContoh(b.label), { token, jenis: b.kunci });
          ids.push(h.id);
        }
        tanda(1, 'ok'); langkah = 2; tanda(2, 'jalan');

        const acuan = new Date(SPMB.acuanUsia(S.pengaturan) + 'T00:00:00');
        const lahir = new Date(acuan); lahir.setFullYear(acuan.getFullYear() - ((cfg.usia?.SMP?.min || 11) + 1));
        const acak = n => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
        const { data: hasil, error: eKirim } = await sb.rpc('kirim_pendaftaran', { p_token: token, p_data: {
          uji: true, setuju: true, jenjang: 'SMP', bagian: 'putra', nama_lengkap: 'Santri Uji Coba', nisn: acak(10), nik: '7306' + acak(12),
          tempat_lahir: 'Kab. Gowa', tanggal_lahir: fmt.isoTgl(lahir), asal_provinsi: 'Sulawesi Selatan', asal_kabupaten: 'Kab. Gowa',
          alamat_jalan: 'Jl. Uji Coba No. 1', rt: '1', rw: '1', desa: 'Desa Uji', kecamatan: 'Kecamatan Uji', kabupaten: 'Kab. Gowa', provinsi: 'Sulawesi Selatan',
          kode_pos: '92111', asal_sekolah: 'SD Uji Coba', nama_ayah: 'Ayah Uji Coba', nama_ibu: 'Ibu Uji Coba', pekerjaan_ayah: 'Lainnya', pekerjaan_ibu: 'Lainnya',
          email: S.user.email, no_wa: S.profil.no_wa || '6281234567890', darurat_nama: 'Kerabat Uji Coba', darurat_hubungan: 'Paman',
          darurat_no: '6285200000000', hafalan_juz: 1, sumber_info: ['Lainnya'], berkas: ids } });
        if (eKirim) throw eKirim;
        tanda(2, 'ok'); langkah = 3; tanda(3, 'jalan');

        const k = await SPMB.konfirmasiPendaftaran(token);
        tanda(3, k.email ? 'ok' : 'gagal');
        $('#ujiHasil').innerHTML = `<div class="note" style="background:var(--ok-soft);border-color:color-mix(in srgb,var(--ok) 35%,transparent)"><i class="ph-duotone ph-check-circle" style="color:var(--ok)"></i><div>
          <b>Alur berhasil.</b> Nomor registrasi uji: <b>${esc(hasil.no_registrasi)}</b>.<br>
          ${k.email ? `Periksa kotak masuk <b>${esc(S.user.email)}</b> (juga folder Spam): email berisi lampiran Bukti Pendaftaran PDF.` : `Email tidak terkirim: ${esc(k.pesan)}`}<br>
          Berkas tersimpan di Google Drive: <b>folder induk SPMB › Berkas Pendaftar › _Uji Coba</b>. Notifikasi "Pendaftar uji coba" juga masuk ke lonceng.</div></div>`;
      } catch (err) {
        tanda(langkah, 'gagal');
        $('#ujiHasil').innerHTML = `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div><b>Gagal pada langkah ${langkah + 1}.</b> ${esc(pesanGalat(err))}</div></div>`;
      } finally { tombol.disabled = false; segarJumlah().catch(() => {}); }
    };

    $('#btnHapusUji').onclick = async () => {
      if (!(await konfirmasi('Hapus semua data uji?', 'Yang dihapus: semua pendaftar bernomor UJI- beserta nilai, keputusan, SKL, daftar ulang, keringanan, dan pembayarannya; Gelombang Simulasi beserta sesi tes, kuota, dan biayanya; akun penguji simulasi; serta notifikasi terkait. Berkasnya dipindah ke Sampah Google Drive. Data pendaftar sungguhan dan pengaturan tidak tersentuh.', 'Hapus data uji', true))) return;
      try {
        const { data, error } = await sb.rpc('hapus_data_uji'); if (error) throw error;
        let pesan = `${data.jumlah} pendaftar uji dihapus${data.gelombang ? `, ${data.gelombang} gelombang uji` : ''}${data.akun_penguji ? `, ${data.akun_penguji} akun penguji uji` : ''}.`;
        try { const h = await SPMB.hapusBerkasPendaftar(data.drive_ids || []); pesan += ` ${h.jumlah} berkas dipindah ke Sampah Drive.`; }
        catch (e2) { pesan += ' Berkas di Drive belum terhapus: ' + pesanGalat(e2); }
        toast(pesan, 'ok', 8000); segarJumlah(); simpanSim(null); tampilHasil(null);
        S.penguji = await cekPenguji().catch(() => S.penguji); bangunMenu(); tandaiMenuAktif('pengaturan');
      } catch (err) { toast(pesanGalat(err), 'err'); }
    };
  }

  /* =================================================================
     LOG AKTIVITAS (Superadmin): bawaan 30 hari terakhir, saringan, halaman, ekspor Excel
     ================================================================= */
  const NAMA_AKSI = {
    insert: ['Menambah', 'ph-plus-circle', 'var(--ok)'], update: ['Mengubah', 'ph-pencil-simple', 'var(--c1)'], delete: ['Menghapus', 'ph-trash', 'var(--danger)'],
    buat_akun: ['Membuat akun', 'ph-user-plus', 'var(--c2)'], atur_ulang_sandi: ['Atur ulang sandi', 'ph-key', 'var(--c6)'], urutkan: ['Mengurutkan', 'ph-arrows-down-up', 'var(--c5)'],
    hapus: ['Menghapus', 'ph-trash', 'var(--danger)'], daftar: ['Pendaftaran baru', 'ph-user-plus', 'var(--ok)'],
    isi_nilai: ['Mengisi nilai', 'ph-pencil-simple-line', 'var(--c5)'], ubah_nilai: ['Mengubah nilai', 'ph-pencil-simple-line', 'var(--c3)'], hapus_nilai: ['Menghapus nilai', 'ph-trash', 'var(--danger)'],
    validasi_nilai_setujui: ['Menyetujui nilai', 'ph-check-circle', 'var(--ok)'], validasi_nilai_kembalikan: ['Mengembalikan nilai', 'ph-arrow-u-up-left', 'var(--c3)'], validasi_nilai_buka: ['Membuka kunci nilai', 'ph-lock-open', 'var(--c6)'],
    tugaskan_penguji: ['Menugaskan penguji', 'ph-chalkboard-teacher', 'var(--c2)'], lepas_penguji: ['Melepas penguji', 'ph-user-minus', 'var(--c8)'],
    tetapkan_hasil: ['Menetapkan hasil', 'ph-gavel', 'var(--c2)'], terbitkan_hasil: ['Menerbitkan hasil', 'ph-megaphone', 'var(--c6)'], tarik_hasil: ['Menarik hasil', 'ph-arrow-counter-clockwise', 'var(--danger)'],
    kirim_daftar_ulang: ['Mengirim daftar ulang', 'ph-paper-plane-tilt', 'var(--c5)'], verifikasi_daftar_ulang: ['Verifikasi daftar ulang', 'ph-clipboard-text', 'var(--ok)'],
    catat_pembayaran: ['Mencatat pembayaran', 'ph-hand-coins', 'var(--ok)'], batalkan_pembayaran: ['Membatalkan pembayaran', 'ph-prohibit', 'var(--danger)'],
    atur_keringanan: ['Mengatur keringanan', 'ph-percent', 'var(--c4)'], hapus_keringanan: ['Menghapus keringanan', 'ph-percent', 'var(--danger)'], atur_format_kuitansi: ['Format kuitansi', 'ph-receipt', 'var(--c5)'],
    isi_data_uji: ['Membuat data uji', 'ph-flask', 'var(--c6)'], isi_data_uji_lengkap: ['Membuat data uji lengkap', 'ph-flask', 'var(--c6)'], isi_data_simulasi: ['Membuat data simulasi', 'ph-users-four', 'var(--c6)'], hapus_data_uji: ['Menghapus data uji', 'ph-flask', 'var(--danger)'],
    mulai_tahun_ajaran: ['Memulai tahun ajaran', 'ph-calendar-star', 'var(--c7)']
  };
  const NAMA_OBJEK = { profil_pengguna: 'akun pengguna', pengaturan: 'pengaturan', akun: 'akun', konten_situs: 'konten situs', berita: 'berita',
    pendaftar: 'pendaftar', gelombang: 'gelombang', sesi_tes: 'sesi tes', nilai_tes: 'nilai', unduhan: 'unduhan', kuota: 'kuota', rincian_biaya: 'rincian biaya', rekening: 'rekening' };
  const AKSI_CRUD = ['insert', 'update', 'delete'];
  const labelAksi = r => {
    const a = NAMA_AKSI[r.aksi];
    if (!a) return [r.aksi.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()), 'ph-dot-outline', 'var(--c8)'];
    return AKSI_CRUD.includes(r.aksi) || r.aksi === 'hapus' ? [`${a[0]} ${NAMA_OBJEK[r.objek] || (r.objek || '').replace(/_/g, ' ')}`, a[1], a[2]] : a;
  };
  HALAMAN.log = async k => {
    const nama = {};
    (await sb.from('profil_pengguna').select('id,nama_lengkap,email').order('nama_lengkap')).data?.forEach(p => nama[p.id] = p.nama_lengkap || p.email);
    const PER_HAL = 50;
    const hariIni = fmt.isoTgl(), sebulan = fmt.isoTgl(new Date(Date.now() - 30 * 864e5));
    const L = { dari: sebulan, sampai: hariIni, aksi: '', pengguna: '', cari: '', hal: 0, total: 0, data: [] };
    const ringkas = r => {
      const b = r.rincian?.baru || r.rincian?.lama || {};
      if (r.objek === 'pengaturan') return `Pengaturan "${esc(r.objek_id)}"`;
      if (r.objek === 'konten_situs' || r.objek === 'berita') {
        if (r.aksi === 'urutkan') return `${esc(UI.NAMA_MODUL[r.objek_id] || r.objek_id || '')} (${r.rincian?.jumlah || 0} item)`;
        const ket = r.aksi === 'update' && r.rincian?.lama && r.rincian?.baru
          ? (r.rincian.lama.diarsipkan_pada !== r.rincian.baru.diarsipkan_pada ? (r.rincian.baru.diarsipkan_pada ? ' (diarsipkan)' : ' (dipulihkan)')
            : r.rincian.lama.tampil !== r.rincian.baru.tampil ? (r.rincian.baru.tampil ? ' (ditampilkan)' : ' (disembunyikan)')
            : r.rincian.lama.status !== r.rincian.baru.status ? ` (${esc(r.rincian.baru.status)})` : '') : '';
        return `${r.objek === 'berita' ? 'Berita' : esc(UI.NAMA_MODUL[b.jenis] || 'Konten')}: ${esc(b.judul || '(tanpa judul)')}${ket}`;
      }
      if (r.objek === 'unduhan') return `Unduhan: ${esc(b.judul || '')}${r.aksi === 'update' && r.rincian?.lama?.tampil !== r.rincian?.baru?.tampil ? (r.rincian.baru.tampil ? ' (ditampilkan)' : ' (disembunyikan)') : ''}`;
      if (r.objek === 'akun') return `Akun ${esc(r.rincian?.nama || nama[r.objek_id] || '')}${r.rincian?.peran ? ` (${NAMA_PERAN[r.rincian.peran]})` : ''}`;
      if (r.objek === 'profil_pengguna') return `Akun ${esc(b.nama_lengkap || b.email || '')}${r.aksi === 'update' && r.rincian?.lama?.peran !== r.rincian?.baru?.peran ? ` (peran: ${NAMA_PERAN[r.rincian.lama.peran]} → ${NAMA_PERAN[r.rincian.baru.peran]})` : ''}${r.aksi === 'update' && r.rincian?.lama?.aktif !== r.rincian?.baru?.aktif ? ` (${r.rincian.baru.aktif ? 'diaktifkan' : 'dinonaktifkan'})` : ''}`;
      // Umum: rangkum isian penting dari rincian
      const d = r.rincian || {};
      const bagian = [d.no || d.pendaftar, d.nama || b.nama || b.judul || b.nama_lengkap, d.bidang && `bidang ${d.bidang}`, d.hasil && `hasil ${String(d.hasil).replace(/_/g, ' ')}`,
        d.aksi && String(d.aksi).replace(/_/g, ' '), d.tahap && String(d.tahap).replace(/_/g, ' '), d.nominal != null && `Rp ${fmt.angka(d.nominal)}`, d.kuitansi && `kuitansi ${d.kuitansi}`,
        d.jumlah != null && `${fmt.angka(d.jumlah)} data`, d.baru && typeof d.baru === 'string' && `${d.lama || ''} → ${d.baru}`, d.catatan && `“${String(d.catatan).slice(0, 80)}”`, d.alasan && `alasan: ${String(d.alasan).slice(0, 80)}`]
        .filter(x => x && typeof x !== 'object');
      return esc(bagian.join(' · ') || (r.objek ? `${NAMA_OBJEK[r.objek] || r.objek} ${r.objek_id || ''}` : '–'));
    };
    const teksPolos = h => { const t = document.createElement('div'); t.innerHTML = h; return t.textContent; };
    const dasar = (kolom, opsi) => {
      let q = sb.from('log_aktivitas').select(kolom, opsi)
        .gte('dibuat_pada', `${L.dari}T00:00:00+08:00`).lt('dibuat_pada', `${fmt.isoTgl(new Date(new Date(L.sampai + 'T00:00:00').getTime() + 864e5))}T00:00:00+08:00`);
      if (L.aksi) { const [a, o] = L.aksi.split('|'); q = q.eq('aksi', a); if (o) q = q.eq('objek', o); }
      if (L.pengguna) q = L.pengguna === 'sistem' ? q.is('pengguna_id', null) : q.eq('pengguna_id', L.pengguna);
      if (L.cari) { const c = L.cari.replace(/[%,()*]/g, ' ').trim(); if (c) q = q.or(`nama_pengguna.ilike.*${c}*,objek_id.ilike.*${c}*,aksi.ilike.*${c}*,objek.ilike.*${c}*`); }
      return q;
    };

    k.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div class="grid-form log-saring" style="align-items:end">
          <div class="field" style="margin:0"><label for="lDari">Dari tanggal</label><input class="input" type="date" id="lDari" value="${L.dari}" max="${hariIni}"></div>
          <div class="field" style="margin:0"><label for="lSampai">Sampai tanggal</label><input class="input" type="date" id="lSampai" value="${L.sampai}" max="${hariIni}"></div>
          <div class="field" style="margin:0"><label for="lAksi">Aktivitas</label><select class="select" id="lAksi"><option value="">Semua aktivitas</option></select></div>
          <div class="field" style="margin:0"><label for="lPengguna">Petugas</label><select class="select" id="lPengguna"><option value="">Semua petugas</option>
            ${Object.entries(nama).map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}<option value="sistem">Sistem / pengunjung</option></select></div>
          <div class="field" style="margin:0"><label for="lCari">Cari</label><div class="input-ikon"><i class="ph-duotone ph-magnifying-glass"></i><input class="input" type="search" id="lCari" placeholder="Nama, nomor, objek"></div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px">
          <div class="chips-select" id="lCepat">${[['7', '7 hari'], ['30', '30 hari'], ['90', '3 bulan'], ['365', '1 tahun']].map(([n, l]) => `<label><input type="radio" name="cepat" value="${n}" ${n === '30' ? 'checked' : ''}>${l}</label>`).join('')}</div>
          <div class="spacer" style="flex:1"></div>
          <button class="btn sm ghost" id="lReset"><i class="ph-duotone ph-arrow-counter-clockwise"></i>Atur ulang</button>
          <button class="btn sm ghost" id="lXlsx"><i class="ph-duotone ph-microsoft-excel-logo" style="color:var(--ok)"></i>Ekspor Excel</button>
          <button class="btn sm ghost" id="lCetak"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Cetak</button>
        </div>
      </div>
      <p class="muted" id="lInfo" style="margin:0 0 10px"></p>
      <div class="table-wrap"><table class="tbl"><thead><tr><th style="width:150px">Waktu</th><th>Petugas</th><th>Aktivitas</th><th>Rincian</th></tr></thead><tbody id="lBody"></tbody></table></div>
      <div id="lHal" style="display:flex;gap:8px;justify-content:center;align-items:center;margin-top:12px"></div>`;

    const muatAksi = async () => {
      const { data } = await dasar('aksi,objek').limit(10000);
      const hit = {};
      (data || []).forEach(r => { const key = AKSI_CRUD.includes(r.aksi) || r.aksi === 'hapus' ? `${r.aksi}|${r.objek || ''}` : r.aksi; hit[key] = (hit[key] || 0) + 1; });
      const sel = $('#lAksi'), v = L.aksi;
      sel.innerHTML = '<option value="">Semua aktivitas</option>' + Object.entries(hit)
        .map(([key, n]) => { const [a, o] = key.split('|'); return [key, labelAksi({ aksi: a, objek: o })[0], n]; })
        .sort((x, y) => x[1].localeCompare(y[1], 'id')).map(([key, l, n]) => `<option value="${esc(key)}" ${key === v ? 'selected' : ''}>${esc(l)} (${fmt.angka(n)})</option>`).join('');
      if (v && !hit[v]) { sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}" selected>${esc(labelAksi({ aksi: v.split('|')[0], objek: v.split('|')[1] })[0])} (0)</option>`); }
    };
    const muat = async () => {
      if (L.dari > L.sampai) return toast('Tanggal awal tidak boleh setelah tanggal akhir.', 'err');
      $('#lBody').innerHTML = '<tr><td colspan="4"><div class="skeleton" style="height:14px;width:60%"></div></td></tr>';
      const { data, count, error } = await dasar('*', { count: 'exact' }).order('dibuat_pada', { ascending: false }).range(L.hal * PER_HAL, L.hal * PER_HAL + PER_HAL - 1);
      if (error) { $('#lBody').innerHTML = `<tr><td colspan="4"><div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(pesanGalat(error))}</div></div></td></tr>`; return; }
      L.data = data || []; L.total = count || 0;
      const halMaks = Math.max(0, Math.ceil(L.total / PER_HAL) - 1);
      $('#lInfo').innerHTML = `<b>${fmt.angka(L.total)}</b> aktivitas pada ${fmt.tglPanjang(new Date(L.dari + 'T00:00:00'))} – ${fmt.tglPanjang(new Date(L.sampai + 'T00:00:00'))}${L.total > PER_HAL ? ` · menampilkan ${fmt.angka(L.hal * PER_HAL + 1)}–${fmt.angka(Math.min(L.total, (L.hal + 1) * PER_HAL))}` : ''}`;
      $('#lBody').innerHTML = L.data.length ? L.data.map(r => { const [l, ic, t] = labelAksi(r); return `
        <tr><td style="white-space:nowrap">${fmt.tglJam(r.dibuat_pada)}</td>
          <td>${esc(r.nama_pengguna || (r.pengguna_id ? nama[r.pengguna_id] || '–' : 'Sistem'))}</td>
          <td><span class="pill" style="--tone:${t}"><i class="ph-duotone ${ic}"></i>${esc(l)}</span></td>
          <td>${ringkas(r)}</td></tr>`; }).join('') : '<tr><td colspan="4"><div class="empty"><i class="ph-duotone ph-clock-counter-clockwise"></i><b>Tidak ada aktivitas</b>Ubah rentang tanggal atau saringan.</div></td></tr>';
      $('#lHal').innerHTML = L.total > PER_HAL ? `<button class="btn sm ghost" data-hal="-1" ${L.hal ? '' : 'disabled'}><i class="ph-duotone ph-caret-left"></i>Sebelumnya</button>
        <span class="muted">Halaman ${L.hal + 1} dari ${halMaks + 1}</span>
        <button class="btn sm ghost" data-hal="1" ${L.hal < halMaks ? '' : 'disabled'}>Berikutnya<i class="ph-duotone ph-caret-right"></i></button>` : '';
    };
    const ambilSemua = async (maks = 5000) => {
      const hasil = [];
      for (let i = 0; i < maks; i += 1000) {
        const { data, error } = await dasar('*').order('dibuat_pada', { ascending: false }).range(i, Math.min(maks, i + 1000) - 1);
        if (error) throw error;
        hasil.push(...(data || [])); if (!data || data.length < 1000) break;
      }
      return hasil;
    };
    const ulang = async (aksiJuga = true) => { L.hal = 0; if (aksiJuga) await muatAksi(); await muat(); };
    const tunda = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

    $('#lDari').onchange = e => { L.dari = e.target.value || sebulan; document.querySelectorAll('[name=cepat]').forEach(r => r.checked = false); ulang(); };
    $('#lSampai').onchange = e => { L.sampai = e.target.value || hariIni; document.querySelectorAll('[name=cepat]').forEach(r => r.checked = false); ulang(); };
    $('#lCepat').onchange = e => { const n = +e.target.value; L.sampai = hariIni; L.dari = fmt.isoTgl(new Date(Date.now() - n * 864e5)); $('#lDari').value = L.dari; $('#lSampai').value = L.sampai; ulang(); };
    $('#lAksi').onchange = e => { L.aksi = e.target.value; ulang(false); };
    $('#lPengguna').onchange = e => { L.pengguna = e.target.value; ulang(); };
    $('#lCari').oninput = tunda(e => { L.cari = e.target.value.trim(); ulang(false); });
    $('#lReset').onclick = () => {
      Object.assign(L, { dari: sebulan, sampai: hariIni, aksi: '', pengguna: '', cari: '' });
      $('#lDari').value = sebulan; $('#lSampai').value = hariIni; $('#lPengguna').value = ''; $('#lCari').value = '';
      document.querySelector('[name=cepat][value="30"]').checked = true; ulang();
    };
    $('#lHal').onclick = e => { const b = e.target.closest('[data-hal]'); if (!b) return; L.hal += +b.dataset.hal; muat(); window.scrollTo(0, 0); };
    const judulRentang = () => `${fmt.tgl(new Date(L.dari + 'T00:00:00'))} s.d. ${fmt.tgl(new Date(L.sampai + 'T00:00:00'))}`;
    $('#lXlsx').onclick = async e => {
      const b = e.currentTarget; b.disabled = true;
      try {
        const semua = await ambilSemua(20000);
        if (!semua.length) return toast('Tidak ada aktivitas untuk diekspor.', 'err');
        SPMB.unduhXlsx(`Log Aktivitas SPMB ${judulRentang().replace(/\//g, '-')}`, {
          nama: 'Log Aktivitas', judul: 'Log Aktivitas Sistem SPMB', sub: `Rentang ${judulRentang()} · diekspor ${fmt.tglJam(new Date())} WITA`,
          kolom: [{ j: 'No', w: 6, t: 'angka' }, { j: 'Tanggal', w: 12, t: 'tgl' }, { j: 'Jam', w: 8 }, { j: 'Petugas', w: 26 }, { j: 'Aktivitas', w: 30 }, { j: 'Objek', w: 16 }, { j: 'ID objek', w: 22 }, { j: 'Rincian', w: 70 }],
          baris: semua.map((r, i) => { const w = new Date(r.dibuat_pada); return [i + 1, fmt.isoTgl(w), fmt.jam(w), r.nama_pengguna || (r.pengguna_id ? nama[r.pengguna_id] || '' : 'Sistem'),
            labelAksi(r)[0], NAMA_OBJEK[r.objek] || r.objek || '', r.objek_id || '', teksPolos(ringkas(r))]; })
        });
        toast(`${fmt.angka(semua.length)} aktivitas diekspor.`);
      } catch (err) { toast(pesanGalat(err), 'err'); } finally { b.disabled = false; }
    };
    $('#lCetak').onclick = async () => {
      try {
        const semua = await ambilSemua(1000);
        cetakDokumen({
          judul: 'Log Aktivitas Sistem SPMB', meta: `Rentang ${judulRentang()} · ${fmt.angka(semua.length)} aktivitas${L.total > semua.length ? ` (1.000 terbaru dari ${fmt.angka(L.total)})` : ''} · Dicetak ${fmt.tglPanjang(new Date())}`,
          isi: `<table><thead><tr><th style="width:6%">No</th><th style="width:17%">Waktu</th><th style="width:19%">Petugas</th><th style="width:22%">Aktivitas</th><th style="width:36%">Rincian</th></tr></thead><tbody>
            ${semua.map((r, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${fmt.tglJam(r.dibuat_pada)}</td><td>${esc(r.nama_pengguna || 'Sistem')}</td><td>${esc(labelAksi(r)[0])}</td><td>${ringkas(r)}</td></tr>`).join('')}</tbody></table>`,
          ttd: [{ jabatan: 'Superadmin', nama: S.profil.nama_lengkap }]
        });
      } catch (err) { toast(pesanGalat(err), 'err'); }
    };
    await muatAksi(); await muat();
  };

  /* =================================================================
     PROFIL SAYA
     ================================================================= */
  HALAMAN.profil = async k => {
    const p = S.profil;
    k.innerHTML = `
      <div class="grid-2" style="align-items:start">
        <form class="card" id="fProfil" novalidate>
          <div class="card-head"><div class="avatar" style="width:48px;height:48px;font-size:17px">${esc(inisial(p.nama_lengkap || p.email))}</div>
            <div><h3>${esc(p.nama_lengkap || p.email)}</h3><p><span class="pill" style="--tone:${TONE_PERAN[p.peran]}">${NAMA_PERAN[p.peran]}</span></p></div></div>
          ${inp('nama_lengkap', 'Nama lengkap', p.nama_lengkap, 'maxlength="100"')}
          ${inp('email', 'Email (untuk masuk)', p.email, 'readonly', 'Hubungi Superadmin untuk mengganti email.')}
          ${inp('no_wa', 'Nomor WhatsApp', p.no_wa, 'inputmode="tel" placeholder="08xxxxxxxxxx"')}
          ${p.peran === 'penguji' ? `<div class="field"><span class="label">Bidang tes</span><div>${(p.bidang_penguji || []).map(b => `<span class="pill" style="--tone:var(--c5)">${namaBidang(b)}</span>`).join(' ') || '–'}</div></div>` : ''}
          <div class="field"><span class="label">Terdaftar sejak</span><div class="muted">${fmt.tglPanjang(p.dibuat_pada)}</div></div>
          <div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan profil</button></div>
        </form>
        <form class="card" id="fSandi" novalidate>
          <div class="card-head"><div class="ic-box" style="--tone:var(--c4)"><i class="ph-duotone ph-key"></i></div><div><h3>Ganti kata sandi</h3><p>Minimal 8 karakter, berisi huruf dan angka</p></div></div>
          ${['lama|Kata sandi saat ini|current-password', 'baru|Kata sandi baru|new-password', 'ulang|Ulangi kata sandi baru|new-password'].map(s => { const [n, l, a] = s.split('|'); return `
            <div class="field"><label>${l}</label><div class="input-wrap"><input class="input" type="password" name="${n}" autocomplete="${a}">
            <button type="button" class="toggle-pass" aria-label="Tampilkan kata sandi"><i class="ph-duotone ph-eye"></i></button></div></div>`; }).join('')}
          <div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-lock-key"></i>Ganti kata sandi</button></div>
        </form>
      </div>`;

    $('#fProfil').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      let nama = f.elements.nama_lengkap.value.trim(), wa = f.elements.no_wa.value.replace(/[\s.-]/g, '');
      if (nama.length < 3) return toast('Nama lengkap minimal 3 karakter.', 'err');
      if (wa && !/^(08|\+?62)\d{8,11}$/.test(wa)) return toast('Nomor WhatsApp harus diawali 08 atau 62, 10–13 digit.', 'err');
      wa = wa ? wa.replace(/^\+?62/, '62').replace(/^0/, '62') : null;
      const { data, error } = await sb.from('profil_pengguna').update({ nama_lengkap: nama, no_wa: wa }).eq('id', S.user.id).select().single();
      if (error) return toast(pesanGalat(error), 'err');
      S.profil = data; tampilkanPengguna(); toast('Profil disimpan.'); HALAMAN.profil(k);
    };
    $('#fSandi').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, lama = f.elements.lama.value, baru = f.elements.baru.value, ulang = f.elements.ulang.value;
      if (!lama) return toast('Isi kata sandi saat ini.', 'err');
      if (baru.length < 8 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru)) return toast('Kata sandi baru minimal 8 karakter, berisi huruf dan angka.', 'err');
      if (baru !== ulang) return toast('Kedua kata sandi baru tidak sama.', 'err');
      const { error: e1 } = await sb.auth.signInWithPassword({ email: S.profil.email, password: lama });
      if (e1) return toast('Kata sandi saat ini salah.', 'err');
      const { error } = await sb.auth.updateUser({ password: baru });
      if (error) return toast(pesanGalat(error), 'err');
      f.reset(); toast('Kata sandi berhasil diganti.');
    };
  };

  mulai().catch(err => {
    const m = $('#memuat');
    if (m) m.innerHTML = `<div class="note err" style="max-width:480px"><i class="ph-duotone ph-warning-circle"></i><div><b>Dashboard gagal dimuat.</b><br>${esc(pesanGalat(err))}<br><a href="masuk.html">Kembali ke halaman masuk</a></div></div>`;
  });
})();
