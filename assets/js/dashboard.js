/* =====================================================================
   DASHBOARD PANITIA SPMB (Fase 1)
   Menu: Beranda, Notifikasi, Pengguna, Pengaturan, Log Aktivitas, Profil
   ===================================================================== */
(function () {
  'use strict';
  const { sb, CFG, fmt, esc, inisial, toast, dialog, konfirmasi, pesanGalat,
          muatPengaturan, logoPondok, pasangLogo, kopHTML, cetakDokumen, themeSegHTML } = window.SPMB;
  const $ = (s, r = document) => r.querySelector(s);

  const NAMA_PERAN = { superadmin: 'Superadmin', admin: 'Admin', penguji: 'Penguji' };
  const TONE_PERAN = { superadmin: 'var(--c7)', admin: 'var(--c1)', penguji: 'var(--c5)' };
  const NAMA_BIDANG = { tahfizh: 'Tahfizh', tertulis: 'Tertulis', wawancara: 'Wawancara' };
  const IKON_NOTIF = {
    info: ['ph-info', 'var(--c1)'], sukses: ['ph-check-circle', 'var(--ok)'],
    peringatan: ['ph-warning', 'var(--c6)'], penting: ['ph-siren', 'var(--c7)']
  };

  /* ---------- Daftar menu ---------- */
  const MENU = [
    { id: 'beranda',    label: 'Beranda',       ikon: 'ph-squares-four',            tone: 'var(--c1)', peran: ['superadmin', 'admin', 'penguji'], sub: 'Ringkasan dan statistik langsung' },
    { id: 'notifikasi', label: 'Notifikasi',    ikon: 'ph-bell-ringing',            tone: 'var(--c3)', peran: ['superadmin', 'admin', 'penguji'], sub: 'Pemberitahuan untuk akun Anda' },
    { id: 'pengguna',   label: 'Pengguna',      ikon: 'ph-users-three',             tone: 'var(--c2)', peran: ['superadmin'], sub: 'Akun Admin dan Penguji' },
    { id: 'pengaturan', label: 'Pengaturan',    ikon: 'ph-sliders-horizontal',      tone: 'var(--c5)', peran: ['superadmin'], sub: 'Identitas lembaga, kop surat, Ketua Panitia' },
    { id: 'log',        label: 'Log Aktivitas', ikon: 'ph-clock-counter-clockwise', tone: 'var(--c6)', peran: ['superadmin'], sub: 'Riwayat perubahan penting' },
    { id: 'profil',     label: 'Profil Saya',   ikon: 'ph-user-circle',             tone: 'var(--c4)', peran: ['superadmin', 'admin', 'penguji'], sub: 'Data diri dan kata sandi' }
  ];
  // Menu fase berikutnya, ditampilkan sebagai penanda saja
  const SEGERA = [
    ['Pendaftar', 'ph-identification-card', 'Fase 3'], ['Verifikasi', 'ph-seal-check', 'Fase 3'],
    ['Seleksi', 'ph-exam', 'Fase 4'], ['Pengumuman', 'ph-megaphone', 'Fase 4'],
    ['Daftar Ulang', 'ph-clipboard-text', 'Fase 5'], ['Konten Situs', 'ph-browsers', 'Fase 2']
  ];

  const S = { user: null, profil: null, pengaturan: {}, unread: 0, notifTerbaru: [], kanal: null, jamTimer: null, statTimer: null };
  const bolehMenu = m => m.peran.includes(S.profil.peran);

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

    // Kerangka
    $('#themeSeg').innerHTML = themeSegHTML; SPMB.setTheme(SPMB.getTheme());
    pasangLogo($('#brandLogo'), logoPondok(S.pengaturan));
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
      ${S.profil.peran !== 'penguji' ? `<h5>Segera hadir</h5>
      ${SEGERA.map(([l, ic, f]) => `<a aria-disabled="true" style="--tone:var(--c8);opacity:.55;cursor:default" title="Tersedia di ${f}">
          <span class="ni"><i class="ph-duotone ${ic}"></i></span>${l}<span class="pill" style="--tone:var(--c8);margin-left:auto;font-size:10.5px">${f}</span></a>`).join('')}` : ''}`;
    $('#nav').addEventListener('click', e => {
      if (e.target.closest('a[aria-disabled]')) e.preventDefault();
      if (e.target.closest('a[href]')) document.body.classList.remove('nav-open');
    });

    // Navigasi bawah HP: maksimal 4 menu + "Lainnya"
    const pilihan = ['beranda', 'notifikasi', S.profil.peran === 'superadmin' ? 'pengguna' : 'profil']
      .map(id => MENU.find(m => m.id === id));
    $('#bottomNav').innerHTML = pilihan.map(m => `
      <a href="#/${m.id}" data-menu="${m.id}" style="--tone:${m.tone}">
        <span class="pill-ic"><i class="ph-duotone ${m.ikon}"></i></span>${m.id === 'profil' ? 'Profil' : m.label}
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
    const id = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'beranda';
    let m = MENU.find(x => x.id === id);
    if (!m || !bolehMenu(m)) { m = MENU[0]; history.replaceState(null, '', '#/beranda'); }
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
  function setFab(aksi, ikon = 'ph-plus', label = 'Tambah') {
    const f = $('#fab');
    if (!aksi) { f.classList.add('hidden'); f.onclick = null; return; }
    f.classList.remove('hidden'); f.innerHTML = `<i class="ph-duotone ${ikon}"></i>`; f.setAttribute('aria-label', label); f.onclick = aksi;
  }

  /* =================================================================
     BERANDA
     ================================================================= */
  HALAMAN.beranda = async k => {
    const p = S.profil;
    const jam = new Date().getHours();
    const salam = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
    const isSuper = p.peran === 'superadmin', isAdmin = p.peran !== 'penguji';

    k.innerHTML = `
      <div class="welcome">
        <h2>${salam}, ${esc((p.nama_lengkap || '').split(' ')[0] || NAMA_PERAN[p.peran])}</h2>
        <p>Anda masuk sebagai <b>${NAMA_PERAN[p.peran]}</b>${p.peran === 'penguji' && p.bidang_penguji?.length ? ` · Bidang ${p.bidang_penguji.map(b => NAMA_BIDANG[b]).join(', ')}` : ''}.</p>
        <div class="clock"><span><i class="ph-duotone ph-calendar-blank"></i><span id="hariIni">${fmt.hariTgl()}</span></span>
          <span><i class="ph-duotone ph-clock"></i><span id="jamKini">${fmt.jam(new Date())}</span> WITA</span></div>
      </div>
      <div class="stats" id="stats"></div>
      ${isSuper ? '<div id="lengkapi"></div>' : ''}
      <div class="grid-2">
        <div class="card">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-lightning"></i></div><div><h3>Aksi cepat</h3><p>Menu yang sering dipakai</p></div></div>
          <div class="quick">
            <a href="#/notifikasi"><span class="ic-box" style="--tone:var(--c3);width:34px;height:34px;font-size:18px"><i class="ph-duotone ph-bell-ringing"></i></span>Notifikasi</a>
            ${isSuper ? `<a href="#/pengguna"><span class="ic-box" style="--tone:var(--c2);width:34px;height:34px;font-size:18px"><i class="ph-duotone ph-user-plus"></i></span>Tambah pengguna</a>
            <a href="#/pengaturan"><span class="ic-box" style="--tone:var(--c5);width:34px;height:34px;font-size:18px"><i class="ph-duotone ph-identification-card"></i></span>Kop surat</a>
            <a href="#/log"><span class="ic-box" style="--tone:var(--c6);width:34px;height:34px;font-size:18px"><i class="ph-duotone ph-clock-counter-clockwise"></i></span>Log aktivitas</a>` : ''}
            <a href="#/profil"><span class="ic-box" style="--tone:var(--c4);width:34px;height:34px;font-size:18px"><i class="ph-duotone ph-key"></i></span>Ganti kata sandi</a>
            <a href="index.html" target="_blank"><span class="ic-box" style="--tone:var(--c1);width:34px;height:34px;font-size:18px"><i class="ph-duotone ph-globe"></i></span>Lihat situs publik</a>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c6)"><i class="ph-duotone ph-rocket-launch"></i></div><div><h3>Tahap pengembangan</h3><p>Menu baru muncul sesuai fase</p></div></div>
          <ul class="roadmap-mini">
            ${[['Persiapan akun dan bahan', 'done'], ['Fondasi: login, pengguna, pengaturan', 'on'], ['Landing page dan konten situs', ''], ['Pendaftaran online', ''], ['Seleksi dan pengumuman', ''], ['Daftar ulang', ''], ['Laporan dan cadangan', '']]
              .map(([t, s], i) => `<li class="${s}"><span class="n">${s === 'done' ? '✓' : i}</span>Fase ${i} · ${t}${s === 'on' ? ' <span class="pill" style="--tone:var(--c1);margin-left:auto">Sedang berjalan</span>' : ''}</li>`).join('')}
          </ul>
        </div>
      </div>`;

    // Jam berjalan (mengikuti jam perangkat)
    S.jamTimer = setInterval(() => {
      const j = $('#jamKini'); if (!j) return;
      j.textContent = fmt.jam(new Date()); $('#hariIni').textContent = fmt.hariTgl();
    }, 15000);

    // Statistik langsung
    const muatStat = async () => {
      const kartu = [];
      if (isAdmin) {
        const { data: semua } = await sb.from('profil_pengguna').select('peran,aktif');
        const aktif = (semua || []).filter(x => x.aktif);
        kartu.push(['Akun panitia aktif', aktif.length, 'ph-users-three', 'var(--c1)'],
                   ['Admin', aktif.filter(x => x.peran === 'admin').length, 'ph-user-gear', 'var(--c2)'],
                   ['Penguji', aktif.filter(x => x.peran === 'penguji').length, 'ph-chalkboard-teacher', 'var(--c5)']);
      } else {
        kartu.push(['Bidang tes Anda', (p.bidang_penguji || []).length, 'ph-exam', 'var(--c5)'],
                   ['Sesi tes ditugaskan', 0, 'ph-calendar-check', 'var(--c2)']);
      }
      kartu.push(['Notifikasi belum dibaca', S.unread, 'ph-bell-ringing', 'var(--c3)']);
      const el = $('#stats'); if (!el) return;
      el.style.gridTemplateColumns = kartu.length === 3 ? 'repeat(3,minmax(0,1fr))' : '';
      el.innerHTML = kartu.map(([l, n, ic, t]) => `
        <div class="stat" style="--tone:${t}"><span class="live">LIVE</span>
          <div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b>${fmt.angka(n)}</b><span>${l}</span></div>`).join('');
    };
    await muatStat();
    S.statTimer = setInterval(muatStat, 30000);
    HALAMAN.beranda.segarkanStat = muatStat;

    // Yang perlu dilengkapi Superadmin
    if (isSuper) {
      const id = S.pengaturan.identitas || {}, kop = S.pengaturan.kop_surat || {}, kp = S.pengaturan.ketua_panitia || {};
      const { count: jmlAdmin } = await sb.from('profil_pengguna').select('id', { count: 'exact', head: true }).eq('peran', 'admin').eq('aktif', true);
      const tugas = [
        [!!id.alamat && !!id.telepon, 'Lengkapi alamat dan telepon lembaga', '#/pengaturan?tab=identitas'],
        [!!(kop.logo_kanan || id.logo), 'Pasang logo pondok pada kop surat', '#/pengaturan?tab=kop'],
        [(jmlAdmin || 0) > 0, 'Tambahkan akun Admin panitia', '#/pengguna'],
        [!!kp.nama, 'Tunjuk Ketua Panitia (penanda tangan dokumen)', '#/pengaturan?tab=ketua']
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
        if (payload.eventType === 'INSERT') toast(payload.new.judul, 'info');
        await muatNotif();
        if (location.hash.startsWith('#/notifikasi')) HALAMAN.notifikasi.muatDaftar?.();
        HALAMAN.beranda.segarkanStat && location.hash.match(/^#?\/?(beranda)?$/) && HALAMAN.beranda.segarkanStat();
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
          <div class="chips-select">${Object.entries(NAMA_BIDANG).map(([v, l]) => `<label><input type="checkbox" name="bidang" value="${v}" ${(u.bidang_penguji || []).includes(v) ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
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
      <p class="muted" style="font-size:12.5px;margin-top:10px"><i class="ph-duotone ph-info"></i> Akun yang dinonaktifkan tidak dapat masuk, tetapi datanya tetap tersimpan.</p>`;

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
          <td class="hide-sm">${u.bagian === 'umum' ? 'Umum' : u.bagian === 'putra' ? 'Putra' : 'Putri'}${u.bidang_penguji?.length ? `<br><span class="muted" style="font-size:12px">${u.bidang_penguji.map(b => NAMA_BIDANG[b]).join(', ')}</span>` : ''}</td>
          <td class="hide-sm">${u.no_wa ? `<a href="https://wa.me/${esc(u.no_wa)}" target="_blank" rel="noopener" style="text-decoration:none"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i> ${esc(u.no_wa)}</a>` : '<span class="muted">–</span>'}</td>
          <td class="c">${u.aktif ? '<span class="pill" style="--tone:var(--ok)">Aktif</span>' : '<span class="pill" style="--tone:var(--c8)">Nonaktif</span>'}</td>
          <td class="c" style="white-space:nowrap">
            <button class="icon-btn plain" data-ubah="${u.id}" title="Ubah" aria-label="Ubah"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></button>
            <button class="icon-btn plain" data-sandi="${u.id}" title="Atur ulang kata sandi" aria-label="Atur ulang kata sandi"><i class="ph-duotone ph-key" style="color:var(--c6)"></i></button>
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
      const bU = e.target.closest('[data-ubah]'), bS = e.target.closest('[data-sandi]');
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
        <button role="tab" data-tab="kop"><i class="ph-duotone ph-identification-card" style="color:var(--c5)"></i>Kop surat</button>
        <button role="tab" data-tab="ketua"><i class="ph-duotone ph-seal-check" style="color:var(--c6)"></i>Ketua Panitia</button>
      </div>
      <div id="isiTab"></div>`;
    const buka = tab => {
      k.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      ({ identitas: tabIdentitas, kop: tabKop, ketua: tabKetua })[tab]($('#isiTab'));
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
          ${inp('tahun_ajaran', 'Tahun ajaran SPMB', id.tahun_ajaran, 'placeholder="2027/2028"')}
          ${inp('telepon', 'Telepon / WhatsApp kantor', id.telepon, 'inputmode="tel"')}
          ${inp('email', 'Email lembaga', id.email, 'type="email"')}
          <div class="field full"><label for="i_alamat">Alamat lengkap</label><textarea class="textarea" id="i_alamat" name="alamat" style="min-height:70px">${esc(id.alamat || '')}</textarea></div>
          ${inp('logo', 'Tautan logo pondok', id.logo, 'full placeholder="https://… (kosongkan untuk memakai assets/img/logo-pondok.png)"', 'Unggah gambar langsung tersedia di Fase 2. Sementara ini gunakan tautan gambar atau berkas logo di repositori.')}
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
    $('#fId').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, v = n => f.elements[n].value.trim();
      if (v('npsn') && !/^\d{8}$/.test(v('npsn'))) return toast('NPSN harus 8 digit angka.', 'err');
      const nilai = { ...id, nama_lembaga: v('nama_lembaga'), nama_singkat: v('nama_singkat'), tagline: v('tagline'), npsn: v('npsn'), nspp: v('nspp'),
        tahun_ajaran: v('tahun_ajaran'), telepon: v('telepon'), email: v('email'), alamat: v('alamat'), logo: v('logo'),
        video_profil: v('video_profil'), peta_lokasi: v('peta_lokasi'),
        media_sosial: { ...ms, youtube: v('youtube'), instagram: v('instagram'), facebook: v('facebook'), tiktok: v('tiktok') } };
      try { await simpanPengaturan('identitas', nilai); toast('Identitas lembaga disimpan.'); pasangLogo($('#brandLogo'), logoPondok(S.pengaturan)); $('#brandNama').textContent = nilai.nama_singkat; }
      catch (err) { toast(pesanGalat(err), 'err'); }
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
          <div data-mode="gambar">${inp('gambar_kop', 'Tautan gambar kop utuh', kop.gambar_kop, 'placeholder="https://…"', 'Gambar mendatar selebar kertas, sudah memuat logo dan teks.')}</div>
          <div data-mode="susun">
            <div class="grid-form">
              ${inp('logo_kiri', 'Tautan logo kiri', kop.logo_kiri)}
              ${inp('logo_kanan', 'Tautan logo kanan', kop.logo_kanan, '', 'Kosong = logo pondok dari Identitas.')}
            </div>
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
    const { data: admin } = await sb.from('profil_pengguna').select('id,nama_lengkap,email,niy').eq('peran', 'admin').eq('aktif', true).order('nama_lengkap');
    el.innerHTML = `
      <form class="card" id="fKetua" novalidate style="max-width:640px">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c6)"><i class="ph-duotone ph-seal-check"></i></div><div><h3>Ketua Panitia</h3><p>Satu-satunya penanda tangan di semua dokumen cetak</p></div></div>
        ${!admin?.length ? `<div class="note"><i class="ph-duotone ph-warning"></i><div>Belum ada akun Admin aktif. Tambahkan Admin di menu <a href="#/pengguna">Pengguna</a>, lalu kembali ke sini.</div></div>` : ''}
        <div class="field"><label for="kSel">Pilih dari akun Admin</label>
          <select class="select" id="kSel" name="pengguna_id"><option value="">— Pilih Admin —</option>
          ${(admin || []).map(a => `<option value="${a.id}" data-nama="${esc(a.nama_lengkap)}" data-niy="${esc(a.niy || '')}" ${kp.pengguna_id === a.id ? 'selected' : ''}>${esc(a.nama_lengkap || a.email)}</option>`).join('')}</select></div>
        ${inp('nama', 'Nama lengkap bergelar (seperti tertulis di dokumen)', kp.nama)}
        ${inp('niy', 'NIY', kp.niy)}
        <div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan Ketua Panitia</button></div>
      </form>`;
    const f = $('#fKetua');
    $('#kSel').onchange = e => {
      const o = e.target.selectedOptions[0];
      if (o?.dataset.nama) { f.elements.nama.value = o.dataset.nama; if (o.dataset.niy) f.elements.niy.value = o.dataset.niy; }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const nilai = { pengguna_id: f.elements.pengguna_id.value || null, nama: f.elements.nama.value.trim(), niy: f.elements.niy.value.trim() };
      if (!nilai.pengguna_id) return toast('Pilih akun Admin terlebih dahulu.', 'err');
      if (nilai.nama.length < 3) return toast('Nama Ketua Panitia wajib diisi.', 'err');
      try {
        await simpanPengaturan('ketua_panitia', nilai);
        await sb.rpc('kirim_notifikasi_ke_pengguna', { p_penerima: nilai.pengguna_id, p_judul: 'Anda ditunjuk sebagai Ketua Panitia', p_pesan: 'Nama Anda akan tercantum sebagai penanda tangan dokumen SPMB.', p_jenis: 'penting', p_tautan: '#/profil' });
        toast('Ketua Panitia disimpan.');
      } catch (err) { toast(pesanGalat(err), 'err'); }
    };
  }

  /* =================================================================
     LOG AKTIVITAS (Superadmin)
     ================================================================= */
  const NAMA_AKSI = { insert: ['Menambah', 'ph-plus-circle', 'var(--ok)'], update: ['Mengubah', 'ph-pencil-simple', 'var(--c1)'], delete: ['Menghapus', 'ph-trash', 'var(--danger)'],
    buat_akun: ['Membuat', 'ph-user-plus', 'var(--c2)'], atur_ulang_sandi: ['Atur ulang sandi', 'ph-key', 'var(--c6)'] };
  const NAMA_OBJEK = { profil_pengguna: 'akun pengguna', pengaturan: 'pengaturan', akun: 'akun' };
  HALAMAN.log = async k => {
    const { data, error } = await sb.from('log_aktivitas').select('*').order('dibuat_pada', { ascending: false }).limit(150);
    if (error) throw error;
    const nama = {};
    (await sb.from('profil_pengguna').select('id,nama_lengkap,email')).data?.forEach(p => nama[p.id] = p.nama_lengkap || p.email);
    const ringkas = r => {
      if (r.objek === 'pengaturan') return `Pengaturan "${esc(r.objek_id)}"`;
      if (r.objek === 'akun') return `Akun ${esc(r.rincian?.nama || nama[r.objek_id] || '')}${r.rincian?.peran ? ` (${NAMA_PERAN[r.rincian.peran]})` : ''}`;
      const b = r.rincian?.baru || r.rincian?.lama || {};
      return `Akun ${esc(b.nama_lengkap || b.email || '')}${r.aksi === 'update' && r.rincian?.lama?.peran !== r.rincian?.baru?.peran ? ` (peran: ${NAMA_PERAN[r.rincian.lama.peran]} → ${NAMA_PERAN[r.rincian.baru.peran]})` : ''}${r.aksi === 'update' && r.rincian?.lama?.aktif !== r.rincian?.baru?.aktif ? ` (${r.rincian.baru.aktif ? 'diaktifkan' : 'dinonaktifkan'})` : ''}`;
    };
    k.innerHTML = `
      <div class="page-head"><p class="muted" style="margin:0">150 aktivitas terakhir. Setiap perubahan akun dan pengaturan tercatat otomatis.</p><div class="spacer"></div>
        <button class="btn sm ghost" id="btnCetakLog"><i class="ph-duotone ph-printer"></i>Cetak</button></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Petugas</th><th>Aktivitas</th><th>Objek</th></tr></thead><tbody>
      ${data.length ? data.map(r => { const [l, ic, t] = NAMA_AKSI[r.aksi] || [r.aksi, 'ph-dot', 'var(--c8)']; return `
        <tr><td style="white-space:nowrap">${fmt.tglJam(r.dibuat_pada)}</td>
          <td>${esc(r.nama_pengguna || 'Sistem')}</td>
          <td><span class="pill" style="--tone:${t}"><i class="ph-duotone ${ic}"></i>${l} ${NAMA_OBJEK[r.objek] || esc(r.objek || '')}</span></td>
          <td>${ringkas(r)}</td></tr>`; }).join('') : '<tr><td colspan="4"><div class="empty"><i class="ph-duotone ph-clock-counter-clockwise"></i><b>Belum ada aktivitas</b></div></td></tr>'}
      </tbody></table></div>`;
    $('#btnCetakLog').onclick = () => cetakDokumen({
      judul: 'Log Aktivitas Sistem SPMB', meta: `Dicetak: ${fmt.tglPanjang(new Date())}`,
      isi: `<table><thead><tr><th style="width:6%">No</th><th style="width:20%">Waktu</th><th style="width:22%">Petugas</th><th style="width:20%">Aktivitas</th><th style="width:32%">Objek</th></tr></thead><tbody>
        ${data.map((r, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${fmt.tglJam(r.dibuat_pada)}</td><td>${esc(r.nama_pengguna || 'Sistem')}</td><td>${(NAMA_AKSI[r.aksi] || [r.aksi])[0]} ${NAMA_OBJEK[r.objek] || ''}</td><td>${ringkas(r)}</td></tr>`).join('')}</tbody></table>`,
      ttd: [{ jabatan: 'Superadmin', nama: S.profil.nama_lengkap }]
    });
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
          ${p.peran === 'penguji' ? `<div class="field"><span class="label">Bidang tes</span><div>${(p.bidang_penguji || []).map(b => `<span class="pill" style="--tone:var(--c5)">${NAMA_BIDANG[b]}</span>`).join(' ') || '–'}</div></div>` : ''}
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
