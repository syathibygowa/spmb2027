/* =====================================================================
   MENU DAFTAR ULANG (Fase 4 · Langkah 6) · Admin dan Superadmin
   - Daftar: status daftar ulang semua yang lulus, saringan, WA undangan
     berurutan, ekspor Excel
   - Periksa (#/daftarulang/<id>): data lengkap, berkas, pembayaran,
     Terima (kuitansi otomatis) / Minta perbaikan, Bukti dan Kuitansi
   - Rekap santri baru (cetak F4, Excel)
   - Pengaturan (Superadmin): jadwal, isian wajib/opsional, isian tambahan,
     berkas, pernyataan, format kuitansi
   Dimuat sesudah seleksi.js dan du-isian.js.
   ===================================================================== */
(function () {
  'use strict';
  const { sb, CFG, fmt, esc, toast, dialog, konfirmasi, pesanGalat, muatPengaturan, cetakDokumen, buatPdfDokumen, buatPdfBanyak,
          cetakBanyakDokumen, simpanPdf, penandaTangan, lihatBerkasPendaftar } = window.SPMB;
  const DU = window.SPMB_DU, UI = window.SPMB_UI;
  const $ = (s, r = document) => r.querySelector(s);
  window.SPMB_MODUL = window.SPMB_MODUL || {};
  const SEL = { gel: '', uji: false, st: '', q: '' };
  const pill = (l, t, ic) => `<span class="pill" style="--tone:${t}">${ic ? `<i class="ph-duotone ${ic}"></i>` : ''}${esc(l)}</span>`;
  const pillSt = s => { const x = DU.STATUS_DU[s] || DU.STATUS_DU.belum; return pill(x[0], x[1], x[2]); };
  const bagL = b => b === 'putri' ? 'Putri' : 'Putra';
  const galat = e => pesanGalat(e);
  const angkaDari = v => +String(v ?? '').replace(/\D/g, '') || 0;
  const alamatSitus = () => (CFG.alamatSitus || location.href.replace(/\/[^/]*$/, '')).replace(/\/$/, '');

  async function muatGelombang() {
    const { data } = await sb.from('gelombang').select('id,nama,urutan,daftar_ulang_mulai,daftar_ulang_selesai,hasil_terbit_pada,uji').is('diarsipkan_pada', null).order('urutan').order('id');
    const g = data || [];
    if (!SEL.gel || !g.some(x => String(x.id) === String(SEL.gel))) { const a = g.find(x => x.hasil_terbit_pada && !x.uji) || g.find(x => !x.uji) || g[0]; SEL.gel = a ? String(a.id) : ''; SEL.uji = !!a?.uji; }
    GELS = g;
    return g;
  }
  let GELS = [];
  const opsiGel = gels => gels.map(g => `<option value="${g.id}" ${String(g.id) === String(SEL.gel) ? 'selected' : ''}>${esc(g.nama)}${g.uji ? ' (uji coba)' : ''}</option>`).join('');
  // Memilih gelombang uji coba otomatis menyalakan saklar "Data uji" (dan sebaliknya)
  const pilihGel = v => { SEL.gel = v; const g = GELS.find(x => String(x.id) === String(v)); if (g) { SEL.uji = !!g.uji; document.querySelectorAll('.uji-saklar input').forEach(c => { c.checked = SEL.uji; }); } };
  async function pilihCetak(judul, fungsi) {
    const h = await dialog({ judul, ikon: 'ph-printer', tone: 'var(--c1)', isi: '<p style="margin:0">Cetak langsung ke printer (kertas F4) atau simpan sebagai PDF?</p>',
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Unduh PDF', ikon: 'ph-file-pdf', kelas: 'ghost', nilai: 'pdf' }, { label: 'Cetak', ikon: 'ph-printer', nilai: 'cetak' }] });
    if (h) await fungsi(h === 'pdf');
  }
  async function unduh(opsi, nama) {
    const t = toast('Menyusun PDF…', 'info', 60000);
    try { simpanPdf(await buatPdfDokumen(opsi), nama); } catch (e) { toast(galat(e), 'err', 6000); } finally { t.remove(); }
  }

  // Pas foto dari Drive (privat) untuk Profil Santri; gagal = tanpa foto
  async function ambilFoto(paket) {
    const b = (paket.berkas || []).filter(x => x.jenis === 'pas_foto' && x.drive_id && x.status !== 'ditolak').pop();
    if (!b) return '';
    try { const h = await lihatBerkasPendaftar(b.drive_id); return (h.mime || '').startsWith('image/') ? h.data : ''; } catch (e) { return ''; }
  }
  const TAB = [['daftar', 'Daftar dan Verifikasi', 'ph-list-checks', 'var(--c5)'], ['rekap', 'Rekap Santri Baru', 'ph-users-four', 'var(--c1)'], ['atur', 'Pengaturan', 'ph-gear-six', 'var(--c7)']];
  window.SPMB_MODUL.daftarulang = async (k, api) => {
    api.setFab(null);
    if (api.param) return halPeriksa(k, api, api.param);
    const isSuper = api.S.profil.peran === 'superadmin';
    const tab = (location.hash.match(/[?&]tab=(\w+)/) || [])[1] || 'daftar';
    k.innerHTML = `<div class="tabs" role="tablist">${TAB.filter(t => t[0] !== 'atur' || isSuper).map(([id, l, ic, t]) => `<button role="tab" data-tab="${id}" aria-selected="${id === tab}"><i class="ph-duotone ${ic}" style="color:${t}"></i>${l}</button>`).join('')}</div><div id="isiTab"></div>`;
    k.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { location.hash = '#/daftarulang?tab=' + b.dataset.tab; });
    await ({ daftar: tabDaftar, rekap: tabRekap, atur: isSuper ? tabAtur : tabDaftar }[tab] || tabDaftar)($('#isiTab'), api);
  };

  /* ---------- Tab Daftar ---------- */
  async function tabDaftar(el, api) {
    const gels = await muatGelombang();
    if (!gels.length) { el.innerHTML = '<div class="card"><div class="empty"><i class="ph-duotone ph-flag-banner"></i><b>Belum ada gelombang</b></div></div>'; return; }
    let data = [];
    el.innerHTML = `
      <div class="page-head">
        <select class="select" id="dGel" style="max-width:220px" aria-label="Gelombang">${opsiGel(gels)}</select>
        <label class="check uji-saklar"><input type="checkbox" id="dUji" ${SEL.uji ? 'checked' : ''}>Data uji</label>
        <div class="field" style="margin:0;flex:1;min-width:180px;max-width:300px"><input class="input" id="dCari" type="search" placeholder="Cari nama atau nomor…" value="${esc(SEL.q)}"></div>
        <div class="spacer"></div>
        <button class="btn sm ghost" id="dWa"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i>WA undangan</button>
        <button class="btn sm ghost" id="dCsv"><i class="ph-duotone ph-microsoft-excel-logo" style="color:var(--ok)"></i>Ekspor Excel</button>
      </div>
      <div class="stats stats-pendaftar" id="dStat"></div>
      <div class="chips-select du-saring" id="dSaring"></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Calon santri</th><th class="hide-sm">Jenjang</th><th>Status</th><th class="hide-sm">Dikirim</th><th class="hide-sm" style="text-align:right">Transfer / tagihan</th><th class="c">Aksi</th></tr></thead><tbody id="dIsi"></tbody></table></div>
      <p class="muted kecil" style="margin-top:10px"><i class="ph-duotone ph-info"></i> Daftar ini berisi calon santri yang dinyatakan lulus. Wali mengisi di halaman <a href="daftar-ulang.html" target="_blank" rel="noopener">Daftar Ulang</a>; panitia juga dapat mengisi atas nama wali dari halaman Periksa.</p>`;
    const render = () => {
      const hit = s => data.filter(r => r.du_status === s).length;
      const uang = data.filter(r => r.du_status === 'selesai').reduce((a, r) => a + (+r.diterima_nominal || 0), 0);
      $('#dStat').innerHTML = [
        ['Wajib daftar ulang', data.length, 'ph-users-three', 'var(--c1)'], ['Belum mengisi', hit('belum') + hit('draf'), 'ph-circle-dashed', 'var(--c7)'],
        ['Menunggu verifikasi', hit('menunggu'), 'ph-hourglass-medium', 'var(--c2)'], ['Perlu perbaikan', hit('perbaikan'), 'ph-warning', 'var(--c3)'],
        ['Selesai', hit('selesai'), 'ph-seal-check', 'var(--ok)'], ['Dana diterima', DU.rupiah(uang), 'ph-wallet', 'var(--c5)']
      ].map(([l, v, ic, t]) => `<div class="stat" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b${typeof v === 'string' ? ' style="font-size:20px"' : ''}>${typeof v === 'string' ? esc(v) : fmt.angka(v)}</b><span>${l}</span></div>`).join('');
      $('#dSaring').innerHTML = [['', 'Semua', data.length], ...Object.entries(DU.STATUS_DU).map(([s, [l]]) => [s, l, hit(s)])]
        .map(([s, l, n]) => `<label><input type="radio" name="st" value="${s}" ${SEL.st === s ? 'checked' : ''}>${esc(l)} <small class="muted">${n}</small></label>`).join('');
      const q = SEL.q.toLowerCase();
      const rows = data.filter(r => (!SEL.st || r.du_status === SEL.st) && (!q || (r.nama_lengkap + ' ' + r.no_registrasi).toLowerCase().includes(q)))
        .sort((a, b) => ({ menunggu: 0, perbaikan: 1, draf: 2, belum: 3, selesai: 4 }[a.du_status] - { menunggu: 0, perbaikan: 1, draf: 2, belum: 3, selesai: 4 }[b.du_status]) || String(a.dikirim_pada || '').localeCompare(String(b.dikirim_pada || '')));
      $('#dIsi').innerHTML = rows.length ? rows.map(r => `<tr>
          <td><a href="#/daftarulang/${r.id}" style="text-decoration:none;color:inherit"><b>${esc(r.nama_lengkap)}</b></a><br><small class="mono muted">${esc(r.no_registrasi)}</small><span class="show-sm muted kecil">${r.jenjang} ${bagL(r.bagian)}</span></td>
          <td class="hide-sm">${r.jenjang} ${bagL(r.bagian)}</td>
          <td>${pillSt(r.du_status)}${r.jumlah_kirim > 1 ? ` <small class="muted">kirim ke-${r.jumlah_kirim}</small>` : ''}${r.diisi_panitia ? ' <small class="muted">· diisi panitia</small>' : ''}</td>
          <td class="hide-sm">${r.dikirim_pada ? fmt.tglJam(r.dikirim_pada) : '<span class="muted">–</span>'}</td>
          <td class="hide-sm" style="text-align:right">${r.du_status === 'selesai' ? `<b>${DU.rupiah(r.diterima_nominal)}</b>` : r.bayar?.nominal ? DU.rupiah(r.bayar.nominal) : '<span class="muted">–</span>'}<br><small class="muted">dari ${DU.rupiah(r.tagihan)}</small></td>
          <td class="c" style="white-space:nowrap"><a class="btn sm ${r.du_status === 'menunggu' ? '' : 'ghost'}" href="#/daftarulang/${r.id}"><i class="ph-duotone ph-magnifying-glass"></i><span class="hide-sm">${r.du_status === 'menunggu' ? 'Periksa' : 'Buka'}</span></a></td></tr>`).join('')
        : '<tr><td colspan="6"><div class="empty"><i class="ph-duotone ph-clipboard-text"></i><b>Tidak ada data</b>Belum ada calon santri lulus pada pilihan ini, atau hasil belum diterbitkan.</div></td></tr>';
    };
    const muat = async () => { const { data: d, error } = await sb.rpc('du_daftar', { p_gelombang: +SEL.gel, p_uji: SEL.uji }); if (error) throw error; data = d || []; render(); };
    await muat();
    $('#dGel').onchange = e => { pilihGel(e.target.value); muat().catch(x => toast(galat(x), 'err')); };
    $('#dUji').onchange = e => { SEL.uji = e.target.checked; muat().catch(x => toast(galat(x), 'err')); };
    $('#dCari').oninput = e => { SEL.q = e.target.value.trim(); render(); };
    $('#dSaring').onchange = e => { SEL.st = e.target.value; render(); };
    $('#dWa').onclick = async () => {
      const sasaran = data.filter(r => ['belum', 'draf'].includes(r.du_status));
      if (!sasaran.length) return toast('Semua calon santri sudah mengirim daftar ulang.', 'info');
      const g = gels.find(x => String(x.id) === String(SEL.gel));
      await UI.waBerurutan(sasaran.map(r => ({ p: r, sesi: [] })), 'undangan_du', g?.nama, { pilihan: ['undangan_du'], gel: g });
    };
    $('#dCsv').onclick = async () => ekspor(data, `Daftar Ulang ${gels.find(x => String(x.id) === String(SEL.gel))?.nama || ''}`);
  }

  async function ekspor(data, nama) {
    if (!data.length) return toast('Tidak ada data untuk diekspor.', 'warn');
    const peng = await muatPengaturan(), kol = DU.kolomEkspor(peng.daftar_ulang || {});
    const jenis = ([k, , f]) => ['tagihan', 'diterima_nominal'].includes(k) ? 'uang' : k === 'tanggal_lahir' || f?.t === 'tanggal' ? 'tgl'
      : f?.t === 'angka' ? (f.desimal ? 'desimal' : 'angka') : 'teks';
    const nilai = (r, c) => {
      const [k, , f] = c;
      const D = { ...r, ...(r.data || {}), jenis_kelamin: r.bagian === 'putri' ? 'Perempuan' : 'Laki-laki', bagian: bagL(r.bagian), du_status: (DU.STATUS_DU[r.du_status] || [])[0] };
      let v = D[k];
      const t = jenis(c);
      if (t === 'tgl' || t === 'angka' || t === 'desimal' || t === 'uang') return v ?? '';
      if (f) v = DU.teksNilai(f, v);
      if (v === '–') v = '';
      if (typeof v === 'object' && v) v = JSON.stringify(v);
      return v ?? '';
    };
    const ta = peng.identitas?.tahun_ajaran || '';
    const berkas = SPMB.unduhXlsx(`${nama.trim()} ${fmt.isoTgl()}${SEL.uji ? ' (uji)' : ''}`, {
      nama: 'Database Peserta Didik', judul: `${nama.trim().toUpperCase()} · TAHUN AJARAN ${ta}`,
      sub: `Urutan kolom mengikuti Database Peserta Didik · Diunduh ${fmt.tgl(new Date())} pukul ${fmt.jam(new Date())} WITA · ${data.length} santri${SEL.uji ? ' · DATA UJI COBA' : ''}`,
      kolom: [{ j: 'No', w: 5, t: 'angka' }, ...kol.map(c => ({ j: c[1], t: jenis(c), w: Math.max(9, Math.min(36, c[1].length + 3, jenis(c) === 'teks' ? 36 : 14)) }))],
      baris: data.map((r, i) => [i + 1, ...kol.map(c => nilai(r, c))]),
      jumlah: (() => { const j = { 0: 'Jumlah' }; kol.forEach((c, i) => { if (jenis(c) === 'uang') j[i + 1] = 'sum'; }); return j; })()
    });
    toast(`${data.length} baris diekspor ke ${berkas}.`);
  }

  /* ---------- Halaman Periksa ---------- */
  async function halPeriksa(k, api, id) {
    const isSuper = api.S.profil.peran === 'superadmin';
    let P;
    const muat = async () => { const { data, error } = await sb.rpc('du_detail', { p_id: id }); if (error) throw error; P = data; };
    try { await muat(); } catch (e) { k.innerHTML = `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(galat(e))}</div></div>`; return; }
    const peng = await muatPengaturan(), cfg = peng.daftar_ulang || {};
    const label = Object.fromEntries((peng.spmb?.berkas || []).map(b => [b.kunci, b.label]).concat((cfg.berkas || []).map(b => [b.kunci, b.label])));
    const kunciDu = new Set((cfg.berkas || []).map(b => b.kunci));
    const render = () => {
      const p = P.pendaftar, du = P.du, D = DU.nilaiGabung(P), st = du.status;
      const total = +DU.ringkasDari(P).bayar || +du.tagihan || 0;
      const blok = s => {
        const isi = DU.isianLengkap(cfg).filter(f => f.s === s && (f.sub || !f.jika || f.jika(D)))
          .map(f => f.sub ? `<div class="du-dl-sub">${esc(f.sub[0].replace(/ \(.*\)$/, ''))}</div>` : `<div><dt>${esc(f.l)}</dt><dd>${esc(DU.teksNilai(f, D[f.k]))}${f.t === 'koordinat' && D.koordinat?.lat ? ` <a href="https://maps.google.com/?q=${D.koordinat.lat},${D.koordinat.lng}" target="_blank" rel="noopener">peta</a>` : ''}</dd></div>`).join('');
        return `<details class="card du-blok" ${s < 3 ? 'open' : ''}><summary><span class="ic-box kecil" style="--tone:${DU.LANGKAH[s][2]}"><i class="ph-duotone ${DU.LANGKAH[s][1]}"></i></span>${DU.LANGKAH[s][0]}</summary><dl class="du-dl">${isi}</dl></details>`;
      };
      const berkas = (P.berkas || []).slice().sort((a, b) => (kunciDu.has(b.jenis) - kunciDu.has(a.jenis)) || String(b.dibuat_pada).localeCompare(String(a.dibuat_pada)));
      k.innerHTML = `
        <div class="page-head"><a class="btn sm ghost" href="#/daftarulang"><i class="ph-duotone ph-arrow-left"></i>Kembali</a><div class="spacer"></div>
          <a class="btn sm ghost" href="daftar-ulang.html?panitia=${p.id}" target="_blank" rel="noopener"><i class="ph-duotone ph-pencil-simple-line" style="color:var(--c1)"></i>Isi/ubah atas nama wali</a>
          <button class="btn sm ghost" id="pProfil"><i class="ph-duotone ph-identification-card" style="color:var(--c3)"></i>Profil santri</button>
          <button class="btn sm ghost" id="pBukti"><i class="ph-duotone ph-file-text" style="color:var(--c4)"></i>Bukti Daftar Ulang</button>
          ${st === 'selesai' ? '<button class="btn sm ghost" id="pKwt"><i class="ph-duotone ph-receipt" style="color:var(--ok)"></i>Kuitansi</button>' : ''}
          <button class="btn sm ghost" id="pWa"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i>WhatsApp</button></div>
        <div class="card du-status-kartu" style="--tone:${(DU.STATUS_DU[st] || DU.STATUS_DU.belum)[1]}">
          <div class="pg-status-kepala"><span class="ic-box"><i class="ph-duotone ${(DU.STATUS_DU[st] || DU.STATUS_DU.belum)[2]}"></i></span>
            <div><small>${esc(p.no_registrasi)} · ${p.jenjang} ${bagL(p.bagian)} · ${esc(p.gelombang)}</small><h3>${esc(p.nama_lengkap)}</h3>
              <span>${pillSt(st)} ${du.dikirim_pada ? `<span class="muted kecil">dikirim ${fmt.tglJam(du.dikirim_pada)} WITA${du.jumlah_kirim > 1 ? ` · kirim ke-${du.jumlah_kirim}` : ''}</span>` : ''}
              ${du.nama_verifikator ? `<span class="muted kecil"> · diperiksa ${esc(du.nama_verifikator)} ${fmt.tglJam(du.diverifikasi_pada)}</span>` : ''}</span></div>
            <div class="spacer"></div>
            ${st !== 'selesai' && st !== 'belum' ? `<button class="btn ghost" id="pPerbaikan"><i class="ph-duotone ph-arrow-u-up-left" style="color:var(--c3)"></i>Minta perbaikan</button>
              <button class="btn" id="pTerima"><i class="ph-duotone ph-seal-check"></i>Terima daftar ulang</button>` : ''}
            ${st === 'selesai' && isSuper ? '<button class="btn sm ghost" id="pBuka"><i class="ph-duotone ph-lock-open" style="color:var(--danger)"></i>Buka kembali</button>' : ''}
          </div>
          ${du.catatan ? `<div class="note ${st === 'perbaikan' ? 'err' : 'info'}" style="margin:12px 0 0"><i class="ph-duotone ph-chat-text"></i><div><b>Catatan panitia:</b> ${esc(du.catatan)}</div></div>` : ''}
          ${st === 'belum' ? '<div class="note" style="margin:12px 0 0"><i class="ph-duotone ph-info"></i><div>Wali belum mengisi daftar ulang. Kirim undangan melalui WhatsApp atau isi atas nama wali.</div></div>' : ''}
        </div>
        <div class="du-kisi">
          <div>
            <div class="card"><h3 class="du-h"><i class="ph-duotone ph-wallet" style="color:var(--ok)"></i>Pembayaran</h3>
              <div class="bayar-rincian du-bayar">${(P.tagihan || []).length ? DU.rincianHTML(DU.ringkasDari(P)) : '<div><span>Rincian biaya daftar ulang belum diatur</span><b>–</b></div>'}</div>
              <a class="btn sm ghost" href="#/keuangan/${P.pendaftar.id}" style="margin-top:10px"><i class="ph-duotone ph-hand-heart" style="color:var(--c4)"></i>Keringanan dan riwayat pembayaran</a>
              <dl class="du-dl" style="margin-top:12px">
                <div><dt>Klaim transfer wali</dt><dd>${du.bayar?.nominal ? DU.rupiah(du.bayar.nominal) : '–'}</dd></div>
                <div><dt>Tanggal / pengirim</dt><dd>${du.bayar?.tanggal ? fmt.tgl(new Date(du.bayar.tanggal + 'T00:00:00')) : '–'} · ${esc(du.bayar?.nama_pengirim || '–')}${du.bayar?.bank_pengirim ? ` (${esc(du.bayar.bank_pengirim)})` : ''}</dd></div>
                ${st === 'selesai' ? `<div><dt>Diterima panitia</dt><dd><b>${DU.rupiah(du.diterima_nominal)}</b> · ${du.diterima_metode === 'tunai' ? 'tunai' : 'transfer'} · ${fmt.tgl(new Date(du.diterima_tanggal + 'T00:00:00'))}</dd></div>
                  <div><dt>Nomor kuitansi</dt><dd class="mono">${esc(du.nomor_kuitansi || '–')}</dd></div>
                  ${total > (+du.diterima_nominal || 0) ? `<div><dt>Sisa tagihan</dt><dd style="color:var(--c3)"><b>${DU.rupiah(total - du.diterima_nominal)}</b></dd></div>` : ''}` : ''}
              </dl></div>
            <div class="card"><h3 class="du-h"><i class="ph-duotone ph-files" style="color:var(--c4)"></i>Berkas</h3>
              <ul class="du-berkas">${berkas.length ? berkas.map(b => `<li><span class="ic-box kecil" style="--tone:${kunciDu.has(b.jenis) ? 'var(--c5)' : 'var(--c7)'}"><i class="ph-duotone ${(b.mime || '').includes('pdf') ? 'ph-file-pdf' : 'ph-image'}"></i></span>
                <div><b>${esc(label[b.jenis] || b.jenis)}</b><small>${kunciDu.has(b.jenis) ? 'Daftar ulang' : 'Pendaftaran'} · ${fmt.tglJam(b.dibuat_pada)}${b.catatan ? ` · ${esc(b.catatan)}` : ''}</small></div>
                ${pill({ menunggu: 'Menunggu', diterima: 'Diterima', ditolak: 'Ditolak' }[b.status], { menunggu: 'var(--c6)', diterima: 'var(--ok)', ditolak: 'var(--danger)' }[b.status])}
                <button class="icon-btn plain" data-lihat="${b.id}" title="Lihat" aria-label="Lihat berkas"><i class="ph-duotone ph-eye" style="color:var(--c1)"></i></button></li>`).join('') : '<li class="muted">Belum ada berkas</li>'}</ul></div>
            ${(P.riwayat_wa || []).length ? `<div class="card"><h3 class="du-h"><i class="ph-duotone ph-clock-counter-clockwise" style="color:var(--c6)"></i>Riwayat WhatsApp</h3>
              <ul class="du-berkas">${P.riwayat_wa.map(w => `<li><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i><div><b>${esc(peng.templat_wa?.[w.templat]?.judul || w.templat)}</b><small>${fmt.tglJam(w.pada)}</small></div></li>`).join('')}</ul></div>` : ''}
          </div>
          <div>${[0, 1, 2, 3, 4, 5, 6, 7].map(blok).join('')}</div>
        </div>`;
      pasang();
    };
    const pasang = () => {
      const p = P.pendaftar, du = P.du;
      const total = +DU.ringkasDari(P).bayar || +du.tagihan || 0;
      $('#pProfil').onclick = () => pilihCetak('Profil santri', async pdf => {
        const foto = await ambilFoto(P);
        const o = DU.dokumenProfil(P, peng, foto);
        return pdf ? unduh(o, `Profil Santri ${p.no_registrasi} ${p.nama_lengkap}.pdf`) : cetakDokumen(o);
      });
      $('#pBukti').onclick = () => pilihCetak('Bukti Daftar Ulang', pdf => { const o = DU.dokumenBuktiDU(P, peng); return pdf ? unduh(o, `Bukti Daftar Ulang ${p.no_registrasi}.pdf`) : cetakDokumen(o); });
      $('#pKwt')?.addEventListener('click', () => pilihCetak('Kuitansi', pdf => { const o = DU.dokumenKuitansi(P, peng); return pdf ? unduh(o, `Kuitansi ${p.no_registrasi}.pdf`) : cetakDokumen(o); }));
      $('#pWa').onclick = () => UI.waBerurutan([{ p: { ...p, catatan: du.catatan }, sesi: [] }], du.status === 'selesai' ? 'du_selesai' : du.status === 'perbaikan' ? 'du_perbaikan' : 'undangan_du',
        p.gelombang, { pilihan: ['undangan_du', 'du_perbaikan', 'du_selesai'], gel: P.gelombang, catatan: du.catatan }).then(muatUlang);
      $('#pTerima')?.addEventListener('click', async () => {
        const klaim = angkaDari(du.bayar?.nominal);
        const v = await dialog({ judul: `Terima daftar ulang ${p.nama_lengkap}`, ikon: 'ph-seal-check', tone: 'var(--ok)',
          isi: `<p style="margin:0 0 10px">Pastikan data, berkas wajib, dan dana sudah sesuai. Nomor kuitansi dibuat otomatis.</p>
            <div class="grid-form">
              <div class="field"><label>Nominal diterima <span class="req">*</span></label><div class="isian-satuan pra"><span>Rp</span><input class="input" id="tNom" inputmode="numeric" value="${fmt.angka(klaim || total)}"></div>
                <small class="bantu" id="tSisa"></small></div>
              <div class="field"><label>Tanggal diterima <span class="req">*</span></label><input class="input" id="tTgl" type="date" data-default-today></div>
              <div class="field full"><span class="label">Cara pembayaran</span><div class="chips-select"><label><input type="radio" name="tMet" value="transfer" checked>Transfer</label><label><input type="radio" name="tMet" value="tunai">Tunai</label></div></div>
              <div class="field full"><label>Catatan (tampil di kuitansi, boleh kosong)</label><input class="input" id="tCat" maxlength="200" placeholder="Misalnya: sisa dilunasi saat kedatangan"></div>
            </div>`,
          saatBuka: root => { window.SPMB.isiTanggalBawaan(root); const nom = root.querySelector('#tNom'), sisa = root.querySelector('#tSisa');
            const f = () => { const n = angkaDari(nom.value); sisa.innerHTML = total ? (n >= total ? '<b style="color:var(--ok)">Lunas</b>' : `Sisa tagihan <b>${DU.rupiah(total - n)}</b>`) : ''; };
            nom.oninput = f; nom.onchange = () => { nom.value = fmt.angka(angkaDari(nom.value)); f(); }; f(); },
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Terima', ikon: 'ph-check', aksi: async root => {
            const nominal = angkaDari(root.querySelector('#tNom').value), tgl = root.querySelector('#tTgl').value;
            if (!tgl) { toast('Isi tanggal diterima.', 'warn'); return false; }
            const { data, error } = await sb.rpc('du_verifikasi', { p_id: id, p_aksi: 'terima', p_catatan: root.querySelector('#tCat').value.trim(), p_nominal: nominal, p_tanggal: tgl, p_metode: root.querySelector('[name=tMet]:checked').value });
            if (error) throw new Error(galat(error)); return data; } }] });
        if (!v) return;
        toast(`Daftar ulang diterima. Kuitansi ${v.nomor_kuitansi}.`, 'ok', 6000);
        await muatUlang();
        if (await konfirmasi('Kabari wali?', 'Kirim pesan WhatsApp "Daftar Ulang Selesai" ke wali sekarang?', 'Buka WhatsApp')) $('#pWa').click();
      });
      $('#pPerbaikan')?.addEventListener('click', async () => {
        const v = await dialog({ judul: 'Minta perbaikan daftar ulang', ikon: 'ph-arrow-u-up-left', tone: 'var(--c3)',
          isi: `<p style="margin:0 0 10px">Wali dapat mengubah isian dan mengirim ulang. Tuliskan dengan jelas apa yang perlu diperbaiki.</p>
            <div class="field"><label>Catatan perbaikan <span class="req">*</span></label><textarea class="textarea" id="pCat" rows="3" maxlength="500" placeholder="Misalnya: foto bukti transfer buram, nominal belum sesuai, NIK ibu kurang satu digit">${esc(du.catatan || '')}</textarea></div>`,
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Kirim catatan', ikon: 'ph-paper-plane-tilt', aksi: async root => {
            const c = root.querySelector('#pCat').value.trim(); if (c.length < 5) { toast('Tuliskan catatan perbaikan.', 'warn'); return false; }
            const { error } = await sb.rpc('du_verifikasi', { p_id: id, p_aksi: 'perbaikan', p_catatan: c }); if (error) throw new Error(galat(error)); return true; } }] });
        if (!v) return;
        toast('Status: perlu perbaikan.');
        await muatUlang();
        if (await konfirmasi('Kabari wali?', 'Kirim pesan WhatsApp "Perbaikan Daftar Ulang" berisi catatan tadi?', 'Buka WhatsApp')) $('#pWa').click();
      });
      $('#pBuka')?.addEventListener('click', async () => {
        if (!(await konfirmasi('Buka kembali daftar ulang?', 'Status kembali menjadi Menunggu verifikasi. Nomor kuitansi tetap tersimpan.', 'Buka kembali', true))) return;
        const { error } = await sb.rpc('du_verifikasi', { p_id: id, p_aksi: 'buka_kembali' }); if (error) return toast(galat(error), 'err');
        await muatUlang();
      });
      k.querySelectorAll('[data-lihat]').forEach(b => b.onclick = () => lihat(P.berkas.find(x => String(x.id) === b.dataset.lihat)));
    };
    const muatUlang = async () => { try { await muat(); render(); } catch (e) { toast(galat(e), 'err'); } };
    async function lihat(b) {
      let urlBlob = null;
      const pilih = await dialog({ judul: label[b.jenis] || b.jenis, ikon: (b.mime || '').includes('pdf') ? 'ph-file-pdf' : 'ph-image', tone: 'var(--c4)', lebar: true,
        isi: `<div class="pratinjau-berkas" id="lihatIsi"><span class="spinner"></span> Mengambil berkas dari Google Drive…</div>
          <p class="muted" style="font-size:12.5px;margin:8px 0 0">${esc(b.nama)} · diunggah ${fmt.tglJam(b.dibuat_pada)}</p>`,
        tombol: [{ label: 'Tutup', kelas: 'ghost', nilai: null }, { label: 'Tolak', ikon: 'ph-x-circle', kelas: 'ghost', nilai: 'ditolak' }, { label: 'Terima', ikon: 'ph-check-circle', nilai: 'diterima' }],
        saatBuka: async root => {
          try {
            const h = await lihatBerkasPendaftar(b.drive_id), box = root.querySelector('#lihatIsi'); if (!box) return;
            if ((h.mime || '').startsWith('image/')) box.innerHTML = `<img alt="" src="${h.data}">`;
            else { const bin = atob(h.data.split(',')[1]), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
              urlBlob = URL.createObjectURL(new Blob([arr], { type: h.mime })); box.innerHTML = `<iframe title="${esc(b.nama)}" src="${urlBlob}"></iframe>`; }
          } catch (e) { const box = root.querySelector('#lihatIsi'); if (box) box.innerHTML = `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(galat(e))}</div></div>`; }
        } });
      if (urlBlob) setTimeout(() => URL.revokeObjectURL(urlBlob), 1000);
      if (!pilih) return;
      let catatan = '';
      if (pilih === 'ditolak') {
        catatan = await dialog({ judul: 'Tolak berkas', ikon: 'ph-x-circle', tone: 'var(--danger)', isi: '<div class="field"><label>Alasan penolakan</label><input class="input" id="alasanB" maxlength="200" placeholder="Misalnya: foto buram"></div>',
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Tolak', kelas: 'danger', aksi: root => root.querySelector('#alasanB').value.trim() || 'Perlu diunggah ulang' }] });
        if (catatan == null) return;
      }
      const { error } = await sb.from('berkas_pendaftar').update({ status: pilih, catatan }).eq('id', b.id);
      if (error) return toast(galat(error), 'err');
      toast(pilih === 'diterima' ? 'Berkas diterima.' : 'Berkas ditolak.'); await muatUlang();
    }
    render();
  }

  /* ---------- Tab Rekap Santri Baru ---------- */
  async function tabRekap(el, api) {
    const gels = await muatGelombang();
    let data = [], semuaGel = false, hanyaSelesai = true;
    el.innerHTML = `
      <div class="page-head">
        <select class="select" id="rGel" style="max-width:220px" aria-label="Gelombang"><option value="semua">Semua gelombang</option>${opsiGel(gels)}</select>
        <label class="check uji-saklar"><input type="checkbox" id="rUji" ${SEL.uji ? 'checked' : ''}>Data uji</label>
        <label class="check"><input type="checkbox" id="rSelesai" checked>Hanya yang selesai daftar ulang</label>
        <div class="spacer"></div>
        <button class="btn sm ghost" id="rCetak"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Cetak rekap</button>
        <button class="btn sm ghost" id="rProfil"><i class="ph-duotone ph-identification-card" style="color:var(--c3)"></i>Profil semua santri</button>
        <button class="btn sm ghost" id="rCsv"><i class="ph-duotone ph-microsoft-excel-logo" style="color:var(--ok)"></i>Ekspor Excel lengkap</button>
      </div>
      <div class="stats stats-pendaftar" id="rStat"></div>
      <div id="rIsi"></div>`;
    const tampil = () => data.filter(r => !hanyaSelesai || r.du_status === 'selesai');
    const render = () => {
      const rows = tampil(), K = [['SMP', 'putra'], ['SMP', 'putri'], ['SMA', 'putra'], ['SMA', 'putri']];
      $('#rStat').innerHTML = K.map(([j, b], i) => [`${j} ${bagL(b)}`, rows.filter(r => r.jenjang === j && r.bagian === b).length, b === 'putra' ? 'ph-gender-male' : 'ph-gender-female', ['var(--c1)', 'var(--c4)', 'var(--c5)', 'var(--c2)'][i]])
        .concat([['Total santri baru', rows.length, 'ph-graduation-cap', 'var(--ok)']])
        .map(([l, v, ic, t]) => `<div class="stat" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b>${fmt.angka(v)}</b><span>${l}</span></div>`).join('');
      $('#rIsi').innerHTML = K.map(([j, b]) => { const rs = rows.filter(r => r.jenjang === j && r.bagian === b);
        return rs.length ? `<div class="card" style="margin-bottom:14px"><h3 class="du-h">${j} ${bagL(b)} <small class="muted">(${rs.length})</small></h3>
          <div class="table-wrap"><table class="tbl"><thead><tr><th class="c">No</th><th>Nama</th><th class="hide-sm">NISN</th><th class="hide-sm">Asal sekolah</th><th class="hide-sm">Orang tua</th><th>Status</th></tr></thead>
          <tbody>${rs.map((r, i) => `<tr><td class="c">${i + 1}</td><td><a href="#/daftarulang/${r.id}" style="color:inherit;text-decoration:none"><b>${esc(r.nama_lengkap)}</b></a><br><small class="mono muted">${esc(r.no_registrasi)}</small></td>
            <td class="hide-sm mono">${esc(r.nisn)}</td><td class="hide-sm">${esc(r.asal_sekolah || '–')}</td><td class="hide-sm">${esc(r.nama_ayah || '–')} / ${esc(r.nama_ibu || '–')}</td><td>${pillSt(r.du_status)}</td></tr>`).join('')}</tbody></table></div></div>` : ''; }).join('')
        || '<div class="card"><div class="empty"><i class="ph-duotone ph-users-four"></i><b>Belum ada santri baru</b>Data muncul setelah daftar ulang diverifikasi.</div></div>';
    };
    const muat = async () => {
      const ids = semuaGel ? gels.map(g => g.id) : [+SEL.gel];
      const hasil = await Promise.all(ids.map(gid => sb.rpc('du_daftar', { p_gelombang: gid, p_uji: SEL.uji })));
      const e = hasil.find(h => h.error); if (e) throw e.error;
      data = hasil.flatMap((h, i) => (h.data || []).map(r => ({ ...r, gelombang: gels.find(g => g.id === ids[i])?.nama })));
      render();
    };
    $('#rGel').value = SEL.gel;
    await muat();
    $('#rGel').onchange = e => { semuaGel = e.target.value === 'semua'; if (!semuaGel) pilihGel(e.target.value); muat().catch(x => toast(galat(x), 'err')); };
    $('#rUji').onchange = e => { SEL.uji = e.target.checked; muat().catch(x => toast(galat(x), 'err')); };
    $('#rSelesai').onchange = e => { hanyaSelesai = e.target.checked; render(); };
    $('#rCsv').onclick = () => ekspor(tampil(), 'Rekap Santri Baru');
    $('#rProfil').onclick = async () => {
      const rows = tampil(); if (!rows.length) return toast('Tidak ada data.', 'warn');
      const v = await dialog({ judul: `Profil ${rows.length} santri (PDF)`, ikon: 'ph-identification-card', tone: 'var(--c3)',
        isi: `<p style="margin:0 0 10px">Satu santri satu bagian, disusun menjadi satu berkas PDF. Untuk banyak santri, proses dapat memakan beberapa menit.</p>
          <label class="check"><input type="checkbox" id="pfFoto" checked>Sertakan pas foto (diambil dari Google Drive, lebih lama)</label>`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Susun PDF', ikon: 'ph-file-pdf', aksi: root => ({ foto: root.querySelector('#pfFoto').checked }) }] });
      if (!v) return;
      const peng = await muatPengaturan(), t = toast(`Mengambil data 0/${rows.length}…`, 'info', 1800000), tulis = m => { const d = t.querySelector('div'); if (d) d.textContent = m; };
      try {
        const docs = [];
        for (let i = 0; i < rows.length; i++) {
          tulis(`Mengambil data ${i + 1}/${rows.length}…`);
          const { data: P, error } = await sb.rpc('du_detail', { p_id: rows[i].id }); if (error) throw error;
          docs.push(DU.dokumenProfil(P, peng, v.foto ? await ambilFoto(P) : ''));
        }
        simpanPdf(await buatPdfBanyak(docs, 'Profil Santri Baru', (n, tot) => tulis(`Menyusun PDF ${n}/${tot}…`)), `Profil Santri Baru ${fmt.isoTgl()}.pdf`);
      } catch (e) { toast(galat(e), 'err', 7000); } finally { t.remove(); }
    };
    $('#rCetak').onclick = () => pilihCetak('Rekap santri baru', async pdf => {
      const peng = await muatPengaturan(), ta = peng.identitas?.tahun_ajaran || '', rows = tampil();
      if (!rows.length) return toast('Tidak ada data.', 'warn');
      const K = [['SMP', 'putra'], ['SMP', 'putri'], ['SMA', 'putra'], ['SMA', 'putri']].filter(([j, b]) => rows.some(r => r.jenjang === j && r.bagian === b));
      const docs = K.map(([j, b]) => { const rs = rows.filter(r => r.jenjang === j && r.bagian === b);
        return { judul: 'Rekap Santri Baru', nomor: '',
          meta: `Tahun Ajaran ${esc(ta)} · ${semuaGel ? 'Semua gelombang' : esc(gels.find(g => String(g.id) === String(SEL.gel))?.nama || '')} · <b>${j} ${bagL(b)}</b> · ${rs.length} santri${hanyaSelesai ? '' : ' (termasuk yang belum selesai daftar ulang)'}${SEL.uji ? ' · <b>DATA UJI COBA</b>' : ''}`,
          isi: `<table><colgroup><col style="width:5%"><col style="width:31%"><col style="width:13%"><col style="width:20%"><col style="width:20%"><col style="width:11%"></colgroup>
            <thead><tr><th>No</th><th>Nama santri / No. registrasi</th><th>NISN</th><th>Tempat, tanggal lahir</th><th>Asal sekolah</th><th>Status</th></tr></thead>
            <tbody>${rs.map((r, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(r.nama_lengkap)}<br><span style="font-size:8pt">${esc(r.no_registrasi)}</span></td><td>${esc(r.nisn)}</td>
              <td>${esc(r.tempat_lahir || '')}, ${r.tanggal_lahir ? fmt.tgl(new Date(r.tanggal_lahir + 'T00:00:00')) : '–'}</td><td>${esc(r.asal_sekolah || '–')}</td><td>${r.du_status === 'selesai' ? 'Selesai' : (DU.STATUS_DU[r.du_status] || [''])[0]}</td></tr>`).join('')}</tbody></table>`,
          ttd: penandaTangan('rekap_pendaftar', peng, j) }; });
      if (!pdf) return cetakBanyakDokumen(docs);
      const t = toast('Menyusun PDF…', 'info', 120000);
      try { simpanPdf(await buatPdfBanyak(docs, 'Rekap Santri Baru'), `Rekap Santri Baru ${fmt.isoTgl()}.pdf`); } catch (e) { toast(galat(e), 'err'); } finally { t.remove(); }
    });
  }

  /* ---------- Tab Pengaturan (Superadmin) ---------- */
  async function tabAtur(el, api) {
    const peng = await muatPengaturan(true), cfg = JSON.parse(JSON.stringify(peng.daftar_ulang || {}));
    cfg.wajib = cfg.wajib || {}; cfg.berkas = cfg.berkas || []; cfg.isian_tambahan = cfg.isian_tambahan || [];
    const isianAtur = DU.ISIAN.filter(f => f.k && f.src !== 'kunci' && !f.inti);
    const kunciDari = t => String(t).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28) || 'isian';
    const render = () => {
      el.innerHTML = `
        <form id="fAtur" novalidate>
        <div class="card"><h3 class="du-h"><i class="ph-duotone ph-calendar-check" style="color:var(--c2)"></i>Pembukaan daftar ulang</h3>
          <div class="chips-select">${[['jadwal', 'Ikuti jadwal daftar ulang tiap gelombang'], ['buka', 'Buka sekarang'], ['tutup', 'Tutup']].map(([v, l]) => `<label><input type="radio" name="mode" value="${v}" ${(cfg.mode || 'jadwal') === v ? 'checked' : ''}>${l}</label>`).join('')}</div>
          <p class="muted kecil" style="margin:8px 0 0">Jadwal daftar ulang tiap gelombang diatur di Pengaturan SPMB > Gelombang. Panitia tetap dapat mengisi atas nama wali kapan saja.</p>
          <div class="grid-form" style="margin-top:12px">
            <div class="field full"><label>Catatan di langkah pembayaran</label><textarea class="textarea" name="catatan" rows="2" maxlength="400" placeholder="Misalnya: transfer sesuai total, cantumkan nama santri pada berita transfer">${esc(cfg.catatan || '')}</textarea></div>
            <div class="field full"><label>Pernyataan sebelum mengirim</label><textarea class="textarea" name="pernyataan" rows="2" maxlength="400">${esc(cfg.pernyataan || '')}</textarea></div>
            <div class="field"><label>Format nomor kuitansi</label><input class="input mono" name="format_kuitansi" value="${esc(cfg.format_kuitansi || '{urut}/KWT-DU/SPMB-IAS/{romawi}/{tahun}')}"><small>Isian: {urut}, {romawi} (bulan), {tahun}</small></div>
          </div></div>
        <div class="card"><h3 class="du-h"><i class="ph-duotone ph-files" style="color:var(--c4)"></i>Berkas daftar ulang</h3>
          <div class="du-atur-daftar">${cfg.berkas.map((b, i) => `<div class="du-atur-baris"><input class="input" data-berkas-label="${i}" value="${esc(b.label)}" maxlength="80" aria-label="Nama berkas">
            <label class="check"><input type="checkbox" data-berkas-wajib="${i}" ${b.wajib ? 'checked' : ''}>Wajib</label>
            ${b.kunci === 'bukti_bayar_du' ? '<span class="icon-btn plain" title="Bukti pembayaran tidak dapat dihapus"><i class="ph-duotone ph-lock-simple muted"></i></span>' : `<button type="button" class="icon-btn plain" data-hapus-berkas="${i}" aria-label="Hapus"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>`}</div>`).join('')}</div>
          <button type="button" class="btn sm ghost" id="tambahBerkas" style="margin-top:8px"><i class="ph-duotone ph-plus-circle" style="color:var(--c6)"></i>Tambah berkas</button>
          <p class="muted kecil" style="margin:8px 0 0">"Kartu KIP/KIS/KKS" otomatis wajib bagi wali yang memilih penerima KIP atau KKS.</p></div>
        <div class="card"><h3 class="du-h"><i class="ph-duotone ph-list-checks" style="color:var(--c5)"></i>Isian wajib atau opsional</h3>
          <p class="muted kecil" style="margin:-4px 0 10px">Centang = wajib diisi wali. Nomor KK selalu wajib. Isian bersyarat (misalnya data wali) hanya diminta bila relevan.</p>
          ${DU.LANGKAH.slice(0, 8).map(([l, ic, t], s) => { const fs = isianAtur.filter(f => f.s === s); return fs.length ? `<div class="du-atur-grup"><b><i class="ph-duotone ${ic}" style="color:${t}"></i>${l}</b>
            <div class="chips-select cek-banyak">${fs.map(f => `<label><input type="checkbox" data-wajib="${f.k}" ${DU.wajibKah(f, cfg) ? 'checked' : ''}><i class="ph-duotone ph-square kosong"></i><i class="ph-duotone ph-check-square penuh"></i>${esc(f.l)}</label>`).join('')}</div></div>` : ''; }).join('')}</div>
        <div class="card"><h3 class="du-h"><i class="ph-duotone ph-plus-square" style="color:var(--c6)"></i>Isian tambahan</h3>
          <div class="du-atur-daftar">${cfg.isian_tambahan.map((x, i) => `<div class="du-atur-baris tambahan">
            <input class="input" data-x="${i}" data-xk="label" value="${esc(x.label)}" placeholder="Nama isian" maxlength="80" aria-label="Nama isian">
            <select class="select" data-x="${i}" data-xk="jenis" aria-label="Jenis">${[['teks', 'Teks'], ['angka', 'Angka'], ['pilihan', 'Pilihan'], ['tanggal', 'Tanggal']].map(([v, l]) => `<option value="${v}" ${x.jenis === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <select class="select" data-x="${i}" data-xk="langkah" aria-label="Langkah">${DU.LANGKAH.slice(0, 8).map(([l], s) => `<option value="${s}" ${+x.langkah === s ? 'selected' : ''}>${s + 1}. ${l}</option>`).join('')}</select>
            <input class="input" data-x="${i}" data-xk="pilihan" value="${esc((x.pilihan || []).join(', '))}" placeholder="Pilihan, pisahkan koma" ${x.jenis === 'pilihan' ? '' : 'disabled'} aria-label="Pilihan">
            <label class="check"><input type="checkbox" data-x="${i}" data-xk="wajib" ${x.wajib ? 'checked' : ''}>Wajib</label>
            <button type="button" class="icon-btn plain" data-hapus-x="${i}" aria-label="Hapus"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button></div>`).join('') || '<p class="muted" style="margin:0">Belum ada isian tambahan.</p>'}</div>
          <button type="button" class="btn sm ghost" id="tambahIsian" style="margin-top:8px"><i class="ph-duotone ph-plus-circle" style="color:var(--c6)"></i>Tambah isian</button>
          <p class="muted kecil" style="margin:8px 0 0">Contoh: ukuran sepatu, nama penjemput, atau pilihan kamar. Isian tambahan ikut dalam ekspor Excel.</p></div>
        <div style="display:flex;justify-content:flex-end"><button class="btn" type="submit"><i class="ph-duotone ph-floppy-disk"></i>Simpan pengaturan daftar ulang</button></div>
        </form>`;
    };
    const baca = () => {
      const f = $('#fAtur');
      cfg.mode = f.querySelector('[name=mode]:checked')?.value || 'jadwal';
      cfg.catatan = f.elements.catatan.value.trim(); cfg.pernyataan = f.elements.pernyataan.value.trim(); cfg.format_kuitansi = f.elements.format_kuitansi.value.trim();
      f.querySelectorAll('[data-berkas-label]').forEach(i => { cfg.berkas[+i.dataset.berkasLabel].label = i.value.trim(); });
      f.querySelectorAll('[data-berkas-wajib]').forEach(i => { cfg.berkas[+i.dataset.berkasWajib].wajib = i.checked; });
      f.querySelectorAll('[data-wajib]').forEach(i => { const def = !!DU.ISIAN.find(x => x.k === i.dataset.wajib).w; if (i.checked === def) delete cfg.wajib[i.dataset.wajib]; else cfg.wajib[i.dataset.wajib] = i.checked; });
      f.querySelectorAll('[data-x]').forEach(i => { const x = cfg.isian_tambahan[+i.dataset.x], k = i.dataset.xk;
        if (k === 'wajib') x.wajib = i.checked; else if (k === 'langkah') x.langkah = +i.value; else if (k === 'pilihan') x.pilihan = i.value.split(',').map(s => s.trim()).filter(Boolean); else x[k] = i.value.trim(); });
      cfg.isian_tambahan.forEach(x => { if (!x.kunci) x.kunci = kunciDari(x.label); });
    };
    render();
    el.addEventListener('click', e => {
      if (e.target.closest('#tambahBerkas')) { baca(); cfg.berkas.push({ kunci: '', label: '', wajib: false }); render(); }
      if (e.target.closest('#tambahIsian')) { baca(); cfg.isian_tambahan.push({ kunci: '', label: '', jenis: 'teks', langkah: 0, wajib: false, pilihan: [] }); render(); }
      const hb = e.target.closest('[data-hapus-berkas]'), hx = e.target.closest('[data-hapus-x]');
      if (hb) { baca(); cfg.berkas.splice(+hb.dataset.hapusBerkas, 1); render(); }
      if (hx) { baca(); cfg.isian_tambahan.splice(+hx.dataset.hapusX, 1); render(); }
    });
    el.addEventListener('change', e => { if (e.target.dataset.xk === 'jenis') { baca(); render(); } });
    el.addEventListener('submit', async e => {
      e.preventDefault(); baca();
      const kosong = cfg.berkas.find(b => b.label.length < 3) || cfg.isian_tambahan.find(x => x.label.length < 2);
      if (kosong) return toast('Nama berkas/isian minimal 3 karakter.', 'warn');
      if (!cfg.format_kuitansi.includes('{urut}')) return toast('Format nomor kuitansi wajib memuat {urut}.', 'warn');
      const dipakai = new Set();
      cfg.berkas.forEach(b => { if (!b.kunci) b.kunci = kunciDari(b.label); while (dipakai.has(b.kunci)) b.kunci += '_2'; dipakai.add(b.kunci); });
      const kx = new Set(); cfg.isian_tambahan.forEach(x => { while (kx.has(x.kunci)) x.kunci += '_2'; kx.add(x.kunci); });
      const { error } = await sb.from('pengaturan').update({ nilai: cfg }).eq('kunci', 'daftar_ulang');
      if (error) return toast(galat(error), 'err');
      api.S.pengaturan.daftar_ulang = cfg; await muatPengaturan(true);
      toast('Pengaturan daftar ulang disimpan.'); render();
    });
  }
})();
