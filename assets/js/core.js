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
  function dialog({ judul, ikon = 'ph-info', tone = 'var(--primary)', isi = '', tombol = [], lebar = false, saatBuka = null }) {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = `
        <div class="modal${lebar ? ' lebar' : ''}" role="dialog" aria-modal="true" aria-label="${esc(judul)}">
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
      if (saatBuka) { try { saatBuka(back); } catch (e) { console.error(e); } }
      const f = back.querySelector('input:not([type=hidden]):not([type=file]),select,textarea'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
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
  // Logo diunggah Superadmin di Pengaturan > Identitas (tersimpan di Google Drive)
  function logoPondok(p) {
    return (p?.identitas?.logo) || (p?.kop_surat?.logo_kanan) || '';
  }
  // Pasang logo pada elemen .brand-logo; bila kosong atau gagal dimuat, tampilkan ikon
  function pasangLogo(el, url) {
    if (!el) return;
    if (!url) { el.innerHTML = '<i class="ph-duotone ph-mosque"></i>'; return; }
    el.innerHTML = `<img alt="Logo pondok" src="${esc(gambar(url, 128))}">`;
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

  /* =================================================================
     FASE 2: unggah berkas ke Google Drive, gambar, teks berformat
     ================================================================= */

  // Alamat Apps Script: dari Pengaturan > Integrasi, bila kosong dari config.js
  async function alamatUnggah() {
    const p = await muatPengaturan().catch(() => ({}));
    return (p.integrasi?.apps_script_url || CFG.appsScriptUrl || '').trim();
  }

  async function kirimKeJembatan(data) {
    const url = await alamatUnggah();
    if (!url) throw new Error('Alamat Apps Script belum diatur (Pengaturan > Integrasi).');
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Sesi Anda berakhir. Silakan masuk kembali.');
    let res;
    try {
      // text/plain agar tidak memicu pemeriksaan CORS tambahan dari browser
      res = await fetch(url, { method: 'POST', body: JSON.stringify({ ...data, token: session.access_token }) });
    } catch (e) { throw new Error('Tidak dapat terhubung ke layanan unggah (Apps Script). Periksa koneksi atau alamat Apps Script.'); }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Layanan unggah tidak memberi jawaban yang benar. Pastikan Apps Script diterapkan dengan akses "Siapa saja".'); }
    if (!j.ok) throw new Error(j.error || 'Unggah gagal.');
    return j;
  }

  // Perkecil gambar di browser sebelum diunggah (hemat kuota dan cepat dibuka di HP)
  const bacaDataURL = blob => new Promise((ok, gagal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = gagal; r.readAsDataURL(blob); });
  async function kompresGambar(file, { maksSisi = 1600, kualitas = 0.82 } = {}) {
    const t = file.type;
    if (t === 'image/gif' || t === 'application/pdf') return file;
    if (t === 'image/png' && file.size <= 500 * 1024) return file;          // logo transparan tetap PNG
    const img = await new Promise((ok, gagal) => {
      const u = URL.createObjectURL(file), i = new Image();
      i.onload = () => { URL.revokeObjectURL(u); ok(i); };
      i.onerror = () => { URL.revokeObjectURL(u); gagal(new Error('Gambar tidak dapat dibaca.')); };
      i.src = u;
    });
    const skala = Math.min(1, maksSisi / Math.max(img.naturalWidth, img.naturalHeight));
    if (skala === 1 && file.size <= 400 * 1024 && t === 'image/jpeg') return file;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * skala); c.height = Math.round(img.naturalHeight * skala);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', kualitas));
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  }

  /* Unggah satu berkas. bagian: nama subfolder (mis. 'galeri').
     Hasil: { id, url, nama, ukuran }. Tercatat di tabel berkas_unggahan. */
  async function unggahBerkas(file, { bagian = 'umum', keperluan = 'konten', maksSisi = 1600 } = {}) {
    const izin = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!izin.includes(file.type)) throw new Error('Jenis berkas tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau PDF.');
    const siap = file.type.startsWith('image/') ? await kompresGambar(file, { maksSisi }) : file;
    if (siap.size > 10 * 1024 * 1024) throw new Error('Ukuran berkas melebihi 10 MB.');
    const hasil = await kirimKeJembatan({ aksi: 'unggah', keperluan, bagian, nama: siap.name, mime: siap.type, data: await bacaDataURL(siap) });
    await sb.from('berkas_unggahan').insert({ drive_id: hasil.id, nama: hasil.nama, url: hasil.url, mime: hasil.mime, ukuran: hasil.ukuran, keperluan, bagian });
    return hasil;
  }
  async function hapusBerkasDrive(driveId, keperluan = 'konten') {
    await kirimKeJembatan({ aksi: 'hapus', keperluan, id: driveId });
    await sb.from('berkas_unggahan').delete().eq('drive_id', driveId);
  }

  // Gambar Drive (lh3) dengan lebar tertentu agar ringan; tautan lain dibiarkan
  function gambar(url, lebar) {
    if (!url) return '';
    const m = String(url).match(/^https:\/\/lh3\.googleusercontent\.com\/d\/([\w-]+)/);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}${lebar ? '=w' + lebar : ''}`;
    const d = String(url).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    if (d) return `https://lh3.googleusercontent.com/d/${d[1]}${lebar ? '=w' + lebar : ''}`;
    return url;
  }

  // ID video YouTube dari berbagai bentuk tautan
  function youtubeId(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : '';
  }

  // Ubah judul menjadi alamat halaman: "Wisuda Tahfizh 2026" -> "wisuda-tahfizh-2026"
  const slugDari = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  // Nomor WA ke format 62…
  const nomorWA = s => { const n = String(s || '').replace(/[^\d]/g, ''); return n.startsWith('0') ? '62' + n.slice(1) : n; };

  /* Teks berformat sederhana untuk berita dan profil:
     ## Subjudul, ### Subjudul kecil, **tebal**, *miring*, [teks](https://…),
     - daftar, 1. daftar bernomor, > kutipan, ![keterangan](https://gambar) */
  function teksBerformat(src) {
    const inline = t => esc(t)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, a, u) => `<img src="${gambar(u, 1200)}" alt="${a}" loading="lazy">`)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<i>$2</i>');
    return String(src || '').replace(/\r/g, '').split(/\n{2,}/).map(blok => {
      const b = blok.trim(); if (!b) return '';
      const baris = b.split('\n');
      if (/^###\s/.test(b)) return `<h4>${inline(b.replace(/^###\s+/, ''))}</h4>`;
      if (/^##\s/.test(b)) return `<h3>${inline(b.replace(/^##\s+/, ''))}</h3>`;
      if (baris.every(l => /^\s*[-*]\s+/.test(l))) return `<ul>${baris.map(l => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      if (baris.every(l => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${baris.map(l => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
      if (baris.every(l => /^>\s?/.test(l))) return `<blockquote>${baris.map(l => inline(l.replace(/^>\s?/, ''))).join('<br>')}</blockquote>`;
      const g = b.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
      if (g) return `<figure><img src="${gambar(g[2], 1200)}" alt="${esc(g[1])}" loading="lazy">${g[1] ? `<figcaption>${esc(g[1])}</figcaption>` : ''}</figure>`;
      return `<p>${baris.map(inline).join('<br>')}</p>`;
    }).join('');
  }

  // Ikon tab browser mengikuti logo pondok di Pengaturan
  function pasangFavicon(url) {
    if (!url) return;
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    l.href = gambar(url, 128);
  }

  // Warna pendukung yang dapat dipilih untuk kartu (mengikuti tema terang/gelap)
  const WARNA = [['c1', 'Biru'], ['c2', 'Ungu'], ['c3', 'Oranye'], ['c4', 'Magenta'], ['c5', 'Toska'], ['c6', 'Emas'], ['c7', 'Merah'], ['c8', 'Abu-abu']];

  // Ikon Phosphor pilihan untuk kartu konten
  const IKON_PILIHAN = [
    'book-open-text', 'book-bookmark', 'books', 'mosque', 'moon-stars', 'star-and-crescent', 'hands-praying', 'student', 'graduation-cap',
    'chalkboard-teacher', 'exam', 'certificate', 'medal', 'trophy', 'crown', 'star', 'seal-check', 'shield-check', 'target', 'lightbulb',
    'brain', 'heart', 'hand-heart', 'handshake', 'users-three', 'user-circle', 'house-line', 'buildings', 'bed', 'bowl-food',
    'first-aid-kit', 'soccer-ball', 'basketball', 'barbell', 'bicycle', 'microphone-stage', 'megaphone', 'translate', 'globe-hemisphere-east',
    'laptop', 'desktop', 'flask', 'calculator', 'plant', 'tree', 'sun', 'leaf', 'compass', 'path', 'flag', 'rocket-launch',
    'calendar-check', 'clock', 'note-pencil', 'identification-card', 'clipboard-text', 'files', 'money', 'wallet', 'credit-card',
    'magnifying-glass', 'megaphone-simple', 'check-circle', 'chat-circle-dots', 'phone-call', 'whatsapp-logo', 'map-pin', 'bus', 'car', 'wifi-high'
  ];

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
    isiTanggalBawaan, setTheme, getTheme, themeSegHTML,
    alamatUnggah, kirimKeJembatan, kompresGambar, unggahBerkas, hapusBerkasDrive, gambar, youtubeId,
    slugDari, nomorWA, teksBerformat, pasangFavicon, WARNA, IKON_PILIHAN
  };
})();
