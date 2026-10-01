/* =====================================================================
   MENU KEUANGAN (Fase 4 · Langkah 6b) · Admin dan Superadmin
   - Ringkasan: tagihan, keringanan, dana masuk, tunggakan per tahap,
     pemasukan harian, per metode, per kelompok; cetak laporan F4
   - Tagihan santri: status lunas/sebagian/belum, saringan, ekspor CSV
   - Pembayaran masuk: buku pembayaran per rentang tanggal, kuitansi,
     pembatalan (Superadmin)
   - Keringanan: daftar keringanan per kategori
   - Detail (#/keuangan/<id>): rincian tagihan setelah keringanan, catat
     pembayaran (kuitansi otomatis), atur keringanan (Superadmin)
   Pembayaran pendaftaran tercatat otomatis saat bukti bayar diterima;
   pembayaran daftar ulang tercatat saat daftar ulang diterima.
   ===================================================================== */
(function () {
  'use strict';
  const { sb, fmt, esc, toast, dialog, konfirmasi, pesanGalat, muatPengaturan, cetakDokumen, buatPdfDokumen, simpanPdf, penandaTangan, grafik } = window.SPMB;
  const DU = window.SPMB_DU;
  const $ = (s, r = document) => r.querySelector(s);
  window.SPMB_MODUL = window.SPMB_MODUL || {};
  const rp = DU.rupiah;
  const SEL = { gel: '', uji: false, q: '', st: '', dari: '', sampai: '' };
  const bagL = b => b === 'putri' ? 'Putri' : 'Putra';
  const pill = (l, t, ic) => `<span class="pill" style="--tone:${t}">${ic ? `<i class="ph-duotone ${ic}"></i>` : ''}${esc(l)}</span>`;
  const TONE_TAHAP = { pendaftaran: 'var(--c1)', daftar_ulang: 'var(--c5)', tahunan: 'var(--c3)', bulanan: 'var(--c2)', lainnya: 'var(--c7)' };
  const statusBayar = (tag, bayar) => !tag && !bayar ? ['Tanpa tagihan', 'var(--c8)', 'ph-minus-circle'] : bayar >= tag ? ['Lunas', 'var(--ok)', 'ph-check-circle'] : bayar > 0 ? ['Sebagian', 'var(--c6)', 'ph-circle-half'] : ['Belum bayar', 'var(--danger)', 'ph-x-circle'];
  const angkaDari = v => +String(v ?? '').replace(/\D/g, '') || 0;
  const galat = e => pesanGalat(e);

  async function muatGelombang() {
    const { data } = await sb.from('gelombang').select('id,nama,urutan').is('diarsipkan_pada', null).order('urutan').order('id');
    return data || [];
  }
  const opsiGel = gels => `<option value="">Semua gelombang</option>${gels.map(g => `<option value="${g.id}" ${String(g.id) === String(SEL.gel) ? 'selected' : ''}>${esc(g.nama)}</option>`).join('')}`;
  async function pilihCetak(judul, fungsi) {
    const h = await dialog({ judul, ikon: 'ph-printer', tone: 'var(--c1)', isi: '<p style="margin:0">Cetak langsung ke printer (kertas F4) atau simpan sebagai PDF?</p>',
      tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Unduh PDF', ikon: 'ph-file-pdf', kelas: 'ghost', nilai: 'pdf' }, { label: 'Cetak', ikon: 'ph-printer', nilai: 'cetak' }] });
    if (h) await fungsi(h === 'pdf');
  }
  async function cetakAtauPdf(opsi, nama, pdf) {
    if (!pdf) return cetakDokumen(opsi);
    const t = toast('Menyusun PDF…', 'info', 60000);
    try { simpanPdf(await buatPdfDokumen(opsi), nama); } catch (e) { toast(galat(e), 'err'); } finally { t.remove(); }
  }
  function unduhCsv(baris, nama) {
    const sel = v => { v = String(v ?? ''); return `"${(/^\d{8,}$/.test(v) ? '\t' : '') + v.replace(/"/g, '""')}"`; };
    const url = URL.createObjectURL(new Blob(['﻿' + baris.map(r => r.map(sel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${nama} ${fmt.isoTgl()}.csv` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  const TAB = [['ringkasan', 'Ringkasan', 'ph-chart-pie-slice', 'var(--c1)'], ['tagihan', 'Tagihan Santri', 'ph-users-three', 'var(--c5)'],
    ['pembayaran', 'Pembayaran Masuk', 'ph-arrow-circle-down', 'var(--ok)'], ['keringanan', 'Keringanan', 'ph-hand-heart', 'var(--c4)']];
  window.SPMB_MODUL.keuangan = async (k, api) => {
    api.setFab(null);
    if (api.param) return halDetail(k, api, api.param);
    const tab = (location.hash.match(/[?&]tab=(\w+)/) || [])[1] || 'ringkasan';
    k.innerHTML = `<div class="tabs" role="tablist">${TAB.map(([id, l, ic, t]) => `<button role="tab" data-tab="${id}" aria-selected="${id === tab}"><i class="ph-duotone ${ic}" style="color:${t}"></i>${l}</button>`).join('')}</div><div id="isiTab"></div>`;
    k.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { location.hash = '#/keuangan?tab=' + b.dataset.tab; });
    await ({ ringkasan: tabRingkasan, tagihan: tabTagihan, pembayaran: tabPembayaran, keringanan: tabKeringanan }[tab] || tabRingkasan)($('#isiTab'), api);
  };
  const kepalaSaring = gels => `<select class="select" id="kGel" style="max-width:220px" aria-label="Gelombang">${opsiGel(gels)}</select>
    <label class="check uji-saklar"><input type="checkbox" id="kUji" ${SEL.uji ? 'checked' : ''}>Data uji</label>`;
  const pasangSaring = muat => { $('#kGel').onchange = e => { SEL.gel = e.target.value; muat().catch(x => toast(galat(x), 'err')); }; $('#kUji').onchange = e => { SEL.uji = e.target.checked; muat().catch(x => toast(galat(x), 'err')); }; };

  /* ---------- Ringkasan ---------- */
  async function tabRingkasan(el) {
    const gels = await muatGelombang();
    let R;
    el.innerHTML = `<div class="page-head">${kepalaSaring(gels)}<div class="spacer"></div>
        <button class="btn sm ghost" id="kLap"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Cetak laporan keuangan</button></div>
      <div class="stats stats-pendaftar" id="kStat"></div><div id="kIsi"></div>`;
    const render = () => {
      const T = R.total, persen = T.tagihan ? Math.round(T.dibayar / T.tagihan * 100) : 0;
      $('#kStat').innerHTML = [
        ['Tagihan setelah keringanan', rp(T.tagihan), 'ph-receipt', 'var(--c1)'], ['Dana masuk', rp(T.dibayar), 'ph-arrow-circle-down', 'var(--ok)'],
        ['Belum terbayar', rp(T.sisa), 'ph-hourglass-medium', 'var(--danger)'], ['Total keringanan', rp(T.potongan), 'ph-hand-heart', 'var(--c4)'],
        ['Santri berkeringanan', fmt.angka(T.santri_keringanan), 'ph-users', 'var(--c6)'], ['Capaian pembayaran', persen + '%', 'ph-chart-line-up', 'var(--c5)']
      ].map(([l, v, ic, t]) => `<div class="stat" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b style="font-size:${String(v).length > 12 ? 17 : String(v).length > 9 ? 20 : 26}px;white-space:nowrap">${esc(v)}</b><span>${l}</span></div>`).join('');
      const urut = ['pendaftaran', 'daftar_ulang', 'tahunan', 'bulanan', 'lainnya'].filter(t => R.per_tahap[t] && (R.per_tahap[t].kotor || R.per_tahap[t].dibayar));
      const harian = (R.harian || []).map(h => ({ label: fmt.tgl(new Date(String(h.tanggal).slice(0, 10) + 'T00:00:00')).slice(0, 5), nilai: +h.jumlah, tip: `${fmt.tgl(new Date(String(h.tanggal).slice(0, 10) + 'T00:00:00'))}: ${rp(h.jumlah)}` }));
      $('#kIsi').innerHTML = `
        <div class="card"><h3 class="du-h"><i class="ph-duotone ph-stack" style="color:var(--c1)"></i>Per tahap pembayaran</h3>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Tahap</th><th style="text-align:right">Tagihan</th><th style="text-align:right" class="hide-sm">Keringanan</th><th style="text-align:right">Harus bayar</th><th style="text-align:right">Masuk</th><th style="text-align:right">Sisa</th><th class="hide-sm">Lunas</th></tr></thead>
          <tbody>${urut.length ? urut.map(t => { const x = R.per_tahap[t], p = x.bayar ? Math.min(100, Math.round(x.dibayar / x.bayar * 100)) : 0;
            return `<tr><td>${pill(DU.NAMA_TAHAP[t], TONE_TAHAP[t])}</td><td style="text-align:right">${rp(x.kotor)}</td><td style="text-align:right;color:var(--ok)" class="hide-sm">${x.potongan ? '− ' + rp(x.potongan) : '–'}</td>
              <td style="text-align:right"><b>${rp(x.bayar)}</b></td><td style="text-align:right">${rp(x.dibayar)}</td><td style="text-align:right;color:${x.bayar > x.dibayar ? 'var(--danger)' : 'inherit'}">${rp(Math.max(0, x.bayar - x.dibayar))}</td>
              <td class="hide-sm" style="min-width:140px">${x.santri ? `${grafik.kemajuan(x.lunas, x.santri, TONE_TAHAP[t])}<small class="muted">${x.lunas}/${x.santri} santri${x.sebagian ? ` · ${x.sebagian} sebagian` : ''}</small>` : `<small class="muted">${p}%</small>`}</td></tr>`; }).join('')
            : '<tr><td colspan="7"><div class="empty"><i class="ph-duotone ph-wallet"></i><b>Belum ada tagihan</b>Atur Rincian Biaya di Pengaturan SPMB.</div></td></tr>'}</tbody></table></div>
          <p class="muted kecil" style="margin:8px 0 0"><i class="ph-duotone ph-info"></i> Pendaftaran ditagihkan kepada semua pendaftar; daftar ulang dan tahunan kepada yang lulus. SPP bulanan dan biaya lain dicatat saat dibayar.</p></div>
        <div class="k-kisi">
          <div class="card"><h3 class="du-h"><i class="ph-duotone ph-chart-bar" style="color:var(--ok)"></i>Dana masuk 30 hari terakhir</h3>${grafik.batang(harian, { warna: 'var(--ok)', labelTiap: 6, satuan: '' })}
            ${grafik.tabel(['Tanggal', 'Jumlah'], harian.filter(h => h.nilai).map(h => [h.tip.split(':')[0], rp(h.nilai)]))}</div>
          <div class="card"><h3 class="du-h"><i class="ph-duotone ph-users-four" style="color:var(--c5)"></i>Per kelompok</h3>
            ${grafik.mendatar((R.per_kelompok || []).map(x => ({ label: `${x.jenjang} ${bagL(x.bagian)} · ${x.tagihan ? Math.round(x.dibayar / x.tagihan * 100) : 0}%`, nilai: +x.dibayar })), { warna: 'var(--c5)', satuan: 'rupiah masuk' })}
            <div class="k-metode">${Object.entries(R.per_metode || {}).map(([m, n]) => `<div><small>${m === 'tunai' ? 'Tunai' : 'Transfer'}</small><b>${rp(n)}</b></div>`).join('') || '<small class="muted">Belum ada pembayaran.</small>'}</div>
            ${Object.keys(R.keringanan || {}).length ? `<h4 class="sub-form">Keringanan per kategori</h4><div class="pill-baris">${Object.entries(R.keringanan).map(([k, n]) => pill(`${DU.KATEGORI_KERINGANAN[k] || k} ${n}`, 'var(--c4)', 'ph-hand-heart')).join(' ')}</div>` : ''}</div>
        </div>`;
    };
    const muat = async () => { const { data, error } = await sb.rpc('keuangan_ringkas', { p_gelombang: SEL.gel ? +SEL.gel : null, p_uji: SEL.uji }); if (error) throw error; R = data; render(); };
    await muat(); pasangSaring(muat);
    $('#kLap').onclick = () => pilihCetak('Laporan keuangan', async pdf => {
      const peng = await muatPengaturan(), ta = peng.identitas?.tahun_ajaran || '';
      const urut = ['pendaftaran', 'daftar_ulang', 'tahunan', 'bulanan', 'lainnya'].filter(t => R.per_tahap[t] && (R.per_tahap[t].kotor || R.per_tahap[t].dibayar));
      const T = R.total, td = 'style="text-align:right"';
      const opsi = { judul: 'Laporan Keuangan SPMB', nomor: '',
        meta: `Tahun Ajaran ${esc(ta)} · ${SEL.gel ? esc(gels.find(g => String(g.id) === SEL.gel)?.nama || '') : 'Semua gelombang'} · Keadaan per ${fmt.tglPanjang(new Date())} pukul ${fmt.jam(new Date())} WITA${SEL.uji ? ' · <b>DATA UJI COBA</b>' : ''}`,
        isi: `<table><colgroup><col style="width:20%"><col style="width:16%"><col style="width:16%"><col style="width:16%"><col style="width:16%"><col style="width:16%"></colgroup>
          <thead><tr><th>Tahap</th><th>Tagihan</th><th>Keringanan</th><th>Harus bayar</th><th>Masuk</th><th>Sisa</th></tr></thead>
          <tbody>${urut.map(t => { const x = R.per_tahap[t]; return `<tr><td>${DU.NAMA_TAHAP[t]}</td><td ${td}>${rp(x.kotor)}</td><td ${td}>${rp(x.potongan)}</td><td ${td}>${rp(x.bayar)}</td><td ${td}>${rp(x.dibayar)}</td><td ${td}>${rp(Math.max(0, x.bayar - x.dibayar))}</td></tr>`; }).join('')}
            <tr><td><b>Jumlah</b></td><td ${td}><b>${rp(T.kotor)}</b></td><td ${td}><b>${rp(T.potongan)}</b></td><td ${td}><b>${rp(T.tagihan)}</b></td><td ${td}><b>${rp(T.dibayar)}</b></td><td ${td}><b>${rp(T.sisa)}</b></td></tr></tbody></table>
          <div style="height:10px"></div>
          <table><colgroup><col style="width:40%"><col style="width:30%"><col style="width:30%"></colgroup><thead><tr><th>Kelompok</th><th>Harus bayar</th><th>Masuk</th></tr></thead>
          <tbody>${(R.per_kelompok || []).map(x => `<tr><td>${x.jenjang} ${bagL(x.bagian)}</td><td ${td}>${rp(x.tagihan)}</td><td ${td}>${rp(x.dibayar)}</td></tr>`).join('')}</tbody></table>
          <p style="font-size:9.5pt;margin:8px 0 0">Penerimaan menurut cara bayar: ${Object.entries(R.per_metode || {}).map(([m, n]) => `${m === 'tunai' ? 'tunai' : 'transfer'} ${rp(n)}`).join(', ') || '–'}. Santri yang mendapat keringanan: ${T.santri_keringanan} orang.</p>`,
        ttd: penandaTangan('laporan_keuangan', peng) };
      await cetakAtauPdf(opsi, `Laporan Keuangan ${fmt.isoTgl()}.pdf`, pdf);
    });
  }

  /* ---------- Tagihan santri ---------- */
  async function tabTagihan(el) {
    const gels = await muatGelombang();
    let data = [];
    el.innerHTML = `<div class="page-head">${kepalaSaring(gels)}
        <div class="field" style="margin:0;flex:1;min-width:180px;max-width:300px"><input class="input" id="kCari" type="search" placeholder="Cari nama atau nomor…" value="${esc(SEL.q)}"></div>
        <div class="spacer"></div><button class="btn sm ghost" id="kCsv"><i class="ph-duotone ph-file-csv" style="color:var(--c5)"></i>Ekspor CSV</button></div>
      <div class="chips-select du-saring" id="kSaring"></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Santri</th><th class="hide-sm">Status santri</th><th style="text-align:right">Harus bayar</th><th style="text-align:right">Masuk</th><th style="text-align:right" class="hide-sm">Sisa</th><th>Pembayaran</th><th class="c"></th></tr></thead><tbody id="kIsi"></tbody></table></div>`;
    const ST = r => statusBayar(r.tagihan, r.dibayar)[0];
    const render = () => {
      const hit = s => data.filter(r => ST(r) === s).length;
      $('#kSaring').innerHTML = [['', 'Semua', data.length], ['Belum bayar', 'Belum bayar', hit('Belum bayar')], ['Sebagian', 'Sebagian', hit('Sebagian')], ['Lunas', 'Lunas', hit('Lunas')], ['k', 'Berkeringanan', data.filter(r => r.keringanan).length]]
        .map(([v, l, n]) => `<label><input type="radio" name="kst" value="${v}" ${SEL.st === v ? 'checked' : ''}>${l} <small class="muted">${n}</small></label>`).join('');
      const q = SEL.q.toLowerCase();
      const rows = data.filter(r => (!SEL.st || (SEL.st === 'k' ? r.keringanan : ST(r) === SEL.st)) && (!q || (r.nama_lengkap + ' ' + r.no_registrasi).toLowerCase().includes(q)));
      $('#kIsi').innerHTML = rows.length ? rows.map(r => { const [l, t, ic] = statusBayar(r.tagihan, r.dibayar);
        return `<tr><td><a href="#/keuangan/${r.id}" style="color:inherit;text-decoration:none"><b>${esc(r.nama_lengkap)}</b></a>${r.keringanan ? ' <i class="ph-duotone ph-hand-heart" style="color:var(--c4)" title="Mendapat keringanan"></i>' : ''}<br><small class="mono muted">${esc(r.no_registrasi)}</small> <small class="muted">${r.jenjang} ${bagL(r.bagian)}</small></td>
          <td class="hide-sm"><small>${esc((window.SPMB_STATUS?.[r.status] || [r.status.replace(/_/g, ' ')])[0])}</small></td>
          <td style="text-align:right">${rp(r.tagihan)}${r.potongan ? `<br><small style="color:var(--ok)">hemat ${rp(r.potongan)}</small>` : ''}</td><td style="text-align:right">${rp(r.dibayar)}</td>
          <td style="text-align:right" class="hide-sm">${r.sisa ? `<b style="color:var(--danger)">${rp(r.sisa)}</b>` : '–'}</td><td>${pill(l, t, ic)}</td>
          <td class="c"><a class="btn sm ghost" href="#/keuangan/${r.id}"><i class="ph-duotone ph-wallet"></i><span class="hide-sm">Detail</span></a></td></tr>`; }).join('')
        : '<tr><td colspan="7"><div class="empty"><i class="ph-duotone ph-users-three"></i><b>Tidak ada data</b></div></td></tr>';
    };
    const muat = async () => { const { data: d, error } = await sb.rpc('keuangan_santri', { p_gelombang: SEL.gel ? +SEL.gel : null, p_uji: SEL.uji }); if (error) throw error; data = d || []; render(); };
    await muat(); pasangSaring(muat);
    $('#kCari').oninput = e => { SEL.q = e.target.value.trim(); render(); };
    $('#kSaring').onchange = e => { SEL.st = e.target.value; render(); };
    $('#kCsv').onclick = () => {
      const th = ['pendaftaran', 'daftar_ulang', 'tahunan', 'bulanan', 'lainnya'];
      unduhCsv([['No. Registrasi', 'Nama', 'Jenjang', 'Bagian', 'Status santri', ...th.flatMap(t => [`${DU.NAMA_TAHAP[t]} tagihan`, `${DU.NAMA_TAHAP[t]} keringanan`, `${DU.NAMA_TAHAP[t]} masuk`]), 'Total harus bayar', 'Total masuk', 'Sisa', 'Status bayar', 'No. WA'],
        ...data.map(r => [r.no_registrasi, r.nama_lengkap, r.jenjang, bagL(r.bagian), r.status, ...th.flatMap(t => [r.tahap?.[t]?.bayar ?? 0, r.tahap?.[t]?.potongan ?? 0, r.tahap?.[t]?.dibayar ?? 0]), r.tagihan, r.dibayar, r.sisa, ST(r), r.no_wa])], 'Tagihan Santri');
      toast(`${data.length} baris diekspor.`);
    };
  }

  /* ---------- Pembayaran masuk ---------- */
  async function tabPembayaran(el, api) {
    const isSuper = api.S.profil.peran === 'superadmin';
    const hariIni = fmt.isoTgl(), awal = hariIni.slice(0, 8) + '01';
    SEL.dari = SEL.dari || awal; SEL.sampai = SEL.sampai || hariIni;
    let data = [], batal = false;
    el.innerHTML = `<div class="page-head">
        <div class="field" style="margin:0"><label class="kecil">Dari</label><input class="input" type="date" id="pDari" value="${SEL.dari}"></div>
        <div class="field" style="margin:0"><label class="kecil">Sampai</label><input class="input" type="date" id="pSampai" value="${SEL.sampai}"></div>
        <label class="check uji-saklar"><input type="checkbox" id="kUji" ${SEL.uji ? 'checked' : ''}>Data uji</label>
        <label class="check"><input type="checkbox" id="pBatal">Tampilkan yang dibatalkan</label>
        <div class="spacer"></div>
        <button class="btn sm ghost" id="pCetak"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Cetak rekap</button>
        <button class="btn sm ghost" id="pCsv"><i class="ph-duotone ph-file-csv" style="color:var(--c5)"></i>Ekspor CSV</button></div>
      <div class="stats stats-pendaftar" id="pStat"></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Santri</th><th class="hide-sm">Untuk</th><th style="text-align:right">Nominal</th><th class="hide-sm">Kuitansi</th><th class="c"></th></tr></thead><tbody id="pIsi"></tbody></table></div>`;
    const aktif = () => data.filter(x => batal || !x.dibatalkan_pada);
    const render = () => {
      const ok = data.filter(x => !x.dibatalkan_pada), jml = ok.reduce((a, x) => a + +x.nominal, 0);
      const perT = t => ok.filter(x => x.tahap === t).reduce((a, x) => a + +x.nominal, 0);
      $('#pStat').innerHTML = [['Total masuk', rp(jml), 'ph-arrow-circle-down', 'var(--ok)'], ['Transaksi', fmt.angka(ok.length), 'ph-receipt', 'var(--c1)'],
        ['Pendaftaran', rp(perT('pendaftaran')), 'ph-note-pencil', 'var(--c1)'], ['Daftar ulang', rp(perT('daftar_ulang')), 'ph-clipboard-text', 'var(--c5)'],
        ['Tahunan/bulanan/lain', rp(perT('tahunan') + perT('bulanan') + perT('lainnya')), 'ph-calendar', 'var(--c3)'], ['Tunai', rp(ok.filter(x => x.metode === 'tunai').reduce((a, x) => a + +x.nominal, 0)), 'ph-money', 'var(--c6)']]
        .map(([l, v, ic, t]) => `<div class="stat" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b style="font-size:${String(v).length > 12 ? 17 : String(v).length > 9 ? 20 : 26}px;white-space:nowrap">${esc(v)}</b><span>${l}</span></div>`).join('');
      const rows = aktif();
      $('#pIsi').innerHTML = rows.length ? rows.map(x => `<tr style="${x.dibatalkan_pada ? 'opacity:.55;text-decoration:line-through' : ''}">
          <td>${fmt.tgl(new Date(x.tanggal + 'T00:00:00'))}<br><small class="muted">${x.metode === 'tunai' ? 'Tunai' : 'Transfer'}</small></td>
          <td><a href="#/keuangan/${x.pendaftar_id}" style="color:inherit;text-decoration:none"><b>${esc(x.nama_lengkap)}</b></a><br><small class="mono muted">${esc(x.no_registrasi)}</small></td>
          <td class="hide-sm">${pill(DU.NAMA_TAHAP[x.tahap], TONE_TAHAP[x.tahap])}${x.komponen ? `<br><small class="muted">${esc(x.komponen)}</small>` : ''}${x.sumber !== 'manual' ? '<br><small class="muted">otomatis</small>' : ''}</td>
          <td style="text-align:right"><b>${rp(x.nominal)}</b>${x.dibatalkan_pada ? `<br><small style="color:var(--danger)">Dibatalkan: ${esc(x.alasan_batal || '')}</small>` : ''}</td>
          <td class="hide-sm mono"><small>${esc(x.nomor_kuitansi || '–')}</small></td>
          <td class="c" style="white-space:nowrap">${x.nomor_kuitansi && !x.dibatalkan_pada ? `<button class="icon-btn plain" data-kwt="${x.id}" title="Kuitansi" aria-label="Kuitansi"><i class="ph-duotone ph-receipt" style="color:var(--ok)"></i></button>` : ''}
            ${isSuper && x.sumber === 'manual' && !x.dibatalkan_pada ? `<button class="icon-btn plain" data-batal="${x.id}" title="Batalkan" aria-label="Batalkan"><i class="ph-duotone ph-prohibit" style="color:var(--danger)"></i></button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="6"><div class="empty"><i class="ph-duotone ph-receipt"></i><b>Belum ada pembayaran pada rentang ini</b></div></td></tr>';
    };
    const muat = async () => { const { data: d, error } = await sb.rpc('keuangan_pembayaran', { p_dari: SEL.dari, p_sampai: SEL.sampai, p_uji: SEL.uji }); if (error) throw error; data = d || []; render(); };
    await muat();
    $('#pDari').onchange = e => { SEL.dari = e.target.value || awal; muat(); };
    $('#pSampai').onchange = e => { SEL.sampai = e.target.value || hariIni; muat(); };
    $('#kUji').onchange = e => { SEL.uji = e.target.checked; muat(); };
    $('#pBatal').onchange = e => { batal = e.target.checked; render(); };
    $('#pIsi').addEventListener('click', async e => {
      const kw = e.target.closest('[data-kwt]'), bt = e.target.closest('[data-batal]');
      if (kw) await kuitansiDari(+kw.dataset.kwt, data.find(x => x.id === +kw.dataset.kwt).pendaftar_id);
      if (bt) {
        const v = await dialog({ judul: 'Batalkan pembayaran', ikon: 'ph-prohibit', tone: 'var(--danger)',
          isi: '<p style="margin:0 0 10px">Pembayaran tetap tercatat dengan tanda batal dan tidak dihitung lagi.</p><div class="field"><label>Alasan <span class="req">*</span></label><input class="input" id="aBatal" maxlength="200"></div>',
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Batalkan pembayaran', kelas: 'danger', aksi: async root => {
            const a = root.querySelector('#aBatal').value.trim(); if (a.length < 5) { toast('Tuliskan alasan.', 'warn'); return false; }
            const { error } = await sb.rpc('batalkan_pembayaran', { p_id: +bt.dataset.batal, p_alasan: a }); if (error) throw new Error(galat(error)); return true; } }] });
        if (v) { toast('Pembayaran dibatalkan.'); await muat(); }
      }
    });
    $('#pCsv').onclick = () => { unduhCsv([['Tanggal', 'No. Registrasi', 'Nama', 'Tahap', 'Komponen', 'Nominal', 'Metode', 'Rekening', 'Penyetor', 'No. Kuitansi', 'Sumber', 'Dicatat oleh', 'Dibatalkan', 'Alasan batal'],
      ...aktif().map(x => [fmt.tgl(new Date(x.tanggal + 'T00:00:00')), x.no_registrasi, x.nama_lengkap, DU.NAMA_TAHAP[x.tahap], x.komponen, x.nominal, x.metode, x.rekening || '', x.penyetor, x.nomor_kuitansi || '', x.sumber, x.nama_pencatat || '', x.dibatalkan_pada ? 'Ya' : '', x.alasan_batal || ''])], 'Pembayaran Masuk'); toast('Diekspor.'); };
    $('#pCetak').onclick = () => pilihCetak('Rekap pembayaran masuk', async pdf => {
      const peng = await muatPengaturan(), ok = data.filter(x => !x.dibatalkan_pada), td = 'style="text-align:right"';
      if (!ok.length) return toast('Tidak ada pembayaran.', 'warn');
      await cetakAtauPdf({ judul: 'Rekap Pembayaran Masuk', nomor: '',
        meta: `Periode ${fmt.tglPanjang(new Date(SEL.dari + 'T00:00:00'))} – ${fmt.tglPanjang(new Date(SEL.sampai + 'T00:00:00'))} · ${ok.length} transaksi${SEL.uji ? ' · <b>DATA UJI COBA</b>' : ''}`,
        isi: `<table><colgroup><col style="width:5%"><col style="width:13%"><col style="width:32%"><col style="width:18%"><col style="width:16%"><col style="width:16%"></colgroup>
          <thead><tr><th>No</th><th>Tanggal</th><th>Santri / No. registrasi</th><th>Untuk</th><th>Kuitansi</th><th>Nominal</th></tr></thead>
          <tbody>${ok.slice().reverse().map((x, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${fmt.tgl(new Date(x.tanggal + 'T00:00:00'))}</td><td>${esc(x.nama_lengkap)}<br><span style="font-size:8pt">${esc(x.no_registrasi)}</span></td>
            <td>${DU.NAMA_TAHAP[x.tahap]}${x.metode === 'tunai' ? ' (tunai)' : ''}</td><td style="font-size:8pt">${esc(x.nomor_kuitansi || '–')}</td><td ${td}>${rp(x.nominal)}</td></tr>`).join('')}
            <tr><td></td><td colspan="4"><b>Jumlah</b></td><td ${td}><b>${rp(ok.reduce((a, x) => a + +x.nominal, 0))}</b></td></tr></tbody></table>`,
        ttd: penandaTangan('laporan_keuangan', peng) }, `Rekap Pembayaran ${SEL.dari} sd ${SEL.sampai}.pdf`, pdf);
    });
  }

  /* ---------- Keringanan ---------- */
  async function tabKeringanan(el) {
    const gels = await muatGelombang();
    let data = [];
    el.innerHTML = `<div class="page-head">${kepalaSaring(gels)}<div class="spacer"></div>
        <button class="btn sm ghost" id="krCsv"><i class="ph-duotone ph-file-csv" style="color:var(--c5)"></i>Ekspor CSV</button></div>
      <div class="note info"><i class="ph-duotone ph-info"></i><div>Keringanan diatur per santri di halaman detail keuangan (tombol <b>Detail</b> di tab Tagihan Santri, atau dari halaman Periksa daftar ulang). Potongan dapat berupa persen atau nominal, untuk satu komponen biaya atau seluruh tagihan satu tahap.</div></div>
      <div class="stats stats-pendaftar" id="krStat"></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Santri</th><th>Keringanan</th><th style="text-align:right">Hemat</th><th class="hide-sm">Alasan</th><th class="c"></th></tr></thead><tbody id="krIsi"></tbody></table></div>`;
    const render = () => {
      const kat = {}; data.forEach(r => (r.list || []).forEach(k => { kat[k.kategori] = (kat[k.kategori] || 0) + 1; }));
      $('#krStat').innerHTML = [['Santri berkeringanan', data.length, 'ph-users', 'var(--c4)'], ['Total hemat', rp(data.reduce((a, r) => a + +r.potongan, 0)), 'ph-hand-heart', 'var(--ok)'],
        ...Object.entries(kat).slice(0, 4).map(([k, n], i) => [DU.KATEGORI_KERINGANAN[k] || k, n, 'ph-tag', ['var(--c1)', 'var(--c3)', 'var(--c5)', 'var(--c6)'][i]])]
        .map(([l, v, ic, t]) => `<div class="stat" style="--tone:${t}"><span class="live">LIVE</span><div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b style="font-size:${String(v).length > 12 ? 17 : String(v).length > 9 ? 20 : 26}px;white-space:nowrap">${esc(String(v))}</b><span>${esc(l)}</span></div>`).join('');
      $('#krIsi').innerHTML = data.length ? data.map(r => `<tr><td><b>${esc(r.nama_lengkap)}</b><br><small class="mono muted">${esc(r.no_registrasi)}</small> <small class="muted">${r.jenjang} ${bagL(r.bagian)}</small></td>
          <td>${(r.list || []).map(k => `<div>${pill(DU.KATEGORI_KERINGANAN[k.kategori] || k.kategori, 'var(--c4)')} <small>${DU.NAMA_TAHAP[k.tahap]} · ${k.komponen ? esc(k.komponen) : 'seluruh tagihan'} · ${k.jenis === 'persen' ? (+k.nilai) + '%' : rp(k.nilai)}</small></div>`).join('')}</td>
          <td style="text-align:right;color:var(--ok)"><b>${rp(r.potongan)}</b></td><td class="hide-sm"><small>${(r.list || []).map(k => esc(k.keterangan || '–')).join('<br>')}</small></td>
          <td class="c"><a class="btn sm ghost" href="#/keuangan/${r.id}"><i class="ph-duotone ph-pencil-simple"></i></a></td></tr>`).join('')
        : '<tr><td colspan="5"><div class="empty"><i class="ph-duotone ph-hand-heart"></i><b>Belum ada keringanan</b></div></td></tr>';
    };
    const muat = async () => {
      const [s, k] = await Promise.all([sb.rpc('keuangan_santri', { p_gelombang: SEL.gel ? +SEL.gel : null, p_uji: SEL.uji }), sb.from('keringanan').select('*, rincian_biaya(komponen)').order('id')]);
      if (s.error) throw s.error; if (k.error) throw k.error;
      const per = {}; (k.data || []).forEach(x => { (per[x.pendaftar_id] = per[x.pendaftar_id] || []).push({ ...x, komponen: x.rincian_biaya?.komponen }); });
      data = (s.data || []).filter(r => per[r.id]).map(r => ({ ...r, list: per[r.id] }));
      render();
    };
    await muat(); pasangSaring(muat);
    $('#krCsv').onclick = () => { unduhCsv([['No. Registrasi', 'Nama', 'Jenjang', 'Bagian', 'Kategori', 'Tahap', 'Komponen', 'Jenis', 'Nilai', 'Keterangan', 'Total hemat santri', 'Diatur oleh'],
      ...data.flatMap(r => r.list.map(k => [r.no_registrasi, r.nama_lengkap, r.jenjang, bagL(r.bagian), DU.KATEGORI_KERINGANAN[k.kategori], DU.NAMA_TAHAP[k.tahap], k.komponen || 'Seluruh tagihan', k.jenis, k.nilai, k.keterangan, r.potongan, k.nama_pembuat || '']))], 'Keringanan'); toast('Diekspor.'); };
  }

  /* ---------- Detail keuangan santri ---------- */
  async function kuitansiDari(idBayar, idSantri) {
    const [{ data: K, error }, peng] = await Promise.all([sb.rpc('keuangan_detail', { p_id: idSantri }), muatPengaturan()]);
    if (error) return toast(galat(error), 'err');
    const x = K.pembayaran.find(b => b.id === idBayar); if (!x) return;
    const { data: rek } = x.rekening_id ? await sb.from('rekening').select('bank,nomor_rekening').eq('id', x.rekening_id).maybeSingle() : { data: null };
    const opsi = DU.kuitansiUmum({ p: K.pendaftar, x: { ...x, rekening: rek ? `${rek.bank} ${rek.nomor_rekening}` : '' }, r: K.tagihan[x.tahap], peng,
      judul: x.tahap === 'daftar_ulang' ? 'Kuitansi Pembayaran Daftar Ulang' : 'Kuitansi Pembayaran' });
    await pilihCetak('Kuitansi', pdf => cetakAtauPdf(opsi, `Kuitansi ${x.nomor_kuitansi.replace(/\//g, '-')}.pdf`, pdf));
  }

  async function halDetail(k, api, id) {
    let K;
    const muat = async () => { const { data, error } = await sb.rpc('keuangan_detail', { p_id: id }); if (error) throw error; K = data; };
    try { await muat(); } catch (e) { k.innerHTML = `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(galat(e))}</div></div>`; return; }
    const { data: rincian } = await sb.from('rincian_biaya').select('id,komponen,tahap,nominal,jenjang,bagian,gelombang_id,wajib').eq('tampil', true).is('diarsipkan_pada', null).order('urutan');
    const { data: rekening } = await sb.from('rekening').select('id,bank,nomor_rekening,peruntukan').eq('tampil', true).is('diarsipkan_pada', null).order('urutan');
    const render = () => {
      const p = K.pendaftar, th = ['pendaftaran', 'daftar_ulang', 'tahunan', 'bulanan', 'lainnya'].filter(t => K.tahap_ditagih.includes(t) && K.tagihan[t]?.kotor || +K.tagihan[t]?.dibayar);
      const tot = th.reduce((a, t) => a + (K.tahap_ditagih.includes(t) ? +K.tagihan[t].bayar : 0), 0), dib = th.reduce((a, t) => a + +K.tagihan[t].dibayar, 0);
      const [sl, st, sic] = statusBayar(tot, dib);
      k.innerHTML = `
        <div class="page-head"><a class="btn sm ghost" href="#/keuangan?tab=tagihan"><i class="ph-duotone ph-arrow-left"></i>Kembali</a><div class="spacer"></div>
          ${['lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai'].includes(p.status) ? `<a class="btn sm ghost" href="#/daftarulang/${p.id}"><i class="ph-duotone ph-clipboard-text" style="color:var(--c5)"></i>Daftar ulang</a>` : ''}
          ${K.boleh_keringanan ? '<button class="btn sm ghost" id="dKer"><i class="ph-duotone ph-hand-heart" style="color:var(--c4)"></i>Tambah keringanan</button>' : ''}
          <button class="btn sm" id="dBayar"><i class="ph-duotone ph-plus-circle"></i>Catat pembayaran</button></div>
        <div class="card du-status-kartu" style="--tone:${st}"><div class="pg-status-kepala"><span class="ic-box"><i class="ph-duotone ${sic}"></i></span>
          <div><small>${esc(p.no_registrasi)} · ${p.jenjang} ${bagL(p.bagian)} · ${esc(p.gelombang)}</small><h3>${esc(p.nama_lengkap)}</h3><span>${pill(sl, st, sic)}</span></div><div class="spacer"></div>
          <div class="k-angka"><div><small>Harus bayar</small><b>${rp(tot)}</b></div><div><small>Masuk</small><b style="color:var(--ok)">${rp(dib)}</b></div><div><small>Sisa</small><b style="color:${tot > dib ? 'var(--danger)' : 'inherit'}">${rp(Math.max(0, tot - dib))}</b></div></div></div></div>
        <div class="du-kisi">
          <div>${th.length ? th.map(t => `<div class="card"><h3 class="du-h">${pill(DU.NAMA_TAHAP[t], TONE_TAHAP[t])}${K.tahap_ditagih.includes(t) ? '' : ' <small class="muted">tidak ditagihkan untuk status ini</small>'}</h3>
              <div class="bayar-rincian du-bayar">${DU.rincianHTML(K.tagihan[t])}</div></div>`).join('') : '<div class="card"><div class="empty"><i class="ph-duotone ph-receipt"></i><b>Belum ada tagihan</b></div></div>'}
            <div class="card"><h3 class="du-h"><i class="ph-duotone ph-hand-heart" style="color:var(--c4)"></i>Keringanan</h3>
              <ul class="du-berkas">${K.keringanan.length ? K.keringanan.map(x => `<li><span class="ic-box kecil" style="--tone:var(--c4)"><i class="ph-duotone ph-tag"></i></span>
                <div><b>${esc(DU.KATEGORI_KERINGANAN[x.kategori] || x.kategori)} · ${x.jenis === 'persen' ? (+x.nilai) + '%' : rp(x.nilai)}</b><small>${DU.NAMA_TAHAP[x.tahap]} · ${x.komponen ? esc(x.komponen) : 'seluruh tagihan tahap'}${x.keterangan ? ' · ' + esc(x.keterangan) : ''} · oleh ${esc(x.nama_pembuat || '–')}</small></div>
                ${K.boleh_keringanan ? `<button class="icon-btn plain" data-ubah-k="${x.id}" aria-label="Ubah"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i></button><button class="icon-btn plain" data-hapus-k="${x.id}" aria-label="Hapus"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>` : ''}</li>`).join('')
                : `<li class="muted">Tidak ada keringanan.${K.boleh_keringanan ? '' : ' Keringanan diatur Superadmin.'}</li>`}</ul></div></div>
          <div><div class="card"><h3 class="du-h"><i class="ph-duotone ph-receipt" style="color:var(--ok)"></i>Riwayat pembayaran</h3>
            <ul class="du-berkas">${K.pembayaran.length ? K.pembayaran.map(x => `<li style="${x.dibatalkan_pada ? 'opacity:.55' : ''}"><span class="ic-box kecil" style="--tone:${TONE_TAHAP[x.tahap]}"><i class="ph-duotone ${x.metode === 'tunai' ? 'ph-money' : 'ph-bank'}"></i></span>
              <div><b>${rp(x.nominal)} · ${DU.NAMA_TAHAP[x.tahap]}${x.komponen ? ' · ' + esc(x.komponen) : ''}</b><small>${fmt.tgl(new Date(x.tanggal + 'T00:00:00'))} · ${x.metode === 'tunai' ? 'tunai' : 'transfer'}${x.nomor_kuitansi ? ' · ' + esc(x.nomor_kuitansi) : ''}${x.sumber !== 'manual' ? ' · otomatis' : ''}${x.nama_pencatat ? ' · ' + esc(x.nama_pencatat) : ''}${x.dibatalkan_pada ? ` · <b style="color:var(--danger)">dibatalkan: ${esc(x.alasan_batal || '')}</b>` : ''}</small></div>
              ${x.nomor_kuitansi && !x.dibatalkan_pada ? `<button class="icon-btn plain" data-kwt="${x.id}" title="Kuitansi" aria-label="Kuitansi"><i class="ph-duotone ph-receipt" style="color:var(--ok)"></i></button>` : ''}</li>`).join('') : '<li class="muted">Belum ada pembayaran.</li>'}</ul></div></div>
        </div>`;
      pasang();
    };
    const muatUlang = async () => { try { await muat(); render(); } catch (e) { toast(galat(e), 'err'); } };
    const komponenUntuk = t => (rincian || []).filter(b => b.tahap === t && b.wajib && (b.jenjang === 'semua' || b.jenjang === K.pendaftar.jenjang) && (b.bagian === 'semua' || b.bagian === K.pendaftar.bagian));
    function formKeringanan(x = {}) {
      return dialog({ judul: x.id ? 'Ubah keringanan' : 'Tambah keringanan', ikon: 'ph-hand-heart', tone: 'var(--c4)', lebar: true,
        isi: `<div class="grid-form">
            <div class="field"><label>Tahap biaya</label><select class="select" id="kTahap">${Object.entries(DU.NAMA_TAHAP).map(([v, l]) => `<option value="${v}" ${(x.tahap || 'daftar_ulang') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label>Berlaku untuk</label><select class="select" id="kKomp"></select></div>
            <div class="field"><span class="label">Bentuk potongan</span><div class="chips-select"><label><input type="radio" name="kJenis" value="persen" ${x.jenis !== 'nominal' ? 'checked' : ''}>Persen (%)</label><label><input type="radio" name="kJenis" value="nominal" ${x.jenis === 'nominal' ? 'checked' : ''}>Nominal (Rp)</label></div></div>
            <div class="field"><label>Besar potongan <span class="req">*</span></label><input class="input" id="kNilai" inputmode="decimal" value="${x.nilai ? (x.jenis === 'nominal' ? fmt.angka(+x.nilai) : +x.nilai) : ''}" placeholder="Misalnya 20 atau 500.000"><small class="bantu" id="kPratinjau"></small></div>
            <div class="field"><label>Alasan / kategori</label><select class="select" id="kKat">${Object.entries(DU.KATEGORI_KERINGANAN).map(([v, l]) => `<option value="${v}" ${x.kategori === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label>Keterangan</label><input class="input" id="kKet" maxlength="200" value="${esc(x.keterangan || '')}" placeholder="Misalnya: adik dari santri kelas 8 / SKTM desa / rekomendasi pimpinan"></div>
          </div><p class="muted kecil" style="margin:6px 0 0">Wali melihat tagihan setelah keringanan di halaman daftar ulang. Keterangan hanya terlihat oleh panitia.</p>`,
        saatBuka: root => {
          const isiKomp = () => { const t = root.querySelector('#kTahap').value; root.querySelector('#kKomp').innerHTML = `<option value="">Seluruh tagihan tahap ini</option>${komponenUntuk(t).map(b => `<option value="${b.id}" ${+x.komponen_id === b.id ? 'selected' : ''}>${esc(b.komponen)} (${rp(b.nominal)})</option>`).join('')}`; pratinjau(); };
          const pratinjau = () => {
            const jenis = root.querySelector('[name=kJenis]:checked').value, raw = root.querySelector('#kNilai').value, n = jenis === 'persen' ? parseFloat(raw.replace(',', '.')) || 0 : angkaDari(raw);
            const b = (rincian || []).find(r => r.id === +root.querySelector('#kKomp').value);
            root.querySelector('#kPratinjau').innerHTML = !n ? '' : jenis === 'persen' ? (b ? `Potongan ${rp(Math.round(b.nominal * n / 100))} dari ${esc(b.komponen)}` : `Potongan ${n}% dari sisa tagihan tahap`) : `Potongan ${rp(n)}`;
          };
          root.querySelector('#kTahap').onchange = isiKomp; root.querySelector('#kKomp').onchange = pratinjau; root.querySelector('#kNilai').oninput = pratinjau;
          root.querySelectorAll('[name=kJenis]').forEach(r => r.onchange = pratinjau); isiKomp();
        },
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
          const jenis = root.querySelector('[name=kJenis]:checked').value, raw = root.querySelector('#kNilai').value;
          const nilai = jenis === 'persen' ? parseFloat(raw.replace(',', '.')) : angkaDari(raw);
          if (!(nilai > 0) || (jenis === 'persen' && nilai > 100)) { toast(jenis === 'persen' ? 'Isi persen 1–100.' : 'Isi nominal potongan.', 'warn'); return false; }
          const kp = root.querySelector('#kKomp').value;
          const { error } = await sb.rpc('atur_keringanan', { p_id: id, p_tahap: root.querySelector('#kTahap').value, p_komponen: kp ? +kp : null, p_jenis: jenis, p_nilai: nilai,
            p_kategori: root.querySelector('#kKat').value, p_keterangan: root.querySelector('#kKet').value, p_ubah: x.id || null });
          if (error) throw new Error(galat(error)); return true; } }] });
    }
    const pasang = () => {
      $('#dKer')?.addEventListener('click', async () => { if (await formKeringanan()) { toast('Keringanan disimpan.'); await muatUlang(); } });
      k.querySelectorAll('[data-ubah-k]').forEach(b => b.onclick = async () => { if (await formKeringanan(K.keringanan.find(x => x.id === +b.dataset.ubahK))) { toast('Keringanan diperbarui.'); await muatUlang(); } });
      k.querySelectorAll('[data-hapus-k]').forEach(b => b.onclick = async () => {
        if (!(await konfirmasi('Hapus keringanan?', 'Tagihan santri kembali dihitung tanpa keringanan ini. Daftar ulang yang sudah selesai tidak berubah.', 'Hapus', true))) return;
        const { error } = await sb.rpc('hapus_keringanan', { p_id: +b.dataset.hapusK }); if (error) return toast(galat(error), 'err');
        toast('Keringanan dihapus.'); await muatUlang(); });
      k.querySelectorAll('[data-kwt]').forEach(b => b.onclick = () => kuitansiDari(+b.dataset.kwt, id));
      $('#dBayar').onclick = async () => {
        const sisaT = t => K.tahap_ditagih.includes(t) ? Math.max(0, +K.tagihan[t]?.bayar - +K.tagihan[t]?.dibayar) : 0;
        const awalT = ['daftar_ulang', 'tahunan', 'pendaftaran'].find(t => K.tahap_ditagih.includes(t) && sisaT(t) > 0) || 'bulanan';
        const v = await dialog({ judul: 'Catat pembayaran', ikon: 'ph-plus-circle', tone: 'var(--ok)', lebar: true,
          isi: `<div class="grid-form">
              <div class="field"><label>Tahap</label><select class="select" id="bTahap">${Object.entries(DU.NAMA_TAHAP).map(([v, l]) => `<option value="${v}" ${v === awalT ? 'selected' : ''}>${l}${K.tahap_ditagih.includes(v) && sisaT(v) ? ` · sisa ${rp(sisaT(v))}` : ''}</option>`).join('')}</select></div>
              <div class="field"><label>Keterangan pembayaran</label><input class="input" id="bKomp" maxlength="80" list="bKompDaftar" placeholder="Misalnya: Pelunasan uang pangkal / SPP Agustus 2027"><datalist id="bKompDaftar"></datalist></div>
              <div class="field"><label>Nominal <span class="req">*</span></label><div class="isian-satuan pra"><span>Rp</span><input class="input" id="bNom" inputmode="numeric"></div></div>
              <div class="field"><label>Tanggal <span class="req">*</span></label><input class="input" type="date" id="bTgl" data-default-today max="${fmt.isoTgl()}"></div>
              <div class="field"><span class="label">Cara bayar</span><div class="chips-select"><label><input type="radio" name="bMet" value="transfer" checked>Transfer</label><label><input type="radio" name="bMet" value="tunai">Tunai</label></div></div>
              <div class="field"><label>Rekening tujuan (transfer)</label><select class="select" id="bRek"><option value="">— Tidak dicatat —</option>${(rekening || []).map(r => `<option value="${r.id}">${esc(r.bank)} ${esc(r.nomor_rekening)}</option>`).join('')}</select></div>
              <div class="field"><label>Nama penyetor</label><input class="input" id="bPen" maxlength="100" value="${esc(K.pendaftar.nama_ayah || '')}"></div>
              <div class="field"><label>Catatan (tampil di kuitansi)</label><input class="input" id="bKet" maxlength="200"></div>
            </div>`,
          saatBuka: root => {
            window.SPMB.isiTanggalBawaan(root);
            const isi = () => { const t = root.querySelector('#bTahap').value; root.querySelector('#bNom').value = sisaT(t) ? fmt.angka(sisaT(t)) : '';
              root.querySelector('#bKompDaftar').innerHTML = komponenUntuk(t).map(b => `<option value="${esc(b.komponen)}">`).join('') + (t === 'bulanan' ? '<option value="SPP bulan ">' : ''); };
            root.querySelector('#bTahap').onchange = isi; root.querySelector('#bNom').onchange = e => { e.target.value = fmt.angka(angkaDari(e.target.value)); }; isi();
          },
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Simpan dan buat kuitansi', ikon: 'ph-receipt', aksi: async root => {
            const nominal = angkaDari(root.querySelector('#bNom').value); if (!nominal) { toast('Isi nominal.', 'warn'); return false; }
            const { data, error } = await sb.rpc('catat_pembayaran', { p_id: id, p_tahap: root.querySelector('#bTahap').value, p_komponen: root.querySelector('#bKomp').value, p_nominal: nominal,
              p_tanggal: root.querySelector('#bTgl').value, p_metode: root.querySelector('[name=bMet]:checked').value, p_rekening: root.querySelector('#bRek').value ? +root.querySelector('#bRek').value : null,
              p_penyetor: root.querySelector('#bPen').value, p_keterangan: root.querySelector('#bKet').value });
            if (error) throw new Error(galat(error)); return data; } }] });
        if (!v) return;
        toast(`Pembayaran tercatat. Kuitansi ${v.nomor_kuitansi}.`, 'ok', 6000);
        await muatUlang(); await kuitansiDari(v.id, id);
      };
    };
    render();
  }
})();
