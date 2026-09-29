/* =====================================================================
   INTI APLIKASI SPMB: koneksi Supabase, tema, format tanggal/waktu,
   pesan singkat (toast), dialog, pengaturan situs, dan cetak F4.
   Dipakai oleh semua halaman.
   ===================================================================== */
(function () {
  'use strict';
  const CFG = window.SPMB_CONFIG;

  /* ---------- Koneksi Supabase ---------- */
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  /* ---------- Tema: terang / gelap / ikuti sistem ---------- */
  const THEME_KEY = 'spmb-tema';
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { return 'system'; } }
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    document.querySelectorAll('[data-theme-btn]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.themeBtn === t)));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#1d1517' : '#c7332f');
    }
  }
  function setTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(t); }
  applyTheme(getTheme());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getTheme()));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-theme-btn]');
    if (b) setTheme(b.dataset.themeBtn);
  });
  const themeSegHTML = `
    <div class="theme-seg" role="group" aria-label="Tema tampilan">
      <button type="button" data-theme-btn="light" title="Tema terang" aria-label="Tema terang"><i class="ph-duotone ph-sun"></i></button>
      <button type="button" data-theme-btn="dark" title="Tema gelap" aria-label="Tema gelap"><i class="ph-duotone ph-moon-stars"></i></button>
      <button type="button" data-theme-btn="system" title="Ikuti sistem" aria-label="Ikuti tema sistem"><i class="ph-duotone ph-desktop"></i></button>
    </div>`;

  /* ---------- Format tanggal dan waktu (WITA mengikuti jam perangkat) ---------- */
  const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const pad = n => String(n).padStart(2, '0');
  const toDate = d => (d instanceof Date ? d : new Date(d));
  const fmt = {
    // 30/09/2026
    tgl(d) { if (!d) return '–'; d = toDate(d); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; },
    // 30 September 2026
    tglPanjang(d) { if (!d) return '–'; d = toDate(d); return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; },
    // Rabu, 30 September 2026
    hariTgl(d) { d = toDate(d || new Date()); return `${HARI[d.getDay()]}, ${fmt.tglPanjang(d)}`; },
    // 14.05
    jam(d) { if (!d) return '–'; d = toDate(d); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; },
    // 30/09/2026 14.05
    tglJam(d) { if (!d) return '–'; return `${fmt.tgl(d)} ${fmt.jam(d)}`; },
    // untuk <input type="date"> dan <input type="time">: bawaan hari ini / jam sekarang
    isoTgl(d) { d = toDate(d || new Date()); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    isoJam(d) { d = toDate(d || new Date()); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; },
    // "5 menit lalu"
    relatif(d) {
      const s = Math.round((Date.now() - toDate(d).getTime()) / 1000);
      if (s < 60) return 'baru saja';
      if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
      if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
      if (s < 7 * 86400) return `${Math.floor(s / 86400)} hari lalu`;
      return fmt.tglJam(d);
    },
    angka(n) { return new Intl.NumberFormat('id-ID').format(n || 0); }
  };
  // Isi otomatis kolom tanggal/jam yang kosong dengan hari ini / jam sekarang
  function isiTanggalBawaan(root) {
    (root || document).querySelectorAll('input[type="date"][data-default-today]').forEach(i => { if (!i.value) i.value = fmt.isoTgl(); });
    (root || document).querySelectorAll('input[type="time"][data-default-now]').forEach(i => { if (!i.value) i.value = fmt.isoJam(); });
  }

  /* ---------- Pengaman teks ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inisial = nama => (String(nama || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase();

  /* ---------- Toast ---------- */
  function toast(pesan, jenis = 'ok', lama = 3800) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const ikon = { ok: 'ph-check-circle', err: 'ph-warning-circle', warn: 'ph-warning', info: 'ph-info' }[jenis] || 'ph-info';
    const t = document.createElement('div');
    t.className = `toast ${jenis}`;
    t.innerHTML = `<i class="ph-duotone ${ikon}"></i><div>${esc(pesan)}</div>`;
    box.appendChild(t);
    setTimeout(() => t.remove(), lama);
  }

  /* ---------- Dialog ---------- */
  function dialog({ judul, ikon = 'ph-info', tone = 'var(--primary)', isi = '', tombol = [] }) {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(judul)}">
          <div class="modal-head"><div class="ic-box" style="--tone:${tone}"><i class="ph-duotone ${ikon}"></i></div><h3>${esc(judul)}</h3>
            <button class="icon-btn plain" data-x aria-label="Tutup"><i class="ph-duotone ph-x"></i></button></div>
          <div class="modal-body">${isi}</div>
          <div class="modal-foot">${tombol.map((b, i) => `<button class="btn ${b.kelas || ''}" data-i="${i}" type="${b.submit ? 'submit' : 'button'}">${b.ikon ? `<i class="ph-duotone ${b.ikon}"></i>` : ''}${esc(b.label)}</button>`).join('')}</div>
        </div>`;
      const tutup = v => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') tutup(null); };
      document.addEventListener('keydown', onKey);
      back.addEventListener('click', async e => {
        if (e.target === back || e.target.closest('[data-x]')) return tutup(null);
        const b = e.target.closest('[data-i]');
        if (!b) return;
        const def = tombol[+b.dataset.i];
        if (def.aksi) {
          b.disabled = true;
          try { const hasil = await def.aksi(back); if (hasil !== false) tutup(hasil ?? def.nilai ?? true); }
          catch (err) { toast(pesanGalat(err), 'err', 6000); }
          finally { b.disabled = false; }
        } else tutup(def.nilai ?? null);
      });
      document.body.appendChild(back);
      const f = back.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 50);
    });
  }
  const konfirmasi = (judul, isi, labelYa = 'Ya, lanjutkan', bahaya = false) => dialog({
    judul, isi: `<p style="margin:0 0 6px">${isi}</p>`, ikon: bahaya ? 'ph-warning' : 'ph-question',
    tone: bahaya ? 'var(--danger)' : 'var(--primary)',
    tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, { label: labelYa, kelas: bahaya ? 'danger' : '', nilai: true }]
  });

  /* ---------- Pesan galat dalam Bahasa Indonesia ---------- */
  function pesanGalat(err) {
    const m = String(err?.message || err || '');
    if (/Invalid login credentials/i.test(m)) return 'Email atau kata sandi salah.';
    if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Hubungi Superadmin.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    if (/rate limit|too many/i.test(m)) return 'Terlalu banyak percobaan. Silakan tunggu beberapa menit.';
    if (/should be different from the old password/i.test(m)) return 'Kata sandi baru harus berbeda dari yang lama.';
    if (/Password should be at least/i.test(m)) return 'Kata sandi minimal 8 karakter.';
    if (/User already registered|already been registered|already exists/i.test(m)) return 'Email tersebut sudah terdaftar.';
    if (/JWT|session/i.test(m) && /expired|invalid/i.test(m)) return 'Sesi Anda berakhir. Silakan masuk kembali.';
    if (/Function not found|404/i.test(m)) return 'Layanan pengelola akun belum dipasang (Langkah 3).';
    return m || 'Terjadi kesalahan. Silakan coba lagi.';
  }

  /* ---------- Pengaturan situs (identitas, kop surat, ketua panitia) ---------- */
  let cachePengaturan = null;
  async function muatPengaturan(paksa = false) {
    if (cachePengaturan && !paksa) return cachePengaturan;
    const { data, error } = await sb.from('pengaturan').select('kunci,nilai');
    if (error) throw error;
    cachePengaturan = Object.fromEntries((data || []).map(r => [r.kunci, r.nilai || {}]));
    return cachePengaturan;
  }
  const LOGO_BAWAAN = 'assets/img/logo-pondok.png';
  function logoPondok(p) {
    return (p?.identitas?.logo) || (p?.kop_surat?.logo_kanan) || LOGO_BAWAAN;
  }
  // Pasang logo pada elemen .brand-logo; bila gagal dimuat, tampilkan ikon
  function pasangLogo(el, url) {
    if (!el) return;
    el.innerHTML = `<img alt="Logo pondok" src="${esc(url)}">`;
    el.querySelector('img').onerror = () => { el.innerHTML = '<i class="ph-duotone ph-mosque"></i>'; };
  }

  /* ---------- Kop surat (pratinjau dan cetak) ---------- */
  function kopHTML(k = {}) {
    if (k.mode === 'gambar' && k.gambar_kop) {
      return `<div class="kop-preview"><img class="kop-img" alt="Kop surat" src="${esc(k.gambar_kop)}"></div>`;
    }
    const logo = u => u ? `<img class="kop-logo" alt="" src="${esc(u)}" onerror="this.style.visibility='hidden'">` : `<div class="kop-logo empty">Logo</div>`;
    return `
      <div class="kop-preview">
        <div class="kop-row">
          ${logo(k.logo_kiri)}
          <div class="kop-text">
            ${k.baris_1 ? `<div class="k1">${esc(k.baris_1)}</div>` : ''}
            ${k.baris_2 ? `<div class="k2">${esc(k.baris_2)}</div>` : ''}
            ${k.baris_3 ? `<div class="k2">${esc(k.baris_3)}</div>` : ''}
            ${k.baris_info ? `<div class="k3">${esc(k.baris_info)}</div>` : ''}
          </div>
          ${logo(k.logo_kanan)}
        </div>
        ${k.pita_teks ? `<div class="kop-band" style="background:${esc(k.pita_warna || '#F8E02F')}">${esc(k.pita_teks)}</div>` : '<div class="kop-line"></div>'}
      </div>`;
  }

  /* Cetak dokumen F4. isi: HTML badan dokumen.
     ttd: array 1–2 kolom tanda tangan {jabatan, nama, nip}, diletakkan sejajar kiri–kanan. */
  async function cetakDokumen({ judul, nomor = '', meta = '', isi = '', ttd = [], tempat = 'Gowa' }) {
    const p = await muatPengaturan().catch(() => ({}));
    const kolomTtd = ttd.length === 1 ? [{}, ttd[0]] : ttd; // satu penanda tangan: di kanan
    const area = document.getElementById('printArea') || Object.assign(document.createElement('div'), { id: 'printArea' });
    area.innerHTML = `
      <div class="doc">
        ${kopHTML(p.kop_surat || {})}
        <div class="doc-title">${esc(judul)}</div>
        ${nomor ? `<div class="doc-no">Nomor: ${esc(nomor)}</div>` : '<div style="height:10px"></div>'}
        ${meta ? `<div class="doc-meta">${meta}</div>` : ''}
        ${isi}
        ${kolomTtd.length ? `<div class="sign">${kolomTtd.map((t, i) => `
          <div>${t.jabatan ? `${i === kolomTtd.length - 1 ? `${esc(tempat)}, ${fmt.tglPanjang(new Date())}<br>` : '<br>'}${esc(t.jabatan)}<div class="space"></div><b>${esc(t.nama || '............................................')}</b>${t.nip ? `<br>${esc(t.nip)}` : ''}` : ''}</div>`).join('')}
        </div>` : ''}
        <div class="foot">Dicetak dari Sistem SPMB ${esc(p.identitas?.tahun_ajaran || '')} pada ${fmt.hariTgl(new Date())} pukul ${fmt.jam(new Date())} WITA</div>
      </div>`;
    if (!area.parentNode) document.body.appendChild(area);
    document.body.classList.add('printing');
    const selesai = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', selesai); };
    window.addEventListener('afterprint', selesai);
    // tunggu gambar kop termuat
    await Promise.all([...area.querySelectorAll('img')].map(img => img.complete ? 0 : new Promise(r => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', () => { img.style.visibility = 'hidden'; r(); }, { once: true });
    })));
    window.print();
    setTimeout(selesai, 1500);
  }

  /* ---------- Tampilkan/sembunyikan kata sandi ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('.toggle-pass');
    if (!b) return;
    const input = b.parentElement.querySelector('input');
    const lihat = input.type === 'password';
    input.type = lihat ? 'text' : 'password';
    b.innerHTML = `<i class="ph-duotone ${lihat ? 'ph-eye-slash' : 'ph-eye'}"></i>`;
    b.setAttribute('aria-label', lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
  });

  window.SPMB = {
    sb, CFG, fmt, esc, inisial, toast, dialog, konfirmasi, pesanGalat,
    muatPengaturan, logoPondok, pasangLogo, kopHTML, cetakDokumen,
    isiTanggalBawaan, setTheme, getTheme, themeSegHTML
  };
})();
