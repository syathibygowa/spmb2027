/* =====================================================================
   SITUS PUBLIK SPMB (Fase 2)
   Kerangka (bilah atas, navigasi bawah HP, kaki, tombol WhatsApp
   melayang) dan isi halaman: Beranda, Profil, Berita, Kontak.
   Semua isi dibaca dari Supabase dan diatur di Dashboard > Konten Situs.
   Halaman menentukan jenisnya lewat <body data-halaman="...">.
   ===================================================================== */
(function () {
  'use strict';
  const { sb, CFG, fmt, esc, toast, muatPengaturan, logoPondok, pasangLogo, themeSegHTML,
          gambar, youtubeId, teksBerformat, pasangFavicon, nomorWA } = window.SPMB;
  const $ = (s, r = document) => r.querySelector(s);
  const HAL = document.body.dataset.halaman || 'beranda';
  const MINTA_PRATINJAU = new URLSearchParams(location.search).has('pratinjau');
  const HARI_INI = fmt.isoTgl();

  const S = { p: {}, konten: {}, pratinjau: false, ta: '' };
  const IKON = {
    statistik: ['ph-chart-bar', 'var(--c1)'], video: ['ph-youtube-logo', 'var(--c7)'], keunggulan: ['ph-star', 'var(--c6)'], jaminan: ['ph-shield-check', 'var(--c5)'],
    program: ['ph-book-open-text', 'var(--c1)'], prestasi: ['ph-trophy', 'var(--c6)'], flyer: ['ph-image-square', 'var(--c4)'], biaya: ['ph-wallet', 'var(--c3)'],
    jadwal: ['ph-calendar-dots', 'var(--c2)'], alur: ['ph-path', 'var(--c3)'], testimoni: ['ph-quotes', 'var(--c2)'], galeri: ['ph-images', 'var(--c5)'],
    berita: ['ph-newspaper', 'var(--c3)'], faq: ['ph-question', 'var(--c1)'], kontak: ['ph-map-pin', 'var(--ok)']
  };
  const ID_BAGIAN = { flyer: 'brosur' };
  const idBagian = k => ID_BAGIAN[k] || k;
  const rupiah = n => 'Rp ' + fmt.angka(n || 0);
  const tanggalId = s => s ? fmt.tglPanjang(new Date(s + 'T00:00:00')) : '';
  const rentang = (a, b) => !b || a === b ? tanggalId(a) : `${tanggalId(a)} – ${tanggalId(b)}`;
  const tautanDaftar = () => 'index.html#alur';          // Fase 3: diganti halaman formulir

  /* =================================================================
     MUAT DATA
     ================================================================= */
  async function cekPratinjau() {
    if (!MINTA_PRATINJAU) return false;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return false;
    const { data } = await sb.rpc('is_panitia');
    return !!data;
  }
  // Konten tampil saja; mode pratinjau panitia juga memuat yang disembunyikan
  async function muatKonten(jenis) {
    let q = sb.from('konten_situs').select('id,jenis,judul,isi,gambar,data,urutan,tampil').in('jenis', jenis).is('diarsipkan_pada', null).order('urutan').order('id');
    if (!S.pratinjau) q = q.eq('tampil', true);
    const { data, error } = await q;
    if (error) throw error;
    jenis.forEach(j => S.konten[j] = []);
    data.forEach(x => { x.data = x.data || {}; S.konten[x.jenis].push(x); });
    // brosur mengikuti periode tampil
    if (S.konten.flyer && !S.pratinjau) S.konten.flyer = S.konten.flyer.filter(x => (!x.data.mulai || x.data.mulai <= HARI_INI) && (!x.data.selesai || x.data.selesai >= HARI_INI));
  }
  function queryBerita(kolom = 'id,slug,judul,ringkasan,sampul,kategori,terbit_pada,penulis_nama,dibaca,status') {
    let q = sb.from('berita').select(kolom).is('diarsipkan_pada', null);
    if (!S.pratinjau) q = q.eq('status', 'terbit').lte('terbit_pada', new Date().toISOString());
    return q;
  }
  const lencanaTersembunyi = x => S.pratinjau && x && x.tampil === false ? '<span class="lencana-sembunyi"><i class="ph-duotone ph-eye-slash"></i>Disembunyikan</span>' : '';

  /* =================================================================
     KERANGKA
     ================================================================= */
  const NAV = [
    ['beranda', 'Beranda', 'index.html', 'ph-house', 'var(--c7)'],
    ['profil', 'Profil', 'profil.html', 'ph-identification-badge', 'var(--c1)'],
    ['biaya', 'Biaya', 'index.html#biaya', 'ph-wallet', 'var(--c3)'],
    ['jadwal', 'Jadwal', 'index.html#jadwal', 'ph-calendar-dots', 'var(--c2)'],
    ['berita', 'Berita', 'berita.html', 'ph-newspaper', 'var(--c5)'],
    ['kontak', 'Kontak', 'kontak.html', 'ph-phone-call', 'var(--ok)']
  ];

  function pasangKerangka() {
    const id = S.p.identitas || {};
    const nama = id.nama_singkat || 'Ponpes Imam Asy-Syathiby';
    const ta = S.ta;

    $('#kepala').innerHTML = `
      ${S.pratinjau ? `<div class="pita-pratinjau"><i class="ph-duotone ph-eye"></i>Mode pratinjau panitia: item yang disembunyikan ikut tampil dan diberi tanda. <a href="${location.pathname}${location.search.replace(/[?&]pratinjau=1/, '').replace(/^&/, '?')}${location.hash}">Tutup pratinjau</a></div>` : ''}
      <header class="situs-bar">
        <a class="brand" href="index.html" aria-label="Beranda">
          <div class="brand-logo" id="brandLogo"></div>
          <div class="brand-teks"><b>${esc(nama)}</b><span>SPMB Tahun Ajaran ${esc(ta)}</span></div>
        </a>
        <nav class="situs-nav" aria-label="Menu utama">
          ${NAV.map(([k, l, h, ic, t]) => `<a href="${h}" style="--tone:${t}" class="${k === HAL ? 'aktif' : ''}"><i class="ph-duotone ${ic}"></i>${l}</a>`).join('')}
        </nav>
        <div class="situs-aksi">
          <div class="hide-sm">${themeSegHTML}</div>
          <a class="icon-btn hide-sm" href="masuk.html" title="Masuk panitia" aria-label="Masuk panitia"><i class="ph-duotone ph-sign-in"></i></a>
          <a class="btn sm" href="${tautanDaftar()}"><i class="ph-duotone ph-note-pencil"></i>Daftar</a>
        </div>
      </header>`;

    const lainnya = [
      ...['keunggulan', 'program', 'prestasi', 'flyer', 'biaya', 'jadwal', 'alur', 'galeri', 'faq']
        .map(k => [(S.p.beranda?.bagian || []).find(b => b.kunci === k)?.judul || k, `index.html#${idBagian(k)}`, IKON[k][0], IKON[k][1]]),
      ['Kontak dan Lokasi', 'kontak.html', 'ph-map-pin', 'var(--ok)'],
      ['Masuk Panitia', 'masuk.html', 'ph-sign-in', 'var(--c8)']
    ];
    $('#kaki').innerHTML = `
      <footer class="situs-kaki">
        <div class="wadah kaki-grid">
          <div>
            <div class="brand"><div class="brand-logo" id="kakiLogo"></div><div class="brand-teks"><b>${esc(nama)}</b><span>${esc(id.tagline || '')}</span></div></div>
            <p class="muted">${esc(id.nama_lembaga || '')}${id.alamat ? `<br>${esc(id.alamat)}` : ''}</p>
            ${id.npsn || id.nspp ? `<p class="muted kecil">${id.npsn ? `NPSN ${esc(id.npsn)}` : ''}${id.npsn && id.nspp ? ' · ' : ''}${id.nspp ? `NSPP ${esc(id.nspp)}` : ''}</p>` : ''}
            <div class="sosmed">${sosmedHTML()}</div>
          </div>
          <div><h4>Jelajahi</h4><ul class="kaki-tautan">${NAV.map(([, l, h, ic, t]) => `<li><a href="${h}"><i class="ph-duotone ${ic}" style="color:${t}"></i>${l}</a></li>`).join('')}</ul></div>
          <div><h4>Hubungi kami</h4><ul class="kaki-tautan">
            ${id.telepon ? `<li><a href="tel:${esc(id.telepon.replace(/[^\d+]/g, ''))}"><i class="ph-duotone ph-phone" style="color:var(--c1)"></i>${esc(id.telepon)}</a></li>` : ''}
            ${id.email ? `<li><a href="mailto:${esc(id.email)}"><i class="ph-duotone ph-envelope-simple" style="color:var(--c3)"></i>${esc(id.email)}</a></li>` : ''}
            ${(S.konten.kontak_panitia || []).slice(0, 3).map(k => `<li><a href="${waTautan(k.data.no_wa)}" target="_blank" rel="noopener"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i>${esc(k.judul)}${k.data.bagian && k.data.bagian !== 'Umum' ? ` (${esc(k.data.bagian)})` : ''}</a></li>`).join('')}
            <li><a href="masuk.html"><i class="ph-duotone ph-sign-in" style="color:var(--c8)"></i>Masuk panitia</a></li></ul></div>
        </div>
        <div class="wadah kaki-bawah">© ${new Date().getFullYear()} ${esc(id.nama_lembaga || nama)}. Hak cipta dilindungi.</div>
      </footer>

      <nav class="situs-bawah" aria-label="Navigasi bawah">
        <a href="index.html" class="${HAL === 'beranda' ? 'aktif' : ''}" style="--tone:var(--c7)"><span class="pill-ic"><i class="ph-duotone ph-house"></i></span>Beranda</a>
        <a href="profil.html" class="${HAL === 'profil' ? 'aktif' : ''}" style="--tone:var(--c1)"><span class="pill-ic"><i class="ph-duotone ph-identification-badge"></i></span>Profil</a>
        <a href="${tautanDaftar()}" class="daftar"><span class="pill-ic"><i class="ph-duotone ph-note-pencil"></i></span>Daftar</a>
        <a href="berita.html" class="${HAL === 'berita' ? 'aktif' : ''}" style="--tone:var(--c5)"><span class="pill-ic"><i class="ph-duotone ph-newspaper"></i></span>Berita</a>
        <button type="button" id="btnLainnya" class="${HAL === 'kontak' ? 'aktif' : ''}" style="--tone:var(--c8)"><span class="pill-ic"><i class="ph-duotone ph-dots-nine"></i></span>Lainnya</button>
      </nav>

      <div class="lembar-back hidden" id="lembarLainnya">
        <div class="lembar" role="dialog" aria-modal="true" aria-label="Menu lainnya">
          <div class="lembar-pegangan"></div>
          <div class="lembar-kepala"><b>Menu</b>${themeSegHTML}</div>
          <div class="lembar-kisi">${lainnya.map(([l, h, ic, t]) => `<a href="${h}" style="--tone:${t}"><span class="ic-box"><i class="ph-duotone ${ic}"></i></span><span>${esc(l)}</span></a>`).join('')}</div>
        </div>
      </div>
      ${waMelayangHTML()}`;

    SPMB.setTheme(SPMB.getTheme());
    pasangLogo($('#brandLogo'), logoPondok(S.p));
    pasangLogo($('#kakiLogo'), logoPondok(S.p));
    if (id.logo) pasangFavicon(id.logo);

    const lembar = $('#lembarLainnya');
    $('#btnLainnya').onclick = () => lembar.classList.remove('hidden');
    lembar.addEventListener('click', e => { if (e.target === lembar || e.target.closest('a')) lembar.classList.add('hidden'); });
    const wa = $('#waMelayang');
    if (wa) {
      wa.querySelector('.wa-tombol').addEventListener('click', e => { if (wa.dataset.banyak) { e.preventDefault(); wa.classList.toggle('buka'); } });
      document.addEventListener('click', e => { if (!e.target.closest('#waMelayang')) wa.classList.remove('buka'); });
    }
    // bayangan bilah atas saat digulir
    const bar = $('.situs-bar');
    addEventListener('scroll', () => bar.classList.toggle('bergulir', scrollY > 8), { passive: true });
  }

  function sosmedHTML() {
    const ms = S.p.identitas?.media_sosial || {};
    const ikon = { youtube: ['ph-youtube-logo', '#e11d1d', 'YouTube'], instagram: ['ph-instagram-logo', '#c2336b', 'Instagram'], facebook: ['ph-facebook-logo', '#1877f2', 'Facebook'], tiktok: ['ph-tiktok-logo', 'var(--text)', 'TikTok'] };
    return Object.entries(ikon).filter(([k]) => ms[k]).map(([k, [ic, c, l]]) =>
      `<a href="${esc(ms[k])}" target="_blank" rel="noopener" aria-label="${l}" title="${l}" style="color:${c}"><i class="ph-duotone ${ic}"></i></a>`).join('');
  }

  const pesanWA = () => `Assalamu'alaikum, saya ingin bertanya tentang SPMB Tahun Ajaran ${S.ta} di ${S.p.identitas?.nama_singkat || 'pondok'}.`;
  const waTautan = no => `https://wa.me/${nomorWA(no)}?text=${encodeURIComponent(pesanWA())}`;
  function waMelayangHTML() {
    let daftar = (S.konten.kontak_panitia || []).filter(k => k.data.wa_melayang && k.data.no_wa);
    const tel = S.p.identitas?.telepon;
    if (!daftar.length && tel && nomorWA(tel).length >= 10) daftar = [{ judul: 'Kantor pondok', data: { no_wa: tel, peran: 'Informasi umum' } }];
    if (!daftar.length) return '';
    const banyak = daftar.length > 1;
    return `
      <div class="wa-melayang" id="waMelayang" ${banyak ? 'data-banyak="1"' : ''}>
        ${banyak ? `<div class="wa-menu"><b>Hubungi panitia</b>${daftar.map(k => `
          <a href="${waTautan(k.data.no_wa)}" target="_blank" rel="noopener"><span class="avatar">${esc(SPMB.inisial(k.judul))}</span>
            <span><b>${esc(k.judul)}</b><small>${esc(k.data.peran || (k.data.bagian && k.data.bagian !== 'Umum' ? 'Panitia ' + k.data.bagian : 'Panitia SPMB'))}</small></span></a>`).join('')}</div>` : ''}
        <a class="wa-tombol" href="${banyak ? '#' : waTautan(daftar[0].data.no_wa)}" target="_blank" rel="noopener" aria-label="Chat WhatsApp panitia">
          <i class="ph-duotone ph-whatsapp-logo"></i><span class="hide-sm">Tanya panitia</span></a>
      </div>`;
  }

  // Kepala bagian
  function kepala(kunci, s, tambahan = '') {
    const [ic, t] = IKON[kunci] || ['ph-square', 'var(--c8)'];
    return `<div class="sek-kepala">
      <span class="ic-box" style="--tone:${t}"><i class="ph-duotone ${ic}"></i></span>
      <div><h2>${esc(s.judul)}</h2>${s.subjudul ? `<p>${esc(s.subjudul)}</p>` : ''}</div>${tambahan}</div>`;
  }
  const kosong = (teks, ikon = 'ph-hourglass-medium') => `<div class="kosong-sek"><i class="ph-duotone ${ikon}"></i><b>${teks}</b></div>`;

  /* =================================================================
     BERANDA (landing page)
     ================================================================= */
  const RENDER = {
    statistik: () => `<div class="kosong-sek"><i class="ph-duotone ph-chart-bar"></i><b>Statistik pendaftar tampil saat pendaftaran online dibuka.</b></div>`,

    video: () => {
      const vids = (S.konten.video || []).filter(v => youtubeId(v.data.youtube));
      if (!vids.length && S.p.identitas?.video_profil && youtubeId(S.p.identitas.video_profil)) vids.push({ judul: 'Video profil', data: { youtube: S.p.identitas.video_profil } });
      if (!vids.length) return '';
      vids.sort((a, b) => (b.data.utama ? 1 : 0) - (a.data.utama ? 1 : 0));
      const [u, ...lain] = vids;
      return `<div class="video-wadah">
        <div class="video-utama" data-yt="${youtubeId(u.data.youtube)}">${ytSampul(u)}</div>
        ${lain.length ? `<div class="video-lain">${[u, ...lain].map((v, i) => `<button type="button" class="${i ? '' : 'aktif'}" data-pilih-yt="${youtubeId(v.data.youtube)}">
          <img alt="" loading="lazy" src="https://i.ytimg.com/vi/${youtubeId(v.data.youtube)}/mqdefault.jpg"><span>${esc(v.judul || 'Video')}${lencanaTersembunyi(v)}</span></button>`).join('')}</div>` : ''}
      </div>`;
    },

    keunggulan: () => {
      const d = S.konten.keunggulan || []; if (!d.length) return '';
      return sliderHTML(d.map(x => `
        <article class="kartu kartu-foto kartu-unggul" style="--tone:var(--${esc(x.data.warna || 'c1')})">
          <div class="foto">${x.gambar ? `<img alt="${esc(x.judul)}" loading="lazy" src="${esc(gambar(x.gambar, 720))}">` : `<div class="foto-kosong"><i class="ph-duotone ph-${esc(x.data.ikon || 'star')}"></i></div>`}
            <span class="ic-box lencana-ikon"><i class="ph-duotone ph-${esc(x.data.ikon || 'star')}"></i></span></div>
          <div class="isi"><b>${esc(x.judul)}</b>${x.isi ? `<p>${esc(x.isi)}</p>` : ''}${lencanaTersembunyi(x)}</div></article>`));
    },
    alur: () => !(S.konten.alur || []).length ? '' : `<ol class="alur">${S.konten.alur.map((x, i) => `
      <li style="--tone:var(--${esc(x.data.warna || 'c3')})"><span class="alur-no">${i + 1}</span><span class="ic-box"><i class="ph-duotone ph-${esc(x.data.ikon || 'check')}"></i></span>
        <div><b>${esc(x.judul)}</b>${x.isi ? `<p>${esc(x.isi)}</p>` : ''}${lencanaTersembunyi(x)}</div></li>`).join('')}</ol>`,

    jaminan: () => !(S.konten.jaminan || []).length ? '' : `<div class="kisi-3">${S.konten.jaminan.map(x => `
      <div class="kartu jaminan" style="--tone:var(--${esc(x.data.warna || 'c5')})">
        <div class="jaminan-atas"><span class="ic-box"><i class="ph-duotone ph-${esc(x.data.ikon || 'seal-check')}"></i></span>${x.data.target ? `<span class="target">${esc(x.data.target)}</span>` : ''}</div>
        <b>${esc(x.judul)}</b>${x.isi ? `<p>${esc(x.isi)}</p>` : ''}${lencanaTersembunyi(x)}</div>`).join('')}</div>`,

    program: () => !(S.konten.program || []).length ? '' : `<div class="kisi-3">${S.konten.program.map((x, i) => `
      <article class="kartu kartu-foto">
        <div class="foto">${x.gambar ? `<img alt="${esc(x.judul)}" loading="lazy" src="${esc(gambar(x.gambar, 720))}">` : `<div class="foto-kosong" style="--tone:var(--c${(i % 6) + 1})"><i class="ph-duotone ph-book-open-text"></i></div>`}
          ${x.data.jenjang ? `<span class="pill-foto">${esc(x.data.jenjang)}</span>` : ''}</div>
        <div class="isi"><b>${esc(x.judul)}</b>${x.isi ? `<p>${esc(x.isi)}</p>` : ''}${lencanaTersembunyi(x)}</div></article>`).join('')}</div>`,

    prestasi: () => {
      const d = S.konten.prestasi || []; if (!d.length) return '';
      const TONE = { Internasional: 'var(--c7)', Nasional: 'var(--c4)', Provinsi: 'var(--c2)', 'Kabupaten/Kota': 'var(--c1)', Kecamatan: 'var(--c5)', Sekolah: 'var(--c8)' };
      return `<div class="geser">${d.map(x => `
        <article class="kartu kartu-foto prestasi">
          <div class="foto">${x.gambar ? `<img alt="${esc(x.judul)}" loading="lazy" src="${esc(gambar(x.gambar, 600))}">` : '<div class="foto-kosong" style="--tone:var(--c6)"><i class="ph-duotone ph-trophy"></i></div>'}
            ${x.data.tingkat ? `<span class="pill-foto" style="background:${TONE[x.data.tingkat] || 'var(--c6)'}">${esc(x.data.tingkat)}</span>` : ''}</div>
          <div class="isi"><b>${esc(x.judul)}</b><span class="meta">${esc([x.data.nama_santri, x.data.tahun].filter(Boolean).join(' · '))}</span>${x.isi ? `<p>${esc(x.isi)}</p>` : ''}${lencanaTersembunyi(x)}</div></article>`).join('')}</div>`;
    },

    flyer: () => !(S.konten.flyer || []).length ? '' : `<div class="kisi-brosur">${S.konten.flyer.map((x, i) => `
      <button type="button" class="brosur" data-lightbox="flyer" data-i="${i}"><img alt="${esc(x.judul)}" loading="lazy" src="${esc(gambar(x.gambar, 700))}">
        <span><b>${esc(x.judul)}</b>${lencanaTersembunyi(x)}<small><i class="ph-duotone ph-magnifying-glass-plus"></i> Ketuk untuk memperbesar</small></span></button>`).join('')}</div>`,

    biaya: () => {
      const d = S.konten.biaya || [];
      if (!d.length) return kosong('Rincian biaya segera diumumkan.', 'ph-wallet');
      const jenjang = ['SMP', 'SMA'].filter(j => d.some(x => x.data.jenjang === j));
      const tab = jenjang.length ? jenjang : [''];
      const TAHAP = ['Pendaftaran', 'Daftar ulang', 'Bulanan', 'Tahunan', 'Lainnya'];
      const TONE_T = { Pendaftaran: 'var(--c1)', 'Daftar ulang': 'var(--c3)', Bulanan: 'var(--c5)', Tahunan: 'var(--c2)', Lainnya: 'var(--c8)' };
      const panel = j => {
        const isi = d.filter(x => !j || !x.data.jenjang || x.data.jenjang === 'Semua jenjang' || x.data.jenjang === j);
        return TAHAP.map(t => {
          const baris = isi.filter(x => (x.data.tahap || 'Lainnya') === t); if (!baris.length) return '';
          const total = baris.filter(x => x.data.wajib !== false).reduce((a, x) => a + (+x.data.nominal || 0), 0);
          const ikon = t === 'Bulanan' ? 'ph-calendar' : t === 'Daftar ulang' ? 'ph-clipboard-text' : t === 'Tahunan' ? 'ph-calendar-star' : 'ph-receipt';
          const label = t === 'Bulanan' ? 'Biaya bulanan' : t === 'Tahunan' ? 'Biaya tahunan' : t === 'Lainnya' ? 'Biaya lainnya' : 'Biaya ' + t.toLowerCase();
          return `<div class="biaya-grup" style="--tone:${TONE_T[t]}">
            <div class="biaya-grup-judul"><i class="ph-duotone ${ikon}"></i><span>${label}</span><b title="Total biaya wajib">${rupiah(total)}</b></div>
            <ul>${baris.map(x => `<li><div><span>${esc(x.judul)}</span>${x.data.bagian && x.data.bagian !== 'Putra dan putri' ? ` <em class="tag">${esc(x.data.bagian)}</em>` : ''}${x.data.wajib === false ? ' <em class="tag">Opsional</em>' : ''}${lencanaTersembunyi(x)}
              ${x.isi ? `<small>${esc(x.isi)}</small>` : ''}</div><b>${rupiah(x.data.nominal)}</b></li>`).join('')}</ul></div>`;
        }).join('');
      };
      return `<div class="kartu biaya-satu">
        <div class="biaya-atas">${tab.length > 1 ? `<div class="chip-tab kecil" role="tablist">${tab.map((j, i) => `<button type="button" role="tab" data-biaya="${esc(j)}" aria-selected="${!i}">Jenjang ${esc(j)}</button>`).join('')}</div>` : ''}
          <span class="muted"><i class="ph-duotone ph-info"></i> Angka di kanan judul = total biaya wajib</span></div>
        ${tab.map((j, i) => `<div class="biaya-kolom" data-panel-biaya="${esc(j)}" ${i ? 'hidden' : ''}>${panel(j)}</div>`).join('')}
      </div>
      <p class="catatan-sek"><i class="ph-duotone ph-info"></i>Rincian dapat berubah. Informasi rekening pembayaran disampaikan saat pendaftaran.</p>`;
    },

    jadwal: () => {
      const d = [...(S.konten.jadwal || [])].sort((a, b) => String(a.data.mulai || '').localeCompare(String(b.data.mulai || '')));
      if (!d.length) return kosong('Jadwal gelombang segera diumumkan.', 'ph-calendar-dots');
      const status = x => { const a = x.data.mulai, b = x.data.selesai || a;
        return !a ? ['', ''] : HARI_INI < a ? ['Akan datang', 'var(--c1)'] : HARI_INI > b ? ['Selesai', 'var(--c8)'] : ['Sedang berlangsung', 'var(--ok)']; };
      const gel = [...new Set([...(S.konten.jadwal || [])].map(x => x.data.gelombang || 'Jadwal'))];   // urutan gelombang mengikuti urutan di dashboard
      // gelombang yang dibuka pertama: yang masih berjalan atau akan datang
      const aktif = gel.find(g => d.some(x => (x.data.gelombang || 'Jadwal') === g && status(x)[0] !== 'Selesai')) || gel[gel.length - 1];
      return `<div class="kartu jadwal-satu">
        ${gel.length > 1 ? `<div class="chip-tab kecil" role="tablist">${gel.map(g => `<button type="button" role="tab" data-gel="${esc(g)}" aria-selected="${g === aktif}"><i class="ph-duotone ph-flag-banner"></i>${esc(g)}</button>`).join('')}</div>` : `<div class="jadwal-kepala"><i class="ph-duotone ph-flag-banner"></i><b>${esc(gel[0])}</b></div>`}
        ${gel.map((g, gi) => `<div class="linimasa-wadah" data-panel-gel="${esc(g)}" ${g === aktif ? '' : 'hidden'} style="--tone:var(--c${[2, 1, 5, 4, 3, 6][gi % 6]})">
          <ol class="linimasa-h">${d.filter(x => (x.data.gelombang || 'Jadwal') === g).map(x => { const [st, t] = status(x); return `
            <li class="${st === 'Selesai' ? 'lewat' : st === 'Sedang berlangsung' ? 'kini' : ''}"><span class="titik"></span>
              <span class="tgl">${rentang(x.data.mulai, x.data.selesai)}</span><b>${esc(x.judul)}</b>
              ${st ? `<span class="pill" style="--tone:${t}">${st}</span>` : ''}${lencanaTersembunyi(x)}${x.isi ? `<p>${esc(x.isi)}</p>` : ''}</li>`; }).join('')}</ol></div>`).join('')}
      </div>`;
    },

    testimoni: () => !(S.konten.testimoni || []).length ? '' : `<div class="geser">${S.konten.testimoni.map((x, i) => `
      <figure class="kartu testimoni" style="--tone:var(--c${[2, 5, 3, 1, 4, 6][i % 6]})">
        <i class="ph-duotone ph-quotes kutip"></i><blockquote>${esc(x.isi)}</blockquote>
        <figcaption>${x.gambar ? `<img class="avatar" alt="" loading="lazy" src="${esc(gambar(x.gambar, 160))}">` : `<span class="avatar">${esc(SPMB.inisial(x.judul))}</span>`}
          <span><b>${esc(x.judul)}</b><small>${esc([x.data.peran, x.data.keterangan].filter(Boolean).join(' · '))}</small></span>${lencanaTersembunyi(x)}</figcaption></figure>`).join('')}</div>`,

    galeri: () => {
      const d = S.konten.galeri || []; if (!d.length) return '';
      const album = [...new Set(d.map(x => x.data.album).filter(Boolean))];
      return `${album.length > 1 ? `<div class="chip-tab" role="tablist"><button type="button" data-album="" aria-selected="true">Semua</button>${album.map(a => `<button type="button" data-album="${esc(a)}" aria-selected="false">${esc(a)}</button>`).join('')}</div>` : ''}
        <div class="kisi-galeri">${d.map((x, i) => {
          const [ic, warna, nm] = sumberTautan(x.data.tautan);
          if (!x.gambar) return `<a class="galeri-item galeri-tautan" href="${esc(x.data.tautan)}" target="_blank" rel="noopener" data-album-item="${esc(x.data.album || '')}" style="--tone:${warna}">
            <i class="ph-duotone ${ic}"></i><b>${esc(x.judul || x.data.album || 'Album kegiatan')}</b><small>Buka di ${nm} <i class="ph-duotone ph-arrow-square-out"></i></small>${lencanaTersembunyi(x)}</a>`;
          return `<div class="galeri-sel" data-album-item="${esc(x.data.album || '')}"><button type="button" class="galeri-item" data-lightbox="galeri" data-i="${i}">
            <img alt="${esc(x.judul || 'Foto kegiatan')}" loading="lazy" src="${esc(gambar(x.gambar, 600))}">${x.judul ? `<span>${esc(x.judul)}</span>` : ''}${lencanaTersembunyi(x)}</button>
            ${x.data.tautan ? `<a class="galeri-link" href="${esc(x.data.tautan)}" target="_blank" rel="noopener" title="Buka album di ${nm}" aria-label="Buka album di ${nm}" style="--tone:${warna}"><i class="ph-duotone ${ic}"></i></a>` : ''}</div>`;
        }).join('')}</div>`;
    },

    berita: () => {
      const d = S.beritaTerbaru || []; if (!d.length) return '';
      return `<div class="kisi-3">${d.map(kartuBerita).join('')}</div>
        <div class="tengah"><a class="btn outline" href="berita.html"><i class="ph-duotone ph-newspaper"></i>Lihat semua berita</a></div>`;
    },

    faq: () => faqHTML(),
    kontak: () => kontakHTML()
  };

  // Ikon, warna, dan nama layanan untuk tautan galeri
  function sumberTautan(u) {
    u = String(u || '');
    if (/drive\.google|photos\.google|photos\.app\.goo/.test(u)) return ['ph-google-drive-logo', '#1a73e8', 'Google Drive'];
    if (/instagram/.test(u)) return ['ph-instagram-logo', '#c2336b', 'Instagram'];
    if (/facebook|fb\.watch|fb\.com/.test(u)) return ['ph-facebook-logo', '#1877f2', 'Facebook'];
    if (/tiktok/.test(u)) return ['ph-tiktok-logo', 'var(--text)', 'TikTok'];
    if (/youtu/.test(u)) return ['ph-youtube-logo', '#e11d1d', 'YouTube'];
    return ['ph-link-simple', 'var(--c5)', 'tautan'];
  }

  function sliderHTML(kartu) {
    return `<div class="slider" data-slider>
      <div class="slider-trek" tabindex="0" aria-roledescription="carousel">${kartu.join('')}</div>
      <button type="button" class="slider-nav kiri" data-geser="-1" aria-label="Sebelumnya"><i class="ph-duotone ph-caret-left"></i></button>
      <button type="button" class="slider-nav kanan" data-geser="1" aria-label="Berikutnya"><i class="ph-duotone ph-caret-right"></i></button>
      <div class="slider-titik" aria-hidden="true"></div>
    </div>`;
  }
  // Bergulir otomatis tiap 4 detik; berhenti saat disentuh/diarahkan kursor atau tidak terlihat
  function pasangSlider(root) {
    const diam = matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.querySelectorAll('[data-slider]').forEach(sl => {
      const trek = sl.querySelector('.slider-trek'), titik = sl.querySelector('.slider-titik');
      const langkah = () => { const k = trek.firstElementChild; return k ? k.getBoundingClientRect().width + parseFloat(getComputedStyle(trek).columnGap || 0) : trek.clientWidth; };
      const perLayar = () => Math.max(1, Math.round(trek.clientWidth / langkah()));
      const halaman = () => Math.max(1, trek.children.length - perLayar() + 1);
      const posisi = () => Math.round(trek.scrollLeft / langkah());
      const gambarTitik = () => {
        const n = halaman(); sl.classList.toggle('muat-semua', n <= 1);
        titik.innerHTML = n > 1 ? Array.from({ length: n }, (_, i) => `<span class="${i === Math.min(posisi(), n - 1) ? 'on' : ''}"></span>`).join('') : '';
      };
      const geser = arah => {
        const akhir = trek.scrollLeft + trek.clientWidth >= trek.scrollWidth - 4;
        if (arah > 0 && akhir) trek.scrollTo({ left: 0, behavior: 'smooth' });
        else if (arah < 0 && trek.scrollLeft <= 4) trek.scrollTo({ left: trek.scrollWidth, behavior: 'smooth' });
        else trek.scrollBy({ left: arah * langkah(), behavior: 'smooth' });
      };
      let jeda = false, terlihat = false, lanjutT;
      const henti = () => { jeda = true; clearTimeout(lanjutT); };
      const lanjut = (tunda = 0) => { clearTimeout(lanjutT); lanjutT = setTimeout(() => { jeda = false; }, tunda); };
      sl.addEventListener('mouseenter', henti); sl.addEventListener('mouseleave', () => lanjut());
      sl.addEventListener('touchstart', henti, { passive: true }); sl.addEventListener('touchend', () => lanjut(6000), { passive: true });
      sl.addEventListener('focusin', henti); sl.addEventListener('focusout', () => lanjut());
      sl.addEventListener('click', e => { const b = e.target.closest('[data-geser]'); if (b) { geser(+b.dataset.geser); henti(); lanjut(6000); } });
      let t; trek.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(gambarTitik, 80); }, { passive: true });
      addEventListener('resize', gambarTitik);
      new IntersectionObserver(([e]) => { terlihat = e.isIntersecting; }, { threshold: .4 }).observe(sl);
      gambarTitik();
      if (!diam) setInterval(() => { if (terlihat && !jeda && !document.hidden && halaman() > 1) geser(1); }, 4000);
    });
  }

  // Video utama berputar otomatis (tanpa suara, sesuai aturan browser) saat bagiannya terlihat
  function pasangPutarOtomatis(root) {
    const wadah = root.querySelector('.video-utama'); if (!wadah || !('IntersectionObserver' in window)) return;
    const perintah = f => { const fr = wadah.querySelector('iframe'); if (fr) fr.contentWindow.postMessage(JSON.stringify({ event: 'command', func: f, args: [] }), '*'); };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const tombol = wadah.querySelector('[data-putar]');
        if (tombol) tombol.outerHTML = iframeYT(tombol.dataset.putar, true);
        else perintah('playVideo');
      } else perintah('pauseVideo');
    }, { threshold: .5 }).observe(wadah);
  }
  const iframeYT = (id, bisu) => `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&enablejsapi=1${bisu ? '&mute=1' : ''}&origin=${encodeURIComponent(location.origin)}" title="Video profil" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

  function kartuIkon(d, kelas) {
    if (!(d || []).length) return '';
    return `<div class="kisi-3 ${kelas}">${d.map(x => `
      <div class="kartu kartu-ikon" style="--tone:var(--${esc(x.data.warna || 'c1')})"><span class="ic-box"><i class="ph-duotone ph-${esc(x.data.ikon || 'star')}"></i></span>
        <b>${esc(x.judul)}</b>${x.isi ? `<p>${esc(x.isi)}</p>` : ''}${lencanaTersembunyi(x)}</div>`).join('')}</div>`;
  }

  function ytSampul(v) {
    const id = youtubeId(v.data.youtube);
    return `<button type="button" class="yt-sampul" data-putar="${id}" aria-label="Putar video ${esc(v.judul || '')}">
      <img alt="" loading="lazy" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg"><span class="yt-play"><i class="ph-duotone ph-play"></i></span>
      ${v.judul ? `<span class="yt-judul">${esc(v.judul)}</span>` : ''}</button>`;
  }

  function kartuBerita(b) {
    const belum = b.status !== 'terbit' || new Date(b.terbit_pada) > new Date();
    return `<a class="kartu kartu-foto kartu-berita" href="berita.html?b=${encodeURIComponent(b.slug)}${S.pratinjau ? '&pratinjau=1' : ''}">
      <div class="foto">${b.sampul ? `<img alt="" loading="lazy" src="${esc(gambar(b.sampul, 720))}">` : '<div class="foto-kosong" style="--tone:var(--c3)"><i class="ph-duotone ph-newspaper"></i></div>'}
        <span class="pill-foto">${esc(b.kategori)}</span></div>
      <div class="isi"><span class="meta"><i class="ph-duotone ph-calendar-blank"></i>${fmt.tglPanjang(b.terbit_pada)}${belum && S.pratinjau ? ' · <b style="color:var(--c6)">Belum terbit</b>' : ''}</span>
        <b>${esc(b.judul)}</b>${b.ringkasan ? `<p>${esc(b.ringkasan)}</p>` : ''}<span class="baca">Baca selengkapnya <i class="ph-duotone ph-arrow-right"></i></span></div></a>`;
  }

  function faqHTML() {
    const d = S.konten.faq || []; if (!d.length) return '';
    const kat = [...new Set(d.map(x => x.data.kategori).filter(Boolean))];
    return `${kat.length > 1 ? `<div class="chip-tab"><button type="button" data-faq="" aria-selected="true">Semua</button>${kat.map(k => `<button type="button" data-faq="${esc(k)}" aria-selected="false">${esc(k)}</button>`).join('')}</div>` : ''}
      <div class="faq">${d.map(x => `<details data-faq-item="${esc(x.data.kategori || '')}"><summary><i class="ph-duotone ph-question"></i><span>${esc(x.judul)}</span>${lencanaTersembunyi(x)}<i class="ph-duotone ph-caret-down panah"></i></summary>
        <div class="artikel">${teksBerformat(x.isi)}</div></details>`).join('')}</div>`;
  }

  function petaSrc(id) {
    const u = String(id.peta_lokasi || '');
    if (/google\.[^/]+\/maps\/embed/.test(u)) return u;
    const q = u.match(/[?&]q=([^&]+)/)?.[1] || u.match(/\/maps\/place\/([^/]+)/)?.[1];
    if (q) return `https://maps.google.com/maps?q=${q}&output=embed`;
    const k = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (k) return `https://maps.google.com/maps?q=${k[1]},${k[2]}&z=16&output=embed`;
    if (id.alamat) return `https://maps.google.com/maps?q=${encodeURIComponent(id.alamat)}&output=embed`;
    return '';
  }

  function kontakHTML() {
    const id = S.p.identitas || {};
    const panitia = S.konten.kontak_panitia || [];
    const peta = petaSrc(id);
    const buka = id.peta_lokasi || (id.alamat ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(id.alamat)}` : '');
    return `<div class="kontak-grid">
      <div class="kontak-kiri">
        <div class="kartu kontak-info">
          ${id.alamat ? `<div class="baris"><span class="ic-box" style="--tone:var(--c7)"><i class="ph-duotone ph-map-pin"></i></span><div><small>Alamat</small><p>${esc(id.alamat)}</p></div></div>` : ''}
          ${id.telepon ? `<div class="baris"><span class="ic-box" style="--tone:var(--c1)"><i class="ph-duotone ph-phone"></i></span><div><small>Telepon</small><p><a href="tel:${esc(id.telepon.replace(/[^\d+]/g, ''))}">${esc(id.telepon)}</a></p></div></div>` : ''}
          ${id.email ? `<div class="baris"><span class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-envelope-simple"></i></span><div><small>Email</small><p><a href="mailto:${esc(id.email)}">${esc(id.email)}</a></p></div></div>` : ''}
          ${sosmedHTML() ? `<div class="baris"><span class="ic-box" style="--tone:var(--c4)"><i class="ph-duotone ph-share-network"></i></span><div><small>Media sosial</small><div class="sosmed">${sosmedHTML()}</div></div></div>` : ''}
        </div>
        ${panitia.length ? `<div class="kisi-panitia">${panitia.map((k, i) => `
          <div class="kartu panitia" style="--tone:var(--c${[5, 4, 1, 2][i % 4]})">
            <span class="avatar">${esc(SPMB.inisial(k.judul))}</span>
            <div><b>${esc(k.judul)}</b><small>${esc(k.data.peran || 'Panitia SPMB')}${k.data.bagian && k.data.bagian !== 'Umum' ? ` · ${esc(k.data.bagian)}` : ''}</small>${lencanaTersembunyi(k)}</div>
            <a class="btn sm wa" href="${waTautan(k.data.no_wa)}" target="_blank" rel="noopener"><i class="ph-duotone ph-whatsapp-logo"></i>Chat</a></div>`).join('')}</div>` : ''}
      </div>
      <div class="kartu peta">${peta ? `<iframe title="Peta lokasi pondok" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(peta)}"></iframe>` : '<div class="kosong-sek"><i class="ph-duotone ph-map-trifold"></i><b>Peta lokasi segera tersedia.</b></div>'}
        ${buka ? `<a class="btn ghost block" href="${esc(buka)}" target="_blank" rel="noopener"><i class="ph-duotone ph-navigation-arrow" style="color:var(--c1)"></i>Buka di Google Maps</a>` : ''}</div>
    </div>`;
  }

  function heroHTML() {
    const h = S.p.beranda?.hero || {}, id = S.p.identitas || {};
    const akhir = h.hitung_mundur ? new Date(h.hitung_mundur) : null;
    const adaHM = akhir && akhir > new Date();
    const foto = (h.gambar_daftar?.length ? h.gambar_daftar : (h.gambar ? [h.gambar] : [])).filter(Boolean);
    return `<section class="hero-situs hero-tengah${foto.length ? ' berfoto' : ''}" id="atas">
      ${foto.length ? `<div class="hero-slide" aria-hidden="true">${foto.map((u, i) => `<div class="hs${i ? '' : ' on'}" ${i ? `data-latar="${esc(gambar(u, 1920))}"` : `style="background-image:url('${esc(gambar(u, 1920))}')"`}></div>`).join('')}</div><div class="hero-lapis"></div>` : ''}
      <div class="wadah hero-isi">
        ${id.tagline ? `<span class="eyebrow"><i class="ph-duotone ph-sparkle"></i>${esc(id.tagline)}</span>` : ''}
        <h1>${esc(h.judul || 'Penerimaan Santri Baru')} <span class="ta">${esc(S.ta)}</span></h1>
        <p>${esc(h.subjudul || id.nama_lembaga || '')}</p>
        <div class="hero-actions">
          <a class="btn" href="${tautanDaftar()}"><i class="ph-duotone ph-note-pencil"></i>${esc(h.tombol_utama || 'Daftar Sekarang')}</a>
          <a class="btn ghost" href="index.html#jadwal"><i class="ph-duotone ph-megaphone"></i>${esc(h.tombol_kedua || 'Cek Pengumuman')}</a>
        </div>
        ${adaHM ? `<div class="hitung" data-akhir="${akhir.toISOString()}"><small><i class="ph-duotone ph-hourglass-medium"></i>${esc(h.label_hitung_mundur || 'Pendaftaran ditutup dalam')}</small>
          <div>${['hari', 'jam', 'menit', 'detik'].map((u, i) => `${i ? '<em>:</em>' : ''}<span><b data-u="${u}">00</b>${u}</span>`).join('')}</div></div>` : ''}
      </div>
      ${foto.length > 1 ? `<div class="hero-titik">${foto.map((_, i) => `<button type="button" data-hs="${i}" class="${i ? '' : 'on'}" aria-label="Foto ${i + 1}"></button>`).join('')}</div>` : ''}
    </section>`;
  }

  async function halBeranda() {
    const b = S.p.beranda?.bagian || [];
    const tampil = b.filter(s => s.tampil || S.pratinjau);
    const main = $('#isi');
    let alt = false;
    main.innerHTML = heroHTML() + tampil.map(s => {
      const fn = RENDER[s.kunci]; if (!fn) return '';
      let isi = fn();
      if (!isi) { if (!S.pratinjau) return ''; isi = kosong('Belum ada isi. Tambahkan di Dashboard > Konten Situs.', 'ph-tray'); }
      alt = !alt;
      return `<section class="sek${alt ? '' : ' alt'}${!s.tampil ? ' sek-sembunyi' : ''}" id="${idBagian(s.kunci)}">
        <div class="wadah">${!s.tampil ? '<span class="lencana-sembunyi besar"><i class="ph-duotone ph-eye-slash"></i>Bagian ini disembunyikan</span>' : ''}${kepala(s.kunci, s)}${isi}</div></section>`;
    }).join('');
    pasangInteraksi(main);
    pasangSlider(main);
    pasangPutarOtomatis(main);
    jalankanSliderHero();
    jalankanHitungMundur();
  }

  // Foto latar bagian pembuka berganti tiap 5 detik (crossfade)
  function jalankanSliderHero() {
    const slide = [...document.querySelectorAll('.hero-slide .hs')], titik = [...document.querySelectorAll('.hero-titik [data-hs]')];
    if (slide.length < 2) return;
    let i = 0, iv;
    const muatFoto = el => { if (el?.dataset.latar) { el.style.backgroundImage = `url('${el.dataset.latar}')`; delete el.dataset.latar; } };
    muatFoto(slide[1]);
    const ke = n => {
      i = (n + slide.length) % slide.length;
      muatFoto(slide[i]); muatFoto(slide[(i + 1) % slide.length]);
      slide.forEach((s, k) => s.classList.toggle('on', k === i));
      titik.forEach((t, k) => t.classList.toggle('on', k === i));
    };
    const mulai = () => { clearInterval(iv); iv = setInterval(() => { if (!document.hidden) ke(i + 1); }, 5000); };
    titik.forEach(t => t.onclick = () => { ke(+t.dataset.hs); mulai(); });
    mulai();
  }

  function jalankanHitungMundur() {
    const el = $('.hitung'); if (!el) return;
    const akhir = new Date(el.dataset.akhir);
    const pad = n => String(n).padStart(2, '0');
    const t = () => {
      let s = Math.max(0, Math.floor((akhir - Date.now()) / 1000));
      const v = { hari: Math.floor(s / 86400), jam: Math.floor(s % 86400 / 3600), menit: Math.floor(s % 3600 / 60), detik: s % 60 };
      Object.entries(v).forEach(([u, n]) => { const b = el.querySelector(`[data-u="${u}"]`); if (b) b.textContent = u === 'hari' ? n : pad(n); });
      if (!s) clearInterval(iv);
    };
    const iv = setInterval(t, 1000); t();
  }

  /* ---------- Interaksi bersama: video, tab, lightbox, FAQ ---------- */
  function pasangInteraksi(root) {
    root.addEventListener('click', e => {
      const putar = e.target.closest('[data-putar]');
      if (putar) {
        putar.outerHTML = iframeYT(putar.dataset.putar, false);
        return;
      }
      const pilih = e.target.closest('[data-pilih-yt]');
      if (pilih) {
        const wadah = root.querySelector('.video-utama'), v = (S.konten.video || []).find(x => youtubeId(x.data.youtube) === pilih.dataset.pilihYt) || { data: { youtube: 'https://youtu.be/' + pilih.dataset.pilihYt } };
        wadah.innerHTML = ytSampul(v); wadah.querySelector('[data-putar]').click();
        root.querySelectorAll('[data-pilih-yt]').forEach(b => b.classList.toggle('aktif', b === pilih));
        return;
      }
      const tb = e.target.closest('[data-biaya]');
      if (tb) {
        tb.parentNode.querySelectorAll('[data-biaya]').forEach(b => b.setAttribute('aria-selected', String(b === tb)));
        root.querySelectorAll('[data-panel-biaya]').forEach(p => p.hidden = p.dataset.panelBiaya !== tb.dataset.biaya);
        return;
      }
      const gl = e.target.closest('[data-gel]');
      if (gl) {
        gl.parentNode.querySelectorAll('[data-gel]').forEach(b => b.setAttribute('aria-selected', String(b === gl)));
        root.querySelectorAll('[data-panel-gel]').forEach(p => p.hidden = p.dataset.panelGel !== gl.dataset.gel);
        return;
      }
      const al = e.target.closest('[data-album]');
      if (al) {
        al.parentNode.querySelectorAll('[data-album]').forEach(b => b.setAttribute('aria-selected', String(b === al)));
        root.querySelectorAll('[data-album-item]').forEach(g => g.hidden = !!al.dataset.album && g.dataset.albumItem !== al.dataset.album);
        root.querySelectorAll('.galeri-sel [data-lightbox]').forEach(b => b.hidden = b.parentNode.hidden);
        return;
      }
      const fq = e.target.closest('[data-faq]');
      if (fq) {
        fq.parentNode.querySelectorAll('[data-faq]').forEach(b => b.setAttribute('aria-selected', String(b === fq)));
        root.querySelectorAll('[data-faq-item]').forEach(g => g.hidden = !!fq.dataset.faq && g.dataset.faqItem !== fq.dataset.faq);
        return;
      }
      const lb = e.target.closest('[data-lightbox]');
      if (lb) {
        const jenis = lb.dataset.lightbox;
        const semua = [...root.querySelectorAll(`[data-lightbox="${jenis}"]`)].filter(x => !x.hidden);
        const data = S.konten[jenis] || [];
        bukaLightbox(semua.map(x => data[+x.dataset.i]), semua.indexOf(lb), jenis === 'flyer');
      }
    });
  }

  function bukaLightbox(daftar, i, unduh) {
    const el = document.createElement('div');
    el.className = 'lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    const tampil = () => {
      const x = daftar[i];
      const drive = String(x.gambar || '').match(/googleusercontent\.com\/d\/([\w-]+)/)?.[1];
      el.innerHTML = `
        <div class="lb-atas"><span>${i + 1} / ${daftar.length}</span><span class="spacer"></span>
          ${unduh ? `<a class="icon-btn plain" href="${drive ? `https://drive.google.com/uc?export=download&id=${drive}` : esc(x.gambar)}" target="_blank" rel="noopener" title="Unduh" aria-label="Unduh"><i class="ph-duotone ph-download-simple"></i></a>` : ''}
          <button class="icon-btn plain" data-lb="tutup" aria-label="Tutup"><i class="ph-duotone ph-x"></i></button></div>
        <figure><img alt="${esc(x.judul || '')}" src="${esc(gambar(x.gambar, 1920))}">${x.judul || x.data?.tautan ? `<figcaption>${esc(x.judul || '')}${x.data?.album ? ` · ${esc(x.data.album)}` : ''}${x.data?.tanggal ? ` · ${tanggalId(x.data.tanggal)}` : ''}
          ${x.data?.tautan ? `<a class="lb-tautan" href="${esc(x.data.tautan)}" target="_blank" rel="noopener"><i class="ph-duotone ${sumberTautan(x.data.tautan)[0]}"></i>Lihat album lengkap di ${sumberTautan(x.data.tautan)[2]}</a>` : ''}</figcaption>` : ''}</figure>
        ${daftar.length > 1 ? `<button class="lb-nav kiri" data-lb="-1" aria-label="Sebelumnya"><i class="ph-duotone ph-caret-left"></i></button><button class="lb-nav kanan" data-lb="1" aria-label="Berikutnya"><i class="ph-duotone ph-caret-right"></i></button>` : ''}`;
    };
    const tutup = () => { el.remove(); document.removeEventListener('keydown', kunci); document.body.style.overflow = ''; };
    const geser = d => { i = (i + d + daftar.length) % daftar.length; tampil(); };
    const kunci = e => { if (e.key === 'Escape') tutup(); if (e.key === 'ArrowLeft') geser(-1); if (e.key === 'ArrowRight') geser(1); };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-lb]');
      if (b) return b.dataset.lb === 'tutup' ? tutup() : geser(+b.dataset.lb);
      if (e.target === el || e.target.tagName === 'FIGURE') tutup();
    });
    let x0 = null;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) geser(dx < 0 ? 1 : -1); x0 = null; });
    document.addEventListener('keydown', kunci);
    document.body.style.overflow = 'hidden';
    tampil(); document.body.appendChild(el);
  }

  /* =================================================================
     HALAMAN PROFIL
     ================================================================= */
  function kepalaHalaman(judul, sub, ikon, tone) {
    return `<section class="kepala-hal"><div class="wadah"><span class="ic-box" style="--tone:${tone}"><i class="ph-duotone ${ikon}"></i></span>
      <div><h1>${esc(judul)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div></section>`;
  }
  async function halProfil() {
    const pl = S.p.profil_lembaga || {}, id = S.p.identitas || {};
    const pim = S.konten.pimpinan || [];
    document.title = `Profil · ${id.nama_singkat || 'SPMB'}`;
    $('#isi').innerHTML = `${kepalaHalaman('Profil Lembaga', id.nama_lembaga, 'ph-identification-badge', 'var(--c1)')}
      <section class="sek"><div class="wadah profil-grid">
        <article class="kartu profil-isi">
          ${pl.gambar ? `<img class="profil-foto" alt="${esc(id.nama_lembaga || '')}" src="${esc(gambar(pl.gambar, 1400))}">` : ''}
          <h2>${esc(pl.judul || 'Selayang Pandang')}</h2>
          <div class="artikel">${teksBerformat(pl.isi) || '<p class="muted">Profil lembaga segera dilengkapi.</p>'}</div>
        </article>
        <aside class="profil-samping">
          ${pl.visi ? `<div class="kartu visi"><span class="ic-box" style="--tone:var(--c6)"><i class="ph-duotone ph-eye"></i></span><h3>Visi</h3><p>${esc(pl.visi)}</p></div>` : ''}
          ${(pl.misi || []).length ? `<div class="kartu misi"><span class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-target"></i></span><h3>Misi</h3><ol>${pl.misi.map(m => `<li>${esc(m)}</li>`).join('')}</ol></div>` : ''}
          <div class="kartu identitas-kecil">${[['NPSN', id.npsn], ['NSPP', id.nspp], ['Tahun ajaran SPMB', S.ta]].filter(([, v]) => v).map(([l, v]) => `<div><small>${l}</small><b>${esc(v)}</b></div>`).join('')}</div>
        </aside>
      </div></section>
      ${pim.length ? `<section class="sek alt" id="pimpinan"><div class="wadah">
        <div class="sek-kepala"><span class="ic-box" style="--tone:var(--c2)"><i class="ph-duotone ph-users-three"></i></span><div><h2>Pimpinan Pondok</h2><p>Direktur, wakil direktur, dan kepala bidang</p></div></div>
        <div class="kisi-pimpinan">${pim.map((x, i) => `
          <article class="kartu pimpinan" style="--tone:var(--c${[2, 1, 5, 4, 3, 6][i % 6]})">
            ${x.gambar ? `<img alt="${esc(x.judul)}" loading="lazy" src="${esc(gambar(x.gambar, 480))}">` : `<span class="avatar besar">${esc(SPMB.inisial(x.judul))}</span>`}
            <span class="pill">${esc(x.data.jabatan || '')}</span><b>${esc(x.judul)}</b>${lencanaTersembunyi(x)}
            ${x.isi ? `<details><summary>Baca sambutan</summary><div class="artikel">${teksBerformat(x.isi)}</div></details>` : ''}
          </article>`).join('')}</div></div></section>` : ''}
      <section class="sek"><div class="wadah ajakan"><div><h2>Siap bergabung bersama kami?</h2><p>Lihat biaya, jadwal gelombang, dan alur pendaftaran SPMB ${esc(S.ta)}.</p></div>
        <div class="hero-actions"><a class="btn" href="${tautanDaftar()}"><i class="ph-duotone ph-note-pencil"></i>Alur pendaftaran</a><a class="btn ghost" href="index.html#biaya"><i class="ph-duotone ph-wallet"></i>Biaya</a></div></div></section>`;
  }

  /* =================================================================
     HALAMAN BERITA (daftar dan baca)
     ================================================================= */
  async function halBerita() {
    const slug = new URLSearchParams(location.search).get('b');
    return slug ? bacaBerita(slug) : daftarBerita();
  }

  // Sidebar berita: kategori (dengan jumlah), berita terbaru, dan terpopuler
  async function sidebarBerita(kategoriAktif = '', kecualiId = null) {
    const [{ data: semua }, { data: baru }, { data: populer }] = await Promise.all([
      queryBerita('kategori'),
      queryBerita('id,slug,judul,sampul,terbit_pada,dibaca,status').order('terbit_pada', { ascending: false }).limit(6),
      queryBerita('id,slug,judul,sampul,terbit_pada,dibaca,status').order('dibaca', { ascending: false }).order('terbit_pada', { ascending: false }).limit(6)]);
    const jumlah = {}; (semua || []).forEach(x => jumlah[x.kategori] = (jumlah[x.kategori] || 0) + 1);
    const KAT_TONE = ['var(--c1)', 'var(--c3)', 'var(--c5)', 'var(--c2)', 'var(--c4)', 'var(--c6)'];
    const pra = S.pratinjau ? '&pratinjau=1' : '';
    const item = x => `<li><a href="berita.html?b=${encodeURIComponent(x.slug)}${pra}">
      ${x.sampul ? `<img alt="" loading="lazy" src="${esc(gambar(x.sampul, 200))}">` : '<span class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-newspaper"></i></span>'}
      <span><b>${esc(x.judul)}</b><small>${fmt.tglPanjang(x.terbit_pada)} · ${fmt.angka(x.dibaca)} dibaca</small></span></a></li>`;
    const saring = d => (d || []).filter(x => x.id !== kecualiId).slice(0, 5);
    return `<aside class="sisi-berita">
      <div class="kartu sisi-kartu">
        <h3><i class="ph-duotone ph-folders" style="color:var(--c2)"></i>Kategori</h3>
        <ul class="sisi-kategori">
          <li><a href="berita.html${S.pratinjau ? '?pratinjau=1' : ''}" data-k="" class="${kategoriAktif ? '' : 'aktif'}" style="--tone:var(--primary)"><i class="ph-duotone ph-squares-four"></i>Semua berita<span>${(semua || []).length}</span></a></li>
          ${Object.keys(jumlah).sort().map((k, i) => `<li><a href="berita.html?k=${encodeURIComponent(k)}${pra}" data-k="${esc(k)}" class="${k === kategoriAktif ? 'aktif' : ''}" style="--tone:${KAT_TONE[i % KAT_TONE.length]}"><i class="ph-duotone ph-tag"></i>${esc(k)}<span>${jumlah[k]}</span></a></li>`).join('')}
        </ul>
      </div>
      <div class="kartu sisi-kartu">
        <div class="sisi-tab" role="tablist">
          <button type="button" data-sisi="baru" aria-selected="true"><i class="ph-duotone ph-clock"></i>Terbaru</button>
          <button type="button" data-sisi="populer" aria-selected="false"><i class="ph-duotone ph-fire"></i>Terpopuler</button>
        </div>
        <ol class="sisi-daftar" data-panel-sisi="baru">${saring(baru).map(item).join('') || '<li class="muted">Belum ada berita.</li>'}</ol>
        <ol class="sisi-daftar bernomor" data-panel-sisi="populer" hidden>${saring(populer).map(item).join('') || '<li class="muted">Belum ada berita.</li>'}</ol>
      </div>
      <a class="kartu sisi-ajakan" href="${tautanDaftar()}"><i class="ph-duotone ph-note-pencil"></i><span><b>SPMB ${esc(S.ta)}</b><small>Lihat alur pendaftaran santri baru</small></span><i class="ph-duotone ph-arrow-right"></i></a>
    </aside>`;
  }
  function pasangSidebar(root, saatKategori) {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-sisi]');
      if (t) {
        root.querySelectorAll('[data-sisi]').forEach(b => b.setAttribute('aria-selected', String(b === t)));
        root.querySelectorAll('[data-panel-sisi]').forEach(p => p.hidden = p.dataset.panelSisi !== t.dataset.sisi);
        return;
      }
      const k = e.target.closest('.sisi-kategori [data-k]');
      if (k && saatKategori) { e.preventDefault(); saatKategori(k.dataset.k); }
    });
  }

  async function daftarBerita() {
    const id = S.p.identitas || {};
    document.title = `Berita · ${id.nama_singkat || 'SPMB'}`;
    const PER = 8;
    let hal = 0, kategori = new URLSearchParams(location.search).get('k') || '', cari = '', semuaKat = [];
    $('#isi').innerHTML = `${kepalaHalaman('Berita dan Artikel', 'Kabar terbaru kegiatan, prestasi, dan pengumuman pondok', 'ph-newspaper', 'var(--c3)')}
      <section class="sek"><div class="wadah berita-tata">
        <div class="berita-utama">
          <div class="bar-cari"><div class="input-wrap"><i class="ph-duotone ph-magnifying-glass ikon-cari"></i><input class="input" type="search" id="cariB" placeholder="Cari berita…"></div></div>
          <div class="chip-tab hanya-hp" id="katB"></div>
          <div class="judul-daftar" id="judulB"></div>
          <div class="kisi-2" id="daftarB"></div>
          <div class="tengah"><button class="btn outline hidden" id="lebihB"><i class="ph-duotone ph-arrow-down"></i>Muat lebih banyak</button></div>
        </div>
        <div id="sisiB"></div>
      </div></section>`;
    $('#sisiB').outerHTML = await sidebarBerita(kategori);
    const { data: kat } = await queryBerita('kategori');
    semuaKat = [...new Set((kat || []).map(x => x.kategori))].sort();
    $('#katB').innerHTML = semuaKat.length > 1 ? `<button type="button" data-k="" aria-selected="${!kategori}">Semua</button>${semuaKat.map(k => `<button type="button" data-k="${esc(k)}" aria-selected="${k === kategori}">${esc(k)}</button>`).join('')}` : '';
    const pilihKategori = k => {
      kategori = k;
      document.querySelectorAll('#katB [data-k], .sisi-kategori [data-k]').forEach(x => { const on = x.dataset.k === k; x.setAttribute('aria-selected', String(on)); x.classList.toggle('aktif', on); });
      history.replaceState(null, '', 'berita.html' + (k ? '?k=' + encodeURIComponent(k) : '') + (S.pratinjau ? (k ? '&' : '?') + 'pratinjau=1' : ''));
      muat();
    };
    pasangSidebar($('.berita-tata'), pilihKategori);
    const muat = async (tambah = false) => {
      if (!tambah) hal = 0;
      let q = queryBerita().order('terbit_pada', { ascending: false }).range(hal * PER, hal * PER + PER);
      if (kategori) q = q.eq('kategori', kategori);
      if (cari) q = q.ilike('judul', `%${cari.replace(/[%_]/g, '')}%`);
      const { data, error } = await q;
      if (error) throw error;
      $('#judulB').innerHTML = kategori || cari ? `<i class="ph-duotone ph-funnel"></i>${kategori ? `Kategori <b>${esc(kategori)}</b>` : ''}${kategori && cari ? ' · ' : ''}${cari ? `Pencarian "<b>${esc(cari)}</b>"` : ''}` : '';
      const ada = data.slice(0, PER);
      const html = ada.map(kartuBerita).join('');
      $('#daftarB').innerHTML = tambah ? $('#daftarB').innerHTML + html : (html || `<div class="kosong-sek lebar"><i class="ph-duotone ph-newspaper"></i><b>${cari || kategori ? 'Tidak ada berita yang cocok.' : 'Belum ada berita.'}</b></div>`);
      $('#lebihB').classList.toggle('hidden', data.length <= PER);
    };
    await muat();
    $('#lebihB').onclick = () => { hal++; muat(true); };
    let t; $('#cariB').oninput = e => { clearTimeout(t); t = setTimeout(() => { cari = e.target.value.trim(); muat(); }, 350); };
    $('#katB').onclick = e => { const b = e.target.closest('[data-k]'); if (b) pilihKategori(b.dataset.k); };
  }

  async function bacaBerita(slug) {
    const id = S.p.identitas || {};
    const { data: b, error } = await queryBerita('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!b) {
      $('#isi').innerHTML = `${kepalaHalaman('Berita tidak ditemukan', 'Berita mungkin sudah dipindahkan atau belum terbit.', 'ph-newspaper', 'var(--c3)')}
        <section class="sek"><div class="wadah tengah"><a class="btn" href="berita.html"><i class="ph-duotone ph-arrow-left"></i>Kembali ke daftar berita</a></div></section>`;
      return;
    }
    document.title = `${b.judul} · ${id.nama_singkat || 'SPMB'}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', b.ringkasan || b.judul);
    const urlBagi = location.origin + location.pathname + '?b=' + encodeURIComponent(b.slug);
    const { data: lain } = await queryBerita().neq('id', b.id).order('terbit_pada', { ascending: false }).limit(3);
    const belum = b.status !== 'terbit' || new Date(b.terbit_pada) > new Date();
    const sisi = await sidebarBerita(b.kategori, b.id);
    $('#isi').innerHTML = `
      <div class="baca-tata wadah">
      <article class="baca">
        <div>
          <a class="kembali" href="berita.html${S.pratinjau ? '?pratinjau=1' : ''}"><i class="ph-duotone ph-arrow-left"></i>Semua berita</a>
          ${belum ? `<div class="note" style="margin-top:12px"><i class="ph-duotone ph-eye"></i><div>Pratinjau: berita ini ${b.status === 'draf' ? 'masih berupa draf' : 'terjadwal terbit ' + fmt.tglJam(b.terbit_pada)} dan belum terlihat oleh pengunjung.</div></div>` : ''}
          <span class="pill" style="--tone:var(--c3)">${esc(b.kategori)}</span>
          <h1>${esc(b.judul)}</h1>
          <div class="baca-meta"><span><i class="ph-duotone ph-calendar-blank"></i>${fmt.hariTgl(b.terbit_pada)}</span>
            ${b.penulis_nama ? `<span><i class="ph-duotone ph-user"></i>${esc(b.penulis_nama)}</span>` : ''}
            <span><i class="ph-duotone ph-eye"></i>${fmt.angka(b.dibaca + (belum ? 0 : 1))} kali dibaca</span></div>
          ${b.sampul ? `<img class="baca-sampul" alt="" src="${esc(gambar(b.sampul, 1600))}">` : ''}
          <div class="artikel">${teksBerformat(b.isi)}</div>
          <div class="bagikan"><b>Bagikan</b>
            <a class="icon-btn" style="color:#16a34a" href="https://wa.me/?text=${encodeURIComponent(b.judul + '\n' + urlBagi)}" target="_blank" rel="noopener" aria-label="Bagikan ke WhatsApp"><i class="ph-duotone ph-whatsapp-logo"></i></a>
            <a class="icon-btn" style="color:#1877f2" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlBagi)}" target="_blank" rel="noopener" aria-label="Bagikan ke Facebook"><i class="ph-duotone ph-facebook-logo"></i></a>
            <button class="icon-btn" id="salinB" style="color:var(--c1)" aria-label="Salin tautan"><i class="ph-duotone ph-link-simple"></i></button></div>
        </div>
      </article>
      ${sisi}
      </div>
      ${(lain || []).length ? `<section class="sek alt"><div class="wadah"><div class="sek-kepala"><span class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-newspaper"></i></span><div><h2>Berita lainnya</h2></div></div>
        <div class="kisi-3">${lain.map(kartuBerita).join('')}</div></div></section>` : ''}`;
    pasangSidebar($('.baca-tata'));
    $('#salinB').onclick = async () => { try { await navigator.clipboard.writeText(urlBagi); toast('Tautan berita disalin.'); } catch (e) { prompt('Salin tautan berikut:', urlBagi); } };
    // hitung dibaca sekali per sesi browser
    const kunci = 'dibaca-' + b.id;
    try { if (!belum && !sessionStorage.getItem(kunci)) { sessionStorage.setItem(kunci, 1); sb.rpc('tambah_baca_berita', { p_id: b.id }).then(() => {}); } } catch (e) {}
  }

  /* =================================================================
     HALAMAN KONTAK
     ================================================================= */
  async function halKontak() {
    const id = S.p.identitas || {};
    document.title = `Kontak · ${id.nama_singkat || 'SPMB'}`;
    const faq = faqHTML();
    $('#isi').innerHTML = `${kepalaHalaman('Kontak dan Lokasi', 'Hubungi panitia SPMB atau kunjungi pondok kami', 'ph-phone-call', 'var(--ok)')}
      <section class="sek"><div class="wadah">${kontakHTML()}</div></section>
      ${faq ? `<section class="sek alt" id="faq"><div class="wadah">${kepala('faq', { judul: 'Tanya Jawab', subjudul: 'Pertanyaan yang sering diajukan' })}${faq}</div></section>` : ''}`;
    pasangInteraksi($('#isi'));
  }

  /* =================================================================
     MULAI
     ================================================================= */
  async function mulai() {
    S.pratinjau = await cekPratinjau().catch(() => false);
    S.p = await muatPengaturan();
    S.ta = S.p.identitas?.tahun_ajaran || '2027/2028';
    const jenis = { beranda: ['keunggulan', 'jaminan', 'program', 'prestasi', 'flyer', 'alur', 'testimoni', 'galeri', 'faq', 'video', 'kontak_panitia', 'biaya', 'jadwal'],
      profil: ['pimpinan', 'kontak_panitia'], berita: ['kontak_panitia'], kontak: ['kontak_panitia', 'faq'] }[HAL] || ['kontak_panitia'];
    const tugas = [muatKonten(jenis)];
    if (HAL === 'beranda') tugas.push(queryBerita().order('terbit_pada', { ascending: false }).limit(3).then(({ data }) => { S.beritaTerbaru = data || []; }));
    await Promise.all(tugas);
    pasangKerangka();
    await ({ beranda: halBeranda, profil: halProfil, berita: halBerita, kontak: halKontak }[HAL] || halBeranda)();
    // gulir ke bagian yang dituju setelah isi termuat
    if (location.hash.length > 1) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) setTimeout(() => t.scrollIntoView(), 60); }
  }

  mulai().catch(err => {
    console.error(err);
    $('#isi').innerHTML = `<section class="sek"><div class="wadah"><div class="note err"><i class="ph-duotone ph-warning-circle"></i><div><b>Isi situs belum dapat dimuat.</b><br>${esc(SPMB.pesanGalat(err))}<br><a href="">Muat ulang halaman</a></div></div></div></section>`;
  });
})();
