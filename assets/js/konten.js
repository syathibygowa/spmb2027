/* =====================================================================
   MENU KONTEN SITUS (Fase 2) · khusus Superadmin
   Mengelola isi landing page, profil lembaga, berita, dan berkas.
   Dimuat sebelum dashboard.js; dashboard memanggil SPMB_MODUL.konten().
   ===================================================================== */
(function () {
  'use strict';
  const { sb, fmt, esc, toast, dialog, konfirmasi, pesanGalat, muatPengaturan,
          unggahBerkas, hapusBerkasDrive, gambar, youtubeId, slugDari, nomorWA, teksBerformat,
          WARNA, IKON_PILIHAN } = window.SPMB;
  const $ = (s, r = document) => r.querySelector(s);
  const thn = new Date().getFullYear();

  /* =================================================================
     KOMPONEN FORMULIR BERSAMA (juga dipakai menu Pengaturan)
     ================================================================= */

  // Kolom gambar: tempel tautan atau unggah dari perangkat (dikompres otomatis)
  function inputGambar(nama, label, nilai = '', { bagian = 'umum', maksSisi = 1600, bantuan = '', wajib = false, bulat = false } = {}) {
    return `
      <div class="field full" data-gambar data-bagian="${esc(bagian)}" data-maks="${maksSisi}">
        <label>${label}${wajib ? ' <span class="req">*</span>' : ''}</label>
        <div class="img-pick">
          <div class="img-prev${bulat ? ' bulat' : ''}">${nilai ? `<img alt="" src="${esc(gambar(nilai, 400))}">` : '<i class="ph-duotone ph-image"></i>'}</div>
          <div class="img-act">
            <input class="input" name="${nama}" value="${esc(nilai)}" placeholder="Tempel tautan gambar, atau klik Unggah" autocomplete="off">
            <div class="img-btns">
              <label class="btn sm ghost"><i class="ph-duotone ph-upload-simple" style="color:var(--c1)"></i>Unggah<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label>
              <button type="button" class="btn sm ghost" data-kosongkan><i class="ph-duotone ph-x-circle" style="color:var(--c7)"></i>Kosongkan</button>
              <span class="img-status muted"></span>
            </div>
          </div>
        </div>
        ${bantuan ? `<small>${bantuan}</small>` : ''}
      </div>`;
  }
  function pasangPemilihGambar(root) {
    root.querySelectorAll('[data-gambar]').forEach(box => {
      if (box.dataset.siap) return; box.dataset.siap = 1;
      const input = box.querySelector('input[name]'), prev = box.querySelector('.img-prev'), status = box.querySelector('.img-status');
      const tampil = () => { prev.innerHTML = input.value.trim() ? `<img alt="" src="${esc(gambar(input.value.trim(), 400))}" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'ph-duotone ph-image-broken'}))">` : '<i class="ph-duotone ph-image"></i>'; };
      input.addEventListener('change', tampil);
      box.querySelector('[data-kosongkan]').onclick = () => { input.value = ''; tampil(); input.dispatchEvent(new Event('input', { bubbles: true })); };
      box.querySelector('input[type=file]').addEventListener('change', async e => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        status.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span> Mengunggah…';
        box.querySelectorAll('button,label.btn').forEach(b => b.classList.add('sibuk'));
        try {
          const h = await unggahBerkas(file, { bagian: box.dataset.bagian, maksSisi: +box.dataset.maks || 1600 });
          input.value = h.url; tampil();
          input.dispatchEvent(new Event('input', { bubbles: true }));
          status.textContent = `Terunggah (${Math.round(h.ukuran / 1024)} KB)`;
        } catch (err) { status.textContent = ''; toast(pesanGalat(err), 'err', 7000); }
        finally { box.querySelectorAll('.sibuk').forEach(b => b.classList.remove('sibuk')); }
      });
    });
  }

  // Beberapa gambar sekaligus (slider): unggah banyak, urutkan, hapus
  function inputDaftarGambar(nama, label, daftar = [], { bagian = 'umum', maks = 8, maksSisi = 2000, bantuan = '' } = {}) {
    return `
      <div class="field full" data-daftar-gambar data-nama="${nama}" data-bagian="${esc(bagian)}" data-maks="${maks}" data-sisi="${maksSisi}">
        <label>${label}</label>
        <input type="hidden" name="${nama}" value="${esc(JSON.stringify(daftar))}">
        <div class="dg-kisi"></div>
        <div class="img-btns" style="margin-top:8px">
          <label class="btn sm ghost"><i class="ph-duotone ph-upload-simple" style="color:var(--c1)"></i>Unggah foto<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label>
          <button type="button" class="btn sm ghost" data-dg-tautan><i class="ph-duotone ph-link-simple" style="color:var(--c5)"></i>Tambah dari tautan</button>
          <span class="img-status muted"></span>
        </div>
        ${bantuan ? `<small>${bantuan}</small>` : ''}
      </div>`;
  }
  function pasangDaftarGambar(root) {
    root.querySelectorAll('[data-daftar-gambar]').forEach(box => {
      if (box.dataset.siap) return; box.dataset.siap = 1;
      const h = box.querySelector('input[type=hidden]'), kisi = box.querySelector('.dg-kisi'), status = box.querySelector('.img-status');
      const maks = +box.dataset.maks;
      let daftar = []; try { daftar = JSON.parse(h.value) || []; } catch (e) {}
      const tampil = () => {
        kisi.innerHTML = daftar.length ? daftar.map((u, i) => `
          <div class="dg-item"><img alt="" src="${esc(gambar(u, 320))}"><span class="dg-no">${i + 1}</span>
            <div class="dg-aksi">
              <button type="button" data-dg="kiri" data-i="${i}" title="Geser ke kiri" aria-label="Geser ke kiri" ${i ? '' : 'disabled'}><i class="ph-duotone ph-caret-left"></i></button>
              <button type="button" data-dg="hapus" data-i="${i}" title="Hapus dari slider" aria-label="Hapus dari slider"><i class="ph-duotone ph-trash"></i></button>
              <button type="button" data-dg="kanan" data-i="${i}" title="Geser ke kanan" aria-label="Geser ke kanan" ${i < daftar.length - 1 ? '' : 'disabled'}><i class="ph-duotone ph-caret-right"></i></button>
            </div></div>`).join('')
          : '<div class="dg-kosong"><i class="ph-duotone ph-images"></i><span>Belum ada foto. Tanpa foto, latar memakai gradasi warna pondok.</span></div>';
        status.textContent = `${daftar.length} dari ${maks} foto`;
      };
      const simpan = () => { h.value = JSON.stringify(daftar); h.dispatchEvent(new Event('input', { bubbles: true })); tampil(); };
      kisi.addEventListener('click', e => {
        const b = e.target.closest('[data-dg]'); if (!b) return;
        const i = +b.dataset.i;
        if (b.dataset.dg === 'hapus') daftar.splice(i, 1);
        if (b.dataset.dg === 'kiri' && i > 0) [daftar[i - 1], daftar[i]] = [daftar[i], daftar[i - 1]];
        if (b.dataset.dg === 'kanan' && i < daftar.length - 1) [daftar[i + 1], daftar[i]] = [daftar[i], daftar[i + 1]];
        simpan();
      });
      box.querySelector('[data-dg-tautan]').onclick = () => {
        if (daftar.length >= maks) return toast(`Maksimal ${maks} foto.`, 'warn');
        const u = (prompt('Tempel tautan gambar (diawali https://):', 'https://') || '').trim();
        if (/^https?:\/\/\S+$/.test(u) && u !== 'https://') { daftar.push(u); simpan(); }
      };
      box.querySelector('input[type=file]').addEventListener('change', async e => {
        const files = [...e.target.files].slice(0, Math.max(0, maks - daftar.length)); e.target.value = '';
        if (!files.length) return toast(`Maksimal ${maks} foto.`, 'warn');
        for (const [i, f] of files.entries()) {
          status.innerHTML = `<span class="spinner" style="width:14px;height:14px"></span> Mengunggah ${i + 1} dari ${files.length}…`;
          try { const hsl = await unggahBerkas(f, { bagian: box.dataset.bagian, maksSisi: +box.dataset.sisi }); daftar.push(hsl.url); simpan(); }
          catch (err) { toast(`${f.name}: ${pesanGalat(err)}`, 'err', 7000); }
        }
        tampil();
      });
      tampil();
    });
  }

  // Pemilih ikon
  const inputIkon = (nama, label, nilai) => `
    <div class="field" data-ikon>
      <label>${label}</label>
      <input type="hidden" name="${nama}" value="${esc(nilai)}">
      <button type="button" class="ikon-now"><span class="ic-box"><i class="ph-duotone ph-${esc(nilai)}"></i></span><span>Pilih ikon</span><i class="ph-duotone ph-caret-down"></i></button>
      <div class="ikon-grid hidden">${IKON_PILIHAN.map(i => `<button type="button" data-i="${i}" title="${i}" class="${i === nilai ? 'on' : ''}"><i class="ph-duotone ph-${i}"></i></button>`).join('')}</div>
    </div>`;
  function pasangPemilihIkon(root) {
    root.querySelectorAll('[data-ikon]').forEach(box => {
      const grid = box.querySelector('.ikon-grid'), h = box.querySelector('input'), now = box.querySelector('.ikon-now i');
      box.querySelector('.ikon-now').onclick = () => grid.classList.toggle('hidden');
      grid.onclick = e => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        h.value = b.dataset.i; now.className = 'ph-duotone ph-' + b.dataset.i;
        grid.querySelectorAll('.on').forEach(x => x.classList.remove('on')); b.classList.add('on');
        grid.classList.add('hidden');
      };
    });
  }
  // Warna ikon mengikuti warna yang dipilih
  function pasangWarnaIkon(root) {
    const ic = root.querySelector('.ikon-now .ic-box');
    const w = () => { const v = root.querySelector('[name=warna]:checked')?.value; if (ic && v) ic.style.setProperty('--tone', `var(--${v})`); };
    root.querySelectorAll('[name=warna]').forEach(r => r.addEventListener('change', w)); w();
  }
  const inputWarna = (nama, label, nilai) => `
    <div class="field"><span class="label">${label}</span>
      <div class="warna-pick">${WARNA.map(([v, l]) => `<label title="${l}" style="--tone:var(--${v})"><input type="radio" name="${nama}" value="${v}" ${v === nilai ? 'checked' : ''}><span></span></label>`).join('')}</div></div>`;

  // Bilah format untuk kolom teks panjang (berita, profil)
  const bilahFormat = nama => `
    <div class="md-bar" data-untuk="${nama}">
      <button type="button" data-md="b" title="Tebal"><i class="ph-duotone ph-text-b"></i></button>
      <button type="button" data-md="i" title="Miring"><i class="ph-duotone ph-text-italic"></i></button>
      <button type="button" data-md="h" title="Subjudul"><i class="ph-duotone ph-text-h-two"></i></button>
      <button type="button" data-md="ul" title="Daftar"><i class="ph-duotone ph-list-bullets"></i></button>
      <button type="button" data-md="ol" title="Daftar bernomor"><i class="ph-duotone ph-list-numbers"></i></button>
      <button type="button" data-md="q" title="Kutipan"><i class="ph-duotone ph-quotes"></i></button>
      <button type="button" data-md="a" title="Tautan"><i class="ph-duotone ph-link-simple"></i></button>
      <label title="Sisipkan gambar"><i class="ph-duotone ph-image"></i><input type="file" accept="image/*" hidden></label>
      <span class="spacer"></span>
      <button type="button" data-md="lihat" class="txt"><i class="ph-duotone ph-eye"></i><span>Pratinjau</span></button>
    </div>`;
  function pasangBilahFormat(root, bagian = 'berita') {
    root.querySelectorAll('.md-bar').forEach(bar => {
      const ta = root.querySelector(`[name="${bar.dataset.untuk}"]`);
      const prev = document.createElement('div'); prev.className = 'artikel md-prev hidden'; ta.after(prev);
      const sisip = (awal, akhir = '', contoh = '') => {
        const a = ta.selectionStart, b = ta.selectionEnd, pilih = ta.value.slice(a, b) || contoh;
        ta.setRangeText(awal + pilih + akhir, a, b, 'end'); ta.focus();
      };
      const barisAwal = pref => {
        const a = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
        const pilih = ta.value.slice(a, ta.selectionEnd) || 'Teks';
        ta.setRangeText(pilih.split('\n').map((l, i) => (typeof pref === 'function' ? pref(i) : pref) + l).join('\n'), a, ta.selectionEnd, 'end'); ta.focus();
      };
      bar.addEventListener('click', e => {
        const b = e.target.closest('[data-md]'); if (!b) return;
        const m = b.dataset.md;
        if (m === 'b') sisip('**', '**', 'teks tebal');
        if (m === 'i') sisip('*', '*', 'teks miring');
        if (m === 'h') barisAwal('## ');
        if (m === 'ul') barisAwal('- ');
        if (m === 'ol') barisAwal(i => `${i + 1}. `);
        if (m === 'q') barisAwal('> ');
        if (m === 'a') { const u = prompt('Tempel alamat tautan (diawali https://):', 'https://'); if (u && /^https?:\/\//.test(u)) sisip('[', `](${u})`, 'teks tautan'); }
        if (m === 'lihat') {
          const buka = prev.classList.contains('hidden');
          prev.innerHTML = teksBerformat(ta.value) || '<p class="muted">Belum ada isi.</p>';
          prev.classList.toggle('hidden', !buka); ta.classList.toggle('hidden', buka);
          b.querySelector('span').textContent = buka ? 'Ubah' : 'Pratinjau';
        }
      });
      bar.querySelector('input[type=file]').addEventListener('change', async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        toast('Mengunggah gambar…', 'info', 2500);
        try { const h = await unggahBerkas(f, { bagian }); sisip('\n\n![', `](${h.url})\n\n`, 'Keterangan gambar'); }
        catch (err) { toast(pesanGalat(err), 'err', 7000); }
      });
    });
  }

  // Urutan: seret-lepas (laptop) dan tombol naik/turun (HP)
  function pasangUrutan(wadah, saatBerubah) {
    let seret = null;
    wadah.addEventListener('dragstart', e => {
      const r = e.target.closest('[data-urut]'); if (!r) return;
      seret = r; r.classList.add('diseret'); e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', r.dataset.urut); } catch (x) {}
    });
    wadah.addEventListener('dragover', e => {
      if (!seret) return; e.preventDefault();
      const r = e.target.closest('[data-urut]'); if (!r || r === seret) return;
      const kotak = r.getBoundingClientRect();
      r.parentNode.insertBefore(seret, e.clientY > kotak.top + kotak.height / 2 ? r.nextSibling : r);
    });
    wadah.addEventListener('dragend', () => { if (!seret) return; seret.classList.remove('diseret'); seret = null; saatBerubah(urutan()); });
    wadah.addEventListener('click', e => {
      const n = e.target.closest('[data-naik]'), t = e.target.closest('[data-turun]');
      const r = (n || t)?.closest('[data-urut]'); if (!r) return;
      if (n && r.previousElementSibling?.dataset.urut) r.parentNode.insertBefore(r, r.previousElementSibling);
      else if (t && r.nextElementSibling?.dataset.urut) r.parentNode.insertBefore(r.nextElementSibling, r);
      else return;
      saatBerubah(urutan());
    });
    const urutan = () => [...wadah.querySelectorAll('[data-urut]')].map(r => r.dataset.urut);
  }
  const tombolUrut = `<span class="urut-btn"><button type="button" class="icon-btn plain" data-naik title="Naikkan" aria-label="Naikkan"><i class="ph-duotone ph-caret-up"></i></button><button type="button" class="icon-btn plain" data-turun title="Turunkan" aria-label="Turunkan"><i class="ph-duotone ph-caret-down"></i></button></span>`;

  window.SPMB_UI = { inputGambar, pasangPemilihGambar, pasangUrutan, inputDaftarGambar, pasangDaftarGambar };

  /* =================================================================
     DEFINISI MODUL KONTEN
     t: teks · panjang · gambar · ikon · warna · pilihan · tanggal · angka · wa · youtube · cek
     Kolom judul, isi, gambar disimpan di kolom tabel; sisanya di "data".
     ================================================================= */
  const F = (k, l, t = 'teks', o = {}) => ({ k, l, t, ...o });
  const KOLOM = ['judul', 'isi', 'gambar'];
  const namaSumber = u => /drive\.google/.test(u) ? 'Google Drive' : /instagram/.test(u) ? 'Instagram' : /facebook|fb\.watch/.test(u) ? 'Facebook' : /tiktok/.test(u) ? 'TikTok' : /youtu/.test(u) ? 'YouTube' : 'Tautan';
  const rupiah = n => n == null || n === '' ? '' : 'Rp ' + fmt.angka(n);
  const potong = (s, n = 90) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  const MODUL = {
    keunggulan: { label: 'Keunggulan', ikon: 'ph-star', tone: 'var(--c6)', bagian: 'keunggulan',
      bidang: [F('gambar', 'Gambar kartu', 'gambar', { maksSisi: 1000, bantuan: 'Foto mendatar (4:3) yang menggambarkan keunggulan ini. Bila kosong, ikon ditampilkan besar sebagai gantinya.' }),
        F('ikon', 'Ikon', 'ikon', { bawaan: 'star' }), F('warna', 'Warna', 'warna', { bawaan: 'c6' }),
        F('judul', 'Judul', 'teks', { wajib: 1, maks: 80, contoh: 'Hafalan mutqin 30 juz' }), F('isi', 'Deskripsi singkat', 'panjang', { maks: 200 })],
      sub: x => potong(x.isi) },
    jaminan: { label: 'Jaminan Mutu', ikon: 'ph-shield-check', tone: 'var(--c5)', bagian: 'jaminan',
      bidang: [F('ikon', 'Ikon', 'ikon', { bawaan: 'seal-check' }), F('warna', 'Warna', 'warna', { bawaan: 'c5' }),
        F('target', 'Target atau angka', 'teks', { contoh: 'Minimal 10 juz', maks: 40 }),
        F('judul', 'Butir jaminan', 'teks', { wajib: 1, maks: 100, contoh: 'Hafalan Al-Qur\'an bersanad' }), F('isi', 'Penjelasan', 'panjang', { maks: 300 })],
      sub: x => [x.data.target, potong(x.isi, 70)].filter(Boolean).join(' · ') },
    program: { label: 'Program', ikon: 'ph-book-open-text', tone: 'var(--c1)', bagian: 'program',
      bidang: [F('gambar', 'Foto program', 'gambar'), F('judul', 'Nama program', 'teks', { wajib: 1, maks: 80 }),
        F('jenjang', 'Jenjang', 'pilihan', { pilihan: ['Semua jenjang', 'SMP', 'SMA'] }), F('isi', 'Deskripsi', 'panjang', { maks: 500 })],
      sub: x => [x.data.jenjang, potong(x.isi, 70)].filter(Boolean).join(' · ') },
    prestasi: { label: 'Prestasi', ikon: 'ph-trophy', tone: 'var(--c6)', bagian: 'prestasi',
      bidang: [F('gambar', 'Foto', 'gambar'), F('judul', 'Nama prestasi', 'teks', { wajib: 1, maks: 120, contoh: 'Juara 1 MHQ 10 Juz' }),
        F('nama_santri', 'Nama santri atau tim', 'teks', { maks: 100 }),
        F('tingkat', 'Tingkat', 'pilihan', { pilihan: ['Sekolah', 'Kecamatan', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional'] }),
        F('tahun', 'Tahun', 'angka', { min: 2000, maks: thn + 1, bawaan: thn }),
        F('kategori', 'Kategori', 'pilihan', { pilihan: ['Santri', 'Lembaga', 'Guru'] }), F('isi', 'Keterangan', 'panjang', { maks: 300 })],
      sub: x => [x.data.nama_santri, x.data.tingkat, x.data.tahun].filter(Boolean).join(' · ') },
    flyer: { label: 'Brosur', ikon: 'ph-image-square', tone: 'var(--c4)', bagian: 'brosur',
      bidang: [F('gambar', 'Gambar brosur/poster', 'gambar', { wajib: 1, maksSisi: 2400, bantuan: 'Poster tegak paling baik. Gambar diperkecil otomatis sampai 2400 piksel.' }),
        F('judul', 'Judul', 'teks', { wajib: 1, maks: 100, contoh: 'Brosur SPMB 2027/2028' }),
        F('mulai', 'Tampil mulai', 'tanggal', { hariIni: 1 }), F('selesai', 'Tampil sampai', 'tanggal', { bantuan: 'Kosongkan bila tampil terus.' }),
        F('isi', 'Keterangan', 'panjang', { maks: 300 })],
      sub: x => x.data.selesai ? `Tampil ${fmt.tgl(x.data.mulai)} s.d. ${fmt.tgl(x.data.selesai)}` : x.data.mulai ? `Tampil mulai ${fmt.tgl(x.data.mulai)}` : 'Tampil terus' },
    alur: { label: 'Alur Pendaftaran', ikon: 'ph-path', tone: 'var(--c3)', bagian: 'alur',
      bidang: [F('ikon', 'Ikon', 'ikon', { bawaan: 'note-pencil' }), F('warna', 'Warna', 'warna', { bawaan: 'c3' }),
        F('judul', 'Nama langkah', 'teks', { wajib: 1, maks: 60, contoh: 'Isi formulir online' }), F('isi', 'Penjelasan', 'panjang', { maks: 300 })],
      sub: x => potong(x.isi), bernomor: true },
    testimoni: { label: 'Testimoni', ikon: 'ph-quotes', tone: 'var(--c2)', bagian: 'testimoni',
      bidang: [F('gambar', 'Foto (opsional)', 'gambar', { maksSisi: 600, bulat: 1 }), F('judul', 'Nama', 'teks', { wajib: 1, maks: 80 }),
        F('peran', 'Sebagai', 'pilihan', { pilihan: ['Wali santri', 'Alumni', 'Santri', 'Tokoh masyarakat'] }),
        F('keterangan', 'Keterangan', 'teks', { maks: 100, contoh: 'Alumni angkatan 2022, mahasiswa LIPIA' }),
        F('isi', 'Isi testimoni', 'panjang', { wajib: 1, maks: 600 })],
      sub: x => [x.data.peran, x.data.keterangan].filter(Boolean).join(' · ') },
    galeri: { label: 'Galeri', ikon: 'ph-images', tone: 'var(--c5)', bagian: 'galeri',
      bidang: [F('gambar', 'Foto', 'gambar', { bantuan: 'Boleh dikosongkan bila hanya membagikan tautan album.' }), F('judul', 'Keterangan foto', 'teks', { maks: 120 }),
        F('album', 'Album', 'teks', { maks: 60, contoh: 'Wisuda Tahfizh', daftar: 1 }), F('tanggal', 'Tanggal kegiatan', 'tanggal', { hariIni: 1 }),
        F('tautan', 'Tautan album atau unggahan (opsional)', 'url', { bantuan: 'Contoh: folder Google Drive, unggahan Instagram, Facebook, TikTok, atau YouTube. Pastikan folder Drive dibagikan "Siapa saja yang memiliki link".' })],
      wajibSalah: [['gambar', 'tautan', 'Isi foto atau tautan (salah satu wajib).']],
      sub: x => [x.data.album, x.data.tanggal && fmt.tgl(x.data.tanggal), x.data.tautan && 'Bertautan: ' + namaSumber(x.data.tautan)].filter(Boolean).join(' · ') },
    faq: { label: 'Tanya Jawab', ikon: 'ph-question', tone: 'var(--c1)', bagian: 'faq',
      bidang: [F('judul', 'Pertanyaan', 'teks', { wajib: 1, maks: 200 }), F('isi', 'Jawaban', 'panjang', { wajib: 1, maks: 1500 }),
        F('kategori', 'Kategori', 'teks', { maks: 40, contoh: 'Pendaftaran', daftar: 1 })],
      sub: x => [x.data.kategori, potong(x.isi, 70)].filter(Boolean).join(' · ') },
    biaya: { label: 'Biaya', ikon: 'ph-wallet', tone: 'var(--c3)', bagian: 'biaya',
      bidang: [F('judul', 'Komponen biaya', 'teks', { wajib: 1, maks: 80, contoh: 'Uang pendaftaran' }),
        F('tahap', 'Tahap pembayaran', 'pilihan', { pilihan: ['Pendaftaran', 'Daftar ulang', 'Bulanan', 'Tahunan', 'Lainnya'] }),
        F('jenjang', 'Jenjang', 'pilihan', { pilihan: ['Semua jenjang', 'SMP', 'SMA'] }),
        F('bagian', 'Berlaku untuk', 'pilihan', { pilihan: ['Putra dan putri', 'Putra', 'Putri'] }),
        F('nominal', 'Nominal (Rp)', 'angka', { wajib: 1, min: 0, maks: 100000000, bantuan: 'Tulis angka saja, tanpa titik. Contoh: 250000' }),
        F('wajib', 'Biaya wajib', 'cek', { bawaan: true }),
        F('isi', 'Keterangan', 'panjang', { maks: 300, contoh: 'Dapat diangsur 3 kali' })],
      sub: x => [x.data.tahap, x.data.jenjang, x.data.bagian !== 'Putra dan putri' && x.data.bagian, rupiah(x.data.nominal), x.data.wajib === false && 'opsional'].filter(Boolean).join(' · ') },
    jadwal: { label: 'Jadwal', ikon: 'ph-calendar-dots', tone: 'var(--c2)', bagian: 'jadwal',
      bidang: [F('gelombang', 'Gelombang', 'teks', { wajib: 1, maks: 40, contoh: 'Gelombang 1', daftar: 1 }),
        F('judul', 'Kegiatan', 'teks', { wajib: 1, maks: 80, contoh: 'Pendaftaran online' }),
        F('mulai', 'Tanggal mulai', 'tanggal', { wajib: 1, hariIni: 1 }),
        F('selesai', 'Tanggal selesai', 'tanggal', { bantuan: 'Kosongkan bila kegiatan hanya satu hari.' }),
        F('isi', 'Keterangan', 'panjang', { maks: 300, contoh: 'Tes dilaksanakan di kampus pondok atau secara online' })],
      sub: x => [x.data.gelombang, x.data.mulai && (fmt.tgl(x.data.mulai) + (x.data.selesai ? ' s.d. ' + fmt.tgl(x.data.selesai) : ''))].filter(Boolean).join(' · ') },
    video: { label: 'Video', ikon: 'ph-youtube-logo', tone: 'var(--c7)', bagian: 'video',
      bidang: [F('youtube', 'Tautan YouTube', 'youtube', { wajib: 1 }), F('judul', 'Judul video', 'teks', { maks: 120 }),
        F('utama', 'Jadikan video utama di halaman depan', 'cek')],
      sub: x => x.data.youtube },
    pimpinan: { label: 'Pimpinan', ikon: 'ph-user-circle-gear', tone: 'var(--c2)', bagian: 'pimpinan',
      bidang: [F('gambar', 'Foto', 'gambar', { maksSisi: 800 }), F('judul', 'Nama lengkap bergelar', 'teks', { wajib: 1, maks: 120 }),
        F('jabatan', 'Jabatan', 'teks', { wajib: 1, maks: 80, contoh: 'Direktur', daftar: 1 }), F('isi', 'Sambutan singkat', 'panjang', { maks: 1500 })],
      sub: x => x.data.jabatan },
    kontak_panitia: { label: 'Kontak Panitia', ikon: 'ph-address-book', tone: 'var(--ok)', bagian: 'kontak',
      bidang: [F('judul', 'Nama', 'teks', { wajib: 1, maks: 80 }), F('peran', 'Keterangan', 'teks', { maks: 80, contoh: 'Panitia SPMB Putra' }),
        F('no_wa', 'Nomor WhatsApp', 'wa', { wajib: 1 }), F('bagian', 'Melayani', 'pilihan', { pilihan: ['Umum', 'Putra', 'Putri'] }),
        F('wa_melayang', 'Tampilkan di tombol WhatsApp melayang', 'cek', { bawaan: true })],
      sub: x => [x.data.peran, x.data.no_wa && '+' + x.data.no_wa].filter(Boolean).join(' · ') }
  };

  // Susunan menu modul (kisi ikon berwarna)
  const KELOMPOK = [
    ['Halaman depan', [['beranda', 'Beranda dan Susunan', 'ph-layout', 'var(--primary)'], ...['keunggulan', 'jaminan', 'program', 'prestasi', 'flyer', 'biaya', 'jadwal', 'alur', 'testimoni', 'galeri', 'faq', 'video'].map(k => [k, MODUL[k].label, MODUL[k].ikon, MODUL[k].tone])]],
    ['Halaman lain', [['profil', 'Profil Lembaga', 'ph-identification-badge', 'var(--c1)'], ['pimpinan', 'Pimpinan', MODUL.pimpinan.ikon, MODUL.pimpinan.tone],
      ['kontak_panitia', 'Kontak Panitia', MODUL.kontak_panitia.ikon, MODUL.kontak_panitia.tone], ['berita', 'Berita', 'ph-newspaper', 'var(--c3)']]],
    ['Penyimpanan', [['berkas', 'Berkas Unggahan', 'ph-folder-open', 'var(--c8)']]]
  ];
  const NAMA_MODUL = { beranda: 'Beranda', profil: 'Profil Lembaga', berita: 'Berita', berkas: 'Berkas Unggahan', identitas: 'Identitas', kop: 'Kop surat', brosur: 'Brosur', kontak: 'Kontak', umum: 'Umum' };
  Object.entries(MODUL).forEach(([k, m]) => NAMA_MODUL[k] = m.label);
  window.SPMB_UI.NAMA_MODUL = NAMA_MODUL;

  /* =================================================================
     HALAMAN UTAMA MENU KONTEN SITUS
     ================================================================= */
  window.SPMB_MODUL = window.SPMB_MODUL || {};
  window.SPMB_MODUL.konten = async (k, ctx) => {
    const m = (location.hash.match(/[?&]m=(\w+)/) || [])[1] || 'beranda';
    k.innerHTML = `
      <div class="modgrid" role="tablist">
        ${KELOMPOK.map(([g, daftar]) => `<div class="modgrup"><h5>${g}</h5><div class="modbtns">
          ${daftar.map(([id, l, ic, t]) => `<a href="#/konten?m=${id}" role="tab" aria-selected="${id === m}" style="--tone:${t}"><span class="ic-box"><i class="ph-duotone ${ic}"></i></span><span>${l}</span></a>`).join('')}
        </div></div>`).join('')}
      </div>
      <div id="isiModul"></div>`;
    ctx.setFab(null);
    k.querySelector('.modbtns a[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    window.scrollTo(0, 0);
    const el = $('#isiModul');
    if (m === 'beranda') return halBeranda(el, ctx);
    if (m === 'profil') return halProfil(el, ctx);
    if (m === 'berita') return halBerita(el, ctx);
    if (m === 'berkas') return halBerkas(el, ctx);
    if (MODUL[m]) return halModul(el, m, ctx);
    el.innerHTML = '<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>Modul tidak dikenal.</div></div>';
  };

  /* =================================================================
     MODUL DAFTAR (keunggulan, program, galeri, dll.)
     ================================================================= */
  async function halModul(el, jenis, ctx) {
    const M = MODUL[jenis];
    let semua = [], lihatArsip = false;
    const bagianSitus = { flyer: 'brosur', kontak_panitia: 'kontak', pimpinan: 'pimpinan' }[jenis] || jenis;
    const tautanSitus = jenis === 'pimpinan' ? 'profil.html#pimpinan' : `index.html?pratinjau=1#${bagianSitus}`;

    el.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden">
        <div class="card-head" style="padding:16px 18px 0">
          <div class="ic-box" style="--tone:${M.tone}"><i class="ph-duotone ${M.ikon}"></i></div>
          <div><h3>${M.label}</h3><p id="ringkasModul">Memuat…</p></div>
          <div class="spacer"></div>
          <a class="btn sm ghost hide-sm" href="${tautanSitus}" target="_blank" rel="noopener"><i class="ph-duotone ph-eye" style="color:var(--c1)"></i>Pratinjau di situs</a>
          <button class="btn sm hide-sm" id="btnTambah"><i class="ph-duotone ph-plus"></i>Tambah</button>
        </div>
        <div class="page-head" style="padding:12px 18px 0;margin:0">
          <div class="tabs" style="margin:0;border:0">
            <button data-arsip="0" aria-selected="true"><i class="ph-duotone ph-list-checks" style="color:var(--c1)"></i>Aktif</button>
            <button data-arsip="1" aria-selected="false"><i class="ph-duotone ph-archive" style="color:var(--c8)"></i>Arsip</button>
          </div>
        </div>
        <div id="daftar" class="daftar-konten"></div>
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:10px"><i class="ph-duotone ph-info"></i>
        Seret baris (laptop) atau gunakan tombol panah (HP) untuk mengubah urutan. Item yang disembunyikan tidak tampil di situs; item yang diarsipkan dapat dipulihkan.</p>`;

    const thumb = x => {
      if (x.gambar) return `<img class="thumb${jenis === 'testimoni' || jenis === 'pimpinan' ? ' bulat' : ''}" alt="" loading="lazy" src="${esc(gambar(x.gambar, 160))}">`;
      if (jenis === 'galeri' && x.data.tautan) return `<span class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-link-simple"></i></span>`;
      if (jenis === 'video' && youtubeId(x.data.youtube)) return `<img class="thumb" alt="" loading="lazy" src="https://i.ytimg.com/vi/${youtubeId(x.data.youtube)}/mqdefault.jpg">`;
      if (x.data.ikon) return `<span class="ic-box" style="--tone:var(--${esc(x.data.warna || 'c1')})"><i class="ph-duotone ph-${esc(x.data.ikon)}"></i></span>`;
      return `<span class="ic-box" style="--tone:${M.tone}"><i class="ph-duotone ${M.ikon}"></i></span>`;
    };
    const lencana = x => [
      !x.tampil && !x.diarsipkan_pada ? '<span class="pill" style="--tone:var(--c8)"><i class="ph-duotone ph-eye-slash"></i>Disembunyikan</span>' : '',
      x.data.utama ? '<span class="pill" style="--tone:var(--c7)"><i class="ph-duotone ph-star"></i>Utama</span>' : '',
      jenis === 'kontak_panitia' && x.data.wa_melayang ? '<span class="pill" style="--tone:var(--ok)"><i class="ph-duotone ph-whatsapp-logo"></i>WA melayang</span>' : '',
      jenis === 'flyer' && x.data.selesai && x.data.selesai < fmt.isoTgl() ? '<span class="pill" style="--tone:var(--c8)">Periode berakhir</span>' : '',
      x.diarsipkan_pada ? `<span class="pill" style="--tone:var(--c8)">Diarsipkan ${fmt.tgl(x.diarsipkan_pada)}</span>` : ''
    ].join(' ');

    const render = () => {
      const aktif = semua.filter(x => !x.diarsipkan_pada), arsip = semua.filter(x => x.diarsipkan_pada);
      $('#ringkasModul').textContent = `${aktif.filter(x => x.tampil).length} tampil · ${aktif.filter(x => !x.tampil).length} disembunyikan · ${arsip.length} di arsip`;
      const rows = lihatArsip ? arsip : aktif;
      $('#daftar').innerHTML = rows.length ? rows.map((x, i) => `
        <div class="baris-konten${x.tampil ? '' : ' redup'}" ${lihatArsip ? '' : `draggable="true" data-urut="${x.id}"`}>
          ${lihatArsip ? '' : '<i class="ph-duotone ph-dots-six-vertical pegangan hide-sm" title="Seret untuk mengurutkan"></i>'}
          ${M.bernomor && !lihatArsip ? `<span class="nomor">${i + 1}</span>` : ''}
          ${thumb(x)}
          <div class="teks"><b>${esc(x.judul || (jenis === 'video' ? 'Video tanpa judul' : jenis === 'galeri' ? 'Foto tanpa keterangan' : '(tanpa judul)'))}</b>
            <span>${esc(M.sub(x) || '')}</span><div class="lencana">${lencana(x)}</div></div>
          <div class="aksi">
            ${lihatArsip ? `
              <button class="icon-btn plain" data-pulih="${x.id}" title="Pulihkan" aria-label="Pulihkan"><i class="ph-duotone ph-arrow-counter-clockwise" style="color:var(--ok)"></i></button>
              <button class="icon-btn plain" data-hapus="${x.id}" title="Hapus permanen" aria-label="Hapus permanen"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>` : `
              ${tombolUrut}
              <button class="icon-btn plain" data-tampil="${x.id}" title="${x.tampil ? 'Sembunyikan' : 'Tampilkan'}" aria-label="${x.tampil ? 'Sembunyikan' : 'Tampilkan'}"><i class="ph-duotone ${x.tampil ? 'ph-eye' : 'ph-eye-slash'}" style="color:${x.tampil ? 'var(--c5)' : 'var(--c8)'}"></i></button>
              <button class="icon-btn plain" data-ubah="${x.id}" title="Ubah" aria-label="Ubah"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></button>
              <button class="icon-btn plain" data-arsipkan="${x.id}" title="Arsipkan" aria-label="Arsipkan"><i class="ph-duotone ph-archive" style="color:var(--c3)"></i></button>`}
          </div>
        </div>`).join('')
        : `<div class="empty"><i class="ph-duotone ${lihatArsip ? 'ph-archive' : M.ikon}"></i><b>${lihatArsip ? 'Arsip kosong' : `Belum ada ${M.label.toLowerCase()}`}</b>${lihatArsip ? '' : 'Klik Tambah untuk mengisi.'}</div>`;
    };
    const muat = async () => {
      const { data, error } = await sb.from('konten_situs').select('*').eq('jenis', jenis).order('urutan').order('id');
      if (error) throw error;
      semua = data.map(x => ({ ...x, data: x.data || {} })); render();
    };
    await muat();

    el.querySelectorAll('[data-arsip]').forEach(b => b.onclick = () => {
      lihatArsip = b.dataset.arsip === '1';
      el.querySelectorAll('[data-arsip]').forEach(x => x.setAttribute('aria-selected', String(x === b))); render();
    });

    const buka = async x => {
      const ok = await formModul(jenis, x, semua);
      if (ok) { toast(x ? 'Perubahan disimpan.' : `${M.label} ditambahkan.`); await muat(); }
    };
    $('#btnTambah').onclick = () => buka(null);
    ctx.setFab(() => buka(null), 'ph-plus', `Tambah ${M.label}`);

    pasangUrutan($('#daftar'), async ids => {
      const { error } = await sb.rpc('urutkan_konten', { p_ids: ids.map(Number) });
      if (error) { toast(pesanGalat(error), 'err'); return muat(); }
      const posisi = Object.fromEntries(ids.map((id, i) => [id, i + 1]));
      semua.forEach(x => { if (posisi[x.id]) x.urutan = posisi[x.id]; });
      semua.sort((a, b) => a.urutan - b.urutan); render();
    });

    $('#daftar').addEventListener('click', async e => {
      const tombol = e.target.closest('button'); if (!tombol) return;
      const [aksi, idTeks] = Object.entries(tombol.dataset)[0] || [];
      const id = +idTeks; if (!id) return;                 // tombol naik/turun ditangani pasangUrutan
      const x = semua.find(r => r.id === id), b = { [aksi]: 1 };
      try {
        if ('ubah' in b) return buka(x);
        if ('tampil' in b) { const { error } = await sb.from('konten_situs').update({ tampil: !x.tampil }).eq('id', id); if (error) throw error; toast(x.tampil ? 'Disembunyikan dari situs.' : 'Ditampilkan di situs.'); }
        if ('arsipkan' in b) {
          if (!(await konfirmasi('Arsipkan item ini?', `"${esc(x.judul || M.label)}" tidak lagi tampil di situs. Anda dapat memulihkannya dari tab Arsip.`, 'Arsipkan'))) return;
          const { error } = await sb.from('konten_situs').update({ diarsipkan_pada: new Date().toISOString() }).eq('id', id); if (error) throw error; toast('Diarsipkan.');
        }
        if ('pulih' in b) { const { error } = await sb.from('konten_situs').update({ diarsipkan_pada: null }).eq('id', id); if (error) throw error; toast('Dipulihkan.'); }
        if ('hapus' in b) {
          if (!(await konfirmasi('Hapus permanen?', `"${esc(x.judul || M.label)}" akan dihapus dari database dan tidak dapat dipulihkan. Gambar di Google Drive tetap tersimpan.`, 'Hapus permanen', true))) return;
          const { error } = await sb.from('konten_situs').delete().eq('id', id); if (error) throw error; toast('Dihapus permanen.');
        }
        await muat();
      } catch (err) { toast(pesanGalat(err), 'err'); }
    });
  }

  // Formulir tambah/ubah item modul
  async function formModul(jenis, x, semua) {
    const M = MODUL[jenis], d = x?.data || {};
    const nilai = f => KOLOM.includes(f.k) ? (x ? x[f.k] : '') : (x ? d[f.k] : f.bawaan);
    const saran = f => [...new Set(semua.map(r => r.data?.[f.k]).filter(Boolean))];
    const bidang = f => {
      const v = nilai(f) ?? '', req = f.wajib ? ' <span class="req">*</span>' : '', id = `f_${f.k}`;
      const bantu = f.bantuan ? `<small>${f.bantuan}</small>` : '';
      switch (f.t) {
        case 'gambar': return inputGambar(f.k, f.l, v, { bagian: M.bagian, maksSisi: f.maksSisi || 1600, bantuan: f.bantuan, wajib: f.wajib, bulat: f.bulat });
        case 'ikon': return inputIkon(f.k, f.l, v || f.bawaan);
        case 'warna': return inputWarna(f.k, f.l, v || f.bawaan);
        case 'panjang': return `<div class="field full"><label for="${id}">${f.l}${req}</label><textarea class="textarea" id="${id}" name="${f.k}" ${f.maks ? `maxlength="${f.maks}"` : ''}>${esc(v)}</textarea>${f.maks ? `<small data-hitung="${f.k}">0/${f.maks} karakter</small>` : ''}</div>`;
        case 'pilihan': return `<div class="field"><label for="${id}">${f.l}${req}</label><select class="select" id="${id}" name="${f.k}">${f.pilihan.map(p => `<option ${p === v ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>${bantu}</div>`;
        case 'tanggal': return `<div class="field"><label for="${id}">${f.l}${req}</label><input class="input" type="date" id="${id}" name="${f.k}" value="${esc(v || '')}" ${f.hariIni && !x ? 'data-default-today' : ''}>${bantu}</div>`;
        case 'angka': return `<div class="field"><label for="${id}">${f.l}${req}</label><input class="input" type="number" inputmode="numeric" id="${id}" name="${f.k}" value="${esc(v ?? '')}" min="${f.min ?? ''}" max="${f.maks ?? ''}">${bantu}</div>`;
        case 'wa': return `<div class="field"><label for="${id}">${f.l}${req}</label><input class="input" inputmode="tel" id="${id}" name="${f.k}" value="${esc(v ? '0' + String(v).replace(/^62/, '') : '')}" placeholder="08xxxxxxxxxx"><small>Diawali 08 atau 62, 10–13 digit.</small></div>`;
        case 'youtube': return `<div class="field full"><label for="${id}">${f.l}${req}</label><input class="input" id="${id}" name="${f.k}" value="${esc(v)}" placeholder="https://youtu.be/…"><div class="yt-prev" data-yt></div></div>`;
        case 'url': return `<div class="field full"><label for="${id}">${f.l}${req}</label><input class="input" type="url" inputmode="url" id="${id}" name="${f.k}" value="${esc(v || '')}" placeholder="https://…">${bantu}</div>`;
        case 'cek': return `<div class="field full"><label class="check"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}>${f.l}</label></div>`;
        default: return `<div class="field ${f.maks > 80 || f.k === 'judul' ? 'full' : ''}"><label for="${id}">${f.l}${req}</label><input class="input" id="${id}" name="${f.k}" value="${esc(v)}" ${f.maks ? `maxlength="${f.maks}"` : ''} ${f.contoh ? `placeholder="Contoh: ${esc(f.contoh)}"` : ''} ${f.daftar ? `list="dl_${f.k}"` : ''}>
          ${f.daftar ? `<datalist id="dl_${f.k}">${saran(f).map(s => `<option value="${esc(s)}">`).join('')}</datalist>` : ''}${bantu}</div>`;
      }
    };

    return dialog({
      judul: `${x ? 'Ubah' : 'Tambah'} ${M.label}`, ikon: M.ikon, tone: M.tone,
      isi: `<form id="fModul" novalidate><div class="grid-form">${M.bidang.map(bidang).join('')}</div>
        <div class="field full" style="margin-bottom:4px"><label class="check"><input type="checkbox" name="_tampil" ${!x || x.tampil ? 'checked' : ''}>Tampilkan di situs</label></div>
        <div id="fErr"></div></form>`,
      saatBuka: root => {
        pasangPemilihGambar(root); pasangPemilihIkon(root); pasangWarnaIkon(root);
        SPMB.isiTanggalBawaan(root);
        root.querySelectorAll('[data-hitung]').forEach(s => {
          const ta = root.querySelector(`[name="${s.dataset.hitung}"]`), n = ta.maxLength;
          const h = () => s.textContent = `${ta.value.length}/${n} karakter`; ta.addEventListener('input', h); h();
        });
        const yt = root.querySelector('[name=youtube]');
        if (yt) { const p = () => { const v = youtubeId(yt.value); root.querySelector('[data-yt]').innerHTML = v ? `<img alt="" src="https://i.ytimg.com/vi/${v}/mqdefault.jpg">` : ''; }; yt.addEventListener('input', p); p(); }
      },
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, {
        label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
          const f = root.querySelector('#fModul'), err = [];
          const baris = { jenis, judul: '', isi: '', gambar: null, data: { ...d }, tampil: f.elements._tampil.checked };
          for (const b of M.bidang) {
            const input = f.elements[b.k];
            let v = b.t === 'cek' ? input.checked : (input?.value ?? '').trim();
            if (b.wajib && !v) { err.push(`${b.l} wajib diisi.`); continue; }
            if (b.t === 'wa' && v) { if (!/^(08|\+?62)\d{8,11}$/.test(v.replace(/[\s.-]/g, ''))) err.push('Nomor WhatsApp harus diawali 08 atau 62, 10–13 digit.'); v = nomorWA(v); }
            if (b.t === 'youtube' && v && !youtubeId(v)) err.push('Tautan YouTube belum benar.');
            if (b.t === 'angka' && v !== '') { v = Number(v); if (Number.isNaN(v) || (b.min != null && v < b.min) || (b.maks != null && v > b.maks)) err.push(`${b.l} harus antara ${b.min} dan ${b.maks}.`); }
            if ((b.t === 'gambar' || b.t === 'url') && v && !/^https?:\/\//.test(v)) err.push(`${b.l}: tautan harus diawali https://`);
            if (KOLOM.includes(b.k)) baris[b.k] = v || (b.k === 'gambar' ? null : '');
            else baris.data[b.k] = v === '' ? null : v;
          }
          (M.wajibSalah || []).forEach(([a, c, pesan]) => { const ada = k => KOLOM.includes(k) ? baris[k] : baris.data[k]; if (!ada(a) && !ada(c)) err.push(pesan); });
          if (baris.data.mulai && baris.data.selesai && baris.data.selesai < baris.data.mulai) err.push('Tanggal selesai tidak boleh sebelum tanggal mulai.');
          root.querySelector('#fErr').innerHTML = err.length ? `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${err.map(esc).join('<br>')}</div></div>` : '';
          if (err.length) return false;

          if (x) { const { error } = await sb.from('konten_situs').update(baris).eq('id', x.id); if (error) throw error; }
          else {
            baris.urutan = Math.max(0, ...semua.map(r => r.urutan || 0)) + 1;
            const { data: baru, error } = await sb.from('konten_situs').insert(baris).select('id').single(); if (error) throw error;
            x = { id: baru.id };
          }
          // hanya satu video utama
          if (jenis === 'video' && baris.data.utama) {
            for (const r of semua.filter(r => r.id !== x.id && r.data?.utama))
              await sb.from('konten_situs').update({ data: { ...r.data, utama: false } }).eq('id', r.id);
          }
          return true;
        }
      }]
    });
  }

  /* =================================================================
     BERANDA: teks hero dan susunan bagian landing page
     ================================================================= */
  const IKON_BAGIAN = {
    statistik: ['ph-chart-bar', 'var(--c1)'], video: ['ph-youtube-logo', 'var(--c7)'], keunggulan: ['ph-star', 'var(--c6)'], jaminan: ['ph-shield-check', 'var(--c5)'],
    program: ['ph-book-open-text', 'var(--c1)'], prestasi: ['ph-trophy', 'var(--c6)'], flyer: ['ph-image-square', 'var(--c4)'], biaya: ['ph-wallet', 'var(--c3)'],
    jadwal: ['ph-calendar-dots', 'var(--c2)'], alur: ['ph-path', 'var(--c3)'], testimoni: ['ph-quotes', 'var(--c2)'], galeri: ['ph-images', 'var(--c5)'],
    berita: ['ph-newspaper', 'var(--c3)'], faq: ['ph-question', 'var(--c1)'], kontak: ['ph-map-pin', 'var(--ok)']
  };
  const CATATAN_BAGIAN = {
    keunggulan: 'Tampil sebagai slider bergambar yang bergulir otomatis (4 kartu di laptop, 1 kartu di HP).',
    video: 'Video utama berputar otomatis tanpa suara saat bagian ini terlihat di layar.',
    statistik: 'Berisi angka pendaftar langsung. Aktif setelah Fase 3 (pendaftaran online).',
    biaya: 'Isi sementara dari modul Biaya, tampil dalam satu kartu per jenjang. Tampil "Segera diumumkan" bila kosong.',
    jadwal: 'Isi sementara dari modul Jadwal, tampil sebagai linimasa mendatar per gelombang. Status dihitung otomatis dari tanggal.',
    berita: 'Menampilkan 3 berita terbaru yang sudah terbit.',
    kontak: 'Alamat, telepon, media sosial, dan peta dari Pengaturan > Identitas, ditambah Kontak Panitia.'
  };
  const MODUL_BAGIAN = { keunggulan: 'keunggulan', jaminan: 'jaminan', program: 'program', prestasi: 'prestasi', flyer: 'flyer', alur: 'alur', testimoni: 'testimoni', galeri: 'galeri', faq: 'faq', video: 'video', berita: 'berita', kontak: 'kontak_panitia', biaya: 'biaya', jadwal: 'jadwal' };

  async function halBeranda(el, ctx) {
    const p = await muatPengaturan(true);
    const b = JSON.parse(JSON.stringify(p.beranda || { hero: {}, bagian: [] }));
    const h = b.hero || {};
    const keLokal = s => s ? String(s).slice(0, 16) : '';
    el.innerHTML = `
      <form class="card" id="fHero" novalidate>
        <div class="card-head"><div class="ic-box" style="--tone:var(--primary)"><i class="ph-duotone ph-layout"></i></div>
          <div><h3>Bagian pembuka (hero)</h3><p>Bagian pertama yang dilihat pengunjung</p></div><div class="spacer"></div>
          <a class="btn sm ghost hide-sm" href="index.html?pratinjau=1" target="_blank" rel="noopener"><i class="ph-duotone ph-eye" style="color:var(--c1)"></i>Pratinjau</a></div>
        <div class="grid-form">
          <div class="field full"><label>Judul besar</label><input class="input" name="judul" value="${esc(h.judul || '')}" maxlength="80" placeholder="Penerimaan Santri Baru"><small>Tahun ajaran dari Pengaturan > Identitas ditambahkan otomatis.</small></div>
          <div class="field full"><label>Judul kecil (di bawah judul besar)</label><textarea class="textarea" name="subjudul" maxlength="300" style="min-height:70px" placeholder="Kosongkan untuk memakai nama lembaga">${esc(h.subjudul || '')}</textarea></div>
          ${inputDaftarGambar('gambar_daftar', 'Foto latar slider (maksimal 8)', h.gambar_daftar?.length ? h.gambar_daftar : (h.gambar ? [h.gambar] : []), { bagian: 'beranda', maks: 8, maksSisi: 2000, bantuan: 'Foto mendatar suasana pondok. Berganti otomatis setiap 5 detik sesuai urutan di atas. Diberi lapisan warna agar teks tetap terbaca.' })}
          <div class="field"><label>Teks tombol utama</label><input class="input" name="tombol_utama" value="${esc(h.tombol_utama || '')}" maxlength="30"></div>
          <div class="field"><label>Teks tombol kedua</label><input class="input" name="tombol_kedua" value="${esc(h.tombol_kedua || '')}" maxlength="30"></div>
          <div class="field"><label>Hitung mundur sampai</label><input class="input" type="datetime-local" name="hitung_mundur" value="${esc(keLokal(h.hitung_mundur))}"><small>Kosongkan bila tidak ada hitung mundur. Jam mengikuti WITA.</small></div>
          <div class="field"><label>Keterangan hitung mundur</label><input class="input" name="label_hitung_mundur" value="${esc(h.label_hitung_mundur || '')}" maxlength="60"></div>
        </div>
        <div class="note info" style="margin:0 0 12px"><i class="ph-duotone ph-info"></i><div>Sebelum Fase 3, tombol utama mengarah ke bagian Alur Pendaftaran dan tombol kedua ke bagian Gelombang dan Jadwal. Setelah formulir online dan pengumuman aktif, keduanya otomatis membuka halaman yang sesuai.</div></div>
        <div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan bagian pembuka</button></div>
      </form>

      <div class="card">
        <div class="card-head"><div class="ic-box" style="--tone:var(--c2)"><i class="ph-duotone ph-rows"></i></div>
          <div><h3>Susunan bagian halaman depan</h3><p>Urutkan, tampilkan atau sembunyikan, dan ubah judul setiap bagian</p></div></div>
        <div id="daftarBagian" class="daftar-konten" style="border:1px solid var(--border);border-radius:12px"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" id="btnSimpanBagian"><i class="ph-duotone ph-floppy-disk"></i>Simpan susunan</button></div>
      </div>`;

    pasangPemilihGambar(el); pasangDaftarGambar(el);
    $('#fHero').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, v = n => f.elements[n].value.trim();
      const hm = v('hitung_mundur');
      let daftarG = []; try { daftarG = JSON.parse(f.elements.gambar_daftar.value) || []; } catch (x) {}
      b.hero = { ...h, judul: v('judul'), subjudul: v('subjudul'), gambar_daftar: daftarG, gambar: daftarG[0] || '', tombol_utama: v('tombol_utama') || 'Daftar Sekarang',
        tombol_kedua: v('tombol_kedua') || 'Cek Pengumuman', hitung_mundur: hm ? hm + ':00+08:00' : '', label_hitung_mundur: v('label_hitung_mundur') };
      try { await ctx.simpanPengaturan('beranda', b); toast('Bagian pembuka disimpan.'); } catch (err) { toast(pesanGalat(err), 'err'); }
    };

    const daftar = $('#daftarBagian');
    const renderBagian = () => {
      daftar.innerHTML = b.bagian.map(s => {
        const [ic, t] = IKON_BAGIAN[s.kunci] || ['ph-square', 'var(--c8)'];
        return `
        <div class="baris-konten bagian${s.tampil ? '' : ' redup'}" draggable="true" data-urut="${s.kunci}">
          <i class="ph-duotone ph-dots-six-vertical pegangan hide-sm"></i>
          <span class="ic-box" style="--tone:${t}"><i class="ph-duotone ${ic}"></i></span>
          <div class="teks">
            <input class="input sm" data-k="${s.kunci}" data-f="judul" value="${esc(s.judul)}" maxlength="60" aria-label="Judul bagian">
            <input class="input sm tipis" data-k="${s.kunci}" data-f="subjudul" value="${esc(s.subjudul || '')}" maxlength="120" aria-label="Subjudul bagian" placeholder="Subjudul">
            ${CATATAN_BAGIAN[s.kunci] ? `<span class="catatan"><i class="ph-duotone ph-info"></i> ${CATATAN_BAGIAN[s.kunci]}</span>` : ''}
          </div>
          <div class="aksi">
            ${MODUL_BAGIAN[s.kunci] ? `<a class="icon-btn plain" href="#/konten?m=${MODUL_BAGIAN[s.kunci]}" title="Kelola isi" aria-label="Kelola isi"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></a>` : ''}
            ${tombolUrut}
            <label class="switch" title="Tampilkan"><input type="checkbox" data-tampil="${s.kunci}" ${s.tampil ? 'checked' : ''}><span></span></label>
          </div>
        </div>`;
      }).join('');
    };
    renderBagian();
    daftar.addEventListener('input', e => { const i = e.target.closest('[data-k]'); if (i) b.bagian.find(s => s.kunci === i.dataset.k)[i.dataset.f] = i.value; });
    daftar.addEventListener('change', e => {
      const c = e.target.closest('[data-tampil]'); if (!c) return;
      b.bagian.find(s => s.kunci === c.dataset.tampil).tampil = c.checked; c.closest('.baris-konten').classList.toggle('redup', !c.checked);
    });
    // input di dalam baris tidak ikut terseret
    daftar.addEventListener('mousedown', e => { const r = e.target.closest('[data-urut]'); if (r) r.draggable = !e.target.closest('input,a,button,label'); });
    pasangUrutan(daftar, urut => { b.bagian.sort((a, c) => urut.indexOf(a.kunci) - urut.indexOf(c.kunci)); });
    $('#btnSimpanBagian').onclick = async () => {
      if (b.bagian.some(s => !s.judul.trim())) return toast('Judul bagian tidak boleh kosong.', 'err');
      try { await ctx.simpanPengaturan('beranda', b); toast('Susunan halaman depan disimpan.'); } catch (err) { toast(pesanGalat(err), 'err'); }
    };
  }

  /* =================================================================
     PROFIL LEMBAGA: selayang pandang, visi, misi
     ================================================================= */
  async function halProfil(el, ctx) {
    const p = await muatPengaturan(true);
    const pl = p.profil_lembaga || {};
    el.innerHTML = `
      <form class="card" id="fProfilL" novalidate>
        <div class="card-head"><div class="ic-box" style="--tone:var(--c1)"><i class="ph-duotone ph-identification-badge"></i></div>
          <div><h3>Profil lembaga</h3><p>Isi halaman Profil di situs</p></div><div class="spacer"></div>
          <a class="btn sm ghost hide-sm" href="profil.html?pratinjau=1" target="_blank" rel="noopener"><i class="ph-duotone ph-eye" style="color:var(--c1)"></i>Pratinjau</a></div>
        <div class="grid-form">
          <div class="field full"><label>Judul</label><input class="input" name="judul" value="${esc(pl.judul || 'Selayang Pandang')}" maxlength="80"></div>
          ${inputGambar('gambar', 'Foto lembaga', pl.gambar || '', { bagian: 'profil', maksSisi: 2000 })}
          <div class="field full"><label>Selayang pandang</label>${bilahFormat('isi')}
            <textarea class="textarea" name="isi" style="min-height:220px" placeholder="Sejarah singkat, keadaan pondok, dan hal lain yang ingin diceritakan.">${esc(pl.isi || '')}</textarea>
            <small>Pisahkan paragraf dengan satu baris kosong. Gunakan bilah di atas untuk tebal, subjudul, daftar, tautan, dan gambar.</small></div>
          <div class="field full"><label>Visi</label><textarea class="textarea" name="visi" style="min-height:70px">${esc(pl.visi || '')}</textarea></div>
          <div class="field full"><label>Misi</label><textarea class="textarea" name="misi" style="min-height:140px" placeholder="Satu butir misi per baris">${esc((pl.misi || []).join('\n'))}</textarea><small>Satu butir per baris.</small></div>
        </div>
        <div class="note info" style="margin:0 0 12px"><i class="ph-duotone ph-users-three"></i><div>Foto dan sambutan Direktur, Wakil Direktur, dan Kepala Bidang diatur di modul <a href="#/konten?m=pimpinan">Pimpinan</a>.</div></div>
        <div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan profil lembaga</button></div>
      </form>`;
    pasangPemilihGambar(el); pasangBilahFormat(el, 'profil');
    $('#fProfilL').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, v = n => f.elements[n].value.trim();
      const nilai = { ...pl, judul: v('judul') || 'Selayang Pandang', gambar: v('gambar'), isi: v('isi'), visi: v('visi'), misi: v('misi').split('\n').map(s => s.replace(/^\s*(\d+[.)]|[-*])\s*/, '').trim()).filter(Boolean) };
      try { await ctx.simpanPengaturan('profil_lembaga', nilai); toast('Profil lembaga disimpan.'); } catch (err) { toast(pesanGalat(err), 'err'); }
    };
  }

  /* =================================================================
     BERITA DAN ARTIKEL
     ================================================================= */
  async function halBerita(el, ctx) {
    let semua = [], filter = 'semua';
    el.innerHTML = `
      <div class="page-head">
        <div class="field" style="margin:0;flex:1;min-width:200px;max-width:340px"><input class="input" id="cariBerita" type="search" placeholder="Cari judul atau kategori…"></div>
        <select class="select" id="fStatus" style="width:auto">
          <option value="semua">Semua status</option><option value="terbit">Terbit</option><option value="terjadwal">Terjadwal</option><option value="draf">Draf</option><option value="arsip">Arsip</option></select>
        <div class="spacer"></div>
        <button class="btn" id="btnTulis"><i class="ph-duotone ph-pencil-line"></i>Tulis berita</button>
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Berita</th><th class="hide-sm">Kategori</th><th>Status</th><th class="hide-sm">Tanggal terbit</th><th class="c hide-sm">Dibaca</th><th class="c">Aksi</th></tr></thead>
      <tbody id="tbBerita"></tbody></table></div>`;

    const statusDari = r => r.diarsipkan_pada ? 'arsip' : r.status === 'draf' ? 'draf' : new Date(r.terbit_pada) > new Date() ? 'terjadwal' : 'terbit';
    const PILL = { terbit: ['Terbit', 'var(--ok)', 'ph-check-circle'], terjadwal: ['Terjadwal', 'var(--c2)', 'ph-clock'], draf: ['Draf', 'var(--c6)', 'ph-note-pencil'], arsip: ['Arsip', 'var(--c8)', 'ph-archive'] };
    const render = () => {
      const q = $('#cariBerita').value.toLowerCase();
      const rows = semua.filter(r => (filter === 'semua' ? statusDari(r) !== 'arsip' : statusDari(r) === filter) && (!q || (r.judul + ' ' + r.kategori).toLowerCase().includes(q)));
      $('#tbBerita').innerHTML = rows.length ? rows.map(r => { const s = statusDari(r), [l, t, ic] = PILL[s]; return `
        <tr>
          <td><div class="who">${r.sampul ? `<img class="thumb" alt="" loading="lazy" src="${esc(gambar(r.sampul, 160))}">` : '<span class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-newspaper"></i></span>'}
            <div><b>${esc(r.judul)}</b><span>${esc(potong(r.ringkasan, 80))}</span></div></div></td>
          <td class="hide-sm">${esc(r.kategori)}</td>
          <td><span class="pill" style="--tone:${t}"><i class="ph-duotone ${ic}"></i>${l}</span></td>
          <td class="hide-sm" style="white-space:nowrap">${fmt.tglJam(r.terbit_pada)}</td>
          <td class="c hide-sm">${fmt.angka(r.dibaca)}</td>
          <td class="c" style="white-space:nowrap">
            ${s === 'arsip' ? `<button class="icon-btn plain" data-pulih="${r.id}" title="Pulihkan" aria-label="Pulihkan"><i class="ph-duotone ph-arrow-counter-clockwise" style="color:var(--ok)"></i></button>
              <button class="icon-btn plain" data-hapus="${r.id}" title="Hapus permanen" aria-label="Hapus permanen"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>` : `
            <a class="icon-btn plain" href="berita.html?b=${esc(r.slug)}&pratinjau=1" target="_blank" rel="noopener" title="Lihat" aria-label="Lihat"><i class="ph-duotone ph-eye" style="color:var(--c5)"></i></a>
            <button class="icon-btn plain" data-ubah="${r.id}" title="Ubah" aria-label="Ubah"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></button>
            <button class="icon-btn plain" data-arsipkan="${r.id}" title="Arsipkan" aria-label="Arsipkan"><i class="ph-duotone ph-archive" style="color:var(--c3)"></i></button>`}
          </td></tr>`; }).join('')
        : `<tr><td colspan="6"><div class="empty"><i class="ph-duotone ph-newspaper"></i><b>${semua.length ? 'Tidak ada berita yang cocok' : 'Belum ada berita'}</b>${semua.length ? '' : 'Klik Tulis berita untuk membuat artikel pertama.'}</div></td></tr>`;
    };
    const muat = async () => {
      const { data, error } = await sb.from('berita').select('id,slug,judul,ringkasan,sampul,kategori,status,terbit_pada,dibaca,diarsipkan_pada,penulis_nama').order('terbit_pada', { ascending: false });
      if (error) throw error; semua = data; render();
    };
    await muat();
    $('#cariBerita').oninput = render; $('#fStatus').onchange = e => { filter = e.target.value; render(); };
    const tulis = async id => {
      let r = null;
      if (id) { const { data, error } = await sb.from('berita').select('*').eq('id', id).single(); if (error) return toast(pesanGalat(error), 'err'); r = data; }
      if (await formBerita(r, semua, ctx)) { toast(r ? 'Berita disimpan.' : 'Berita dibuat.'); await muat(); }
    };
    $('#btnTulis').onclick = () => tulis(null);
    ctx.setFab(() => tulis(null), 'ph-pencil-line', 'Tulis berita');
    $('#tbBerita').addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      const [aksi, id] = Object.entries(b.dataset)[0] || []; if (!id) return;
      const r = semua.find(x => x.id === +id);
      try {
        if (aksi === 'ubah') return tulis(+id);
        if (aksi === 'arsipkan') {
          if (!(await konfirmasi('Arsipkan berita?', `"${esc(r.judul)}" tidak lagi tampil di situs. Anda dapat memulihkannya dari status Arsip.`, 'Arsipkan'))) return;
          const { error } = await sb.from('berita').update({ diarsipkan_pada: new Date().toISOString() }).eq('id', id); if (error) throw error; toast('Berita diarsipkan.');
        }
        if (aksi === 'pulih') { const { error } = await sb.from('berita').update({ diarsipkan_pada: null }).eq('id', id); if (error) throw error; toast('Berita dipulihkan.'); }
        if (aksi === 'hapus') {
          if (!(await konfirmasi('Hapus berita permanen?', `"${esc(r.judul)}" akan dihapus dan tidak dapat dipulihkan.`, 'Hapus permanen', true))) return;
          const { error } = await sb.from('berita').delete().eq('id', id); if (error) throw error; toast('Berita dihapus.');
        }
        await muat();
      } catch (err) { toast(pesanGalat(err), 'err'); }
    });
  }

  async function formBerita(r, semua, ctx) {
    const kategori = [...new Set(['Berita', 'Pengumuman', 'Kegiatan', 'Prestasi', 'Artikel', ...semua.map(x => x.kategori)])];
    const lokal = d => { const t = new Date(d || Date.now()); return `${fmt.isoTgl(t)}T${fmt.isoJam(t)}`; };
    return dialog({
      judul: r ? 'Ubah berita' : 'Tulis berita', ikon: 'ph-newspaper', tone: 'var(--c3)', lebar: true,
      isi: `<form id="fBerita" novalidate><div class="grid-form">
          <div class="field full"><label>Judul <span class="req">*</span></label><input class="input" name="judul" value="${esc(r?.judul || '')}" maxlength="150"></div>
          <div class="field full"><label>Alamat halaman</label><div class="slug-row"><span class="muted">berita.html?b=</span><input class="input" name="slug" value="${esc(r?.slug || '')}" maxlength="80"></div>
            <small>Terisi otomatis dari judul. Hindari mengubahnya setelah berita dibagikan.</small></div>
          <div class="field"><label>Kategori</label><input class="input" name="kategori" list="dlKategori" value="${esc(r?.kategori || 'Berita')}" maxlength="40">
            <datalist id="dlKategori">${kategori.map(k => `<option value="${esc(k)}">`).join('')}</datalist></div>
          <div class="field"><label>Penulis</label><input class="input" name="penulis_nama" value="${esc(r?.penulis_nama || ctx.S.profil.nama_lengkap || '')}" maxlength="80"></div>
          ${inputGambar('sampul', 'Gambar sampul', r?.sampul || '', { bagian: 'berita', maksSisi: 1600, bantuan: 'Foto mendatar. Juga dipakai sebagai gambar pratinjau saat dibagikan.' })}
          <div class="field full"><label>Ringkasan</label><textarea class="textarea" name="ringkasan" maxlength="300" style="min-height:64px" placeholder="Satu atau dua kalimat untuk kartu berita">${esc(r?.ringkasan || '')}</textarea></div>
          <div class="field full"><label>Isi berita <span class="req">*</span></label>${bilahFormat('isi')}
            <textarea class="textarea" name="isi" style="min-height:260px">${esc(r?.isi || '')}</textarea>
            <small>Pisahkan paragraf dengan satu baris kosong.</small></div>
          <div class="field"><label>Status</label><select class="select" name="status"><option value="draf" ${r?.status !== 'terbit' ? 'selected' : ''}>Draf (belum tampil)</option><option value="terbit" ${r?.status === 'terbit' ? 'selected' : ''}>Terbit</option></select></div>
          <div class="field"><label>Tanggal dan jam terbit</label><input class="input" type="datetime-local" name="terbit_pada" value="${esc(lokal(r?.terbit_pada))}"><small>Bila diisi waktu mendatang, berita tampil otomatis pada waktu itu.</small></div>
        </div><div id="fErr"></div></form>`,
      saatBuka: root => {
        pasangPemilihGambar(root); pasangBilahFormat(root, 'berita');
        const j = root.querySelector('[name=judul]'), s = root.querySelector('[name=slug]');
        let manual = !!r;
        s.addEventListener('input', () => { manual = true; });
        j.addEventListener('input', () => { if (!manual) s.value = slugDari(j.value); });
      },
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, {
        label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
          const f = root.querySelector('#fBerita'), v = n => f.elements[n].value.trim(), err = [];
          const d = { judul: v('judul'), slug: slugDari(v('slug') || v('judul')), kategori: v('kategori') || 'Berita', penulis_nama: v('penulis_nama'),
            sampul: v('sampul') || null, ringkasan: v('ringkasan'), isi: v('isi'), status: v('status'),
            terbit_pada: v('terbit_pada') ? new Date(v('terbit_pada')).toISOString() : new Date().toISOString() };
          if (d.judul.length < 5) err.push('Judul minimal 5 karakter.');
          if (!d.slug) err.push('Alamat halaman tidak valid.');
          if (!d.isi) err.push('Isi berita wajib diisi.');
          if (d.sampul && !/^https?:\/\//.test(d.sampul)) err.push('Tautan sampul harus diawali https://');
          if (!d.ringkasan) d.ringkasan = d.isi.replace(/[#*>_\-\[\]()!]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
          root.querySelector('#fErr').innerHTML = err.length ? `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${err.map(esc).join('<br>')}</div></div>` : '';
          if (err.length) return false;
          const { error } = r ? await sb.from('berita').update(d).eq('id', r.id) : await sb.from('berita').insert(d);
          if (error) {
            if (/duplicate key|unique/i.test(error.message)) { root.querySelector('#fErr').innerHTML = '<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>Alamat halaman sudah dipakai berita lain. Ubah sedikit alamatnya.</div></div>'; return false; }
            throw error;
          }
          return true;
        }
      }]
    });
  }

  /* =================================================================
     BERKAS UNGGAHAN (katalog berkas di Google Drive)
     ================================================================= */
  async function halBerkas(el, ctx) {
    el.innerHTML = `
      <div class="page-head">
        <p class="muted" style="margin:0;max-width:640px">Semua gambar yang diunggah tersimpan di Google Drive, folder <b>SPMB 2027 / Konten Situs</b>. Salin tautan untuk dipakai di kolom gambar mana pun.</p>
        <div class="spacer"></div>
        <label class="btn"><i class="ph-duotone ph-upload-simple"></i>Unggah gambar<input type="file" id="fileBaru" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden></label>
      </div>
      <div id="gridBerkas" class="berkas-grid"></div>`;
    let semua = [];
    const muat = async () => {
      const { data, error } = await sb.from('berkas_unggahan').select('*').order('dibuat_pada', { ascending: false }).limit(300);
      if (error) throw error; semua = data;
      $('#gridBerkas').innerHTML = data.length ? data.map(b => `
        <div class="berkas">
          ${String(b.mime).startsWith('image/') ? `<img alt="" loading="lazy" src="${esc(gambar(b.url, 400))}">` : '<div class="pdf"><i class="ph-duotone ph-file-pdf"></i></div>'}
          <div class="info"><b title="${esc(b.nama)}">${esc(b.nama)}</b><span>${esc(NAMA_MODUL[b.bagian] || b.bagian || '')} · ${Math.round((b.ukuran || 0) / 1024)} KB · ${fmt.tgl(b.dibuat_pada)}</span></div>
          <div class="acts">
            <button class="icon-btn plain" data-salin="${esc(b.url)}" title="Salin tautan" aria-label="Salin tautan"><i class="ph-duotone ph-copy" style="color:var(--c1)"></i></button>
            <a class="icon-btn plain" href="https://drive.google.com/file/d/${esc(b.drive_id)}/view" target="_blank" rel="noopener" title="Buka di Drive" aria-label="Buka di Drive"><i class="ph-duotone ph-google-drive-logo" style="color:var(--c5)"></i></a>
            <button class="icon-btn plain" data-hapus="${esc(b.drive_id)}" title="Hapus" aria-label="Hapus"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>
          </div>
        </div>`).join('')
        : '<div class="card"><div class="empty"><i class="ph-duotone ph-folder-open"></i><b>Belum ada berkas</b>Gambar yang diunggah dari menu mana pun akan tercatat di sini.</div></div>';
    };
    await muat();
    $('#fileBaru').onchange = async e => {
      const files = [...e.target.files]; e.target.value = '';
      for (const [i, f] of files.entries()) {
        toast(`Mengunggah ${i + 1} dari ${files.length}: ${f.name}`, 'info', 2500);
        try { await unggahBerkas(f, { bagian: 'umum' }); } catch (err) { toast(`${f.name}: ${pesanGalat(err)}`, 'err', 7000); }
      }
      await muat(); toast('Unggah selesai.');
    };
    $('#gridBerkas').addEventListener('click', async e => {
      const s = e.target.closest('[data-salin]'), h = e.target.closest('[data-hapus]');
      if (s) { try { await navigator.clipboard.writeText(s.dataset.salin); toast('Tautan disalin.'); } catch (x) { prompt('Salin tautan berikut:', s.dataset.salin); } }
      if (h) {
        const b = semua.find(x => x.drive_id === h.dataset.hapus);
        const [{ count: c1 }, { count: c2 }] = await Promise.all([
          sb.from('konten_situs').select('id', { count: 'exact', head: true }).eq('gambar', b.url),
          sb.from('berita').select('id', { count: 'exact', head: true }).eq('sampul', b.url)]);
        const dipakai = (c1 || 0) + (c2 || 0);
        if (!(await konfirmasi('Hapus berkas?', `${dipakai ? `<b>Berkas ini masih dipakai di ${dipakai} konten.</b> Gambarnya akan hilang dari situs.<br><br>` : ''}Berkas dipindahkan ke Sampah Google Drive dan masih dapat dipulihkan dari Drive selama 30 hari.`, 'Hapus', true))) return;
        try { await hapusBerkasDrive(b.drive_id); toast('Berkas dihapus.'); await muat(); } catch (err) { toast(pesanGalat(err), 'err', 7000); }
      }
    });
  }
})();
