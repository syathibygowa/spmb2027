/* =====================================================================
   DASHBOARD > UNDUHAN (Fase 5) · Admin dan Superadmin
   Kelola Pusat Unduhan situs: unggah berkas (PDF, gambar, Word, Excel,
   PowerPoint) ke Google Drive folder "Unduhan" atau tambah tautan,
   ubah, urutkan, tandai penting, sembunyikan, dan hapus.
   Membutuhkan SQL 16 dan Apps Script Jembatan Unggah versi 3.4.
   ===================================================================== */
(function () {
  'use strict';
  window.SPMB_MODUL = window.SPMB_MODUL || {};

  const MIME_EKST = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  const MAKS_MB = 15;

  window.SPMB_MODUL.unduhan = async (k, api) => {
    const { sb, fmt, esc, toast, dialog, konfirmasi, pesanGalat, kirimKeJembatan, kompresGambar } = window.SPMB;
    const U = window.SPMB_UNDUHAN;
    const $ = (s, r = document) => r.querySelector(s);
    let semua = [], saring = { cari: '', kat: '', st: '' };

    const muat = async () => {
      const { data, error } = await sb.from('unduhan').select('*').order('urutan').order('id');
      if (error) {
        if (/relation .*unduhan|does not exist|schema cache/i.test(error.message || '')) throw new Error('Tabel Unduhan belum ada. Jalankan SQL 16 di Supabase terlebih dahulu.');
        throw error;
      }
      semua = data || [];
      render();
    };

    k.innerHTML = `
      <div class="page-head" style="flex-wrap:wrap;gap:10px">
        <p class="muted" style="margin:0;flex:1;min-width:240px">Dokumen di sini tampil di halaman <b>Unduhan</b> situs. Berkas tersimpan di Google Drive folder <b>Unduhan</b> dan dapat dibuka siapa saja yang memegang tautannya.</p>
        <a class="btn sm ghost" href="unduhan.html" target="_blank" rel="noopener"><i class="ph-duotone ph-arrow-square-out" style="color:var(--c2)"></i>Lihat halaman</a>
        <button class="btn sm ghost" id="uTautan"><i class="ph-duotone ph-link-simple" style="color:var(--c5)"></i>Tambah tautan</button>
        <button class="btn sm" id="uTambah"><i class="ph-duotone ph-upload-simple"></i>Unggah berkas</button>
      </div>
      <div class="stats stats-pendaftar" id="uStat" style="margin-bottom:14px"></div>
      <div class="card">
        <div class="toolbar" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <div class="input-ikon" style="flex:1;min-width:200px"><i class="ph-duotone ph-magnifying-glass"></i><input class="input" id="uCari" type="search" placeholder="Cari judul atau keterangan" aria-label="Cari"></div>
          <select class="select" id="uKat" aria-label="Kategori" style="max-width:220px"><option value="">Semua kategori</option></select>
          <select class="select" id="uSt" aria-label="Status" style="max-width:180px"><option value="">Semua status</option><option value="tampil">Ditampilkan</option><option value="sembunyi">Disembunyikan</option></select>
        </div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th style="width:62px">Urut</th><th>Dokumen</th><th>Kategori</th><th>Ukuran</th><th>Diunduh</th><th>Status</th><th style="text-align:right">Aksi</th></tr></thead>
          <tbody id="uBody"></tbody></table></div>
      </div>`;

    const statHTML = () => {
      const tampil = semua.filter(x => x.tampil).length, total = semua.reduce((a, x) => a + (x.diunduh || 0), 0);
      const kat = new Set(semua.map(x => x.kategori)).size;
      return [['Dokumen', semua.length, 'ph-files', 'var(--c2)'], ['Ditampilkan', tampil, 'ph-eye', 'var(--ok)'],
        ['Kategori', kat, 'ph-folders', 'var(--c3)'], ['Total diunduh', total, 'ph-download-simple', 'var(--c5)']]
        .map(([l, n, ic, t]) => `<div class="stat" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b>${fmt.angka(n)}</b><span>${l}</span></div>`).join('');
    };

    function render() {
      $('#uStat').innerHTML = statHTML();
      const kats = [...new Set(semua.map(x => x.kategori))].sort();
      const sel = $('#uKat'), v = sel.value;
      sel.innerHTML = '<option value="">Semua kategori</option>' + kats.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
      const c = saring.cari.toLowerCase();
      const baris = semua.filter(x => (!saring.kat || x.kategori === saring.kat) && (!saring.st || (saring.st === 'tampil') === x.tampil)
        && (!c || `${x.judul} ${x.keterangan}`.toLowerCase().includes(c)));
      $('#uBody').innerHTML = baris.length ? baris.map(x => {
        const [jl, ic, t] = U.JENIS[U.jenisDari(x)], i = semua.indexOf(x);
        return `<tr data-id="${x.id}">
          <td><div style="display:flex;gap:2px">
            <button class="icon-btn plain" data-naik title="Naikkan" aria-label="Naikkan" ${i === 0 ? 'disabled' : ''}><i class="ph-duotone ph-caret-up"></i></button>
            <button class="icon-btn plain" data-turun title="Turunkan" aria-label="Turunkan" ${i === semua.length - 1 ? 'disabled' : ''}><i class="ph-duotone ph-caret-down"></i></button></div></td>
          <td><div class="unduh-baris"><span class="unduh-admin-ikon" style="--tone:${t}" title="${jl}"><i class="ph-duotone ${ic}"></i></span>
            <span style="min-width:0"><b>${esc(x.judul)}${x.unggulan ? ' <i class="ph-duotone ph-star" style="color:var(--c6)" title="Penting"></i>' : ''}</b>
            <small class="muted">${esc([x.keterangan ? x.keterangan.slice(0, 90) + (x.keterangan.length > 90 ? '…' : '') : jl, x.nama_pengunggah, fmt.tgl(x.diperbarui_pada || x.dibuat_pada)].filter(Boolean).join(' · '))}</small></span></div></td>
          <td>${esc(x.kategori)}</td>
          <td style="white-space:nowrap">${U.ukuranTeks(x.ukuran) || '–'}</td>
          <td>${fmt.angka(x.diunduh || 0)}</td>
          <td>${x.tampil ? '<span class="pill" style="--tone:var(--ok)"><i class="ph-duotone ph-eye"></i>Tampil</span>' : '<span class="pill" style="--tone:var(--c8)"><i class="ph-duotone ph-eye-slash"></i>Disembunyikan</span>'}</td>
          <td><div style="display:flex;gap:2px;justify-content:flex-end">
            <a class="icon-btn plain" href="${esc(U.tautanLihat(x))}" target="_blank" rel="noopener" title="Buka" aria-label="Buka"><i class="ph-duotone ph-arrow-square-out" style="color:var(--c1)"></i></a>
            <button class="icon-btn plain" data-ubah title="Ubah" aria-label="Ubah"><i class="ph-duotone ph-pencil-simple" style="color:var(--c5)"></i></button>
            <button class="icon-btn plain" data-tampil title="${x.tampil ? 'Sembunyikan' : 'Tampilkan'}" aria-label="${x.tampil ? 'Sembunyikan' : 'Tampilkan'}"><i class="ph-duotone ${x.tampil ? 'ph-eye-slash' : 'ph-eye'}" style="color:var(--c3)"></i></button>
            <button class="icon-btn plain" data-hapus title="Hapus" aria-label="Hapus"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button></div></td></tr>`;
      }).join('') : `<tr><td colspan="7"><div class="empty"><i class="ph-duotone ph-folder-open"></i><b>${semua.length ? 'Tidak ada yang cocok' : 'Belum ada dokumen'}</b>${semua.length ? 'Ubah kata kunci atau saringan.' : 'Klik Unggah berkas untuk menambahkan brosur, panduan, atau formulir.'}</div></td></tr>`;
    }

    const bacaDataURL = f => new Promise((ok, gagal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => gagal(new Error('Berkas tidak dapat dibaca.')); r.readAsDataURL(f); });
    const mimeBerkas = f => {
      const ekst = (f.name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
      const m = MIME_EKST[ekst];
      return Object.values(MIME_EKST).includes(f.type) ? f.type : m || '';
    };
    async function unggah(file, kategori) {
      const mime = mimeBerkas(file);
      if (!mime) throw new Error('Jenis berkas tidak didukung. Gunakan PDF, JPG, PNG, WEBP, Word (.docx), Excel (.xlsx), atau PowerPoint (.pptx).');
      let siap = file;
      if (mime.startsWith('image/')) siap = await kompresGambar(file, { maksSisi: 2400, kualitas: 0.85 });
      if (siap.size > MAKS_MB * 1024 * 1024) throw new Error(`Ukuran berkas melebihi ${MAKS_MB} MB. Perkecil dulu sebelum diunggah.`);
      try {
        return await kirimKeJembatan({ aksi: 'unggah', keperluan: 'unduhan', bagian: kategori, nama: file.name, mime: siap.type || mime, data: await bacaDataURL(siap) });
      } catch (err) {
        if (/keperluan unggah tidak dikenal/i.test(err.message || '')) throw new Error('Apps Script Jembatan Unggah masih versi lama. Perbarui ke versi 3.4 (lihat panduan Fase 5), lalu coba lagi.');
        throw err;
      }
    }
    const hapusDrive = id => id ? kirimKeJembatan({ aksi: 'hapus', keperluan: 'unduhan', id }).catch(e => console.warn('Hapus berkas Drive:', e)) : null;

    async function form(x, sumberAwal) {
      const baru = !x, sumber0 = x?.sumber || sumberAwal || 'berkas';
      const kats = [...new Set(['Brosur', 'Panduan', 'Formulir', 'Surat', 'Jadwal', ...semua.map(y => y.kategori)])];
      const hasil = await dialog({
        judul: baru ? (sumber0 === 'tautan' ? 'Tambah tautan unduhan' : 'Unggah berkas') : 'Ubah dokumen', ikon: sumber0 === 'tautan' ? 'ph-link-simple' : 'ph-upload-simple', tone: 'var(--c2)',
        isi: `<form id="fUnduh" novalidate>
          <div class="field"><label for="dJudul">Judul dokumen <span class="req">*</span></label><input class="input" id="dJudul" maxlength="120" value="${esc(x?.judul || '')}" placeholder="Contoh: Brosur SPMB ${esc(SPMB.taAktif(api.S.pengaturan))}"></div>
          <div class="field"><label for="dKat">Kategori <span class="req">*</span></label><input class="input" id="dKat" maxlength="40" list="dKatDaftar" value="${esc(x?.kategori || 'Brosur')}">
            <datalist id="dKatDaftar">${kats.map(y => `<option value="${esc(y)}">`).join('')}</datalist><small>Pilih dari daftar atau tulis kategori baru.</small></div>
          <div class="field"><label for="dKet">Keterangan singkat</label><textarea class="textarea" id="dKet" maxlength="500" style="min-height:70px" placeholder="Misalnya: Panduan langkah demi langkah mengisi formulir online.">${esc(x?.keterangan || '')}</textarea></div>
          <div class="field"><span class="label">Sumber</span><div class="chips-select">
            <label><input type="radio" name="sumber" value="berkas" ${sumber0 === 'berkas' ? 'checked' : ''}>Berkas diunggah</label>
            <label><input type="radio" name="sumber" value="tautan" ${sumber0 === 'tautan' ? 'checked' : ''}>Tautan (Google Drive, situs lain)</label></div></div>
          <div class="field" data-sumber="berkas"><label for="dFile">${x?.sumber === 'berkas' ? 'Ganti berkas (opsional)' : 'Pilih berkas <span class="req">*</span>'}</label>
            <input class="input" id="dFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx">
            <small>${x?.sumber === 'berkas' ? `Berkas sekarang: <b>${esc(x.nama_berkas || '')}</b> (${U.ukuranTeks(x.ukuran)}). ` : ''}PDF, gambar, Word, Excel, atau PowerPoint; maksimal ${MAKS_MB} MB. Gambar diperkecil otomatis.</small></div>
          <div class="field" data-sumber="tautan"><label for="dUrl">Alamat tautan <span class="req">*</span></label><input class="input" id="dUrl" type="url" inputmode="url" value="${esc(x?.sumber === 'tautan' ? x.url : '')}" placeholder="https://drive.google.com/…">
            <small>Untuk Google Drive, pastikan aksesnya "Siapa saja yang memiliki link".</small></div>
          <label class="check"><input type="checkbox" id="dTampil" ${x ? (x.tampil ? 'checked' : '') : 'checked'}>Tampilkan di situs</label>
          <label class="check"><input type="checkbox" id="dUnggul" ${x?.unggulan ? 'checked' : ''}>Tandai penting (tampil paling atas)</label>
          <div id="dProses"></div>
        </form>`,
        saatBuka: root => {
          const atur = () => { const s = root.querySelector('[name=sumber]:checked').value; root.querySelectorAll('[data-sumber]').forEach(el => el.hidden = el.dataset.sumber !== s); };
          root.querySelectorAll('[name=sumber]').forEach(r => r.onchange = atur); atur();
          root.querySelector('#dFile').onchange = e => { const f = e.target.files[0], j = root.querySelector('#dJudul'); if (f && !j.value.trim()) j.value = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 120); };
        },
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, { label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
          const v = id => root.querySelector(id).value.trim();
          const judul = v('#dJudul'), kategori = v('#dKat'), sumber = root.querySelector('[name=sumber]:checked').value;
          if (judul.length < 3) { toast('Judul minimal 3 karakter.', 'err'); return false; }
          if (kategori.length < 2) { toast('Isi kategori dokumen.', 'err'); return false; }
          const d = { judul, kategori, keterangan: v('#dKet'), sumber, tampil: root.querySelector('#dTampil').checked, unggulan: root.querySelector('#dUnggul').checked };
          let lamaDrive = null;
          if (sumber === 'tautan') {
            const url = v('#dUrl');
            if (!/^https:\/\/\S+\.\S+/.test(url)) { toast('Alamat tautan harus diawali https://', 'err'); return false; }
            Object.assign(d, { url, drive_id: null, nama_berkas: null, mime: null, ukuran: null });
            if (x?.sumber === 'berkas') lamaDrive = x.drive_id;
          } else {
            const f = root.querySelector('#dFile').files[0];
            if (!f && x?.sumber !== 'berkas') { toast('Pilih berkas yang akan diunggah.', 'err'); return false; }
            if (f) {
              root.querySelector('#dProses').innerHTML = '<div class="note info"><span class="spinner" style="width:18px;height:18px"></span><div>Mengunggah ke Google Drive…</div></div>';
              try {
                const h = await unggah(f, kategori);
                Object.assign(d, { url: h.lihat || h.url, drive_id: h.id, nama_berkas: h.nama, mime: h.mime, ukuran: h.ukuran });
                if (x?.drive_id) lamaDrive = x.drive_id;
              } finally { root.querySelector('#dProses').innerHTML = ''; }
            }
          }
          if (baru) {
            d.urutan = (semua.reduce((m, y) => Math.max(m, y.urutan || 0), 0)) + 1;
            const { error } = await sb.from('unduhan').insert(d);
            if (error) { if (d.drive_id) hapusDrive(d.drive_id); throw error; }
          } else {
            const { error } = await sb.from('unduhan').update(d).eq('id', x.id);
            if (error) { if (d.drive_id && d.drive_id !== x.drive_id) hapusDrive(d.drive_id); throw error; }
          }
          if (lamaDrive) hapusDrive(lamaDrive);
          return true;
        } }]
      });
      if (hasil) { toast(baru ? 'Dokumen ditambahkan.' : 'Dokumen diperbarui.'); await muat(); }
    }

    async function tukar(i, j) {
      const a = semua[i], b = semua[j]; if (!a || !b) return;
      // urutan unik berurutan agar penukaran selalu berhasil
      const urut = semua.map((x, n) => ({ id: x.id, urutan: n + 1 }));
      [urut[i].urutan, urut[j].urutan] = [urut[j].urutan, urut[i].urutan];
      for (const u of urut) {
        const x = semua.find(y => y.id === u.id);
        if (x.urutan !== u.urutan) { const { error } = await sb.from('unduhan').update({ urutan: u.urutan }).eq('id', u.id); if (error) throw error; }
      }
      await muat();
    }

    $('#uTambah').onclick = () => form(null, 'berkas');
    $('#uTautan').onclick = () => form(null, 'tautan');
    api.setFab(() => form(null, 'berkas'), 'ph-upload-simple', 'Unggah berkas');
    $('#uCari').oninput = e => { saring.cari = e.target.value.trim(); render(); };
    $('#uKat').onchange = e => { saring.kat = e.target.value; render(); };
    $('#uSt').onchange = e => { saring.st = e.target.value; render(); };
    $('#uBody').addEventListener('click', async e => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const x = semua.find(y => y.id === +tr.dataset.id), i = semua.indexOf(x);
      try {
        if (e.target.closest('[data-naik]')) await tukar(i, i - 1);
        else if (e.target.closest('[data-turun]')) await tukar(i, i + 1);
        else if (e.target.closest('[data-ubah]')) await form(x);
        else if (e.target.closest('[data-tampil]')) {
          const { error } = await sb.from('unduhan').update({ tampil: !x.tampil }).eq('id', x.id); if (error) throw error;
          toast(x.tampil ? 'Dokumen disembunyikan dari situs.' : 'Dokumen ditampilkan di situs.'); await muat();
        } else if (e.target.closest('[data-hapus]')) {
          if (!(await konfirmasi('Hapus dokumen?', `"${esc(x.judul)}" dihapus dari halaman Unduhan${x.drive_id ? ' dan berkasnya dipindah ke Sampah Google Drive (dapat dipulihkan 30 hari)' : ''}.`, 'Hapus', true))) return;
          const { error } = await sb.from('unduhan').delete().eq('id', x.id); if (error) throw error;
          await hapusDrive(x.drive_id);
          toast('Dokumen dihapus.'); await muat();
        }
      } catch (err) { toast(pesanGalat(err), 'err', 6000); }
    });
    await muat();
  };
})();
