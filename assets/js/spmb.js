/* =====================================================================
   MENU PENGATURAN SPMB (Fase 3) · khusus Superadmin
   Tab: Gelombang dan Kuota, Rincian Biaya, Rekening, Formulir,
        Templat WhatsApp.
   Dimuat sesudah konten.js dan sebelum dashboard.js; dashboard
   memanggil SPMB_MODUL.spmb().
   ===================================================================== */
(function () {
  'use strict';
  const { sb, CFG, fmt, esc, toast, dialog, konfirmasi, pesanGalat, muatPengaturan, slugDari } = window.SPMB;
  const $ = (s, r = document) => r.querySelector(s);
  const UI = window.SPMB_UI;

  /* ---------- Waktu WITA ---------- */
  // timestamptz -> { tgl: '2026-10-01', jam: '08:00' } menurut WITA
  const wita = ts => {
    if (!ts) return { tgl: '', jam: '' };
    const s = new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Makassar' });
    return { tgl: s.slice(0, 10), jam: s.slice(11, 16) };
  };
  const keTs = (tgl, jam) => tgl ? new Date(`${tgl}T${jam || '00:00'}:00+08:00`).toISOString() : null;
  const tglId = iso => iso ? fmt.tglPanjang(new Date(iso + 'T00:00:00')) : '';
  const tglPendek = iso => iso ? fmt.tgl(new Date(iso + 'T00:00:00')) : '';
  const tsId = ts => { const w = wita(ts); return w.tgl ? `${tglId(w.tgl)}, ${w.jam.replace(':', '.')} WITA` : ''; };
  const rentangTgl = (a, b) => !a ? '' : !b || a === b ? tglId(a) : `${tglId(a)} – ${tglId(b)}`;
  const rupiah = n => 'Rp ' + fmt.angka(n || 0);

  const JENJANG = ['SMP', 'SMA'], BAGIAN = ['putra', 'putri'];
  const NAMA_TAHAP = { pendaftaran: 'Pendaftaran', daftar_ulang: 'Daftar ulang', bulanan: 'Bulanan', tahunan: 'Tahunan', lainnya: 'Lainnya' };
  const TONE_TAHAP = { pendaftaran: 'var(--c1)', daftar_ulang: 'var(--c3)', bulanan: 'var(--c5)', tahunan: 'var(--c2)', lainnya: 'var(--c8)' };
  const NAMA_JENJANG = { semua: 'Semua jenjang', SMP: 'SMP', SMA: 'SMA' };
  const NAMA_BAGIAN = { semua: 'Putra dan putri', putra: 'Putra', putri: 'Putri' };
  const NAMA_PERUNTUKAN = { semua: 'Pendaftaran dan daftar ulang', pendaftaran: 'Pendaftaran', daftar_ulang: 'Daftar ulang' };
  const BERKAS_INTI = ['pas_foto', 'kk', 'akta', 'skl_rapor', 'bukti_bayar'];

  const galatBox = err => err.length ? `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${err.map(esc).join('<br>')}</div></div>` : '';
  const tombolUrut = `<span class="urut-btn"><button type="button" class="icon-btn plain" data-naik title="Naikkan" aria-label="Naikkan"><i class="ph-duotone ph-caret-up"></i></button><button type="button" class="icon-btn plain" data-turun title="Turunkan" aria-label="Turunkan"><i class="ph-duotone ph-caret-down"></i></button></span>`;

  // Simpan urutan hasil seret-lepas (tabel dengan kolom urutan)
  async function simpanUrutan(tabel, ids) {
    const hasil = await Promise.all(ids.map((id, i) => sb.from(tabel).update({ urutan: i + 1 }).eq('id', id)));
    const g = hasil.find(h => h.error); if (g) throw g.error;
  }

  // Isi templat WhatsApp: {nama} -> nilai (juga dipakai menu Pendaftar di Langkah 5)
  const isiTemplat = (teks, data) => String(teks || '').replace(/\{(\w+)\}/g, (m, k) => data[k] != null && data[k] !== '' ? data[k] : m);
  // Pratinjau format WhatsApp: *tebal*, _miring_, ~coret~
  const formatWA = teks => esc(teks)
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>').replace(/~([^~\n]+)~/g, '<s>$1</s>')
    .replace(/\n/g, '<br>');
  Object.assign(window.SPMB_UI, { isiTemplat, formatWA, wita, keTs });

  /* =================================================================
     HALAMAN UTAMA
     ================================================================= */
  const TAB = [
    ['gelombang', 'Gelombang dan Kuota', 'ph-flag-banner', 'var(--c2)'],
    ['biaya', 'Rincian Biaya', 'ph-wallet', 'var(--c3)'],
    ['rekening', 'Rekening', 'ph-bank', 'var(--c5)'],
    ['formulir', 'Formulir', 'ph-textbox', 'var(--c1)'],
    ['wa', 'Templat WhatsApp', 'ph-whatsapp-logo', 'var(--ok)']
  ];
  window.SPMB_MODUL = window.SPMB_MODUL || {};
  window.SPMB_MODUL.spmb = async (k, ctx) => {
    const tab = (location.hash.match(/[?&]tab=(\w+)/) || [])[1] || 'gelombang';
    k.innerHTML = `
      <div class="tabs" role="tablist">
        ${TAB.map(([id, l, ic, t]) => `<button role="tab" data-tab="${id}" aria-selected="${id === tab}"><i class="ph-duotone ${ic}" style="color:${t}"></i>${l}</button>`).join('')}
      </div>
      <div id="isiTab"></div>`;
    k.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { location.hash = '#/spmb?tab=' + b.dataset.tab; });
    k.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    window.scrollTo(0, 0);
    ctx.setFab(null);
    const el = $('#isiTab');
    const fungsi = { gelombang: tabGelombang, biaya: tabBiaya, rekening: tabRekening, formulir: tabFormulir, wa: tabWA }[tab] || tabGelombang;
    await fungsi(el, ctx);
  };

  /* =================================================================
     TAB GELOMBANG DAN KUOTA
     ================================================================= */
  function statusGelombang(g) {
    const kini = Date.now();
    if (g.diarsipkan_pada) return ['Diarsipkan', 'var(--c8)', 'ph-archive'];
    if (!g.buka || !g.tutup) return ['Jadwal pendaftaran belum diatur', 'var(--c6)', 'ph-warning'];
    const a = new Date(g.buka).getTime(), b = new Date(g.tutup).getTime();
    if (kini >= b) return ['Pendaftaran selesai', 'var(--c8)', 'ph-check-circle'];
    if (!g.formulir_dibuka) return ['Formulir ditutup (saklar OFF)', 'var(--c7)', 'ph-lock-simple'];
    if (kini < a) return ['Akan dibuka ' + tsId(g.buka), 'var(--c1)', 'ph-clock'];
    return ['Formulir sedang dibuka', 'var(--ok)', 'ph-door-open'];
  }

  async function tabGelombang(el, ctx) {
    let semua = [], kuota = [], terisi = {}, lihatArsip = false;
    el.innerHTML = `
      <div class="page-head">
        <div class="tabs" style="margin:0;border:0">
          <button data-arsip="0" aria-selected="true"><i class="ph-duotone ph-flag-banner" style="color:var(--c2)"></i>Aktif</button>
          <button data-arsip="1" aria-selected="false"><i class="ph-duotone ph-archive" style="color:var(--c8)"></i>Arsip</button>
        </div>
        <div class="spacer"></div>
        <a class="btn sm ghost hide-sm" href="index.html?pratinjau=1#jadwal" target="_blank" rel="noopener"><i class="ph-duotone ph-eye" style="color:var(--c1)"></i>Pratinjau di situs</a>
        <button class="btn sm hide-sm" id="btnTambah"><i class="ph-duotone ph-plus"></i>Tambah gelombang</button>
      </div>
      <div id="daftarGel" class="gel-daftar"></div>
      <div class="note info" style="margin-top:14px"><i class="ph-duotone ph-info"></i><div>
        Formulir pendaftaran terbuka otomatis bila saklar <b>Formulir</b> menyala <b>dan</b> waktu sekarang berada di antara jadwal buka dan tutup.
        Kuota kosong berarti tidak dibatasi; angka 0 berarti jenjang itu ditutup. Jadwal di sini tampil di bagian <b>Gelombang dan Jadwal</b> halaman depan.</div></div>`;

    const kartu = g => {
      const [st, tone, ic] = statusGelombang(g), bu = wita(g.buka), tu = wita(g.tutup);
      const kq = JENJANG.flatMap(j => BAGIAN.map(b => {
        const q = kuota.find(x => x.gelombang_id === g.id && x.jenjang === j && x.bagian === b) || {};
        const n = terisi[`${g.id}-${j}-${b}`] || 0, maks = q.jumlah;
        const pct = maks ? Math.min(100, Math.round(n / maks * 100)) : 0;
        const warna = maks === 0 ? 'var(--c8)' : pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--c6)' : 'var(--ok)';
        return `<div class="kuota-sel" style="--tone:${j === 'SMP' ? (b === 'putra' ? 'var(--c1)' : 'var(--c4)') : (b === 'putra' ? 'var(--c5)' : 'var(--c2)')}">
          <span>${j} ${b === 'putra' ? 'Putra' : 'Putri'}</span>
          <b>${fmt.angka(n)}<small> / ${maks == null ? '∞' : fmt.angka(maks)}</small></b>
          <i class="bar"><i style="width:${maks ? pct : 0}%;background:${warna}"></i></i>
          <em>${maks == null ? 'Tanpa batas' : maks === 0 ? 'Ditutup' : `Sisa ${fmt.angka(Math.max(0, maks - n))}`}</em></div>`;
      })).join('');
      const jadwal = [
        ['ph-note-pencil', 'var(--c3)', 'Pendaftaran', g.buka ? `${tglPendek(bu.tgl)} ${bu.jam.replace(':', '.')} – ${tglPendek(tu.tgl)} ${tu.jam.replace(':', '.')} WITA` : 'Belum diatur'],
        ['ph-exam', 'var(--c2)', 'Tes seleksi', g.tes_mulai ? rentangTgl(g.tes_mulai, g.tes_selesai) : 'Belum diatur'],
        ['ph-megaphone', 'var(--c5)', 'Pengumuman', g.pengumuman ? tsId(g.pengumuman) : 'Belum diatur'],
        ['ph-clipboard-text', 'var(--c6)', 'Daftar ulang', g.daftar_ulang_mulai ? rentangTgl(g.daftar_ulang_mulai, g.daftar_ulang_selesai) : 'Belum diatur']
      ];
      return `
        <div class="card gel-kartu${g.tampil ? '' : ' redup'}" ${lihatArsip ? '' : `draggable="true" data-urut="${g.id}"`}>
          <div class="gel-kepala">
            ${lihatArsip ? '' : '<i class="ph-duotone ph-dots-six-vertical pegangan hide-sm" title="Seret untuk mengurutkan"></i>'}
            <span class="ic-box" style="--tone:var(--c2)"><i class="ph-duotone ph-flag-banner"></i></span>
            <div class="teks"><b>${esc(g.nama)}</b>
              <div class="lencana"><span class="pill" style="--tone:${tone}"><i class="ph-duotone ${ic}"></i>${esc(st)}</span>
              ${!g.tampil && !g.diarsipkan_pada ? '<span class="pill" style="--tone:var(--c8)"><i class="ph-duotone ph-eye-slash"></i>Tidak tampil di situs</span>' : ''}
              ${g.kegiatan?.length ? `<span class="pill" style="--tone:var(--c4)"><i class="ph-duotone ph-calendar-plus"></i>${g.kegiatan.length} kegiatan tambahan</span>` : ''}</div></div>
            <div class="aksi">
              ${lihatArsip ? `
                <button class="icon-btn plain" data-pulih="${g.id}" title="Pulihkan" aria-label="Pulihkan"><i class="ph-duotone ph-arrow-counter-clockwise" style="color:var(--ok)"></i></button>
                <button class="icon-btn plain" data-hapus="${g.id}" title="Hapus permanen" aria-label="Hapus permanen"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>` : `
                <label class="gel-saklar" title="Saklar formulir pendaftaran"><span class="hide-sm">Formulir</span><span class="switch"><input type="checkbox" data-saklar="${g.id}" ${g.formulir_dibuka ? 'checked' : ''}><span></span></span></label>
                ${tombolUrut}
                <button class="icon-btn plain" data-tampil="${g.id}" title="${g.tampil ? 'Sembunyikan dari situs' : 'Tampilkan di situs'}" aria-label="Tampil atau sembunyi"><i class="ph-duotone ${g.tampil ? 'ph-eye' : 'ph-eye-slash'}" style="color:${g.tampil ? 'var(--c5)' : 'var(--c8)'}"></i></button>
                <button class="icon-btn plain" data-ubah="${g.id}" title="Ubah" aria-label="Ubah"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></button>
                <button class="icon-btn plain" data-arsipkan="${g.id}" title="Arsipkan" aria-label="Arsipkan"><i class="ph-duotone ph-archive" style="color:var(--c3)"></i></button>`}
            </div>
          </div>
          <div class="gel-jadwal">${jadwal.map(([i, t, l, v]) => `<div style="--tone:${t}"><i class="ph-duotone ${i}"></i><span>${l}</span><b>${esc(v)}</b></div>`).join('')}</div>
          <div class="kuota-kisi">${kq}</div>
          ${g.keterangan ? `<p class="muted" style="margin:10px 0 0;font-size:13px"><i class="ph-duotone ph-note"></i> ${esc(g.keterangan)}</p>` : ''}
        </div>`;
    };

    const render = () => {
      const rows = semua.filter(g => lihatArsip ? g.diarsipkan_pada : !g.diarsipkan_pada);
      $('#daftarGel').innerHTML = rows.length ? rows.map(kartu).join('')
        : `<div class="card"><div class="empty"><i class="ph-duotone ${lihatArsip ? 'ph-archive' : 'ph-flag-banner'}"></i><b>${lihatArsip ? 'Arsip kosong' : 'Belum ada gelombang'}</b>${lihatArsip ? '' : 'Klik Tambah gelombang untuk membuat Gelombang 1.'}</div></div>`;
    };
    const muat = async () => {
      const [g, q, st] = await Promise.all([
        sb.from('gelombang').select('*').order('urutan').order('id'),
        sb.from('kuota').select('*'),
        sb.rpc('statistik_dashboard')
      ]);
      if (g.error) throw g.error; if (q.error) throw q.error;
      semua = g.data; kuota = q.data; terisi = {};
      (st.data?.kuota || []).forEach(x => terisi[`${x.gelombang_id}-${x.jenjang}-${x.bagian}`] = x.terisi);
      render();
    };
    await muat();

    el.querySelectorAll('[data-arsip]').forEach(b => b.onclick = () => {
      lihatArsip = b.dataset.arsip === '1';
      el.querySelectorAll('[data-arsip]').forEach(x => x.setAttribute('aria-selected', String(x === b))); render();
    });
    const buka = async g => { if (await formGelombang(g, semua, kuota)) { toast(g ? 'Gelombang disimpan.' : 'Gelombang ditambahkan.'); await muat(); } };
    $('#btnTambah').onclick = () => buka(null);
    ctx.setFab(() => buka(null), 'ph-plus', 'Tambah gelombang');

    const daftar = $('#daftarGel');
    UI.pasangUrutan(daftar, async ids => {
      try { await simpanUrutan('gelombang', ids.map(Number)); ids.forEach((id, i) => { const g = semua.find(x => x.id == id); if (g) g.urutan = i + 1; }); semua.sort((a, b) => a.urutan - b.urutan || a.id - b.id); }
      catch (err) { toast(pesanGalat(err), 'err'); await muat(); }
    });
    daftar.addEventListener('mousedown', e => { const r = e.target.closest('[data-urut]'); if (r) r.draggable = !e.target.closest('input,a,button,label'); });

    daftar.addEventListener('change', async e => {
      const c = e.target.closest('[data-saklar]'); if (!c) return;
      const g = semua.find(x => x.id == c.dataset.saklar);
      if (c.checked && (!g.buka || !g.tutup)) { c.checked = false; return toast('Atur dulu jadwal buka dan tutup pendaftaran gelombang ini.', 'warn'); }
      if (c.checked) {
        const bentrok = semua.find(x => x.id !== g.id && !x.diarsipkan_pada && x.formulir_dibuka && x.buka && x.tutup && new Date(x.buka) < new Date(g.tutup) && new Date(g.buka) < new Date(x.tutup));
        if (bentrok && !(await konfirmasi('Jadwal bertabrakan', `Formulir ${esc(bentrok.nama)} juga menyala dan jadwalnya beririsan. Pendaftar akan masuk ke gelombang yang dibuka lebih dulu. Tetap nyalakan?`, 'Tetap nyalakan'))) { c.checked = false; return; }
      }
      const { error } = await sb.from('gelombang').update({ formulir_dibuka: c.checked }).eq('id', g.id);
      if (error) { c.checked = !c.checked; return toast(pesanGalat(error), 'err'); }
      toast(c.checked ? `Saklar formulir ${g.nama} dinyalakan.` : `Formulir ${g.nama} ditutup.`, c.checked ? 'ok' : 'warn');
      await muat();
    });
    daftar.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      const [aksi, idTeks] = Object.entries(t.dataset)[0] || []; const id = +idTeks; if (!id) return;
      const g = semua.find(x => x.id === id);
      try {
        if (aksi === 'ubah') return buka(g);
        if (aksi === 'tampil') { const { error } = await sb.from('gelombang').update({ tampil: !g.tampil }).eq('id', id); if (error) throw error; toast(g.tampil ? 'Disembunyikan dari situs.' : 'Ditampilkan di situs.'); }
        if (aksi === 'arsipkan') {
          if (!(await konfirmasi('Arsipkan gelombang?', `${esc(g.nama)} tidak tampil di situs dan formulirnya ditutup. Data pendaftarnya tetap aman. Anda dapat memulihkannya dari tab Arsip.`, 'Arsipkan'))) return;
          const { error } = await sb.from('gelombang').update({ diarsipkan_pada: new Date().toISOString(), formulir_dibuka: false }).eq('id', id); if (error) throw error; toast('Gelombang diarsipkan.');
        }
        if (aksi === 'pulih') { const { error } = await sb.from('gelombang').update({ diarsipkan_pada: null }).eq('id', id); if (error) throw error; toast('Gelombang dipulihkan.'); }
        if (aksi === 'hapus') {
          const { count } = await sb.from('pendaftar').select('id', { count: 'exact', head: true }).eq('gelombang_id', id);
          if (count) return toast(`${g.nama} sudah memiliki ${count} pendaftar sehingga tidak dapat dihapus. Biarkan tetap di arsip.`, 'warn', 6000);
          if (!(await konfirmasi('Hapus permanen?', `${esc(g.nama)} beserta kuotanya dihapus dan tidak dapat dipulihkan.`, 'Hapus permanen', true))) return;
          const { error } = await sb.from('gelombang').delete().eq('id', id); if (error) throw error; toast('Gelombang dihapus.');
        }
        await muat();
      } catch (err) { toast(pesanGalat(err), 'err'); }
    });
  }

  // Formulir tambah/ubah gelombang
  async function formGelombang(g, semua, kuota) {
    const baru = !g; g = g || { kegiatan: [], formulir_dibuka: false, tampil: true };
    const bu = wita(g.buka), tu = wita(g.tutup), pg = wita(g.pengumuman);
    const nomorBaru = semua.length + 1;
    const kq = (j, b) => { const q = kuota.find(x => x.gelombang_id === g.id && x.jenjang === j && x.bagian === b); return q?.jumlah ?? ''; };
    const barisKegiatan = (x = {}) => `
      <div class="kegiatan-baris">
        <input class="input" data-kg="judul" value="${esc(x.judul || '')}" maxlength="80" placeholder="Nama kegiatan, misalnya Silaturahmi wali santri" aria-label="Nama kegiatan">
        <input class="input" type="date" data-kg="mulai" value="${esc(x.mulai || '')}" aria-label="Tanggal mulai">
        <input class="input" type="date" data-kg="selesai" value="${esc(x.selesai || '')}" aria-label="Tanggal selesai">
        <input class="input" data-kg="keterangan" value="${esc(x.keterangan || '')}" maxlength="200" placeholder="Keterangan (boleh kosong)" aria-label="Keterangan">
        <button type="button" class="icon-btn plain" data-hapus-kg title="Hapus kegiatan" aria-label="Hapus kegiatan"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>
      </div>`;
    const subjudul = (ic, t, teks) => `<h4 class="sub-form"><i class="ph-duotone ${ic}" style="color:${t}"></i>${teks}</h4>`;

    return dialog({
      judul: baru ? 'Tambah gelombang' : `Ubah ${g.nama}`, ikon: 'ph-flag-banner', tone: 'var(--c2)', lebar: true,
      isi: `<form id="fGel" novalidate>
        <div class="grid-form">
          <div class="field"><label for="g_nama">Nama gelombang <span class="req">*</span></label>
            <input class="input" id="g_nama" name="nama" value="${esc(g.nama || `Gelombang ${nomorBaru}`)}" maxlength="60"></div>
          <div class="field"><label for="g_ket">Keterangan singkat</label>
            <input class="input" id="g_ket" name="keterangan" value="${esc(g.keterangan || '')}" maxlength="200" placeholder="Boleh dikosongkan"></div>
        </div>
        ${subjudul('ph-note-pencil', 'var(--c3)', 'Pendaftaran online')}
        <div class="grid-form">
          <div class="field"><label>Dibuka <span class="req">*</span></label><div class="pasangan">
            <input class="input" type="date" name="buka_tgl" value="${bu.tgl}" ${baru ? 'data-default-today' : ''} aria-label="Tanggal buka">
            <input class="input" type="time" name="buka_jam" value="${bu.jam}" ${baru ? 'data-default-now' : ''} aria-label="Jam buka"></div></div>
          <div class="field"><label>Ditutup <span class="req">*</span></label><div class="pasangan">
            <input class="input" type="date" name="tutup_tgl" value="${tu.tgl}" aria-label="Tanggal tutup">
            <input class="input" type="time" name="tutup_jam" value="${tu.jam || '23:59'}" aria-label="Jam tutup"></div>
            <small>Jam mengikuti WITA.</small></div>
        </div>
        ${subjudul('ph-exam', 'var(--c2)', 'Tes seleksi dan pengumuman')}
        <div class="grid-form">
          <div class="field"><label>Tes seleksi</label><div class="pasangan">
            <input class="input" type="date" name="tes_mulai" value="${esc(g.tes_mulai || '')}" aria-label="Tes mulai">
            <input class="input" type="date" name="tes_selesai" value="${esc(g.tes_selesai || '')}" aria-label="Tes selesai"></div>
            <small>Tanggal mulai dan selesai. Kosongkan yang kedua bila hanya satu hari.</small></div>
          <div class="field"><label>Pengumuman hasil</label><div class="pasangan">
            <input class="input" type="date" name="umum_tgl" value="${pg.tgl}" aria-label="Tanggal pengumuman">
            <input class="input" type="time" name="umum_jam" value="${pg.jam}" aria-label="Jam pengumuman"></div>
            <small>Jam kosong = pukul 08.00 WITA.</small></div>
        </div>
        ${subjudul('ph-clipboard-text', 'var(--c6)', 'Daftar ulang')}
        <div class="grid-form">
          <div class="field"><label>Periode daftar ulang</label><div class="pasangan">
            <input class="input" type="date" name="du_mulai" value="${esc(g.daftar_ulang_mulai || '')}" aria-label="Daftar ulang mulai">
            <input class="input" type="date" name="du_selesai" value="${esc(g.daftar_ulang_selesai || '')}" aria-label="Daftar ulang selesai"></div></div>
        </div>
        ${subjudul('ph-users-four', 'var(--c1)', 'Kuota santri')}
        <div class="kuota-isian">
          ${JENJANG.flatMap(j => BAGIAN.map(b => `<div class="field"><label>${j} ${b === 'putra' ? 'Putra' : 'Putri'}</label>
            <input class="input" type="number" inputmode="numeric" min="0" max="5000" name="kuota_${j}_${b}" value="${esc(kq(j, b))}" placeholder="Tanpa batas"></div>`)).join('')}
        </div>
        <small class="muted" style="display:block;margin:-6px 0 8px">Kosong = tidak dibatasi. 0 = jenjang itu tidak menerima pendaftar di gelombang ini.</small>
        ${subjudul('ph-calendar-plus', 'var(--c4)', 'Kegiatan tambahan (tampil di linimasa)')}
        <div id="daftarKegiatan">${(g.kegiatan || []).map(barisKegiatan).join('')}</div>
        <button type="button" class="btn sm ghost" id="btnTambahKegiatan" style="margin:2px 0 12px"><i class="ph-duotone ph-plus-circle" style="color:var(--c4)"></i>Tambah kegiatan</button>
        <div class="field full" style="margin:0"><label class="check"><input type="checkbox" name="formulir_dibuka" ${g.formulir_dibuka ? 'checked' : ''}>Nyalakan saklar formulir (pendaftaran terbuka pada rentang tanggal di atas)</label></div>
        <div class="field full" style="margin:0 0 4px"><label class="check"><input type="checkbox" name="tampil" ${g.tampil !== false ? 'checked' : ''}>Tampilkan jadwal gelombang ini di halaman depan</label></div>
        <div id="fErr"></div>
      </form>`,
      saatBuka: root => {
        SPMB.isiTanggalBawaan(root);
        const wadah = root.querySelector('#daftarKegiatan');
        root.querySelector('#btnTambahKegiatan').onclick = () => { wadah.insertAdjacentHTML('beforeend', barisKegiatan()); wadah.lastElementChild.querySelector('input').focus(); };
        wadah.addEventListener('click', e => { const b = e.target.closest('[data-hapus-kg]'); if (b) b.closest('.kegiatan-baris').remove(); });
      },
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, {
        label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
          const f = root.querySelector('#fGel'), v = n => f.elements[n].value.trim(), err = [];
          const d = {
            nama: v('nama'), keterangan: v('keterangan'),
            buka: keTs(v('buka_tgl'), v('buka_jam') || '00:00'), tutup: keTs(v('tutup_tgl'), v('tutup_jam') || '23:59'),
            tes_mulai: v('tes_mulai') || null, tes_selesai: v('tes_selesai') || v('tes_mulai') || null,
            pengumuman: keTs(v('umum_tgl'), v('umum_jam') || '08:00'),
            daftar_ulang_mulai: v('du_mulai') || null, daftar_ulang_selesai: v('du_selesai') || v('du_mulai') || null,
            formulir_dibuka: f.elements.formulir_dibuka.checked, tampil: f.elements.tampil.checked,
            kegiatan: [...root.querySelectorAll('.kegiatan-baris')].map(r => {
              const x = Object.fromEntries([...r.querySelectorAll('[data-kg]')].map(i => [i.dataset.kg, i.value.trim()]));
              if (x.mulai && !x.selesai) x.selesai = x.mulai;
              return x;
            }).filter(x => x.judul || x.mulai)
          };
          if (d.nama.length < 2) err.push('Nama gelombang wajib diisi.');
          if (!!d.buka !== !!d.tutup) err.push('Isi tanggal buka dan tanggal tutup pendaftaran sekaligus.');
          if (d.buka && d.tutup && new Date(d.tutup) <= new Date(d.buka)) err.push('Waktu tutup harus sesudah waktu buka.');
          if (d.formulir_dibuka && !d.buka) err.push('Saklar formulir hanya dapat dinyalakan bila jadwal buka dan tutup sudah diisi.');
          if (d.tes_mulai && d.tes_selesai < d.tes_mulai) err.push('Tanggal selesai tes tidak boleh sebelum tanggal mulai.');
          if (d.daftar_ulang_mulai && d.daftar_ulang_selesai < d.daftar_ulang_mulai) err.push('Tanggal selesai daftar ulang tidak boleh sebelum tanggal mulai.');
          if (d.tes_mulai && d.tutup && d.tes_mulai < wita(d.tutup).tgl) err.push('Catatan: tes dijadwalkan sebelum pendaftaran ditutup. Periksa kembali bila tidak disengaja.');
          d.kegiatan.forEach((x, i) => {
            if (!x.judul) err.push(`Kegiatan tambahan ${i + 1}: nama kegiatan wajib diisi.`);
            if (!x.mulai) err.push(`Kegiatan "${x.judul || i + 1}": tanggal mulai wajib diisi.`);
            if (x.mulai && x.selesai < x.mulai) err.push(`Kegiatan "${x.judul}": tanggal selesai sebelum tanggal mulai.`);
          });
          const kuotaBaru = JENJANG.flatMap(j => BAGIAN.map(b => {
            const s = v(`kuota_${j}_${b}`);
            if (s !== '' && (!/^\d+$/.test(s) || +s > 5000)) err.push(`Kuota ${j} ${b}: isi angka 0–5000 atau kosongkan.`);
            return { jenjang: j, bagian: b, jumlah: s === '' ? null : +s };
          }));
          // "Catatan" di atas hanya peringatan: minta konfirmasi, bukan penolakan
          const catatan = err.filter(x => x.startsWith('Catatan:')), galat = err.filter(x => !x.startsWith('Catatan:'));
          root.querySelector('#fErr').innerHTML = galatBox(galat);
          if (galat.length) return false;
          if (catatan.length && !(await konfirmasi('Periksa jadwal', esc(catatan[0].replace('Catatan: ', '')) + ' Tetap simpan?', 'Tetap simpan'))) return false;

          if (d.formulir_dibuka) {
            const bentrok = semua.find(x => x.id !== g.id && !x.diarsipkan_pada && x.formulir_dibuka && x.buka && x.tutup && new Date(x.buka) < new Date(d.tutup) && new Date(d.buka) < new Date(x.tutup));
            if (bentrok && !(await konfirmasi('Jadwal bertabrakan', `Formulir ${esc(bentrok.nama)} juga menyala dan jadwalnya beririsan. Pendaftar akan masuk ke gelombang yang dibuka lebih dulu. Tetap simpan?`, 'Tetap simpan'))) return false;
          }

          let id = g.id;
          if (baru) {
            d.urutan = Math.max(0, ...semua.map(x => x.urutan || 0)) + 1;
            const { data, error } = await sb.from('gelombang').insert(d).select('id').single(); if (error) throw error; id = data.id;
          } else {
            const { error } = await sb.from('gelombang').update(d).eq('id', id); if (error) throw error;
          }
          const { error: eq } = await sb.from('kuota').upsert(kuotaBaru.map(q => ({ ...q, gelombang_id: id })), { onConflict: 'gelombang_id,jenjang,bagian' });
          if (eq) throw eq;
          return true;
        }
      }]
    });
  }

  /* =================================================================
     DAFTAR UMUM (Rincian Biaya dan Rekening)
     C = { tabel, label, ikon, tone, baris(x) -> {judul, sub, lencana, kiri}, bidang, kosong, atas(el, rows) }
     ================================================================= */
  async function kelolaDaftar(el, ctx, C) {
    let semua = [], lihatArsip = false;
    el.innerHTML = `
      <div id="atasDaftar"></div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="card-head" style="padding:16px 18px 0">
          <div class="ic-box" style="--tone:${C.tone}"><i class="ph-duotone ${C.ikon}"></i></div>
          <div><h3>${C.label}</h3><p id="ringkasDaftar">Memuat…</p></div>
          <div class="spacer"></div>
          ${C.pratinjau ? `<a class="btn sm ghost hide-sm" href="${C.pratinjau}" target="_blank" rel="noopener"><i class="ph-duotone ph-eye" style="color:var(--c1)"></i>Pratinjau di situs</a>` : ''}
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
      ${C.catatan ? `<p class="muted" style="font-size:12.5px;margin-top:10px"><i class="ph-duotone ph-info"></i> ${C.catatan}</p>` : ''}`;

    const render = () => {
      const aktif = semua.filter(x => !x.diarsipkan_pada), arsip = semua.filter(x => x.diarsipkan_pada);
      $('#ringkasDaftar').textContent = `${aktif.filter(x => x.tampil).length} tampil · ${aktif.filter(x => !x.tampil).length} disembunyikan · ${arsip.length} di arsip`;
      if (C.atas) C.atas($('#atasDaftar'), aktif);
      const rows = lihatArsip ? arsip : aktif;
      $('#daftar').innerHTML = rows.length ? rows.map(x => {
        const b = C.baris(x);
        return `
        <div class="baris-konten${x.tampil ? '' : ' redup'}" ${lihatArsip ? '' : `draggable="true" data-urut="${x.id}"`}>
          ${lihatArsip ? '' : '<i class="ph-duotone ph-dots-six-vertical pegangan hide-sm" title="Seret untuk mengurutkan"></i>'}
          ${b.kiri}
          <div class="teks"><b>${esc(b.judul)}</b><span>${esc(b.sub)}</span>
            <div class="lencana">${b.lencana || ''}${!x.tampil && !x.diarsipkan_pada ? '<span class="pill" style="--tone:var(--c8)"><i class="ph-duotone ph-eye-slash"></i>Disembunyikan</span>' : ''}${x.diarsipkan_pada ? `<span class="pill" style="--tone:var(--c8)">Diarsipkan ${fmt.tgl(x.diarsipkan_pada)}</span>` : ''}</div></div>
          ${b.kanan || ''}
          <div class="aksi">
            ${lihatArsip ? `
              <button class="icon-btn plain" data-pulih="${x.id}" title="Pulihkan" aria-label="Pulihkan"><i class="ph-duotone ph-arrow-counter-clockwise" style="color:var(--ok)"></i></button>
              <button class="icon-btn plain" data-hapus="${x.id}" title="Hapus permanen" aria-label="Hapus permanen"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>` : `
              ${tombolUrut}
              <button class="icon-btn plain" data-tampil="${x.id}" title="${x.tampil ? 'Sembunyikan' : 'Tampilkan'}" aria-label="${x.tampil ? 'Sembunyikan' : 'Tampilkan'}"><i class="ph-duotone ${x.tampil ? 'ph-eye' : 'ph-eye-slash'}" style="color:${x.tampil ? 'var(--c5)' : 'var(--c8)'}"></i></button>
              <button class="icon-btn plain" data-ubah="${x.id}" title="Ubah" aria-label="Ubah"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></button>
              <button class="icon-btn plain" data-arsipkan="${x.id}" title="Arsipkan" aria-label="Arsipkan"><i class="ph-duotone ph-archive" style="color:var(--c3)"></i></button>`}
          </div>
        </div>`;
      }).join('')
        : `<div class="empty"><i class="ph-duotone ${lihatArsip ? 'ph-archive' : C.ikon}"></i><b>${lihatArsip ? 'Arsip kosong' : C.kosong}</b>${lihatArsip ? '' : 'Klik Tambah untuk mengisi.'}</div>`;
    };
    const muat = async () => {
      const { data, error } = await sb.from(C.tabel).select('*').order('urutan').order('id');
      if (error) throw error; semua = data; render();
    };
    await muat();

    el.querySelectorAll('[data-arsip]').forEach(b => b.onclick = () => {
      lihatArsip = b.dataset.arsip === '1';
      el.querySelectorAll('[data-arsip]').forEach(x => x.setAttribute('aria-selected', String(x === b))); render();
    });
    const buka = async x => { if (await formDaftar(C, x, semua)) { toast(x ? 'Perubahan disimpan.' : `${C.labelSatu[0].toUpperCase() + C.labelSatu.slice(1)} ditambahkan.`); await muat(); } };
    $('#btnTambah').onclick = () => buka(null);
    ctx.setFab(() => buka(null), 'ph-plus', `Tambah ${C.labelSatu}`);

    UI.pasangUrutan($('#daftar'), async ids => {
      try { await simpanUrutan(C.tabel, ids.map(Number)); ids.forEach((id, i) => { const x = semua.find(r => r.id == id); if (x) x.urutan = i + 1; }); semua.sort((a, b) => a.urutan - b.urutan || a.id - b.id); }
      catch (err) { toast(pesanGalat(err), 'err'); await muat(); }
    });
    $('#daftar').addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      const [aksi, idTeks] = Object.entries(t.dataset)[0] || []; const id = +idTeks; if (!id) return;
      const x = semua.find(r => r.id === id), nama = esc(C.baris(x).judul);
      try {
        if (aksi === 'ubah') return buka(x);
        if (aksi === 'tampil') { const { error } = await sb.from(C.tabel).update({ tampil: !x.tampil }).eq('id', id); if (error) throw error; toast(x.tampil ? 'Disembunyikan.' : 'Ditampilkan.'); }
        if (aksi === 'arsipkan') {
          if (!(await konfirmasi('Arsipkan?', `"${nama}" tidak lagi dipakai di situs dan formulir. Anda dapat memulihkannya dari tab Arsip.`, 'Arsipkan'))) return;
          const { error } = await sb.from(C.tabel).update({ diarsipkan_pada: new Date().toISOString() }).eq('id', id); if (error) throw error; toast('Diarsipkan.');
        }
        if (aksi === 'pulih') { const { error } = await sb.from(C.tabel).update({ diarsipkan_pada: null }).eq('id', id); if (error) throw error; toast('Dipulihkan.'); }
        if (aksi === 'hapus') {
          if (!(await konfirmasi('Hapus permanen?', `"${nama}" akan dihapus dan tidak dapat dipulihkan.`, 'Hapus permanen', true))) return;
          const { error } = await sb.from(C.tabel).delete().eq('id', id); if (error) throw error; toast('Dihapus permanen.');
        }
        await muat();
      } catch (err) { toast(pesanGalat(err), 'err'); }
    });
  }

  // Formulir tambah/ubah untuk kelolaDaftar
  function formDaftar(C, x, semua) {
    const nilai = b => x ? x[b.k] : b.bawaan;
    const bidang = b => {
      const v = nilai(b) ?? '', req = b.wajib ? ' <span class="req">*</span>' : '', id = `d_${b.k}`, bantu = b.bantuan ? `<small>${b.bantuan}</small>` : '';
      const kelas = b.full ? 'field full' : 'field';
      switch (b.t) {
        case 'pilihan': return `<div class="${kelas}"><label for="${id}">${b.l}${req}</label><select class="select" id="${id}" name="${b.k}">${b.opsi.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v ?? '') ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>${bantu}</div>`;
        case 'rupiah': return `<div class="${kelas}"><label for="${id}">${b.l}${req}</label><input class="input" id="${id}" name="${b.k}" inputmode="numeric" value="${v === '' ? '' : esc(v)}" placeholder="Contoh: 250000"><small data-rp>${v !== '' ? rupiah(v) : 'Tulis angka saja, tanpa titik.'}</small></div>`;
        case 'cek': return `<div class="field full" style="margin:0"><label class="check"><input type="checkbox" name="${b.k}" ${v ? 'checked' : ''}>${b.l}</label></div>`;
        case 'panjang': return `<div class="field full"><label for="${id}">${b.l}${req}</label><textarea class="textarea" id="${id}" name="${b.k}" maxlength="${b.maks || 300}" style="min-height:70px" placeholder="${esc(b.contoh || '')}">${esc(v)}</textarea>${bantu}</div>`;
        default: return `<div class="${kelas}"><label for="${id}">${b.l}${req}</label><input class="input" id="${id}" name="${b.k}" value="${esc(v)}" maxlength="${b.maks || 100}" ${b.contoh ? `placeholder="Contoh: ${esc(b.contoh)}"` : ''} ${b.angka ? 'inputmode="numeric"' : ''}>${bantu}</div>`;
      }
    };
    return dialog({
      judul: `${x ? 'Ubah' : 'Tambah'} ${C.labelSatu}`, ikon: C.ikon, tone: C.tone,
      isi: `<form id="fDaftar" novalidate><div class="grid-form">${C.bidang.map(bidang).join('')}</div>
        <div class="field full" style="margin:0 0 4px"><label class="check"><input type="checkbox" name="_tampil" ${!x || x.tampil ? 'checked' : ''}>Tampilkan dan pakai</label></div>
        <div id="fErr"></div></form>`,
      saatBuka: root => {
        root.querySelectorAll('[data-rp]').forEach(s => {
          const i = s.previousElementSibling;
          i.addEventListener('input', () => { const n = i.value.replace(/\D/g, ''); s.textContent = n ? rupiah(+n) : 'Tulis angka saja, tanpa titik.'; });
        });
      },
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, {
        label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
          const f = root.querySelector('#fDaftar'), err = [], d = { tampil: f.elements._tampil.checked };
          for (const b of C.bidang) {
            const i = f.elements[b.k];
            let v = b.t === 'cek' ? i.checked : i.value.trim();
            if (b.t === 'rupiah') { v = v.replace(/[.\s]/g, ''); if (!/^\d{1,10}$/.test(v)) { err.push(`${b.l}: isi angka tanpa titik (0 atau lebih).`); continue; } v = +v; }
            if (b.wajib && (v === '' || v == null)) { err.push(`${b.l} wajib diisi.`); continue; }
            if (b.pola && v && !b.pola.test(v)) err.push(b.pesanPola);
            if (b.t === 'pilihan' && b.angka) v = v === '' ? null : +v;
            d[b.k] = v;
          }
          root.querySelector('#fErr').innerHTML = galatBox(err);
          if (err.length) return false;
          if (C.rapikan) C.rapikan(d);
          if (x) { const { error } = await sb.from(C.tabel).update(d).eq('id', x.id); if (error) throw error; }
          else {
            d.urutan = Math.max(0, ...semua.map(r => r.urutan || 0)) + 1;
            const { error } = await sb.from(C.tabel).insert(d); if (error) throw error;
          }
          return true;
        }
      }]
    });
  }

  /* =================================================================
     TAB RINCIAN BIAYA
     ================================================================= */
  async function tabBiaya(el, ctx) {
    const { data: gel } = await sb.from('gelombang').select('id,nama,diarsipkan_pada').order('urutan').order('id');
    const gelAktif = (gel || []).filter(g => !g.diarsipkan_pada);
    const namaGel = id => (gel || []).find(g => g.id === id)?.nama || 'gelombang terhapus';
    let pilihGel = gelAktif[0]?.id ?? '';

    await kelolaDaftar(el, ctx, {
      tabel: 'rincian_biaya', label: 'Rincian Biaya', labelSatu: 'komponen biaya', ikon: 'ph-wallet', tone: 'var(--c3)',
      kosong: 'Belum ada komponen biaya', pratinjau: 'index.html?pratinjau=1#biaya',
      catatan: 'Biaya tahap Pendaftaran tampil di formulir sebagai tagihan pendaftaran. Biaya lainnya tampil di halaman depan dan dipakai saat daftar ulang (Fase 5).',
      baris: x => ({
        judul: x.komponen,
        sub: [NAMA_JENJANG[x.jenjang], NAMA_BAGIAN[x.bagian], x.gelombang_id ? namaGel(x.gelombang_id) : 'Semua gelombang', x.keterangan].filter(Boolean).join(' · '),
        kiri: `<span class="ic-box" style="--tone:${TONE_TAHAP[x.tahap]}"><i class="ph-duotone ph-receipt"></i></span>`,
        lencana: `<span class="pill" style="--tone:${TONE_TAHAP[x.tahap]}">${NAMA_TAHAP[x.tahap]}</span>${x.wajib ? '' : '<span class="pill" style="--tone:var(--c8)">Opsional</span>'}`,
        kanan: `<b class="nominal">${rupiah(x.nominal)}</b>`
      }),
      bidang: [
        { k: 'komponen', l: 'Komponen biaya', wajib: 1, maks: 80, contoh: 'Uang pendaftaran', full: 1 },
        { k: 'tahap', l: 'Tahap pembayaran', t: 'pilihan', opsi: Object.entries(NAMA_TAHAP), bawaan: 'pendaftaran' },
        { k: 'nominal', l: 'Nominal (Rp)', t: 'rupiah', wajib: 1, bawaan: '' },
        { k: 'jenjang', l: 'Jenjang', t: 'pilihan', opsi: Object.entries(NAMA_JENJANG), bawaan: 'semua' },
        { k: 'bagian', l: 'Berlaku untuk', t: 'pilihan', opsi: Object.entries(NAMA_BAGIAN), bawaan: 'semua' },
        { k: 'gelombang_id', l: 'Gelombang', t: 'pilihan', angka: 1, opsi: [['', 'Semua gelombang'], ...gelAktif.map(g => [g.id, g.nama])], bawaan: '', bantuan: 'Pilih gelombang tertentu bila biayanya berbeda antargelombang. Halaman depan menampilkan biaya umum ditambah biaya khusus gelombang yang sedang dibuka (atau yang berikutnya).' },
        { k: 'wajib', l: 'Biaya wajib (dihitung dalam total)', t: 'cek', bawaan: true },
        { k: 'keterangan', l: 'Keterangan', t: 'panjang', maks: 300, contoh: 'Dapat diangsur 3 kali', bawaan: '' }
      ],
      // Ringkasan total wajib per tahap untuk setiap jenjang dan putra/putri
      atas: function ringkasan(box, rows) {
        if (!rows.length) { box.innerHTML = ''; return; }
        const kolom = JENJANG.flatMap(j => BAGIAN.map(b => [j, b]));
        const pakai = x => x.tampil && x.wajib && (x.gelombang_id == null || String(x.gelombang_id) === String(pilihGel));
        const tahap = Object.keys(NAMA_TAHAP).filter(t => rows.some(x => x.tahap === t && pakai(x)));
        const jumlah = (t, j, b) => rows.filter(x => pakai(x) && x.tahap === t && (x.jenjang === 'semua' || x.jenjang === j) && (x.bagian === 'semua' || x.bagian === b)).reduce((a, x) => a + (+x.nominal || 0), 0);
        box.innerHTML = `
          <div class="card ringkas-biaya" style="margin-bottom:16px">
            <div class="card-head"><div class="ic-box" style="--tone:var(--c6)"><i class="ph-duotone ph-calculator"></i></div>
              <div><h3>Ringkasan biaya wajib</h3><p>Total yang tampil dan wajib, per tahap</p></div><div class="spacer"></div>
              ${gelAktif.length ? `<select class="select" id="ringkasGel" style="width:auto" aria-label="Gelombang">${gelAktif.map(g => `<option value="${g.id}" ${String(g.id) === String(pilihGel) ? 'selected' : ''}>${esc(g.nama)}</option>`).join('')}</select>` : ''}</div>
            ${tahap.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Tahap</th>${kolom.map(([j, b]) => `<th class="c">${j} ${b === 'putra' ? 'Putra' : 'Putri'}</th>`).join('')}</tr></thead>
              <tbody>${tahap.map(t => `<tr><td><span class="pill" style="--tone:${TONE_TAHAP[t]}">${NAMA_TAHAP[t]}</span></td>${kolom.map(([j, b]) => `<td class="c">${rupiah(jumlah(t, j, b))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
              : '<p class="muted" style="margin:0">Belum ada biaya wajib yang tampil.</p>'}
          </div>`;
        const s = box.querySelector('#ringkasGel');
        if (s) s.onchange = () => { pilihGel = s.value; ringkasan(box, rows); };
      }
    });
  }

  /* =================================================================
     TAB REKENING
     ================================================================= */
  function tabRekening(el, ctx) {
    return kelolaDaftar(el, ctx, {
      tabel: 'rekening', label: 'Rekening Pembayaran', labelSatu: 'rekening', ikon: 'ph-bank', tone: 'var(--c5)',
      kosong: 'Belum ada rekening', pratinjau: 'index.html?pratinjau=1#biaya',
      catatan: 'Rekening tampil di formulir pendaftaran (langkah unggah bukti transfer), di bawah rincian biaya halaman depan, dan pada tagihan daftar ulang.',
      baris: x => ({
        judul: `${x.bank} · ${x.nomor_rekening}`,
        sub: ['a.n. ' + x.atas_nama, x.keterangan].filter(Boolean).join(' · '),
        kiri: '<span class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-bank"></i></span>',
        lencana: `<span class="pill" style="--tone:var(--c1)">${NAMA_PERUNTUKAN[x.peruntukan]}</span><span class="pill" style="--tone:${x.bagian === 'putri' ? 'var(--c4)' : x.bagian === 'putra' ? 'var(--c2)' : 'var(--c8)'}">${NAMA_BAGIAN[x.bagian]}</span>`
      }),
      bidang: [
        { k: 'bank', l: 'Nama bank', wajib: 1, maks: 60, contoh: 'Bank Syariah Indonesia (BSI)' },
        { k: 'nomor_rekening', l: 'Nomor rekening', wajib: 1, maks: 30, angka: 1, contoh: '7123456789', pola: /^[0-9][0-9 .-]{4,30}$/, pesanPola: 'Nomor rekening hanya berisi angka (boleh spasi, titik, atau strip).' },
        { k: 'atas_nama', l: 'Atas nama', wajib: 1, maks: 100, full: 1, contoh: 'Ponpes Imam Asy-Syathiby' },
        { k: 'peruntukan', l: 'Peruntukan', t: 'pilihan', opsi: Object.entries(NAMA_PERUNTUKAN), bawaan: 'semua' },
        { k: 'bagian', l: 'Untuk santri', t: 'pilihan', opsi: Object.entries(NAMA_BAGIAN), bawaan: 'semua' },
        { k: 'keterangan', l: 'Keterangan', t: 'panjang', maks: 200, contoh: 'Kode bank 451. Sertakan nama santri pada berita transfer.', bawaan: '' }
      ]
    });
  }

  /* =================================================================
     TAB FORMULIR (pengaturan kunci "spmb")
     ================================================================= */
  function contohNomor(pola, digit, ta, jenjang, jk) {
    const tahun = (String(ta).match(/\d{4}/) || [String(new Date().getFullYear())])[0];
    return pola.replace('{TA}', tahun.slice(2)).replace('{TAHUN}', tahun).replace('{JENJANG}', jenjang).replace('{JK}', jk).replace('{NO}', '1'.padStart(digit, '0'));
  }

  async function tabFormulir(el, ctx) {
    const p = await muatPengaturan(true);
    const c = JSON.parse(JSON.stringify(p.spmb || {}));
    const ta = p.identitas?.tahun_ajaran || '2027/2028';
    c.usia = c.usia || { acuan: '2027-07-01', SMP: { min: 11, maks: 15 }, SMA: { min: 14, maks: 18 } };
    c.berkas = c.berkas || [];
    const barisBerkas = b => `
      <div class="berkas-atur" data-kunci="${esc(b.kunci || '')}">
        <span class="ic-box" style="--tone:${BERKAS_INTI.includes(b.kunci) ? 'var(--c1)' : 'var(--c4)'}"><i class="ph-duotone ${b.jenis === 'gambar' ? 'ph-image' : 'ph-file-text'}"></i></span>
        <input class="input" data-b="label" value="${esc(b.label || '')}" maxlength="60" placeholder="Nama berkas" aria-label="Nama berkas">
        <select class="select" data-b="jenis" aria-label="Jenis berkas"><option value="semua" ${b.jenis !== 'gambar' ? 'selected' : ''}>Foto atau PDF</option><option value="gambar" ${b.jenis === 'gambar' ? 'selected' : ''}>Foto saja</option></select>
        <label class="check" style="margin:0"><input type="checkbox" data-b="wajib" ${b.wajib ? 'checked' : ''}>Wajib</label>
        ${BERKAS_INTI.includes(b.kunci) ? '<span class="icon-btn plain" title="Berkas inti tidak dapat dihapus" style="cursor:default"><i class="ph-duotone ph-lock-simple" style="color:var(--c8)"></i></span>'
          : '<button type="button" class="icon-btn plain" data-hapus-berkas title="Hapus berkas" aria-label="Hapus berkas"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>'}
      </div>`;
    const token = t => `<button type="button" class="chip-token" data-token="${t}">${t}</button>`;

    el.innerHTML = `
      <form id="fForm" novalidate>
        <div class="grid-2" style="align-items:start">
          <div class="card">
            <div class="card-head"><div class="ic-box" style="--tone:var(--c1)"><i class="ph-duotone ph-hash"></i></div><div><h3>Nomor registrasi</h3><p>Dibuat otomatis saat formulir dikirim</p></div></div>
            <div class="field"><label for="f_pola">Format nomor</label>
              <input class="input" id="f_pola" name="format_nomor" value="${esc(c.format_nomor || 'SPMB{TA}-{JENJANG}-{JK}-{NO}')}" maxlength="60" style="font-family:ui-monospace,Menlo,Consolas,monospace">
              <div class="token-baris">${['{TA}', '{TAHUN}', '{JENJANG}', '{JK}', '{NO}'].map(token).join('')}</div>
              <small>{TA} = 2 digit tahun ajaran, {TAHUN} = 4 digit, {JENJANG} = SMP/SMA, {JK} = P (putra) atau I (putri), {NO} = nomor urut. Wajib memuat {JENJANG}, {JK}, dan {NO}.</small></div>
            <div class="field"><label for="f_digit">Jumlah digit nomor urut</label>
              <select class="select" id="f_digit" name="digit_nomor" style="max-width:220px">${[3, 4, 5].map(n => `<option value="${n}" ${(+c.digit_nomor || 4) === n ? 'selected' : ''}>${n} digit (${'1'.padStart(n, '0')})</option>`).join('')}</select></div>
            <div class="nomor-contoh" id="contohNomor"></div>
            <div class="note" style="margin:12px 0 0"><i class="ph-duotone ph-warning"></i><div>Perubahan format hanya berlaku untuk pendaftar berikutnya. Nomor yang sudah terbit tidak berubah dan nomor urut tetap berlanjut.</div></div>
          </div>
          <div class="card">
            <div class="card-head"><div class="ic-box" style="--tone:var(--c3)"><i class="ph-duotone ph-cake"></i></div><div><h3>Batas usia</h3><p>Dihitung pada tanggal acuan</p></div></div>
            <div class="field"><label for="f_acuan">Tanggal acuan usia</label><input class="input" type="date" id="f_acuan" name="acuan" value="${esc(c.usia.acuan || '')}" style="max-width:220px"><small>Biasanya awal tahun ajaran, misalnya 01/07/2027.</small></div>
            <div class="grid-form">
              ${JENJANG.map(j => `
                <div class="field"><label>${j}: usia minimal</label><input class="input" type="number" min="5" max="25" name="${j}_min" value="${esc(c.usia[j]?.min ?? '')}"></div>
                <div class="field"><label>${j}: usia maksimal</label><input class="input" type="number" min="5" max="25" name="${j}_maks" value="${esc(c.usia[j]?.maks ?? '')}"></div>`).join('')}
            </div>
            <small class="muted">Selisih 1 tahun di luar batas masih dapat dikirim setelah pendaftar mengonfirmasi peringatan; Admin melihat tandanya saat verifikasi. Selisih lebih jauh ditolak.</small>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c4)"><i class="ph-duotone ph-files"></i></div><div><h3>Berkas yang diunggah pendaftar</h3><p>Langkah 5 formulir. Foto dikompres otomatis; PDF maksimal 5 MB.</p></div></div>
          <div id="daftarBerkas">${c.berkas.map(barisBerkas).join('')}</div>
          <button type="button" class="btn sm ghost" id="btnTambahBerkas" style="margin-top:8px"><i class="ph-duotone ph-plus-circle" style="color:var(--c4)"></i>Tambah jenis berkas</button>
        </div>

        <div class="grid-2" style="align-items:start">
          <div class="card">
            <div class="card-head"><div class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-list-bullets"></i></div><div><h3>Pilihan isian</h3><p>Satu pilihan per baris</p></div></div>
            <div class="field"><label for="f_sumber">Dari mana mengetahui informasi SPMB</label><textarea class="textarea" id="f_sumber" name="sumber_info" style="min-height:150px">${esc((c.sumber_info || []).join('\n'))}</textarea></div>
            <div class="field"><label for="f_kerja">Pekerjaan ayah dan ibu</label><textarea class="textarea" id="f_kerja" name="pekerjaan" style="min-height:150px">${esc((c.pekerjaan || []).join('\n'))}</textarea></div>
          </div>
          <div class="card">
            <div class="card-head"><div class="ic-box" style="--tone:var(--c6)"><i class="ph-duotone ph-seal-check"></i></div><div><h3>Teks formulir</h3><p>Pernyataan persetujuan dan pengumuman singkat</p></div></div>
            <div class="field"><label for="f_nyata">Pernyataan persetujuan (wajib dicentang)</label><textarea class="textarea" id="f_nyata" name="pernyataan" maxlength="600" style="min-height:110px">${esc(c.pernyataan || '')}</textarea></div>
            <div class="field"><label for="f_cat">Catatan di awal formulir</label><textarea class="textarea" id="f_cat" name="catatan_formulir" maxlength="600" style="min-height:110px" placeholder="Contoh: Siapkan foto KK, akta, rapor, dan bukti transfer sebelum mengisi.">${esc(c.catatan_formulir || '')}</textarea><small>Kosongkan bila tidak perlu.</small></div>
          </div>
        </div>
        <div id="fErr"></div>
        <div class="bilah-simpan"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan pengaturan formulir</button></div>
      </form>`;

    const f = $('#fForm');
    const segarContoh = () => {
      const pola = f.elements.format_nomor.value.trim() || 'SPMB{TA}-{JENJANG}-{JK}-{NO}', dg = +f.elements.digit_nomor.value;
      $('#contohNomor').innerHTML = [['SMP', 'P', 'SMP putra'], ['SMP', 'I', 'SMP putri'], ['SMA', 'P', 'SMA putra'], ['SMA', 'I', 'SMA putri']]
        .map(([j, k, l]) => `<div><span>${l}</span><code>${esc(contohNomor(pola, dg, ta, j, k))}</code></div>`).join('');
    };
    f.addEventListener('input', e => { if (e.target.name === 'format_nomor') segarContoh(); });
    f.elements.digit_nomor.onchange = segarContoh; segarContoh();
    f.querySelectorAll('[data-token]').forEach(b => b.onclick = () => {
      const i = f.elements.format_nomor, a = i.selectionStart ?? i.value.length;
      i.setRangeText(b.dataset.token, a, i.selectionEnd ?? a, 'end'); i.focus(); segarContoh();
    });
    const wadah = $('#daftarBerkas');
    $('#btnTambahBerkas').onclick = () => { wadah.insertAdjacentHTML('beforeend', barisBerkas({ label: '', jenis: 'semua', wajib: false })); wadah.lastElementChild.querySelector('input').focus(); };
    wadah.addEventListener('click', e => { const b = e.target.closest('[data-hapus-berkas]'); if (b) b.closest('.berkas-atur').remove(); });

    f.onsubmit = async e => {
      e.preventDefault();
      const v = n => f.elements[n].value.trim(), err = [];
      const pola = v('format_nomor');
      ['{JENJANG}', '{JK}', '{NO}'].forEach(t => { if (!pola.includes(t)) err.push(`Format nomor wajib memuat ${t}.`); });
      if (/[^A-Za-z0-9{}\-_/.]/.test(pola)) err.push('Format nomor hanya boleh berisi huruf, angka, tanda - _ / . dan kode dalam kurung kurawal.');
      const usia = { acuan: v('acuan') };
      if (!usia.acuan) err.push('Tanggal acuan usia wajib diisi.');
      JENJANG.forEach(j => {
        const a = +v(`${j}_min`), b = +v(`${j}_maks`);
        if (!a || !b || a >= b) err.push(`Batas usia ${j}: usia minimal harus lebih kecil dari usia maksimal.`);
        usia[j] = { min: a, maks: b };
      });
      const dipakai = new Set();
      const berkas = [...wadah.querySelectorAll('.berkas-atur')].map(r => {
        const label = r.querySelector('[data-b=label]').value.trim();
        let kunci = r.dataset.kunci || slugDari(label).replace(/-/g, '_').replace(/[^a-z_]/g, '').slice(0, 30);
        if (!label) err.push('Nama berkas tidak boleh kosong.');
        if (!/^[a-z_]{2,30}$/.test(kunci)) err.push(`Nama berkas "${label}" perlu memuat huruf.`);
        while (dipakai.has(kunci)) kunci = (kunci + '_2').slice(0, 30);
        dipakai.add(kunci);
        return { kunci, label, wajib: r.querySelector('[data-b=wajib]').checked, jenis: r.querySelector('[data-b=jenis]').value };
      });
      const baris = n => v(n).split('\n').map(s => s.trim()).filter(Boolean);
      const sumber = baris('sumber_info'), kerja = baris('pekerjaan');
      if (!sumber.length) err.push('Isi minimal satu pilihan sumber informasi.');
      if (!kerja.length) err.push('Isi minimal satu pilihan pekerjaan.');
      if (v('pernyataan').length < 20) err.push('Pernyataan persetujuan wajib diisi.');
      $('#fErr').innerHTML = galatBox(err);
      if (err.length) return $('#fErr').scrollIntoView({ block: 'center', behavior: 'smooth' });
      const nilai = { ...c, format_nomor: pola, digit_nomor: +v('digit_nomor'), usia, berkas, sumber_info: sumber, pekerjaan: kerja, pernyataan: v('pernyataan'), catatan_formulir: v('catatan_formulir') };
      try { await ctx.simpanPengaturan('spmb', nilai); toast('Pengaturan formulir disimpan.'); await tabFormulir(el, ctx); }
      catch (err2) { toast(pesanGalat(err2), 'err'); }
    };
  }

  /* =================================================================
     TAB TEMPLAT WHATSAPP (pengaturan kunci "templat_wa")
     ================================================================= */
  const ISIAN_WA = [
    ['nama', 'Nama santri'], ['no_registrasi', 'Nomor registrasi'], ['jenjang', 'Jenjang'], ['gelombang', 'Gelombang'],
    ['catatan', 'Catatan petugas'], ['jadwal_tes', 'Jadwal tes'], ['tautan_status', 'Tautan Cek Status'],
    ['tautan_pengumuman', 'Tautan Pengumuman'], ['jadwal_daftar_ulang', 'Jadwal daftar ulang'], ['tautan_daftar_ulang', 'Tautan Daftar Ulang'], ['nama_lembaga', 'Nama lembaga'], ['tahun_ajaran', 'Tahun ajaran']
  ];
  const IKON_WA = { diterima: ['ph-check-circle', 'var(--ok)'], berkas_kurang: ['ph-file-x', 'var(--c7)'], bayar_ok: ['ph-credit-card', 'var(--c5)'],
    jadwal_tes: ['ph-calendar-check', 'var(--c2)'], pengingat_tes: ['ph-alarm', 'var(--c3)'], lulus: ['ph-confetti', 'var(--ok)'], cadangan: ['ph-hourglass-medium', 'var(--c6)'],
    tidak_lulus: ['ph-hand-heart', 'var(--c8)'], undangan_du: ['ph-envelope-open', 'var(--c1)'], du_selesai: ['ph-graduation-cap', 'var(--c4)'] };

  async function tabWA(el, ctx) {
    const p = await muatPengaturan(true);
    const T = JSON.parse(JSON.stringify(p.templat_wa || {}));
    const situs = (CFG.alamatSitus || location.origin).replace(/\/$/, '');
    const contoh = {
      nama: 'Muhammad Fathir', no_registrasi: 'SPMB27-SMP-P-0001', jenjang: 'SMP', gelombang: 'Gelombang 1',
      catatan: '- Foto Kartu Keluarga kurang jelas', jadwal_tes: 'Sabtu, 9 Januari 2027 pukul 08.00 WITA (offline, kampus pondok)',
      tautan_status: situs + '/cek-status.html', tautan_pengumuman: situs + '/pengumuman.html', jadwal_daftar_ulang: '10 Oktober 2027 s.d. 17 Oktober 2027', tautan_daftar_ulang: situs + '/daftar-ulang.html',
      nama_lembaga: p.identitas?.nama_lembaga || 'Pondok Pesantren', tahun_ajaran: p.identitas?.tahun_ajaran || '2027/2028'
    };
    // jsonb tidak menjaga urutan kunci: urutkan sesuai alur pendaftaran
    const URUT = Object.keys(IKON_WA);
    const kunci = Object.keys(T).sort((x, y) => (URUT.indexOf(x) + 1 || 99) - (URUT.indexOf(y) + 1 || 99));
    el.innerHTML = `
      <div class="note info"><i class="ph-duotone ph-info"></i><div>Templat dipakai tombol WhatsApp di menu Pendaftar (Langkah 5). Kata dalam kurung kurawal, misalnya <code>{nama}</code>, diganti otomatis. Tulis <code>*teks*</code> untuk huruf tebal dan <code>_teks_</code> untuk miring di WhatsApp.</div></div>
      <form id="fWA" novalidate>
        ${kunci.length ? kunci.map((k2, i) => {
          const [ic, t] = IKON_WA[k2] || ['ph-chat-circle-text', 'var(--c1)'];
          return `
          <details class="card wa-templat" ${i === 0 ? 'open' : ''}>
            <summary><span class="ic-box" style="--tone:${t}"><i class="ph-duotone ${ic}"></i></span>
              <div class="teks"><b>${esc(T[k2].judul)}</b><span>${esc((T[k2].isi || '').split('\n').find(s => s.trim() && !/^Assalamu/.test(s)) || '')}</span></div>
              <i class="ph-duotone ph-caret-down panah"></i></summary>
            <div class="grid-2" style="align-items:start;margin-top:12px">
              <div>
                <div class="field"><label>Judul templat</label><input class="input" data-wa-judul="${k2}" value="${esc(T[k2].judul)}" maxlength="60"></div>
                <div class="field"><label>Isi pesan</label><textarea class="textarea" data-wa-isi="${k2}" maxlength="1500" style="min-height:220px">${esc(T[k2].isi)}</textarea></div>
                <div class="token-baris">${ISIAN_WA.map(([t2, l]) => `<button type="button" class="chip-token" data-sisip="${k2}" data-token="{${t2}}" title="${l}">{${t2}}</button>`).join('')}</div>
              </div>
              <div><span class="label" style="display:block;font-size:13px;font-weight:700;margin-bottom:6px">Pratinjau dengan data contoh</span>
                <div class="wa-layar"><div class="wa-gelembung" data-wa-prev="${k2}"></div></div></div>
            </div>
          </details>`;
        }).join('') : '<div class="card"><div class="empty"><i class="ph-duotone ph-whatsapp-logo"></i><b>Templat belum tersedia</b>Jalankan SQL 04 terlebih dahulu.</div></div>'}
        <div class="bilah-simpan"><button class="btn" type="submit" ${kunci.length ? '' : 'disabled'}><i class="ph-duotone ph-floppy-disk"></i>Simpan semua templat</button></div>
      </form>`;
    const f = $('#fWA');
    const segar = k2 => { const ta = f.querySelector(`[data-wa-isi="${k2}"]`); f.querySelector(`[data-wa-prev="${k2}"]`).innerHTML = formatWA(isiTemplat(ta.value, contoh)); };
    kunci.forEach(segar);
    f.addEventListener('input', e => { const k2 = e.target.dataset.waIsi; if (k2) segar(k2); });
    f.addEventListener('click', e => {
      const b = e.target.closest('[data-sisip]'); if (!b) return;
      const ta = f.querySelector(`[data-wa-isi="${b.dataset.sisip}"]`), a = ta.selectionStart;
      ta.setRangeText(b.dataset.token, a, ta.selectionEnd, 'end'); ta.focus(); segar(b.dataset.sisip);
    });
    f.onsubmit = async e => {
      e.preventDefault();
      const nilai = {};
      for (const k2 of kunci) {
        const judul = f.querySelector(`[data-wa-judul="${k2}"]`).value.trim(), isi = f.querySelector(`[data-wa-isi="${k2}"]`).value.trim();
        if (!judul || isi.length < 10) return toast(`Templat "${T[k2].judul}": judul dan isi pesan wajib diisi.`, 'err');
        nilai[k2] = { ...T[k2], judul, isi };
      }
      try { await ctx.simpanPengaturan('templat_wa', nilai); toast('Templat WhatsApp disimpan.'); }
      catch (err) { toast(pesanGalat(err), 'err'); }
    };
  }
})();
