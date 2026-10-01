/* =====================================================================
   PUSAT UNDUHAN (Fase 5) · halaman unduhan.html
   Brosur, panduan, formulir, dan dokumen lain untuk calon santri.
   Data: tabel unduhan (hanya yang ditampilkan). Dikelola Admin dan
   Superadmin di Dashboard > Unduhan.
   Dimuat sebelum situs.js; situs.js memanggil SPMB_HAL['unduhan']().
   ===================================================================== */
(function () {
  'use strict';
  window.SPMB_HAL = window.SPMB_HAL || {};

  // Jenis berkas: [label, ikon, warna]
  const JENIS = {
    pdf: ['PDF', 'ph-file-pdf', 'var(--c7)'], gambar: ['Gambar', 'ph-file-image', 'var(--c5)'],
    word: ['Word', 'ph-file-doc', 'var(--c1)'], excel: ['Excel', 'ph-file-xls', 'var(--ok)'],
    ppt: ['PowerPoint', 'ph-file-ppt', 'var(--c3)'], tautan: ['Tautan', 'ph-link-simple', 'var(--c2)'], lain: ['Berkas', 'ph-file', 'var(--c8)']
  };
  const jenisDari = x => {
    if (x.sumber === 'tautan') return 'tautan';
    const m = String(x.mime || '');
    if (m === 'application/pdf') return 'pdf';
    if (m.startsWith('image/')) return 'gambar';
    if (/wordprocessing|msword/.test(m)) return 'word';
    if (/spreadsheet|ms-excel/.test(m)) return 'excel';
    if (/presentation|powerpoint/.test(m)) return 'ppt';
    return 'lain';
  };
  const ukuranTeks = n => !n ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  const tautanUnduh = x => x.sumber === 'berkas' && x.drive_id ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(x.drive_id)}` : x.url;
  const tautanLihat = x => x.sumber === 'berkas' && x.drive_id ? `https://drive.google.com/file/d/${encodeURIComponent(x.drive_id)}/view` : x.url;
  window.SPMB_UNDUHAN = { JENIS, jenisDari, ukuranTeks, tautanUnduh, tautanLihat };

  window.SPMB_HAL.unduhan = async api => {
    const { sb, fmt, esc } = window.SPMB;
    const $ = (s, r = document) => r.querySelector(s);
    const S = api.S;
    document.title = `Unduhan · ${S.p.identitas?.nama_singkat || 'SPMB'}`;

    let data = [];
    try {
      const { data: d, error } = await sb.from('unduhan').select('*').eq('tampil', true).order('urutan').order('id');
      if (error) throw error; data = d || [];
    } catch (err) { console.error(err); }

    const KAT_TONE = ['var(--c1)', 'var(--c3)', 'var(--c5)', 'var(--c2)', 'var(--c4)', 'var(--c6)', 'var(--ok)', 'var(--c7)'];
    const kategori = [...new Set(data.map(x => x.kategori))];
    const toneKat = k => KAT_TONE[Math.max(0, kategori.indexOf(k)) % KAT_TONE.length];
    const q = new URLSearchParams(location.search);
    let pilih = q.get('k') || '', cari = '';

    const kartu = x => {
      const [jl, ic, t] = JENIS[jenisDari(x)];
      const tautan = x.sumber === 'tautan';
      return `<article class="kartu unduh-kartu${x.unggulan ? ' unggulan' : ''}" style="--tone:${t}">
        <div class="unduh-ikon" title="${jl}"><i class="ph-duotone ${ic}"></i></div>
        <div class="unduh-isi">
          <div class="unduh-label"><span class="pill" style="--tone:${toneKat(x.kategori)}"><i class="ph-duotone ph-folder-simple"></i>${esc(x.kategori)}</span>${x.unggulan ? '<span class="pill" style="--tone:var(--c6)"><i class="ph-duotone ph-star"></i>Penting</span>' : ''}</div>
          <h3>${esc(x.judul)}</h3>
          ${x.keterangan ? `<p>${esc(x.keterangan)}</p>` : ''}
          <small class="muted">${[ukuranTeks(x.ukuran), `Diperbarui ${fmt.tgl(x.diperbarui_pada || x.dibuat_pada)}`, x.diunduh ? `${fmt.angka(x.diunduh)} kali diunduh` : ''].filter(Boolean).join(' · ')}</small>
        </div>
        <div class="unduh-aksi">
          ${tautan ? `<a class="btn sm" href="${esc(x.url)}" target="_blank" rel="noopener" data-catat="${x.id}"><i class="ph-duotone ph-arrow-square-out"></i>Buka</a>`
            : `<a class="btn sm" href="${esc(tautanUnduh(x))}" target="_blank" rel="noopener" data-catat="${x.id}"><i class="ph-duotone ph-download-simple"></i>Unduh</a>
               <a class="btn sm ghost" href="${esc(tautanLihat(x))}" target="_blank" rel="noopener"><i class="ph-duotone ph-eye"></i>Lihat</a>`}
        </div>
      </article>`;
    };

    $('#isi').innerHTML = `${api.kepalaHalaman('Pusat Unduhan', `Brosur, panduan, formulir, dan dokumen SPMB Tahun Ajaran ${S.ta}`, 'ph-download-simple', 'var(--c2)')}
      <section class="sek"><div class="wadah">
        ${data.length ? `<div class="unduh-bilah">
          <div class="input-ikon"><i class="ph-duotone ph-magnifying-glass"></i><input class="input" id="uCari" type="search" placeholder="Cari dokumen…" aria-label="Cari dokumen"></div>
          <div class="unduh-kat" role="tablist" aria-label="Kategori">
            <button type="button" data-k="" style="--tone:var(--primary)"><i class="ph-duotone ph-squares-four"></i>Semua<span>${data.length}</span></button>
            ${kategori.map(k => `<button type="button" data-k="${esc(k)}" style="--tone:${toneKat(k)}"><i class="ph-duotone ph-folder-simple"></i>${esc(k)}<span>${data.filter(x => x.kategori === k).length}</span></button>`).join('')}
          </div></div>
          <div id="uDaftar" class="unduh-daftar"></div>` : `<div class="kartu"><div class="empty"><i class="ph-duotone ph-folder-open"></i><b>Belum ada dokumen</b>Dokumen yang dapat diunduh akan tampil di sini.</div></div>`}
        <div class="note info" style="margin-top:20px"><i class="ph-duotone ph-info"></i><div>Berkas tersimpan di Google Drive pondok. Bila unduhan tidak berjalan di HP, tekan <b>Lihat</b> lalu gunakan tombol unduh di Google Drive. Butuh dokumen lain? Hubungi panitia melalui halaman <a href="kontak.html">Kontak</a>.</div></div>
      </div></section>`;
    if (!data.length) return;

    const render = () => {
      const c = cari.toLowerCase();
      const tampil = data.filter(x => (!pilih || x.kategori === pilih) && (!c || `${x.judul} ${x.keterangan} ${x.kategori}`.toLowerCase().includes(c)))
        .sort((a, b) => (b.unggulan - a.unggulan) || (a.urutan - b.urutan) || (a.id - b.id));
      document.querySelectorAll('.unduh-kat [data-k]').forEach(b => b.classList.toggle('aktif', b.dataset.k === pilih));
      $('#uDaftar').innerHTML = tampil.length ? tampil.map(kartu).join('')
        : '<div class="kartu"><div class="empty"><i class="ph-duotone ph-magnifying-glass"></i><b>Tidak ditemukan</b>Coba kata kunci atau kategori lain.</div></div>';
    };
    render();
    $('#uCari').oninput = e => { cari = e.target.value.trim(); render(); };
    $('.unduh-kat').onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      pilih = b.dataset.k; render();
      history.replaceState(null, '', 'unduhan.html' + (pilih ? '?k=' + encodeURIComponent(pilih) : ''));
    };
    $('#uDaftar').addEventListener('click', e => {
      const a = e.target.closest('[data-catat]'); if (!a) return;
      sb.rpc('catat_unduhan', { p_id: +a.dataset.catat }).then(() => {}, () => {});
    });
  };
})();
