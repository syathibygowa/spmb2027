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
    return t;
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

  /* ---------- Isian tanggal dan jam seragam ----------
     Isian <input type="date|time|datetime-local"> bawaan peramban tampil
     mengikuti bahasa peramban (mis. mm/dd/yyyy dan AM/PM di peramban
     berbahasa Inggris). Semua isian tersebut otomatis dibungkus menjadi
     isian teks dd/mm/yyyy + kalender Indonesia, dan jam 24 jam (HH.MM).
     Isian asli tetap ada (tersembunyi) dan menyimpan nilai ISO, sehingga
     kode lain tetap membaca/mengisi .value seperti biasa. */
  const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const nilaiAsli = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const isoKeTeks = iso => /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
  const jamKeTeks = j => /^\d{2}:\d{2}/.test(j || '') ? j.slice(0, 5).replace(':', '.') : '';
  function teksKeIso(t) {
    const m = String(t || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return null;
    const d = +m[1], b = +m[2], y = +m[3], x = new Date(y, b - 1, d);
    return x.getFullYear() === y && x.getMonth() === b - 1 && x.getDate() === d && y >= 1900 ? `${y}-${pad(b)}-${pad(d)}` : null;
  }
  function teksKeJam(t) { const m = String(t || '').match(/^(\d{2})[.:](\d{2})$/); return m && +m[1] < 24 && +m[2] < 60 ? `${m[1]}:${m[2]}` : null; }
  const topengTgl = v => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
  const topengJam = v => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}.${d.slice(2)}` : d; };
  let kalenderTerbuka = null;
  const tutupKalender = () => { if (kalenderTerbuka) { kalenderTerbuka.remove(); kalenderTerbuka = null; } };
  document.addEventListener('mousedown', e => { if (kalenderTerbuka && !kalenderTerbuka.contains(e.target) && !e.target.closest('.btn-kalender')) tutupKalender(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && kalenderTerbuka) { e.stopPropagation(); tutupKalender(); } }, true);
  window.addEventListener('resize', tutupKalender);

  function rapikanIsianWaktu(inp) {
    if (inp.dataset.rapi || !['date', 'time', 'datetime-local'].includes(inp.type)) return;
    inp.dataset.rapi = '1';
    const jenis = inp.type, adaTgl = jenis !== 'time', adaJam = jenis !== 'date';
    const bungkus = document.createElement('span');
    bungkus.className = `isian-waktu jenis-${jenis}`;
    inp.parentNode.insertBefore(bungkus, inp);
    const kelas = inp.className.replace(/\b(asli-waktu)\b/g, '');
    const label = inp.getAttribute('aria-label') || (inp.id && document.querySelector(`label[for="${inp.id}"]`)?.textContent.trim()) || '';
    const buat = (k, ph, ml, lbl) => Object.assign(document.createElement('input'), { type: 'text', className: `${kelas} ${k}`, placeholder: ph, maxLength: ml, autocomplete: 'off', inputMode: 'numeric', title: ph === 'dd/mm/yyyy' ? 'Format tanggal: dd/mm/yyyy' : 'Format jam 24 jam: HH.MM' , ariaLabel: lbl });
    let tTgl, tJam, tombol;
    if (adaTgl) {
      const sub = document.createElement('span'); sub.className = 'isian-tgl';
      tTgl = buat('teks-tgl', 'dd/mm/yyyy', 10, (label ? label + ' ' : '') + '(dd/mm/yyyy)');
      tombol = Object.assign(document.createElement('button'), { type: 'button', className: 'btn-kalender', title: 'Pilih dari kalender', innerHTML: '<i class="ph-duotone ph-calendar-dots"></i>' });
      tombol.setAttribute('aria-label', 'Pilih tanggal dari kalender');
      sub.append(tTgl, tombol); bungkus.append(sub);
      if (inp.id) { const l = document.querySelector(`label[for="${inp.id}"]`); tTgl.id = inp.id + '__teks'; if (l) l.htmlFor = tTgl.id; }
    }
    if (adaJam) {
      tJam = buat('teks-jam', 'HH.MM', 5, (label ? label + ' ' : '') + '(jam, HH.MM)');
      bungkus.append(tJam);
      if (!adaTgl && inp.id) { const l = document.querySelector(`label[for="${inp.id}"]`); tJam.id = inp.id + '__teks'; if (l) l.htmlFor = tJam.id; }
    }
    bungkus.append(inp);
    inp.classList.add('asli-waktu'); inp.tabIndex = -1; inp.setAttribute('aria-hidden', 'true');

    const tampil = () => {
      const v = nilaiAsli.get.call(inp) || '';
      if (tTgl) tTgl.value = isoKeTeks(v.slice(0, 10));
      if (tJam) tJam.value = jamKeTeks(jenis === 'time' ? v : v.slice(11, 16));
      bungkus.classList.remove('belum');
    };
    const kunci = () => { [tTgl, tJam, tombol].forEach(x => { if (x) { x.disabled = inp.disabled; if (x !== tombol) x.readOnly = inp.readOnly; } }); if (tombol) tombol.disabled = inp.disabled || inp.readOnly; };
    Object.defineProperty(inp, 'value', { configurable: true, get() { return nilaiAsli.get.call(this); }, set(v) { nilaiAsli.set.call(this, v); tampil(); } });
    new MutationObserver(kunci).observe(inp, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
    const kirim = (v) => {
      if (v === nilaiAsli.get.call(inp)) return;
      nilaiAsli.set.call(inp, v);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    };
    // Nilai ISO dari teks; null = belum lengkap/tidak sah
    const hitung = () => {
      const d = tTgl ? (tTgl.value ? teksKeIso(tTgl.value) : '') : '', j = tJam ? (tJam.value ? teksKeJam(tJam.value) : '') : '';
      if (jenis === 'date') return d;
      if (jenis === 'time') return j;
      if (!tTgl.value && !tJam.value) return '';
      return d && j ? `${d}T${j}` : d && !tJam.value ? `${d}T00:00` : null;
    };
    const perbarui = () => { const v = hitung(); bungkus.classList.toggle('belum', v === null); if (v !== null) kirim(v); };
    const keluar = () => setTimeout(() => {
      if (bungkus.contains(document.activeElement) || kalenderTerbuka?.dataset.untuk === inp.dataset.rapiId) return;
      const v = hitung();
      [tTgl, tJam].forEach(x => x && x.classList.toggle('bad', v === null));
      if (v === null) kirim('');
      else if (jenis === 'datetime-local' && v && !tJam.value) tJam.value = '00.00';
      inp.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }, 0);
    [tTgl, tJam].forEach(x => {
      if (!x) return;
      x.addEventListener('input', () => { const p0 = x.value; x.value = x === tTgl ? topengTgl(x.value) : topengJam(x.value); if (x.value !== p0 && document.activeElement === x) x.setSelectionRange(x.value.length, x.value.length); x.classList.remove('bad'); perbarui(); });
      x.addEventListener('blur', keluar);
    });
    if (tombol) tombol.addEventListener('click', () => kalenderTerbuka?.dataset.untuk === inp.dataset.rapiId ? tutupKalender() : bukaKalender());
    inp.dataset.rapiId = Math.random().toString(36).slice(2);

    function bukaKalender() {
      tutupKalender();
      const pop = document.createElement('div');
      pop.className = 'kalender-pop'; pop.dataset.untuk = inp.dataset.rapiId;
      pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Kalender');
      const kini = fmt.isoTgl(), dipilih = teksKeIso(tTgl.value) || (nilaiAsli.get.call(inp) || '').slice(0, 10);
      const min = (inp.min || '').slice(0, 10), max = (inp.max || '').slice(0, 10);
      let acuan = dipilih || (max && max < kini ? max : min && min > kini ? min : kini);
      let th = +acuan.slice(0, 4), bl = +acuan.slice(5, 7) - 1;
      const thAwal = min ? +min.slice(0, 4) : new Date().getFullYear() - 80, thAkhir = max ? +max.slice(0, 4) : new Date().getFullYear() + 10;
      const gambar = () => {
        const awal = (new Date(th, bl, 1).getDay() + 6) % 7, jml = new Date(th, bl + 1, 0).getDate();
        let sel = ''; for (let i = 0; i < awal; i++) sel += '<span></span>';
        for (let d = 1; d <= jml; d++) {
          const iso = `${th}-${pad(bl + 1)}-${pad(d)}`, mati = (min && iso < min) || (max && iso > max);
          sel += `<button type="button" data-iso="${iso}" class="${iso === kini ? 'hari-ini' : ''}${iso === dipilih ? ' dipilih' : ''}" ${mati ? 'disabled' : ''}>${d}</button>`;
        }
        pop.innerHTML = `<div class="kal-kepala">
            <button type="button" class="kal-geser" data-geser="-1" aria-label="Bulan sebelumnya"><i class="ph-duotone ph-caret-left"></i></button>
            <select class="kal-bulan" aria-label="Bulan">${BULAN.map((b, i) => `<option value="${i}" ${i === bl ? 'selected' : ''}>${b}</option>`).join('')}</select>
            <select class="kal-tahun" aria-label="Tahun">${Array.from({ length: thAkhir - thAwal + 1 }, (_, i) => thAkhir - i).map(y => `<option ${y === th ? 'selected' : ''}>${y}</option>`).join('')}</select>
            <button type="button" class="kal-geser" data-geser="1" aria-label="Bulan berikutnya"><i class="ph-duotone ph-caret-right"></i></button></div>
          <div class="kal-hari">${HARI_PENDEK.map(h => `<span>${h}</span>`).join('')}</div>
          <div class="kal-tgl">${sel}</div>
          <div class="kal-kaki"><button type="button" data-aksi="kini" ${(min && kini < min) || (max && kini > max) ? 'disabled' : ''}>Hari ini</button>${inp.required ? '' : '<button type="button" data-aksi="hapus">Kosongkan</button>'}</div>`;
      };
      const pilih = iso => {
        tTgl.value = isoKeTeks(iso); tTgl.classList.remove('bad');
        if (tJam && !tJam.value) tJam.value = jenis === 'datetime-local' ? fmt.isoJam().replace(':', '.') : '';
        perbarui(); tutupKalender(); tTgl.focus(); tTgl.blur();
      };
      pop.addEventListener('click', e => {
        const g = e.target.closest('[data-geser]');
        if (g) { bl += +g.dataset.geser; if (bl < 0) { bl = 11; th--; } if (bl > 11) { bl = 0; th++; } th = Math.min(thAkhir, Math.max(thAwal, th)); gambar(); return; }
        const t = e.target.closest('[data-iso]'); if (t) return pilih(t.dataset.iso);
        const a = e.target.closest('[data-aksi]');
        if (a?.dataset.aksi === 'kini') pilih(kini);
        if (a?.dataset.aksi === 'hapus') { tTgl.value = ''; if (tJam) tJam.value = ''; perbarui(); tutupKalender(); tTgl.focus(); tTgl.blur(); }
      });
      pop.addEventListener('change', e => { if (e.target.matches('.kal-bulan')) bl = +e.target.value; if (e.target.matches('.kal-tahun')) th = +e.target.value; gambar(); });
      gambar();
      document.body.appendChild(pop); kalenderTerbuka = pop;
      const r = tTgl.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      if (innerWidth < 520) { pop.classList.add('bawah'); }
      else {
        pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
        pop.style.top = (r.bottom + h + 8 > innerHeight && r.top > h + 8 ? r.top - h - 6 : r.bottom + 6) + 'px';
      }
      pop.querySelector('.dipilih,.hari-ini,[data-iso]:not([disabled])')?.focus({ preventScroll: true });
    }
    kunci(); tampil();
  }
  const PILIH_WAKTU = 'input[type="date"],input[type="time"],input[type="datetime-local"]';
  const rapikanSemuaWaktu = (root = document) => root.querySelectorAll?.(PILIH_WAKTU).forEach(rapikanIsianWaktu);
  new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches(PILIH_WAKTU)) rapikanIsianWaktu(n); else rapikanSemuaWaktu(n);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => rapikanSemuaWaktu()); else rapikanSemuaWaktu();

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

  /* Dokumen F4 (kop, judul, isi, tanda tangan sejajar). Dipakai untuk cetak dan PDF
     agar hasil keduanya sama persis. isi: HTML badan dokumen.
     ttd: array 1–2 kolom tanda tangan {jabatan, nama, nip}, diletakkan sejajar kiri–kanan. */
  function htmlDokumen({ judul, nomor = '', meta = '', isi = '', ttd = [], tempat = 'Gowa' }, p) {
    const kolomTtd = ttd.length === 1 ? [{}, ttd[0]] : ttd; // satu penanda tangan: di kanan
    return `
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
  }
  async function cetakDokumen(opsi) {
    const p = await muatPengaturan().catch(() => ({}));
    const area = document.getElementById('printArea') || Object.assign(document.createElement('div'), { id: 'printArea' });
    area.innerHTML = htmlDokumen(opsi, p);
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

  /* ---------- PDF langsung dari peramban (tanpa Google Docs) ----------
     Dokumen yang sama dengan cetak disusun di bidang tak terlihat selebar isi F4
     (215,9 − 2×20 mm), dipotret beresolusi tinggi (html2canvas), lalu disusun ke
     halaman F4 bermargin 2 cm (jsPDF). Halaman dipotong di antara baris tabel. */
  const muatSkrip = src => new Promise((ok, gagal) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return ok();
    const sc = Object.assign(document.createElement('script'), { src, async: true });
    sc.dataset.src = src; sc.onload = ok; sc.onerror = () => { sc.remove(); gagal(new Error('Pustaka PDF tidak dapat dimuat. Periksa koneksi internet.')); };
    document.head.appendChild(sc);
  });
  let pustakaPdf;
  const siapkanPustakaPdf = () => pustakaPdf || (pustakaPdf = Promise.all([muatSkrip('assets/vendor/pdf/html2canvas.min.js'), muatSkrip('assets/vendor/pdf/jspdf.umd.min.js')]).catch(e => { pustakaPdf = null; throw e; }));
  const cacheGambarPdf = {};
  const blobKeDataURL = blob => new Promise((ok, gagal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = gagal; r.readAsDataURL(blob); });
  async function gambarKeDataURL(src) {
    if (!src || src.startsWith('data:')) return src;
    if (cacheGambarPdf[src]) return cacheGambarPdf[src];
    try { const r = await fetch(src, { mode: 'cors' }); if (!r.ok) throw 0; return (cacheGambarPdf[src] = await blobKeDataURL(await r.blob())); }
    catch (e) {
      // Gambar kop di Google Drive kadang tidak mengizinkan akses langsung: ambil lewat Apps Script
      const h = await kirimKeJembatan({ aksi: 'gambar_kop', url: src }, { publik: true });
      return (cacheGambarPdf[src] = h.data);
    }
  }
  async function buatPdfDokumen(opsi) {
    const [p] = await Promise.all([muatPengaturan().catch(() => ({})), siapkanPustakaPdf()]);
    const kanvas = document.createElement('div');
    kanvas.className = 'pdf-kanvas';
    kanvas.innerHTML = htmlDokumen(opsi, p);
    document.body.appendChild(kanvas);
    try {
      for (const img of kanvas.querySelectorAll('img')) {
        try { img.src = await gambarKeDataURL(img.getAttribute('src')); } catch (e) { img.style.visibility = 'hidden'; }
      }
      await Promise.all([...kanvas.querySelectorAll('img')].map(img => img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r; })));
      if (document.fonts?.ready) await document.fonts.ready;
      const SKALA = 2.5;
      const kanvasGambar = await window.html2canvas(kanvas, { scale: SKALA, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1280, windowHeight: 1800 });
      // Titik potong yang aman: bagian bawah baris tabel, paragraf, dan blok
      const atas = kanvas.getBoundingClientRect().top;
      const aman = [...kanvas.querySelectorAll('tr, p, .doc-meta, .doc-no, .doc-title, .kop-preview, .sign, .foot, table, .catatan-kotak, div[style*="height"]')]
        .map(el => el.getBoundingClientRect().bottom - atas).filter(y => y > 0).sort((a, b) => a - b);
      const pxPerMm = kanvas.offsetWidth / 175.9;
      const tinggiHal = 290.2 * pxPerMm, total = kanvas.scrollHeight;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: [215.9, 330.2], orientation: 'portrait', compress: true });
      let mulai = 0, hal = 0;
      while (mulai < total - 1) {
        let akhir = Math.min(total, mulai + tinggiHal);
        if (akhir < total) { const cocok = aman.filter(y => y > mulai + 40 && y <= akhir); if (cocok.length) akhir = cocok[cocok.length - 1] + 1; }
        const potong = document.createElement('canvas');
        potong.width = kanvasGambar.width; potong.height = Math.round((akhir - mulai) * SKALA);
        const ctx = potong.getContext('2d', { alpha: false }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, potong.width, potong.height);
        ctx.drawImage(kanvasGambar, 0, Math.round(mulai * SKALA), potong.width, potong.height, 0, 0, potong.width, potong.height);
        // latar putih murni (piksel hampir putih dibulatkan) agar tidak tampak abu-abu di layar
        const px = ctx.getImageData(0, 0, potong.width, potong.height), d = px.data;
        for (let i = 0; i < d.length; i += 4) { if (d[i] > 248 && d[i + 1] > 248 && d[i + 2] > 248) { d[i] = d[i + 1] = d[i + 2] = 255; } d[i + 3] = 255; }
        ctx.putImageData(px, 0, 0);
        if (hal++) pdf.addPage([215.9, 330.2], 'portrait');
        pdf.addImage(potong.toDataURL('image/png'), 'PNG', 20, 20, 175.9, (akhir - mulai) / pxPerMm, undefined, 'FAST');
        mulai = akhir;
      }
      pdf.setProperties({ title: opsi.judul + (opsi.nomor ? ' ' + opsi.nomor : ''), creator: 'Sistem SPMB ' + (p.identitas?.nama_singkat || '') });
      return pdf.output('datauristring').replace(/^data:application\/pdf;[^,]*,/, 'data:application/pdf;base64,');
    } finally { kanvas.remove(); }
  }
  async function unduhPdfDokumen(opsi, namaFile) {
    const data = await buatPdfDokumen(opsi);
    simpanPdf(data, namaFile);
    return data;
  }

  /* ---------- Grafik sederhana (HTML + CSS, tanpa pustaka) ----------
     Warna: --gr-satu (satu seri/besaran), --gr-putra dan --gr-putri (identitas).
     Setiap batang punya keterangan saat disentuh/diarahkan (data-tip) dan
     setiap grafik dapat dibuka sebagai tabel. */
  const angka = n => new Intl.NumberFormat('id-ID').format(n || 0);
  const grafik = {
    // Batang tegak, satu seri (mis. pendaftar harian). data: [{label, nilai, tip}]
    batang(data, { warna = 'var(--gr-satu)', labelTiap = 5, satuan = 'pendaftar' } = {}) {
      const maks = Math.max(1, ...data.map(d => d.nilai));
      const puncak = Math.max(...data.map(d => d.nilai));
      return `<div class="gr-batang" style="--gr-w:${warna}">
        <div class="gr-sumbu"><span>${angka(maks)}</span><span>0</span></div>
        <div class="gr-area">${data.map((d, i) => `<div class="gr-kolom" tabindex="0" data-tip="${esc(d.tip || `${d.label}: ${angka(d.nilai)} ${satuan}`)}">
            <i style="height:${d.nilai ? Math.max(3, d.nilai / maks * 100) : 0}%"></i>${d.nilai === puncak && puncak > 0 && data.filter(x => x.nilai === puncak).length === 1 ? `<b>${angka(d.nilai)}</b>` : ''}</div>`).join('')}</div>
        <div class="gr-label">${data.map((d, i) => `<span>${i % labelTiap === 0 || i === data.length - 1 ? esc(d.label) : ''}</span>`).join('')}</div>
      </div>`;
    },
    // Batang mendatar dengan nilai tertulis (mis. asal daerah). data: [{label, nilai}]
    mendatar(data, { warna = 'var(--gr-satu)', satuan = 'pendaftar' } = {}) {
      if (!data.length) return '<p class="gr-kosong">Belum ada data.</p>';
      const maks = Math.max(1, ...data.map(d => d.nilai));
      return `<ul class="gr-mendatar" style="--gr-w:${warna}">${data.map(d => `<li tabindex="0" data-tip="${esc(`${d.label}: ${angka(d.nilai)} ${satuan}`)}">
        <span class="gr-nama">${esc(d.label)}</span><span class="gr-jalur"><i style="width:${Math.max(2, d.nilai / maks * 100)}%"></i></span><b>${angka(d.nilai)}</b></li>`).join('')}</ul>`;
    },
    // Batang keterisian kuota
    kemajuan(terisi, kuota, warna = 'var(--gr-satu)') {
      const persen = kuota ? Math.min(100, Math.round(terisi / kuota * 100)) : 0;
      return `<span class="gr-kemajuan" style="--gr-w:${warna}" role="progressbar" aria-valuenow="${persen}" aria-valuemin="0" aria-valuemax="100"><i style="width:${persen}%"></i></span>`;
    },
    // Tabel data untuk setiap grafik (aksesibilitas)
    tabel(kolom, baris) {
      return `<details class="gr-tabel"><summary><i class="ph-duotone ph-table"></i>Lihat sebagai tabel</summary>
        <table><thead><tr>${kolom.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead>
        <tbody>${baris.map(b => `<tr>${b.map((x, i) => `<td${i ? ' class="c"' : ''}>${esc(typeof x === 'number' ? angka(x) : x)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
    }
  };

  /* ---------- Isi Bukti Pendaftaran (dipakai formulir, dashboard, cetak, dan PDF) ----------
     p: data pendaftar (kolom seperti tabel pendaftar) + gelombang (nama), jenisBerkas: ['pas_foto', ...] */
  function dokumenBukti(p, jenisBerkas, peng) {
    const kp = peng.ketua_panitia || {}, ta = peng.identitas?.tahun_ajaran || '';
    const label = Object.fromEntries((peng.spmb?.berkas || []).map(b => [b.kunci, b.label]));
    const t = (rows, lebar) => `<table><colgroup>${lebar.map(w => `<col style="width:${w}%">`).join('')}</colgroup>${rows}</table>`;
    const r = (a, b) => `<tr><td>${a}</td><td>${esc(b == null || b === '' ? '–' : String(b))}</td></tr>`;
    const wa = n => n ? '+' + String(n).replace(/^\+/, '') : '–';
    const alamat = [p.alamat_jalan, p.dusun, `RT ${p.rt || '–'}/RW ${p.rw || '–'}`, p.desa, p.kecamatan ? `Kec. ${p.kecamatan}` : '', p.kabupaten, p.provinsi, p.kode_pos].filter(Boolean).join(', ');
    const hafalan = +p.hafalan_juz >= 1 ? `${String(+p.hafalan_juz).replace('.', ',')} juz` : +p.hafalan_surah > 0 ? `${p.hafalan_surah} surah pendek (kurang dari 1 juz)` : 'Belum ada hafalan';
    const tglLahir = p.tanggal_lahir ? fmt.tglPanjang(new Date(p.tanggal_lahir + 'T00:00:00')) : '–';
    const urut = [...new Set(jenisBerkas || [])].sort((a, b) => Object.keys(label).indexOf(a) - Object.keys(label).indexOf(b));
    return {
      judul: 'Bukti Pendaftaran Santri Baru', nomor: p.no_registrasi,
      meta: `Tahun Ajaran ${esc(ta)} · ${esc(p.gelombang || '')} · Tanggal daftar: ${fmt.tglJam(p.dibuat_pada)} WITA${p.uji ? ' · <b>DATA UJI COBA</b>' : ''}`,
      isi: `<span class="dok-rapat"></span>${t(`<thead><tr><th>Data calon santri</th><th>Keterangan</th></tr></thead><tbody>
          ${r('Nama lengkap', p.nama_lengkap)}${r('NISN / NIK', `${p.nisn} / ${p.nik}`)}
          ${r('Tempat, tanggal lahir', `${p.tempat_lahir}, ${tglLahir}`)}
          ${r('Jenjang / bagian', `${p.jenjang} / ${p.bagian === 'putra' ? 'Putra' : 'Putri'}`)}${r('Asal daerah', `${p.asal_kabupaten || '–'}, ${p.asal_provinsi || '–'}`)}
          ${r('Alamat domisili', alamat)}${r('Sekolah asal', p.asal_sekolah)}
          ${r('Nama ayah / ibu', `${p.nama_ayah || '–'} / ${p.nama_ibu || '–'}`)}${r('WhatsApp / email', `${wa(p.no_wa)} / ${String(p.email || '').toLowerCase()}`)}
          ${r('Hafalan Al-Qur\'an', hafalan)}</tbody>`, [34, 66])}
        <div style="height:6px"></div>
        ${urut.length ? t(`<thead><tr><th>No</th><th>Berkas yang diunggah</th><th>Status</th></tr></thead><tbody>
          ${urut.map((j, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(label[j] || j)}</td><td>Menunggu verifikasi</td></tr>`).join('')}</tbody>`, [8, 62, 30]) : ''}
        <p style="font-size:9pt;margin:6px 0 0">Catatan: simpan bukti ini. Status dan jadwal tes dapat dilihat di halaman Cek Status situs SPMB dengan nomor registrasi dan tanggal lahir santri.</p>`,
      ttd: [{ jabatan: 'Calon santri / wali,', nama: p.nama_lengkap }, { jabatan: 'Ketua Panitia SPMB,', nama: kp.nama, nip: kp.niy ? 'NIY. ' + kp.niy : '' }]
    };
  }

  /* =================================================================
     FASE 2: unggah berkas ke Google Drive, gambar, teks berformat
     ================================================================= */

  // Alamat Apps Script: dari Pengaturan > Integrasi, bila kosong dari config.js
  async function alamatUnggah() {
    const p = await muatPengaturan().catch(() => ({}));
    return (p.integrasi?.apps_script_url || CFG.appsScriptUrl || '').trim();
  }

  // publik = true: dipakai pengunjung tanpa akun (formulir pendaftaran), tanpa sesi Supabase
  async function kirimKeJembatan(data, { publik = false } = {}) {
    const url = await alamatUnggah();
    if (!url) throw new Error(publik ? 'Layanan unggah belum siap. Silakan hubungi panitia.' : 'Alamat Apps Script belum diatur (Pengaturan > Integrasi).');
    let token;
    if (!publik) {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Sesi Anda berakhir. Silakan masuk kembali.');
      token = session.access_token;
    }
    let res;
    try {
      // text/plain agar tidak memicu pemeriksaan CORS tambahan dari browser
      res = await fetch(url, { method: 'POST', body: JSON.stringify(token ? { ...data, token } : data) });
    } catch (e) { throw new Error('Tidak dapat terhubung ke layanan unggah. Periksa koneksi internet lalu coba lagi.'); }
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

  /* ---------- FASE 3: berkas pendaftar ---------- */
  // Unggah satu berkas dari formulir pendaftaran (pengunjung tanpa akun).
  // token: token unggah dari fungsi minta_token_unggah; jenis: kunci berkas (pas_foto, kk, ...).
  async function unggahBerkasPendaftar(file, { token, jenis, hanyaGambar = false }) {
    const t = (file.type || '').toLowerCase();
    if (/heic|heif/.test(t) || /\.(heic|heif)$/i.test(file.name)) throw new Error('Foto format HEIC belum didukung. Ubah pengaturan kamera ke JPG atau kirim tangkapan layarnya.');
    const izin = hanyaGambar ? ['image/jpeg', 'image/png', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!izin.includes(t)) throw new Error(hanyaGambar ? 'Gunakan foto berformat JPG atau PNG.' : 'Gunakan foto (JPG/PNG) atau PDF.');
    let siap = file;
    if (t.startsWith('image/')) {
      siap = await kompresGambar(file, { maksSisi: 1600, kualitas: 0.8 });
      if (siap.size > 1024 * 1024) siap = await kompresGambar(file, { maksSisi: 1280, kualitas: 0.7 });
      if (siap.size > 3 * 1024 * 1024) throw new Error('Foto terlalu besar. Coba potong atau foto ulang dengan resolusi lebih kecil.');
    } else if (siap.size > 5 * 1024 * 1024) throw new Error('Ukuran PDF melebihi 5 MB. Perkecil dulu (misalnya dengan aplikasi pemindai atau ilovepdf.com).');
    return kirimKeJembatan({ aksi: 'unggah', keperluan: 'pendaftar', token_unggah: token, jenis, nama: siap.name, mime: siap.type, data: await bacaDataURL(siap) }, { publik: true });
  }
  // Setelah formulir terkirim: rapikan folder berkas dan kirim email konfirmasi
  // pdf (opsional): Bukti Pendaftaran yang dibuat peramban, dilampirkan ke email apa adanya
  const konfirmasiPendaftaran = (token, pdf = null) => kirimKeJembatan({ aksi: 'konfirmasi', token_unggah: token, ...(pdf ? { pdf } : {}) }, { publik: true });
  // Admin melihat berkas pendaftar (privat di Drive). Hasil: { nama, mime, data: dataURL }
  const lihatBerkasPendaftar = driveId => kirimKeJembatan({ aksi: 'lihat', id: driveId });
  // Bukti Pendaftaran PDF dari Apps Script: pendaftar memakai token formulirnya, panitia memakai id pendaftar
  const ambilBuktiPdf = ({ token, id }) => token
    ? kirimKeJembatan({ aksi: 'bukti', token_unggah: token }, { publik: true })
    : kirimKeJembatan({ aksi: 'bukti', id });
  // Simpan data:application/pdf;base64,... sebagai berkas di perangkat
  function simpanPdf(dataURL, nama) {
    const b64 = String(dataURL).split(',')[1] || '';
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nama.replace(/[\\/:*?"<>|]/g, '-') });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  // Admin menambah/mengganti berkas milik pendaftar (tersimpan di folder santri, privat)
  // santri + label: nama berkas di Drive menjadi "Nama Santri - Jenis Berkas - Nomor urut"
  async function unggahBerkasAdmin(file, { no, jenis, santri = '', label = '' }) {
    const t = (file.type || '').toLowerCase();
    if (/heic|heif/.test(t) || /\.(heic|heif)$/i.test(file.name)) throw new Error('Foto format HEIC belum didukung. Gunakan JPG atau PNG.');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(t)) throw new Error('Gunakan foto (JPG/PNG) atau PDF.');
    const siap = t.startsWith('image/') ? await kompresGambar(file, { maksSisi: 1600, kualitas: 0.8 }) : file;
    if (siap.size > 10 * 1024 * 1024) throw new Error('Ukuran berkas melebihi 10 MB.');
    return kirimKeJembatan({ aksi: 'unggah', keperluan: 'pendaftar_admin', bagian: no, santri, label, nama: `${jenis}-${siap.name}`, mime: siap.type, data: await bacaDataURL(siap) });
  }
  // Superadmin membuang banyak berkas pendaftar ke Sampah Drive (misalnya data uji)
  const hapusBerkasPendaftar = ids => ids.length ? kirimKeJembatan({ aksi: 'hapus', keperluan: 'pendaftar_admin', ids }) : Promise.resolve({ jumlah: 0 });

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
    muatPengaturan, logoPondok, pasangLogo, kopHTML, cetakDokumen, htmlDokumen, buatPdfDokumen, unduhPdfDokumen, dokumenBukti, grafik,
    isiTanggalBawaan, setTheme, getTheme, themeSegHTML,
    alamatUnggah, kirimKeJembatan, kompresGambar, unggahBerkas, hapusBerkasDrive, gambar, youtubeId,
    unggahBerkasPendaftar, konfirmasiPendaftaran, lihatBerkasPendaftar, hapusBerkasPendaftar,
    ambilBuktiPdf, simpanPdf, unggahBerkasAdmin,
    slugDari, nomorWA, teksBerformat, pasangFavicon, WARNA, IKON_PILIHAN
  };
})();
