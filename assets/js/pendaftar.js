/* =====================================================================
   MENU PENDAFTAR DAN VERIFIKASI (Fase 3 · Langkah 5) · Admin dan Superadmin
   - Daftar pendaftar: cari, saring, statistik langsung, cetak, unduh CSV
   - Detail (#/pendaftar/<id>): verifikasi berkas dan pembayaran, ubah data,
     kelola berkas (lihat, unggah, ganti, hapus, terima/tolak), ubah status,
     WhatsApp dari templat, riwayat, Bukti Pendaftaran PDF, batalkan, hapus
   Dimuat sesudah spmb.js; dashboard memanggil SPMB_MODUL.pendaftar().
   ===================================================================== */
(function () {
  'use strict';
  const { sb, CFG, fmt, esc, toast, dialog, konfirmasi, pesanGalat, cetakDokumen, unduhPdfDokumen, dokumenBukti, muatPengaturan,
          lihatBerkasPendaftar, hapusBerkasPendaftar, unggahBerkasAdmin, ambilBuktiPdf, simpanPdf, nomorWA } = window.SPMB;
  const $ = (s, r = document) => r.querySelector(s);
  const UI = window.SPMB_UI;

  /* ---------- Label dan warna ---------- */
  const STATUS = {
    terdaftar: ['Terdaftar', 'var(--c1)', 'ph-note-pencil'],
    berkas_kurang: ['Berkas kurang', 'var(--c3)', 'ph-file-x'],
    berkas_diverifikasi: ['Berkas terverifikasi', 'var(--c5)', 'ph-files'],
    pembayaran_dikonfirmasi: ['Terverifikasi lengkap', 'var(--ok)', 'ph-seal-check'],
    ikut_tes: ['Ikut tes', 'var(--c2)', 'ph-exam'],
    nilai_divalidasi: ['Nilai divalidasi', 'var(--c2)', 'ph-list-checks'],
    lulus: ['Lulus', 'var(--ok)', 'ph-confetti'],
    cadangan: ['Cadangan', 'var(--c6)', 'ph-hourglass-medium'],
    tidak_lulus: ['Tidak lulus', 'var(--c8)', 'ph-hand-heart'],
    daftar_ulang_menunggu: ['Menunggu daftar ulang', 'var(--c3)', 'ph-clipboard-text'],
    daftar_ulang_selesai: ['Daftar ulang selesai', 'var(--ok)', 'ph-graduation-cap'],
    mengundurkan_diri: ['Mengundurkan diri', 'var(--c8)', 'ph-sign-out'],
    dibatalkan: ['Dibatalkan', 'var(--danger)', 'ph-prohibit']
  };
  const VERIF = { menunggu: ['Menunggu', 'var(--c6)'], diterima: ['Diterima', 'var(--ok)'], perbaikan: ['Perlu perbaikan', 'var(--c3)'], ditolak: ['Ditolak', 'var(--danger)'] };
  const IKON_WA = { diterima: ['ph-check-circle', 'var(--ok)'], berkas_kurang: ['ph-file-x', 'var(--c7)'], bayar_ok: ['ph-credit-card', 'var(--c5)'],
    jadwal_tes: ['ph-calendar-check', 'var(--c2)'], pengingat_tes: ['ph-alarm', 'var(--c3)'], lulus: ['ph-confetti', 'var(--ok)'], cadangan: ['ph-hourglass-medium', 'var(--c6)'],
    tidak_lulus: ['ph-hand-heart', 'var(--c8)'], undangan_du: ['ph-envelope-open', 'var(--c1)'], du_selesai: ['ph-graduation-cap', 'var(--c4)'] };
  const TAHAP_VERIF = ['terdaftar', 'berkas_kurang', 'berkas_diverifikasi'];
  const HUBUNGAN = ['Ayah', 'Ibu', 'Kakak', 'Paman', 'Bibi', 'Kakek', 'Nenek', 'Wali', 'Lainnya'];
  const POLA_NAMA = /^[\p{L} .,'`’-]{3,100}$/u;

  const pill = ([l, t], ic) => `<span class="pill" style="--tone:${t}">${ic ? `<i class="ph-duotone ${ic}"></i>` : ''}${esc(l)}</span>`;
  const pillStatus = s => pill(STATUS[s] || [s, 'var(--c8)'], (STATUS[s] || [])[2]);
  const pillVerif = v => pill(VERIF[v] || [v, 'var(--c8)']);
  const bagianL = b => b === 'putra' ? 'Putra' : b === 'putri' ? 'Putri' : b;
  const wita = ts => { if (!ts) return { tgl: '', jam: '' }; const s = new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Makassar' }); return { tgl: s.slice(0, 10), jam: s.slice(11, 16) }; };
  const tglIso = iso => iso ? fmt.tgl(new Date(iso + 'T00:00:00')) : '–';
  const tglPanjangIso = iso => iso ? fmt.tglPanjang(new Date(iso + 'T00:00:00')) : '–';
  const tsId = ts => { const w = wita(ts); return w.tgl ? `${tglIso(w.tgl)} ${w.jam.replace(':', '.')}` : '–'; };
  const ukuran = n => n ? (n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB') : '';
  const alamatSitus = () => (CFG.alamatSitus || location.href.replace(/\/[^/]*$/, '')).replace(/\/$/, '');
  const teksHafalan = p => +p.hafalan_juz >= 1 ? `${String(+p.hafalan_juz).replace('.', ',')} juz` : +p.hafalan_surah > 0 ? `${p.hafalan_surah} surah pendek` : 'Belum ada';
  const galatDB = err => {
    const m = String(err?.message || err || '');
    if (/pendaftar_nisn_unik/.test(m)) return 'NISN ini sudah dipakai pendaftaran lain yang masih aktif.';
    if (/pendaftar_nik_unik/.test(m)) return 'NIK ini sudah dipakai pendaftaran lain yang masih aktif.';
    if (/violates check constraint.*(nisn|nik|rt|rw|kode_pos|npsn|no_wa|darurat_no|hafalan)/i.test(m)) return 'Ada isian dengan format yang tidak sesuai. Periksa kembali angka NISN, NIK, RT/RW, kode pos, NPSN, atau nomor WhatsApp.';
    return pesanGalat(err);
  };

  window.SPMB_MODUL = window.SPMB_MODUL || {};
  window.SPMB_MODUL.pendaftar = (k, api) => api.param ? halDetail(k, api, api.param) : halDaftar(k, api);

  /* =================================================================
     DAFTAR PENDAFTAR
     ================================================================= */
  const SARING = { q: '', gel: '', jb: '', st: '', uji: false, hal: 0 };   // bertahan saat kembali dari detail
  const PER_HAL = 25;

  async function halDaftar(k, api) {
    const { S, setFab } = api;
    // Saringan dari tautan (mis. kartu statistik di Beranda): #/pendaftar?st=@berkas&uji=1&gel=2
    const qs = new URLSearchParams(location.hash.split('?')[1] || '');
    if ([...qs.keys()].length) {
      Object.assign(SARING, { st: qs.get('st') || '', uji: qs.get('uji') === '1', gel: qs.get('gel') || '', q: '', jb: '', hal: 0 });
      history.replaceState(null, '', '#/pendaftar');
    }
    const { data: gels } = await sb.from('gelombang').select('id,nama,urutan').is('diarsipkan_pada', null).order('urutan');
    const opsiStatus = `<option value="">Semua status</option>
      <optgroup label="Perlu tindakan"><option value="@berkas">Menunggu verifikasi berkas</option><option value="@bayar">Menunggu verifikasi pembayaran</option></optgroup>
      <optgroup label="Status">${Object.entries(STATUS).map(([v, [l]]) => `<option value="${v}">${l}</option>`).join('')}</optgroup>
      <option value="@hari">Mendaftar hari ini</option>`;
    k.innerHTML = `
      <div class="stats stats-pendaftar" id="statP"></div>
      <div class="page-head saring-pendaftar">
        <div class="field cari-besar" style="margin:0"><i class="ph-duotone ph-magnifying-glass"></i><input class="input" id="cari" type="search" placeholder="Cari nama, nomor registrasi, NISN, NIK, atau WhatsApp…" value="${esc(SARING.q)}"></div>
        <select class="select" id="fGel" aria-label="Gelombang"><option value="">Semua gelombang</option>${(gels || []).map(g => `<option value="${g.id}">${esc(g.nama)}</option>`).join('')}</select>
        <select class="select" id="fJB" aria-label="Jenjang"><option value="">SMP dan SMA</option>${['SMP putra', 'SMP putri', 'SMA putra', 'SMA putri'].map(x => `<option value="${x}">${x.replace('putra', 'Putra').replace('putri', 'Putri')}</option>`).join('')}</select>
        <select class="select" id="fSt" aria-label="Status">${opsiStatus}</select>
        <label class="check uji-saklar"><input type="checkbox" id="fUji" ${SARING.uji ? 'checked' : ''}>Data uji</label>
      </div>
      <div class="bilah-aksi">
        <span class="muted" id="infoJumlah"></span><div class="spacer"></div>
        <button class="btn sm ghost" id="btnSegarkan" title="Muat ulang"><i class="ph-duotone ph-arrows-clockwise" style="color:var(--c5)"></i><span class="hide-sm">Muat ulang</span></button>
        <button class="btn sm ghost" id="btnCsv"><i class="ph-duotone ph-file-csv" style="color:var(--ok)"></i>Unduh Excel</button>
        <button class="btn sm ghost" id="btnCetak"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Cetak daftar</button>
        <button class="btn sm ghost" id="btnPdf"><i class="ph-duotone ph-file-pdf" style="color:var(--c7)"></i>PDF</button>
        <a class="btn sm" id="btnTambah" href="daftar.html" target="_blank" rel="noopener"><i class="ph-duotone ph-user-plus"></i>Tambah pendaftar</a>
      </div>
      <div class="table-wrap"><table class="tbl tbl-pendaftar"><thead><tr>
        <th>Pendaftar</th><th class="hide-sm">Jenjang</th><th class="hide-sm">Asal</th><th class="c">Berkas</th><th class="c">Bayar</th><th>Status</th><th class="hide-sm">Tanggal daftar</th>
      </tr></thead><tbody id="tbP"><tr><td colspan="7"><span class="spinner"></span> Memuat…</td></tr></tbody></table></div>
      <div class="halaman-nav" id="navHal"></div>
      <p class="muted" style="font-size:12.5px;margin-top:10px"><i class="ph-duotone ph-info"></i> Klik baris untuk membuka detail, verifikasi, dan mengubah data. <b>Tambah pendaftar</b> membuka formulir pendaftaran; sebagai panitia Anda dapat menyimpan data sungguhan dengan berkas menyusul.</p>`;
    $('#fGel').value = SARING.gel; $('#fJB').value = SARING.jb; $('#fSt').value = SARING.st;
    setFab(() => window.open('daftar.html', '_blank'), 'ph-user-plus', 'Tambah pendaftar');

    // Statistik langsung (kartu dapat diklik untuk menyaring)
    const muatStat = async () => {
      const { data, error } = await sb.rpc('statistik_dashboard', { p_gelombang: SARING.gel ? +SARING.gel : null, p_uji: SARING.uji });
      const el = $('#statP'); if (!el || error) return;
      const kartu = [
        ['', 'Total pendaftar', data.total, 'ph-users-three', 'var(--c1)'],
        ['@hari', 'Hari ini', data.hari_ini, 'ph-calendar-plus', 'var(--c2)'],
        ['@berkas', 'Menunggu cek berkas', data.menunggu_berkas, 'ph-file-magnifying-glass', 'var(--c6)'],
        ['@bayar', 'Menunggu cek bayar', data.menunggu_bayar, 'ph-receipt', 'var(--c3)'],
        ['berkas_kurang', 'Berkas kurang', data.berkas_kurang, 'ph-file-x', 'var(--c7)'],
        ['pembayaran_dikonfirmasi', 'Terverifikasi lengkap', data.terverifikasi, 'ph-seal-check', 'var(--ok)']
      ];
      el.innerHTML = kartu.map(([f, l, n, ic, t]) => `<button type="button" class="stat${SARING.st === f && f ? ' dipilih' : ''}" data-st="${f}" style="--tone:${t}"><span class="live">LIVE</span>
        <div class="ic-box"><i class="ph-duotone ${ic}"></i></div><b>${fmt.angka(n)}</b><span>${l}</span></button>`).join('');
    };
    $('#statP').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; SARING.st = SARING.st === b.dataset.st ? '' : b.dataset.st; $('#fSt').value = SARING.st; SARING.hal = 0; muat(); muatStat(); });

    const terapkanSaring = (q, lengkap = false) => {
      if (SARING.gel) q = q.eq('gelombang_id', +SARING.gel);
      if (SARING.jb) { const [j, b] = SARING.jb.split(' '); q = q.eq('jenjang', j).eq('bagian', b); }
      const st = SARING.st;
      if (st === '@berkas') q = q.eq('verif_berkas', 'menunggu').in('status', TAHAP_VERIF);
      else if (st === '@bayar') q = q.eq('verif_bayar', 'menunggu').in('status', TAHAP_VERIF);
      else if (st === '@hari') q = q.gte('dibuat_pada', new Date(`${wita(new Date()).tgl}T00:00:00+08:00`).toISOString());
      else if (st) q = q.eq('status', st);
      else if (!lengkap) q = q.neq('status', 'dibatalkan');
      const cari = SARING.q.replace(/[,()*%\\]/g, ' ').trim();
      if (cari) q = q.or(['nama_lengkap', 'no_registrasi', 'nisn', 'nik', 'no_wa', 'asal_sekolah'].map(c => `${c}.ilike.*${cari}*`).join(','));
      return q;
    };
    let baris = [];
    async function muat() {
      const tb = $('#tbP'); if (!tb) return;
      let q = sb.from('pendaftar').select('id,no_registrasi,nama_lengkap,nisn,jenjang,bagian,asal_kabupaten,asal_provinsi,no_wa,verif_berkas,verif_bayar,status,dibuat_pada,uji,peringatan', { count: 'exact' })
        .eq('uji', SARING.uji);
      q = terapkanSaring(q).order('dibuat_pada', { ascending: false }).range(SARING.hal * PER_HAL, SARING.hal * PER_HAL + PER_HAL - 1);
      const { data, error, count } = await q;
      if (error) { tb.innerHTML = `<tr><td colspan="7"><div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(pesanGalat(error))}</div></div></td></tr>`; return; }
      baris = data || [];
      tb.innerHTML = baris.length ? baris.map(p => `
        <tr class="bisa-klik" data-id="${p.id}" tabindex="0">
          <td><div class="who"><div class="avatar" style="background:${p.bagian === 'putri' ? 'var(--c4)' : 'var(--c1)'}">${esc(SPMB.inisial(p.nama_lengkap))}</div>
            <div><b>${esc(p.nama_lengkap)}${(p.peringatan || []).length ? ' <i class="ph-duotone ph-warning" style="color:var(--c6)" title="Ada peringatan data"></i>' : ''}</b>
            <span class="mono">${esc(p.no_registrasi)}</span><span class="show-sm">${esc(p.jenjang)} ${bagianL(p.bagian)} · ${esc(p.asal_kabupaten || '')}</span></div></div></td>
          <td class="hide-sm">${esc(p.jenjang)} ${bagianL(p.bagian)}</td>
          <td class="hide-sm">${esc(p.asal_kabupaten || '–')}<br><span class="muted" style="font-size:12px">${esc(p.asal_provinsi || '')}</span></td>
          <td class="c">${pillVerif(p.verif_berkas)}</td><td class="c">${pillVerif(p.verif_bayar)}</td>
          <td>${pillStatus(p.status)}</td>
          <td class="hide-sm" style="white-space:nowrap">${tsId(p.dibuat_pada)}</td>
        </tr>`).join('')
        : `<tr><td colspan="7"><div class="empty"><i class="ph-duotone ph-identification-card"></i><b>${SARING.q || SARING.st || SARING.gel || SARING.jb ? 'Tidak ada pendaftar yang cocok' : SARING.uji ? 'Belum ada data uji' : 'Belum ada pendaftar'}</b></div></td></tr>`;
      const total = count || 0, halMaks = Math.max(0, Math.ceil(total / PER_HAL) - 1);
      $('#infoJumlah').textContent = total ? `${fmt.angka(total)} pendaftar${SARING.uji ? ' uji coba' : ''} · menampilkan ${SARING.hal * PER_HAL + 1}–${SARING.hal * PER_HAL + baris.length}` : '';
      $('#navHal').innerHTML = total > PER_HAL ? `<button class="btn sm ghost" data-hal="-1" ${SARING.hal ? '' : 'disabled'}><i class="ph-duotone ph-caret-left"></i>Sebelumnya</button>
        <span class="muted">Halaman ${SARING.hal + 1} dari ${halMaks + 1}</span>
        <button class="btn sm ghost" data-hal="1" ${SARING.hal < halMaks ? '' : 'disabled'}>Berikutnya<i class="ph-duotone ph-caret-right"></i></button>` : '';
    }
    window.SPMB_MODUL.pendaftar.segarkan = () => { if (document.body.contains($('#tbP'))) { muat(); muatStat(); } };

    let tunda;
    $('#cari').oninput = e => { clearTimeout(tunda); tunda = setTimeout(() => { SARING.q = e.target.value; SARING.hal = 0; muat(); }, 300); };
    $('#fGel').onchange = e => { SARING.gel = e.target.value; SARING.hal = 0; muat(); muatStat(); };
    $('#fJB').onchange = e => { SARING.jb = e.target.value; SARING.hal = 0; muat(); };
    $('#fSt').onchange = e => { SARING.st = e.target.value; SARING.hal = 0; muat(); muatStat(); };
    $('#fUji').onchange = e => { SARING.uji = e.target.checked; SARING.hal = 0; muat(); muatStat(); };
    $('#navHal').onclick = e => { const b = e.target.closest('[data-hal]'); if (b) { SARING.hal += +b.dataset.hal; muat(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
    $('#btnSegarkan').onclick = () => { muat(); muatStat(); toast('Data dimuat ulang.', 'info'); };
    const buka = e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = `#/pendaftar/${tr.dataset.id}`; };
    $('#tbP').addEventListener('click', buka);
    $('#tbP').addEventListener('keydown', e => { if (e.key === 'Enter') buka(e); });

    // Semua baris sesuai saringan (untuk cetak dan unduh)
    const ambilSemua = async (kolom = '*') => {
      let q = sb.from('pendaftar').select(kolom).eq('uji', SARING.uji);
      const { data, error } = await terapkanSaring(q).order('jenjang').order('bagian').order('no_registrasi').limit(2000);
      if (error) throw error; return data || [];
    };
    const judulSaring = () => [SARING.gel ? $('#fGel').selectedOptions[0].text : 'Semua gelombang', SARING.jb ? $('#fJB').selectedOptions[0].text : 'SMP dan SMA',
      SARING.st ? $('#fSt').selectedOptions[0].text : 'Semua status aktif', SARING.uji ? 'Data uji coba' : ''].filter(Boolean).join(' · ');

    const opsiDaftar = async () => {
        const data = await ambilSemua('no_registrasi,nama_lengkap,jenjang,bagian,asal_kabupaten,asal_sekolah,no_wa,status');
        if (!data.length) { toast('Tidak ada data untuk dicetak.', 'warn'); return null; }
        const kp = S.pengaturan.ketua_panitia || {};
        return ({
          judul: 'Daftar Calon Santri Baru', nomor: '',
          meta: `Tahun Ajaran ${esc(S.pengaturan.identitas?.tahun_ajaran || '')} · ${esc(judulSaring())} · Jumlah: ${fmt.angka(data.length)} orang`,
          isi: `<table><colgroup><col style="width:5%"><col style="width:17%"><col style="width:24%"><col style="width:10%"><col style="width:16%"><col style="width:13%"><col style="width:15%"></colgroup>
            <thead><tr><th>No</th><th>No. Registrasi</th><th>Nama Lengkap</th><th>Jenjang</th><th>Asal Daerah</th><th>WhatsApp</th><th>Status</th></tr></thead><tbody>
            ${data.map((p, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(p.no_registrasi)}</td><td>${esc(p.nama_lengkap)}</td><td>${esc(p.jenjang)} ${bagianL(p.bagian)}</td>
              <td>${esc(p.asal_kabupaten || '–')}</td><td>+${esc(p.no_wa)}</td><td>${esc((STATUS[p.status] || [p.status])[0])}</td></tr>`).join('')}</tbody></table>`,
          ttd: [{ jabatan: 'Ketua Panitia SPMB,', nama: kp.nama, nip: kp.niy ? 'NIY. ' + kp.niy : '' }]
        });
    };
    $('#btnCetak').onclick = async () => { try { const o = await opsiDaftar(); if (o) cetakDokumen(o); } catch (err) { toast(pesanGalat(err), 'err'); } };
    $('#btnPdf').onclick = async e => {
      const b = e.currentTarget; b.disabled = true;
      try { const o = await opsiDaftar(); if (o) { await unduhPdfDokumen(o, `Daftar Calon Santri ${fmt.tgl(new Date()).replace(/\//g, '-')}.pdf`); toast('Daftar calon santri PDF diunduh.'); } }
      catch (err) { toast(pesanGalat(err), 'err'); } finally { b.disabled = false; }
    };
    $('#btnCsv').onclick = async () => {
      try {
        const data = await ambilSemua();
        if (!data.length) return toast('Tidak ada data untuk diunduh.', 'warn');
        const namaGel = Object.fromEntries((gels || []).map(g => [g.id, g.nama]));
        const kolom = [['No. Registrasi', 'no_registrasi'], ['Gelombang', p => namaGel[p.gelombang_id] || ''], ['Jenjang', 'jenjang'], ['Putra/Putri', p => bagianL(p.bagian)],
          ['Nama Lengkap', 'nama_lengkap'], ['NISN', p => `="${p.nisn}"`], ['NIK', p => `="${p.nik}"`], ['Tempat Lahir', 'tempat_lahir'], ['Tanggal Lahir', p => tglIso(p.tanggal_lahir)],
          ['Asal Provinsi', 'asal_provinsi'], ['Asal Kabupaten/Kota', 'asal_kabupaten'], ['Alamat', 'alamat_jalan'], ['Dusun', 'dusun'], ['RT', p => `="${p.rt || ''}"`], ['RW', p => `="${p.rw || ''}"`],
          ['Desa/Kelurahan', 'desa'], ['Kecamatan', 'kecamatan'], ['Kabupaten/Kota', 'kabupaten'], ['Provinsi', 'provinsi'], ['Kode Pos', 'kode_pos'], ['Sekolah Asal', 'asal_sekolah'], ['NPSN', 'npsn_sekolah'],
          ['Nama Ayah', 'nama_ayah'], ['Pekerjaan Ayah', 'pekerjaan_ayah'], ['Nama Ibu', 'nama_ibu'], ['Pekerjaan Ibu', 'pekerjaan_ibu'], ['Email', 'email'], ['WhatsApp', p => `="+${p.no_wa}"`],
          ['Kontak Darurat', 'darurat_nama'], ['Hubungan', 'darurat_hubungan'], ['No. Darurat', p => p.darurat_no ? `="+${p.darurat_no}"` : ''],
          ['Pernah Mondok', p => p.pernah_mondok ? 'Ya' : 'Tidak'], ['Pondok Sebelumnya', 'pondok_sebelumnya'], ['Lama Mondok', 'lama_mondok'], ['Hafalan', teksHafalan],
          ['Sumber Informasi', 'sumber_info'], ['Pemberi Rekomendasi', p => p.perekomendasi ? `${p.perekomendasi} (${p.perekomendasi_peran || ''})` : ''],
          ['Prestasi', p => (p.prestasi || []).map(x => `${x.nama} (${x.tingkat}, ${x.tahun})`).join('; ')],
          ['Verifikasi Berkas', p => (VERIF[p.verif_berkas] || [p.verif_berkas])[0]], ['Verifikasi Bayar', p => (VERIF[p.verif_bayar] || [p.verif_bayar])[0]],
          ['Status', p => (STATUS[p.status] || [p.status])[0]], ['Tanggal Daftar', p => tsId(p.dibuat_pada)], ['Catatan Panitia', 'catatan_admin']];
        const sel = v => { const x = String(v ?? ''); return /[;"\n]/.test(x) && !x.startsWith('="') ? `"${x.replace(/"/g, '""')}"` : x; };
        const csv = '﻿' + [kolom.map(c => c[0]).join(';'), ...data.map(p => kolom.map(([, f]) => sel(typeof f === 'function' ? f(p) : p[f])).join(';'))].join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: `Data Pendaftar SPMB ${fmt.tgl(new Date()).replace(/\//g, "-")}${SARING.uji ? ' (uji)' : ''}.csv` });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        toast(`${fmt.angka(data.length)} baris diunduh. Buka dengan Excel atau Google Sheets.`);
      } catch (err) { toast(pesanGalat(err), 'err'); }
    };

    await Promise.all([muat(), muatStat()]);
    S.statTimer = setInterval(muatStat, 30000);
  }

  /* =================================================================
     DETAIL PENDAFTAR
     ================================================================= */
  async function halDetail(k, api, id) {
    const { S, setFab } = api;
    const peran = S.profil.peran, isSuper = peran === 'superadmin';
    let P, B = [], G = null, gels = [];
    const cfg = S.pengaturan.spmb || {};
    const labelBerkas = Object.fromEntries((cfg.berkas || []).map(b => [b.kunci, b.label]));

    async function muatData() {
      const [p, b, g] = await Promise.all([
        sb.from('pendaftar').select('*').eq('id', id).maybeSingle(),
        sb.from('berkas_pendaftar').select('*').eq('pendaftar_id', id).order('id'),
        sb.from('gelombang').select('id,nama,tes_mulai,tes_selesai,pengumuman,urutan').order('urutan')
      ]);
      if (p.error) throw p.error;
      if (!p.data) throw new Error('Data pendaftar tidak ditemukan. Mungkin sudah dihapus.');
      P = p.data; B = b.data || []; gels = g.data || []; G = gels.find(x => x.id === P.gelombang_id) || null;
    }
    await muatData();
    document.title = `${P.nama_lengkap} · Pendaftar`;
    const judulHal = $('#pgJudul'); if (judulHal) judulHal.textContent = 'Detail Pendaftar';
    setFab(() => bukaWA(), 'ph-whatsapp-logo', 'Kirim WhatsApp');

    let tabAktif = (location.hash.match(/tab=(\w+)/) || [])[1] || 'verifikasi';
    function kerangka() {
      const berkasMenunggu = B.filter(b => b.status === 'menunggu').length;
      k.innerHTML = `
        <a class="kembali" href="#/pendaftar"><i class="ph-duotone ph-arrow-left"></i>Daftar pendaftar</a>
        <div class="card kepala-pendaftar">
          <div class="foto-pendaftar" id="fotoP"><i class="ph-duotone ph-user"></i></div>
          <div class="info">
            <h2>${esc(P.nama_lengkap)}</h2>
            <div class="no-baris"><span class="mono">${esc(P.no_registrasi)}</span>
              <button class="icon-btn plain" id="salinNo" title="Salin nomor registrasi" aria-label="Salin nomor registrasi"><i class="ph-duotone ph-copy"></i></button></div>
            <div class="pill-baris">${pillStatus(P.status)}${pill([`${P.jenjang} ${bagianL(P.bagian)}`, P.bagian === 'putri' ? 'var(--c4)' : 'var(--c1)'], 'ph-graduation-cap')}
              ${G ? pill([G.nama, 'var(--c2)'], 'ph-flag-banner') : ''}${P.uji ? pill(['Data uji', 'var(--c6)'], 'ph-flask') : ''}${P.didaftarkan_oleh ? pill(['Diinput panitia', 'var(--c8)'], 'ph-user-circle-plus') : ''}</div>
            <small class="muted">Mendaftar ${tsId(P.dibuat_pada)} WITA${P.diperbarui_pada && P.diperbarui_pada !== P.dibuat_pada ? ` · diperbarui ${tsId(P.diperbarui_pada)}` : ''}</small>
          </div>
          <div class="aksi-kepala">
            <button class="btn sm wa-btn" id="btnWA"><i class="ph-duotone ph-whatsapp-logo"></i>WhatsApp</button>
            <button class="btn sm ghost" id="btnBukti"><i class="ph-duotone ph-file-pdf" style="color:var(--c7)"></i>Bukti PDF</button>
            <button class="btn sm ghost" id="btnCetakData"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Cetak data</button>
            <button class="btn sm ghost" id="btnStatus"><i class="ph-duotone ph-arrows-left-right" style="color:var(--c2)"></i>Ubah status</button>
            <button class="btn sm ghost" id="btnLain" aria-haspopup="true"><i class="ph-duotone ph-dots-three-outline"></i><span class="hide-sm">Lainnya</span></button>
          </div>
        </div>
        ${(P.peringatan || []).length ? `<div class="note"><i class="ph-duotone ph-warning"></i><div><b>Peringatan data yang sudah dikonfirmasi pendaftar:</b><ul style="margin:4px 0 0;padding-left:18px">${P.peringatan.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
        ${P.status === 'dibatalkan' ? '<div class="note err"><i class="ph-duotone ph-prohibit"></i><div><b>Pendaftaran ini dibatalkan.</b> Tidak dihitung dalam kuota, dan NISN/NIK-nya boleh didaftarkan kembali. Gunakan <b>Lainnya → Pulihkan</b> bila pembatalan keliru.</div></div>' : ''}
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="verifikasi"><i class="ph-duotone ph-seal-check" style="color:var(--ok)"></i>Verifikasi</button>
          <button role="tab" data-tab="data"><i class="ph-duotone ph-identification-card" style="color:var(--c1)"></i>Data santri</button>
          <button role="tab" data-tab="berkas"><i class="ph-duotone ph-files" style="color:var(--c4)"></i>Berkas <span class="count-mini">${B.length}${berkasMenunggu ? ` · ${berkasMenunggu} baru` : ''}</span></button>
          <button role="tab" data-tab="riwayat"><i class="ph-duotone ph-clock-counter-clockwise" style="color:var(--c6)"></i>Riwayat</button>
        </div>
        <div id="isiTabP"></div>`;
      k.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => bukaTab(b.dataset.tab));
      $('#salinNo').onclick = () => navigator.clipboard?.writeText(P.no_registrasi).then(() => toast('Nomor registrasi disalin.'));
      $('#btnWA').onclick = () => bukaWA();
      $('#btnBukti').onclick = unduhBukti;
      $('#btnCetakData').onclick = cetakData;
      $('#btnStatus').onclick = ubahStatus;
      $('#btnLain').onclick = menuLain;
      muatFoto();
      bukaTab(tabAktif);
    }
    function bukaTab(t) {
      tabAktif = t;
      k.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
      history.replaceState(null, '', `#/pendaftar/${id}${t !== 'verifikasi' ? '?tab=' + t : ''}`);
      ({ verifikasi: tabVerifikasi, data: tabData, berkas: tabBerkas, riwayat: tabRiwayat })[t]($('#isiTabP'));
    }
    const segarkan = async (tab = tabAktif) => { await muatData(); tabAktif = tab; kerangka(); };

    // Pas foto (berkas privat, diambil lewat Apps Script)
    const cacheLihat = {};
    const ambilBerkas = async driveId => cacheLihat[driveId] || (cacheLihat[driveId] = await lihatBerkasPendaftar(driveId));
    async function muatFoto() {
      const f = [...B].reverse().find(b => b.jenis === 'pas_foto' && (b.mime || '').startsWith('image/'));
      if (!f) return;
      try { const h = await ambilBerkas(f.drive_id); const el = $('#fotoP'); if (el) el.innerHTML = `<img alt="Pas foto" src="${h.data}">`; } catch (e) { /* tetap ikon */ }
    }

    /* ---------- Tab Verifikasi ---------- */
    function tabVerifikasi(el) {
      const bayar = [...B].reverse().find(b => b.jenis === 'bukti_bayar');
      const wajib = (cfg.berkas || []).filter(b => b.wajib || (b.kunci === 'rekomendasi' && P.perekomendasi) || (b.kunci === 'sertifikat' && (P.prestasi || []).length));
      const kurang = wajib.filter(w => !B.some(b => b.jenis === w.kunci));
      const ditolak = B.filter(b => b.status === 'ditolak');
      el.innerHTML = `
        <div class="grid-2">
          <div class="card verif-kartu" style="--tone:var(--c4)">
            <div class="card-head"><div class="ic-box"><i class="ph-duotone ph-files"></i></div><div><h3>Verifikasi berkas</h3><p>Periksa kelengkapan dan kejelasan berkas</p></div><div class="spacer"></div>${pillVerif(P.verif_berkas)}</div>
            <ul class="cek-berkas">${wajib.map(w => { const f = [...B].reverse().find(b => b.jenis === w.kunci);
              return `<li><i class="ph-duotone ${!f ? 'ph-x-circle' : f.status === 'diterima' ? 'ph-check-circle' : f.status === 'ditolak' ? 'ph-warning-circle' : 'ph-circle-dashed'}" style="color:${!f ? 'var(--danger)' : f.status === 'diterima' ? 'var(--ok)' : f.status === 'ditolak' ? 'var(--c3)' : 'var(--c6)'}"></i>
                <span>${esc(w.label)}</span><small>${!f ? 'Belum ada' : (VERIF[f.status] || [f.status])[0]}</small></li>`; }).join('')}</ul>
            ${kurang.length ? `<div class="note" style="margin-top:10px"><i class="ph-duotone ph-warning"></i><div>Belum ada: <b>${kurang.map(w => esc(w.label)).join(', ')}</b>. Unggah di tab Berkas bila pendaftar mengirim lewat WhatsApp.</div></div>` : ''}
            ${P.catatan_berkas ? `<div class="catatan-kotak"><b>Catatan perbaikan:</b><br>${esc(P.catatan_berkas).replace(/\n/g, '<br>')}</div>` : ''}
            <div class="aksi-baris">
              <button class="btn sm ok-btn" id="vbTerima"><i class="ph-duotone ph-check-circle"></i>Berkas lengkap dan sesuai</button>
              <button class="btn sm ghost" id="vbPerbaikan"><i class="ph-duotone ph-file-x" style="color:var(--c3)"></i>Perlu perbaikan</button>
              ${P.verif_berkas !== 'menunggu' ? '<button class="btn sm ghost" id="vbUlang"><i class="ph-duotone ph-arrow-counter-clockwise"></i>Kembalikan ke menunggu</button>' : ''}
              <button class="btn sm ghost" data-ke-tab="berkas"><i class="ph-duotone ph-files" style="color:var(--c4)"></i>Periksa berkas</button>
            </div>
          </div>
          <div class="card verif-kartu" style="--tone:var(--c3)">
            <div class="card-head"><div class="ic-box"><i class="ph-duotone ph-receipt"></i></div><div><h3>Verifikasi pembayaran</h3><p>Cocokkan bukti transfer dengan mutasi rekening</p></div><div class="spacer"></div>${pillVerif(P.verif_bayar)}</div>
            ${bayar ? `<button class="bukti-bayar" data-lihat="${bayar.id}"><span class="thumb" data-thumb="${esc(bayar.drive_id)}"><i class="ph-duotone ${(bayar.mime || '').includes('pdf') ? 'ph-file-pdf' : 'ph-image'}"></i></span>
              <span><b>Bukti transfer pendaftaran</b><small>${esc(bayar.nama)} · ${ukuran(bayar.ukuran)} · ${tsId(bayar.dibuat_pada)}</small></span><i class="ph-duotone ph-magnifying-glass-plus"></i></button>`
              : '<div class="note"><i class="ph-duotone ph-warning"></i><div>Bukti transfer belum diunggah.</div></div>'}
            ${P.catatan_bayar ? `<div class="catatan-kotak"><b>Catatan pembayaran:</b><br>${esc(P.catatan_bayar).replace(/\n/g, '<br>')}</div>` : ''}
            <div class="aksi-baris">
              <button class="btn sm ok-btn" id="vpTerima"><i class="ph-duotone ph-check-circle"></i>Pembayaran diterima</button>
              <button class="btn sm ghost" id="vpTolak"><i class="ph-duotone ph-x-circle" style="color:var(--danger)"></i>Tolak</button>
              ${P.verif_bayar !== 'menunggu' ? '<button class="btn sm ghost" id="vpUlang"><i class="ph-duotone ph-arrow-counter-clockwise"></i>Kembalikan ke menunggu</button>' : ''}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="ic-box" style="--tone:var(--c8)"><i class="ph-duotone ph-note"></i></div><div><h3>Catatan internal panitia</h3><p>Tidak terlihat oleh pendaftar</p></div></div>
          <textarea class="textarea" id="catAdmin" rows="3" maxlength="2000" placeholder="Misalnya: sudah ditelepon 30/09, berkas KK akan dikirim besok.">${esc(P.catatan_admin || '')}</textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn sm" id="simpanCat"><i class="ph-duotone ph-floppy-disk"></i>Simpan catatan</button></div>
        </div>`;
      el.querySelectorAll('[data-ke-tab]').forEach(b => b.onclick = () => bukaTab(b.dataset.keTab));
      el.querySelector('[data-lihat]')?.addEventListener('click', e => pratinjau(B.find(b => b.id == e.currentTarget.dataset.lihat)));
      muatThumb(el);
      const ubah = async (nilai, pesan, templat) => {
        const { error } = await sb.from('pendaftar').update(nilai).eq('id', P.id);
        if (error) return toast(galatDB(error), 'err');
        toast(pesan); await segarkan('verifikasi');
        if (templat && (S.pengaturan.templat_wa || {})[templat]) {
          if (await konfirmasi('Kabari pendaftar?', `Kirim pesan WhatsApp "${esc(S.pengaturan.templat_wa[templat].judul)}" ke orang tua sekarang?`, 'Buka WhatsApp')) bukaWA(templat);
        }
      };
      $('#vbTerima').onclick = async () => {
        if (kurang.length && !(await konfirmasi('Berkas belum lengkap', `Berkas berikut belum ada: <b>${kurang.map(w => esc(w.label)).join(', ')}</b>. Tetap tandai berkas lengkap?`, 'Tetap tandai lengkap'))) return;
        const menunggu = B.filter(b => b.status === 'menunggu');
        if (menunggu.length) await sb.from('berkas_pendaftar').update({ status: 'diterima' }).in('id', menunggu.map(b => b.id));
        ubah({ verif_berkas: 'diterima', catatan_berkas: '' }, 'Berkas ditandai lengkap dan sesuai.');
      };
      $('#vbPerbaikan').onclick = async () => {
        const saran = [...kurang.map(w => `- ${w.label} belum diunggah`), ...ditolak.map(b => `- ${labelBerkas[b.jenis] || b.jenis}: ${b.catatan || 'perlu diperbaiki'}`)].join('\n');
        const cat = await mintaCatatan('Berkas perlu perbaikan', 'Tulis apa yang perlu diperbaiki. Catatan ini dikirim ke orang tua lewat templat WhatsApp "Berkas Kurang".', P.catatan_berkas || saran, true);
        if (cat != null) ubah({ verif_berkas: 'perbaikan', catatan_berkas: cat }, 'Status berkas: perlu perbaikan.', 'berkas_kurang');
      };
      $('#vbUlang')?.addEventListener('click', () => ubah({ verif_berkas: 'menunggu', catatan_berkas: '' }, 'Verifikasi berkas dikembalikan ke menunggu.'));
      $('#vpTerima').onclick = async () => {
        if (!bayar && !(await konfirmasi('Belum ada bukti transfer', 'Bukti transfer belum diunggah. Tetap tandai pembayaran diterima (misalnya dibayar tunai di kantor)?', 'Tetap terima'))) return;
        if (bayar && bayar.status !== 'diterima') await sb.from('berkas_pendaftar').update({ status: 'diterima' }).eq('id', bayar.id);
        ubah({ verif_bayar: 'diterima', catatan_bayar: '' }, 'Pembayaran dikonfirmasi.', 'bayar_ok');
      };
      $('#vpTolak').onclick = async () => {
        const cat = await mintaCatatan('Tolak pembayaran', 'Tulis alasannya, misalnya nominal kurang atau dana belum masuk.', P.catatan_bayar || '', true);
        if (cat != null) ubah({ verif_bayar: 'ditolak', catatan_bayar: cat }, 'Pembayaran ditandai ditolak.');
      };
      $('#vpUlang')?.addEventListener('click', () => ubah({ verif_bayar: 'menunggu', catatan_bayar: '' }, 'Verifikasi pembayaran dikembalikan ke menunggu.'));
      $('#simpanCat').onclick = async () => {
        const { error } = await sb.from('pendaftar').update({ catatan_admin: $('#catAdmin').value.trim() }).eq('id', P.id);
        if (error) return toast(galatDB(error), 'err');
        P.catatan_admin = $('#catAdmin').value.trim(); toast('Catatan disimpan.');
      };
    }
    async function mintaCatatan(judul, ket, awal, wajib) {
      return dialog({
        judul, ikon: 'ph-note-pencil', tone: 'var(--c3)',
        isi: `<p style="margin:0 0 10px">${ket}</p><textarea class="textarea" id="isiCat" rows="5" maxlength="1000">${esc(awal || '')}</textarea><div id="errCat"></div>`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Simpan', ikon: 'ph-floppy-disk', aksi: root => {
          const v = root.querySelector('#isiCat').value.trim();
          if (wajib && v.length < 3) { root.querySelector('#errCat').innerHTML = '<small class="err">Catatan wajib diisi.</small>'; return false; }
          return v;
        } }]
      });
    }
    async function muatThumb(root) {
      for (const el of root.querySelectorAll('[data-thumb]')) {
        const b = B.find(x => x.drive_id === el.dataset.thumb);
        if (!b || !(b.mime || '').startsWith('image/')) continue;
        ambilBerkas(b.drive_id).then(h => { el.innerHTML = `<img alt="" src="${h.data}">`; }).catch(() => {});
      }
    }

    /* ---------- Pratinjau berkas ---------- */
    async function pratinjau(b) {
      if (!b) return;
      let urlBlob = null;
      const tutupUrl = () => urlBlob && URL.revokeObjectURL(urlBlob);
      const hasil = dialog({
        judul: labelBerkas[b.jenis] || b.jenis, ikon: (b.mime || '').includes('pdf') ? 'ph-file-pdf' : 'ph-image', tone: 'var(--c4)', lebar: true,
        isi: `<div class="pratinjau-berkas" id="pratinjauIsi"><span class="spinner"></span> Mengambil berkas dari Google Drive…</div>
          <p class="muted" style="font-size:12.5px;margin:8px 0 0">${esc(b.nama)} · ${ukuran(b.ukuran)} · diunggah ${tsId(b.dibuat_pada)} ${b.diunggah_oleh ? 'oleh panitia' : 'oleh pendaftar'} · ${pillVerif(b.status)}</p>
          ${b.catatan ? `<div class="catatan-kotak"><b>Catatan:</b> ${esc(b.catatan)}</div>` : ''}`,
        tombol: [{ label: 'Tutup', kelas: 'ghost', nilai: null },
          { label: 'Tolak', ikon: 'ph-x-circle', kelas: 'ghost', nilai: 'tolak' },
          { label: 'Terima', ikon: 'ph-check-circle', nilai: 'terima' }],
        saatBuka: async root => {
          try {
            const h = await ambilBerkas(b.drive_id);
            const box = root.querySelector('#pratinjauIsi'); if (!box) return;
            if ((h.mime || '').startsWith('image/')) box.innerHTML = `<img alt="${esc(b.nama)}" src="${h.data}">`;
            else {
              const bin = atob(h.data.split(',')[1]); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
              urlBlob = URL.createObjectURL(new Blob([arr], { type: h.mime }));
              box.innerHTML = `<iframe title="${esc(b.nama)}" src="${urlBlob}"></iframe>
                <div class="aksi-baris" style="justify-content:center"><a class="btn sm ghost" href="${urlBlob}" target="_blank" rel="noopener"><i class="ph-duotone ph-arrow-square-out"></i>Buka di tab baru</a>
                <a class="btn sm ghost" href="${urlBlob}" download="${esc(b.nama)}"><i class="ph-duotone ph-download-simple"></i>Unduh</a></div>`;
            }
          } catch (err) { const box = root.querySelector('#pratinjauIsi'); if (box) box.innerHTML = `<div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(pesanGalat(err))}</div></div>`; }
        }
      });
      const pilih = await hasil; setTimeout(tutupUrl, 1000);
      if (pilih === 'terima') await ubahStatusBerkas(b, 'diterima', '');
      if (pilih === 'tolak') { const cat = await mintaCatatan('Tolak berkas', `Mengapa <b>${esc(labelBerkas[b.jenis] || b.jenis)}</b> ditolak? Misalnya: foto buram, terpotong, atau bukan dokumen yang diminta.`, b.catatan, true); if (cat != null) await ubahStatusBerkas(b, 'ditolak', cat); }
    }
    async function ubahStatusBerkas(b, status, catatan) {
      const { error } = await sb.from('berkas_pendaftar').update({ status, catatan }).eq('id', b.id);
      if (error) return toast(galatDB(error), 'err');
      toast(status === 'diterima' ? 'Berkas diterima.' : 'Berkas ditolak. Jangan lupa tandai "Perlu perbaikan" di tab Verifikasi.');
      await segarkan(tabAktif);
    }

    /* ---------- Tab Berkas ---------- */
    function tabBerkas(el) {
      const jenisAda = [...new Set(B.map(b => b.jenis))];
      const urutan = [...(cfg.berkas || []).map(b => b.kunci), ...jenisAda.filter(j => !labelBerkas[j])];
      el.innerHTML = `
        <p class="muted" style="margin:0 0 12px;font-size:13.5px"><i class="ph-duotone ph-lock-simple"></i> Berkas tersimpan privat di Google Drive (folder santri). Berkas yang diunggah panitia langsung berstatus <b>diterima</b>; berkas dari pendaftar perlu diperiksa. Foto atau PDF, maksimal 10 MB. Berkas yang dihapus masuk Sampah Drive dan dapat dipulihkan dalam 30 hari.</p>
        <div class="berkas-admin">${urutan.map(j => {
          const daftar = B.filter(b => b.jenis === j), def = (cfg.berkas || []).find(b => b.kunci === j) || {};
          return `<div class="card berkas-grup">
            <div class="berkas-grup-kepala"><b>${esc(labelBerkas[j] || j)}</b>${def.wajib ? ' <span class="pill" style="--tone:var(--c7)">Wajib</span>' : ''}
              <div class="spacer"></div><label class="btn sm ghost"><i class="ph-duotone ph-upload-simple" style="color:var(--c4)"></i>${daftar.length ? 'Tambah' : 'Unggah'}<input type="file" hidden data-unggah="${esc(j)}" accept="image/jpeg,image/png,image/webp,application/pdf"></label></div>
            ${daftar.length ? daftar.map(b => `<div class="berkas-baris" data-b="${b.id}">
              <button class="thumb" data-thumb="${esc(b.drive_id)}" data-lihat="${b.id}" title="Lihat"><i class="ph-duotone ${(b.mime || '').includes('pdf') ? 'ph-file-pdf' : 'ph-image'}"></i></button>
              <div class="teks"><b>${esc(b.nama)}</b><small>${ukuran(b.ukuran)} · ${tsId(b.dibuat_pada)} · ${b.diunggah_oleh ? 'panitia' : 'pendaftar'}</small>${pillVerif(b.status)}${b.catatan ? `<small class="catatan-b">${esc(b.catatan)}</small>` : ''}</div>
              <div class="aksi-b">
                <button class="icon-btn plain" data-lihat="${b.id}" title="Lihat" aria-label="Lihat"><i class="ph-duotone ph-eye" style="color:var(--c1)"></i></button>
                <button class="icon-btn plain" data-terima="${b.id}" title="Terima" aria-label="Terima"><i class="ph-duotone ph-check-circle" style="color:var(--ok)"></i></button>
                <button class="icon-btn plain" data-tolak="${b.id}" title="Tolak" aria-label="Tolak"><i class="ph-duotone ph-x-circle" style="color:var(--c3)"></i></button>
                <label class="icon-btn plain" title="Ganti dengan berkas baru" aria-label="Ganti"><i class="ph-duotone ph-arrows-clockwise" style="color:var(--c5)"></i><input type="file" hidden data-ganti="${b.id}" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
                <button class="icon-btn plain" data-hapus="${b.id}" title="Hapus" aria-label="Hapus"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button>
              </div></div>`).join('') : '<p class="muted kosong-b">Belum ada berkas.</p>'}
          </div>`; }).join('')}</div>`;
      muatThumb(el);
      el.onclick = async e => {
        const t = e.target.closest('[data-lihat],[data-terima],[data-tolak],[data-hapus]'); if (!t) return;
        const b = B.find(x => x.id == (t.dataset.lihat || t.dataset.terima || t.dataset.tolak || t.dataset.hapus));
        if (t.dataset.lihat) return pratinjau(b);
        if (t.dataset.terima) return ubahStatusBerkas(b, 'diterima', '');
        if (t.dataset.tolak) { const cat = await mintaCatatan('Tolak berkas', `Mengapa <b>${esc(labelBerkas[b.jenis] || b.jenis)}</b> ditolak?`, b.catatan, true); if (cat != null) ubahStatusBerkas(b, 'ditolak', cat); return; }
        if (t.dataset.hapus) {
          if (!(await konfirmasi('Hapus berkas ini?', `<b>${esc(b.nama)}</b> (${esc(labelBerkas[b.jenis] || b.jenis)}) dipindah ke Sampah Google Drive dan dihapus dari data pendaftar.`, 'Hapus', true))) return;
          await hapusBerkas(b); toast('Berkas dihapus.'); segarkan('berkas');
        }
      };
      el.onchange = async e => {
        const inp = e.target; if (inp.type !== 'file' || !inp.files[0]) return;
        const file = inp.files[0], lama = inp.dataset.ganti ? B.find(x => x.id == inp.dataset.ganti) : null;
        const jenis = inp.dataset.unggah || lama.jenis; inp.value = '';
        const tunggu = toast(`Mengunggah ${file.name}…`, 'info', 60000);
        try {
          const h = await unggahBerkasAdmin(file, { no: P.no_registrasi, jenis, santri: P.nama_lengkap, label: labelBerkas[jenis] || jenis });
          // Diunggah panitia = sudah diperiksa kelayakannya, langsung diterima
          const { error } = await sb.from('berkas_pendaftar').insert({ pendaftar_id: P.id, jenis, drive_id: h.id, nama: h.nama, url: h.lihat || h.url, mime: h.mime, ukuran: h.ukuran, diunggah_oleh: S.user.id, status: 'diterima' });
          if (error) { await hapusBerkasPendaftar([h.id]).catch(() => {}); throw error; }
          if (lama) await hapusBerkas(lama);
          tunggu?.remove?.(); toast(lama ? 'Berkas diganti dan langsung berstatus diterima.' : 'Berkas diunggah dan langsung berstatus diterima.');
          segarkan('berkas');
        } catch (err) { tunggu?.remove?.(); toast(galatDB(err), 'err', 8000); }
      };
    }
    async function hapusBerkas(b) {
      try { await hapusBerkasPendaftar([b.drive_id]); } catch (err) { if (!/tidak ditemukan/i.test(err.message)) throw err; }
      const { error } = await sb.from('berkas_pendaftar').delete().eq('id', b.id);
      if (error) throw error;
      delete cacheLihat[b.drive_id];
    }

    /* ---------- Tab Data santri (lihat dan ubah per bagian) ---------- */
    const pekerjaan = cfg.pekerjaan || [], sumberList = cfg.sumber_info || [];
    const BAGIAN_DATA = [
      { id: 'identitas', judul: 'Identitas dan pilihan', ikon: 'ph-identification-card', tone: 'var(--c1)', kolom: [
        { k: 'nama_lengkap', l: 'Nama lengkap', wajib: 1, cek: v => POLA_NAMA.test(v) || 'Nama 3–100 huruf, tanpa angka.' },
        { k: 'nisn', l: 'NISN', wajib: 1, mode: 'numeric', cek: v => /^\d{10}$/.test(v) || 'NISN harus 10 digit.' },
        { k: 'nik', l: 'NIK', wajib: 1, mode: 'numeric', cek: v => /^\d{16}$/.test(v) || 'NIK harus 16 digit.' },
        { k: 'tempat_lahir', l: 'Tempat lahir', wajib: 1 },
        { k: 'tanggal_lahir', l: 'Tanggal lahir', wajib: 1, tipe: 'date', tampil: v => tglPanjangIso(v) },
        { k: 'jenjang', l: 'Jenjang', tipe: 'select', opsi: ['SMP', 'SMA'], super: 1 },
        { k: 'bagian', l: 'Putra/putri', tipe: 'select', opsi: [['putra', 'Putra'], ['putri', 'Putri']], super: 1, tampil: bagianL },
        { k: 'gelombang_id', l: 'Gelombang', tipe: 'select', opsi: () => gels.map(g => [String(g.id), g.nama]), super: 1, tampil: v => gels.find(g => g.id == v)?.nama || '–', angka: 1 }
      ] },
      { id: 'alamat', judul: 'Asal daerah, alamat, dan sekolah', ikon: 'ph-map-pin', tone: 'var(--c5)', kolom: [
        { k: 'asal_provinsi', l: 'Provinsi asal' }, { k: 'asal_kabupaten', l: 'Kabupaten/kota asal' },
        { k: 'alamat_jalan', l: 'Jalan dan nomor rumah', full: 1 }, { k: 'dusun', l: 'Dusun/lingkungan' },
        { k: 'rt', l: 'RT', mode: 'numeric', cek: v => !v || /^\d{1,3}$/.test(v) || 'RT 1–3 digit.', simpan: v => v ? v.padStart(3, '0') : null },
        { k: 'rw', l: 'RW', mode: 'numeric', cek: v => !v || /^\d{1,3}$/.test(v) || 'RW 1–3 digit.', simpan: v => v ? v.padStart(3, '0') : null },
        { k: 'desa', l: 'Desa/kelurahan' }, { k: 'kecamatan', l: 'Kecamatan' }, { k: 'kabupaten', l: 'Kabupaten/kota' }, { k: 'provinsi', l: 'Provinsi' },
        { k: 'kode_pos', l: 'Kode pos', mode: 'numeric', cek: v => !v || /^\d{5}$/.test(v) || 'Kode pos 5 digit.', simpan: v => v || null },
        { k: 'asal_sekolah', l: 'Sekolah asal', wajib: 1 },
        { k: 'npsn_sekolah', l: 'NPSN sekolah asal', mode: 'numeric', cek: v => !v || /^\d{8}$/.test(v) || 'NPSN 8 digit.', simpan: v => v || null }
      ] },
      { id: 'ortu', judul: 'Orang tua dan kontak', ikon: 'ph-users-three', tone: 'var(--c4)', kolom: [
        { k: 'nama_ayah', l: 'Nama ayah', cek: v => !v || POLA_NAMA.test(v) || 'Nama 3–100 huruf, tanpa angka.' },
        { k: 'pekerjaan_ayah', l: 'Pekerjaan ayah', tipe: 'select', opsi: pekerjaan },
        { k: 'nama_ibu', l: 'Nama ibu', cek: v => !v || POLA_NAMA.test(v) || 'Nama 3–100 huruf, tanpa angka.' },
        { k: 'pekerjaan_ibu', l: 'Pekerjaan ibu', tipe: 'select', opsi: pekerjaan },
        { k: 'email', l: 'Email', wajib: 1, tipe: 'email', cek: v => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) || 'Email tidak valid.', simpan: v => v.toLowerCase() },
        { k: 'no_wa', l: 'WhatsApp orang tua', wajib: 1, mode: 'tel', edit: v => v ? '0' + v.replace(/^62/, '') : '', tampil: v => v ? '+' + v : '–',
          cek: v => /^628\d{7,11}$/.test(nomorWA(v)) || 'Nomor diawali 08, 10–13 digit.', simpan: v => nomorWA(v) },
        { k: 'darurat_nama', l: 'Nama orang terkait (darurat)', cek: v => !v || POLA_NAMA.test(v) || 'Nama 3–100 huruf, tanpa angka.' },
        { k: 'darurat_hubungan', l: 'Hubungan', tipe: 'select', opsi: HUBUNGAN },
        { k: 'darurat_no', l: 'Nomor darurat', mode: 'tel', edit: v => v ? '0' + v.replace(/^62/, '') : '', tampil: v => v ? '+' + v : '–',
          cek: v => !v || /^628\d{7,11}$/.test(nomorWA(v)) || 'Nomor diawali 08, 10–13 digit.', simpan: v => v ? nomorWA(v) : null }
      ] },
      { id: 'lain', judul: 'Riwayat, hafalan, dan informasi', ikon: 'ph-book-open-text', tone: 'var(--c2)', kolom: [
        { k: 'pernah_mondok', l: 'Pernah mondok', tipe: 'select', opsi: [['false', 'Belum pernah'], ['true', 'Pernah']], tampil: v => v ? 'Pernah' : 'Belum pernah', simpan: v => v === 'true', edit: v => String(!!v) },
        { k: 'pondok_sebelumnya', l: 'Pondok sebelumnya' }, { k: 'lama_mondok', l: 'Lama mondok', contoh: '1 tahun 6 bulan' },
        { k: 'hafalan_juz', l: 'Hafalan (juz)', mode: 'decimal', edit: v => String(+v || 0).replace('.', ','), tampil: v => `${String(+v || 0).replace('.', ',')} juz`,
          cek: v => { const n = parseFloat(String(v).replace(',', '.')); return (!isNaN(n) && n >= 0 && n <= 30 && n * 2 === Math.floor(n * 2)) || 'Isi 0–30, boleh setengah (2,5).'; }, simpan: v => parseFloat(String(v).replace(',', '.')) || 0 },
        { k: 'hafalan_surah', l: 'Hafalan surah pendek (bila < 1 juz)', mode: 'numeric', edit: v => String(v || 0), tampil: v => +v ? `${v} surah` : '–',
          cek: v => (/^\d{1,3}$/.test(v) && +v <= 114) || 'Isi 0–114.', simpan: v => +v || 0 },
        { k: 'sumber_info_daftar', l: 'Sumber informasi SPMB', tipe: 'cek', opsi: sumberList, full: 1, tampil: v => (v || []).join(', ') || '–' },
        { k: 'perekomendasi', l: 'Pemberi rekomendasi', cek: v => !v || POLA_NAMA.test(v) || 'Nama 3–100 huruf, tanpa angka.' },
        { k: 'perekomendasi_peran', l: 'Jabatan pemberi rekomendasi' },
        { k: 'prestasi', l: 'Prestasi (satu per baris: nama; tingkat; tahun)', tipe: 'textarea', full: 1,
          edit: v => (v || []).map(x => `${x.nama}; ${x.tingkat}; ${x.tahun}`).join('\n'),
          tampil: v => (v || []).map(x => `${x.nama} (${x.tingkat}, ${x.tahun})`).join('; ') || '–',
          cek: v => v.split('\n').filter(x => x.trim()).length <= 10 || 'Paling banyak 10 prestasi.',
          simpan: v => v.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const [nama, tingkat = '', tahun = ''] = x.split(';').map(y => y.trim()); return { nama, tingkat, tahun: +tahun || tahun }; }) }
      ] }
    ];
    function tabData(el) {
      el.innerHTML = BAGIAN_DATA.map(bg => `
        <div class="card data-bagian">
          <div class="card-head"><div class="ic-box" style="--tone:${bg.tone}"><i class="ph-duotone ${bg.ikon}"></i></div><div><h3>${bg.judul}</h3></div><div class="spacer"></div>
            <button class="btn sm ghost" data-ubah="${bg.id}"><i class="ph-duotone ph-pencil-simple" style="color:var(--c1)"></i>Ubah</button></div>
          <dl class="data-list">${bg.kolom.map(c => { const v = P[c.k]; const t = c.tampil ? c.tampil(v) : (v === null || v === undefined || v === '' ? '–' : v);
            return `<div class="${c.full ? 'full' : ''}"><dt>${esc(c.l)}</dt><dd>${esc(String(t))}</dd></div>`; }).join('')}</dl>
        </div>`).join('');
      el.querySelectorAll('[data-ubah]').forEach(b => b.onclick = () => ubahBagian(BAGIAN_DATA.find(x => x.id === b.dataset.ubah)));
    }
    async function ubahBagian(bg) {
      const nilaiEdit = c => { const v = P[c.k]; return c.edit ? c.edit(v) : v ?? ''; };
      const kolomHTML = c => {
        const kunci = c.super && !isSuper, v = nilaiEdit(c);
        const opsi = typeof c.opsi === 'function' ? c.opsi() : c.opsi || [];
        let isian;
        if (c.tipe === 'select') isian = `<select class="select" name="${c.k}" ${kunci ? 'disabled' : ''}><option value="">— Pilih —</option>${opsi.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}${v && !opsi.some(o => String(Array.isArray(o) ? o[0] : o) === String(v)) ? `<option selected value="${esc(v)}">${esc(v)}</option>` : ''}</select>`;
        else if (c.tipe === 'cek') isian = `<div class="chips-select">${opsi.map(o => `<label><input type="checkbox" name="${c.k}" value="${esc(o)}" ${(P[c.k] || []).includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div>`;
        else if (c.tipe === 'textarea') isian = `<textarea class="textarea" name="${c.k}" rows="4">${esc(v)}</textarea>`;
        else isian = `<input class="input" name="${c.k}" type="${c.tipe || 'text'}" value="${esc(v)}" ${c.mode ? `inputmode="${c.mode}"` : ''} ${c.contoh ? `placeholder="${esc(c.contoh)}"` : ''} ${kunci ? 'disabled' : ''}>`;
        return `<div class="field${c.full ? ' full' : ''}" data-k="${c.k}"><label>${esc(c.l)}${c.wajib ? ' <span class="req">*</span>' : ''}</label>${isian}
          ${kunci ? '<small>Hanya Superadmin yang dapat mengubah (memengaruhi kuota dan nomor).</small>' : ''}<small class="err"></small></div>`;
      };
      const ok = await dialog({
        judul: `Ubah: ${bg.judul}`, ikon: 'ph-pencil-simple', tone: bg.tone, lebar: true,
        isi: `<form class="grid-form" id="fUbahP" novalidate>${bg.kolom.map(kolomHTML).join('')}</form>`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, { label: 'Simpan', ikon: 'ph-floppy-disk', aksi: async root => {
          const f = root.querySelector('#fUbahP'), ubah = {}; let salah = false;
          for (const c of bg.kolom) {
            if (c.super && !isSuper) continue;
            const box = f.querySelector(`[data-k="${c.k}"]`), err = box.querySelector('.err'); err.textContent = '';
            let v;
            if (c.tipe === 'cek') v = [...f.querySelectorAll(`[name="${c.k}"]:checked`)].map(x => x.value);
            else v = String(f.elements[c.k].value).replace(/\s+/g, c.tipe === 'textarea' ? '$&' : ' ').trim();
            if (c.tipe !== 'cek') {
              if (c.wajib && !v) { err.textContent = 'Wajib diisi.'; salah = true; continue; }
              const h = c.cek ? c.cek(v) : true;
              if (h !== true) { err.textContent = h; salah = true; continue; }
            }
            let akhir = c.simpan ? c.simpan(v) : v;
            if (c.angka) akhir = akhir ? +akhir : null;
            if (JSON.stringify(akhir ?? null) !== JSON.stringify(P[c.k] ?? null) && !(akhir === '' && P[c.k] == null)) ubah[c.k] = akhir;
          }
          if (salah) return false;
          if (ubah.sumber_info_daftar) ubah.sumber_info = ubah.sumber_info_daftar.join('; ');
          if (!Object.keys(ubah).length) return 'tetap';
          const { error } = await sb.from('pendaftar').update(ubah).eq('id', P.id);
          if (error) throw new Error(galatDB(error));
          return 'ubah';
        } }]
      });
      if (ok === 'ubah') { toast('Data pendaftar disimpan.'); segarkan('data'); }
      else if (ok === 'tetap') toast('Tidak ada perubahan.', 'info');
    }

    /* ---------- Tab Riwayat ---------- */
    async function tabRiwayat(el) {
      el.innerHTML = '<div class="card"><span class="spinner"></span> Memuat riwayat…</div>';
      const [r, w] = await Promise.all([
        sb.from('riwayat_status').select('*').eq('pendaftar_id', P.id).order('pada', { ascending: false }),
        sb.from('log_wa').select('*').eq('pendaftar_id', P.id).order('pada', { ascending: false })
      ]);
      const NAMA_J = { status: 'Status', berkas: 'Verifikasi berkas', bayar: 'Verifikasi pembayaran' };
      const label = (j, v) => j === 'status' ? (STATUS[v] || [v])[0] : (VERIF[v] || [v])[0];
      const item = [
        ...(r.data || []).map(x => ({ pada: x.pada, ikon: x.jenis === 'status' ? 'ph-arrows-left-right' : x.jenis === 'berkas' ? 'ph-files' : 'ph-receipt', tone: x.jenis === 'status' ? 'var(--c2)' : x.jenis === 'berkas' ? 'var(--c4)' : 'var(--c3)',
          teks: `<b>${NAMA_J[x.jenis]}</b>: ${esc(label(x.jenis, x.dari))} → <b>${esc(label(x.jenis, x.ke))}</b>`, catatan: x.catatan, oleh: x.nama_oleh })),
        ...(w.data || []).map(x => ({ pada: x.pada, ikon: 'ph-whatsapp-logo', tone: '#16a34a', teks: `<b>WhatsApp</b>: ${esc((S.pengaturan.templat_wa || {})[x.templat]?.judul || x.templat)} ke +${esc(x.nomor)}`, catatan: x.pesan, oleh: x.nama_oleh, wa: 1 })),
        { pada: P.dibuat_pada, ikon: 'ph-note-pencil', tone: 'var(--c1)', teks: `<b>Mendaftar</b> dengan nomor ${esc(P.no_registrasi)}${P.didaftarkan_oleh ? ' (diinput panitia)' : ' lewat formulir online'}` }
      ].sort((a, b) => new Date(b.pada) - new Date(a.pada));
      el.innerHTML = `<div class="card"><ul class="linimasa">${item.map(x => `<li style="--tone:${x.tone}"><span class="ic-box"><i class="ph-duotone ${x.ikon}"></i></span>
        <div><div>${x.teks}</div>${x.catatan ? `<div class="${x.wa ? 'wa-ringkas' : 'catatan-kotak'}">${esc(x.catatan).replace(/\n/g, '<br>')}</div>` : ''}
        <small class="muted">${tsId(x.pada)} WITA${x.oleh ? ` · ${esc(x.oleh)}` : ''}</small></div></li>`).join('')}</ul>
        <p class="muted" style="font-size:12.5px;margin:10px 0 0">Perubahan isi data tercatat lengkap di menu Log Aktivitas (Superadmin).</p></div>`;
    }

    /* ---------- WhatsApp dari templat ---------- */
    async function bukaWA(awal) {
      const T = S.pengaturan.templat_wa || (await muatPengaturan(true)).templat_wa || {};
      const kunci = Object.keys(IKON_WA).filter(x => T[x]).concat(Object.keys(T).filter(x => !IKON_WA[x]));
      const pilih = awal && T[awal] ? awal : P.status === 'ikut_tes' && T.jadwal_tes ? 'jadwal_tes' : P.verif_berkas === 'perbaikan' ? 'berkas_kurang' : P.verif_bayar === 'diterima' && T.bayar_ok ? 'bayar_ok' : 'diterima';
      const id_ = S.pengaturan.identitas || {};
      const situs = alamatSitus();
      // Jadwal tes dari sesi yang diikuti (Fase 4); bila belum dijadwalkan, pakai tanggal tes gelombang
      const { data: ikut } = await sb.from('peserta_sesi').select('sesi_tes(*)').eq('pendaftar_id', P.id);
      const jadwalSesi = UI.teksJadwalTes ? UI.teksJadwalTes((ikut || []).map(x => x.sesi_tes), S.pengaturan) : '';
      const data = {
        nama: P.nama_lengkap, no_registrasi: P.no_registrasi, jenjang: `${P.jenjang} ${bagianL(P.bagian)}`, gelombang: G?.nama || '',
        catatan: P.catatan_berkas || P.catatan_bayar || '', jadwal_tes: jadwalSesi || (G?.tes_mulai ? (G.tes_selesai && G.tes_selesai !== G.tes_mulai ? `${tglPanjangIso(G.tes_mulai)} – ${tglPanjangIso(G.tes_selesai)}` : tglPanjangIso(G.tes_mulai)) : ''),
        tautan_status: `${situs}/cek-status.html?no=${encodeURIComponent(P.no_registrasi)}`, tautan_pengumuman: `${situs}/cek-status.html?no=${encodeURIComponent(P.no_registrasi)}`,
        tautan_daftar_ulang: `${situs}/daftar-ulang.html?no=${encodeURIComponent(P.no_registrasi)}`, nama_lembaga: id_.nama_lembaga || '', tahun_ajaran: id_.tahun_ajaran || ''
      };
      const nomor = { utama: P.no_wa, darurat: P.darurat_no };
      const hasil = await dialog({
        judul: 'Kirim WhatsApp', ikon: 'ph-whatsapp-logo', tone: '#16a34a', lebar: true,
        isi: `<div class="wa-kirim">
          <div><div class="field"><label>Templat pesan</label><div class="chips-select templat-pilih">${kunci.map(x => `<label><input type="radio" name="templat" value="${x}" ${x === pilih ? 'checked' : ''}><i class="ph-duotone ${(IKON_WA[x] || ['ph-chat-text'])[0]}" style="color:${(IKON_WA[x] || [0, 'var(--c8)'])[1]}"></i>${esc(T[x].judul || x)}</label>`).join('')}</div></div>
            <div class="field"><label>Kirim ke</label><div class="chips-select">
              <label><input type="radio" name="ke" value="utama" checked>Orang tua · +${esc(P.no_wa)}</label>
              ${P.darurat_no ? `<label><input type="radio" name="ke" value="darurat">${esc(P.darurat_nama || 'Kontak darurat')} · +${esc(P.darurat_no)}</label>` : ''}</div></div>
            <div class="field"><label>Isi pesan (dapat diubah)</label><textarea class="textarea" id="isiWA" rows="10"></textarea>
              <small>*tebal*, _miring_. Teks {dalam kurung kurawal} belum terisi datanya; ubah sebelum mengirim.</small></div></div>
          <div class="wa-layar"><div class="wa-gelembung" id="pratinjauWA"></div></div></div>`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Buka WhatsApp', ikon: 'ph-paper-plane-tilt', kelas: 'wa-btn', aksi: root => ({
          templat: root.querySelector('[name=templat]:checked')?.value || 'lainnya', nomor: nomor[root.querySelector('[name=ke]:checked').value], pesan: root.querySelector('#isiWA').value.trim() }) }],
        saatBuka: root => {
          const ta = root.querySelector('#isiWA'), pv = root.querySelector('#pratinjauWA');
          const isi = () => { const t = root.querySelector('[name=templat]:checked')?.value; ta.value = UI.isiTemplat(T[t]?.isi || '', data); pv.innerHTML = UI.formatWA(ta.value); };
          root.querySelectorAll('[name=templat]').forEach(r => r.onchange = isi);
          ta.oninput = () => { pv.innerHTML = UI.formatWA(ta.value); };
          isi();
        }
      });
      if (!hasil || !hasil.pesan) return;
      window.open(`https://wa.me/${hasil.nomor}?text=${encodeURIComponent(hasil.pesan)}`, '_blank', 'noopener');
      const { error } = await sb.from('log_wa').insert({ pendaftar_id: P.id, templat: hasil.templat, nomor: hasil.nomor, pesan: hasil.pesan });
      if (error) toast('WhatsApp dibuka, tetapi riwayat tidak tersimpan: ' + pesanGalat(error), 'warn');
      else toast('WhatsApp dibuka dan tercatat di riwayat.');
      if (tabAktif === 'riwayat') tabRiwayat($('#isiTabP'));
    }

    /* ---------- Ubah status, batalkan, hapus ---------- */
    async function ubahStatus() {
      const kelompok = [['Tahap verifikasi (otomatis dari hasil verifikasi)', ['terdaftar', 'berkas_kurang', 'berkas_diverifikasi', 'pembayaran_dikonfirmasi']],
        ['Seleksi dan pengumuman', ['ikut_tes', 'nilai_divalidasi', 'lulus', 'cadangan', 'tidak_lulus']], ['Daftar ulang', ['daftar_ulang_menunggu', 'daftar_ulang_selesai']], ['Lainnya', ['mengundurkan_diri', 'dibatalkan']]];
      const baru = await dialog({
        judul: 'Ubah status pendaftar', ikon: 'ph-arrows-left-right', tone: 'var(--c2)',
        isi: `<p style="margin:0 0 10px">Status sekarang: ${pillStatus(P.status)}</p>
          <div class="field"><label>Status baru</label><select class="select" id="stBaru">${kelompok.map(([l, arr]) => `<optgroup label="${l}">${arr.map(v => `<option value="${v}" ${v === P.status ? 'selected' : ''}>${STATUS[v][0]}</option>`).join('')}</optgroup>`).join('')}</select></div>
          <p class="muted" style="font-size:12.5px;margin:0">Status tahap verifikasi biasanya berubah sendiri saat berkas/pembayaran diverifikasi. Status <b>Dibatalkan</b> membebaskan NISN/NIK agar dapat didaftarkan ulang dan tidak dihitung dalam kuota.</p>`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Simpan', ikon: 'ph-floppy-disk', aksi: root => root.querySelector('#stBaru').value }]
      });
      if (!baru || baru === P.status) return;
      const { error } = await sb.from('pendaftar').update({ status: baru }).eq('id', P.id);
      if (error) return toast(galatDB(error), 'err');
      toast(`Status diubah menjadi ${STATUS[baru][0]}.`); segarkan();
    }
    function menuLain() {
      const batal = P.status === 'dibatalkan';
      dialog({
        judul: 'Tindakan lainnya', ikon: 'ph-dots-three-outline', tone: 'var(--c8)',
        isi: `<div class="menu-tindakan">
          <button data-aksi="${batal ? 'pulihkan' : 'batalkan'}"><i class="ph-duotone ${batal ? 'ph-arrow-counter-clockwise' : 'ph-prohibit'}" style="color:${batal ? 'var(--ok)' : 'var(--c3)'}"></i>
            <span><b>${batal ? 'Pulihkan pendaftaran' : 'Batalkan pendaftaran (reset)'}</b><small>${batal ? 'Kembalikan ke status Terdaftar.' : 'Data tetap tersimpan, tetapi NISN/NIK boleh didaftarkan ulang dan tidak dihitung kuota.'}</small></span></button>
          <button data-aksi="data_pdf"><i class="ph-duotone ph-file-pdf" style="color:var(--c7)"></i><span><b>Unduh formulir data (PDF)</b><small>Formulir Data Calon Santri ukuran F4, sama dengan hasil cetak.</small></span></button>
          <button data-aksi="salin_wa"><i class="ph-duotone ph-copy" style="color:var(--c1)"></i><span><b>Salin nomor WhatsApp</b><small>+${esc(P.no_wa)}</small></span></button>
          <button data-aksi="hapus" class="bahaya"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i><span><b>Hapus permanen</b><small>Data, riwayat, dan semua berkas dihapus. Tidak dapat dibatalkan.</small></span></button>
        </div>`,
        tombol: [{ label: 'Tutup', kelas: 'ghost', nilai: null }],
        saatBuka: root => root.querySelector('.menu-tindakan').onclick = e => {
          const b = e.target.closest('[data-aksi]'); if (!b) return;
          root.closest('.modal-back').querySelector('[data-x]').click();
          ({ batalkan, pulihkan, hapus: hapusPermanen, data_pdf: unduhDataPdf, salin_wa: () => navigator.clipboard?.writeText('+' + P.no_wa).then(() => toast('Nomor disalin.')) })[b.dataset.aksi]();
        }
      });
    }
    async function batalkan() {
      if (!(await konfirmasi('Batalkan pendaftaran?', `Pendaftaran <b>${esc(P.nama_lengkap)}</b> (${esc(P.no_registrasi)}) ditandai <b>Dibatalkan</b>. Data dan berkas tetap tersimpan; NISN/NIK dapat didaftarkan kembali.`, 'Batalkan pendaftaran', true))) return;
      const { error } = await sb.from('pendaftar').update({ status: 'dibatalkan' }).eq('id', P.id);
      if (error) return toast(galatDB(error), 'err');
      toast('Pendaftaran dibatalkan.'); segarkan();
    }
    async function pulihkan() {
      const { error } = await sb.from('pendaftar').update({ status: 'terdaftar' }).eq('id', P.id);
      if (error) return toast(/unik/.test(error.message) ? `Tidak dapat dipulihkan: ${galatDB(error)}` : galatDB(error), 'err', 8000);
      toast('Pendaftaran dipulihkan.'); segarkan();
    }
    async function hapusPermanen() {
      const ok = await dialog({
        judul: 'Hapus permanen?', ikon: 'ph-trash', tone: 'var(--danger)',
        isi: `<p style="margin:0 0 10px">Data <b>${esc(P.nama_lengkap)}</b>, riwayat, dan <b>${B.length} berkas</b> akan dihapus. Berkas Drive dipindah ke Sampah (dapat dipulihkan 30 hari), tetapi data pendaftar tidak dapat dikembalikan.</p>
          <p style="margin:0 0 10px">Bila hanya ingin mengizinkan pendaftaran ulang, pilih <b>Batalkan pendaftaran</b> saja.</p>
          <div class="field"><label>Ketik nomor registrasi <b>${esc(P.no_registrasi)}</b> untuk melanjutkan</label><input class="input" id="ketikNo" autocomplete="off"></div><div id="errHapus"></div>`,
        tombol: [{ label: 'Batal', kelas: 'ghost', nilai: false }, { label: 'Hapus permanen', ikon: 'ph-trash', kelas: 'danger', aksi: async root => {
          if (root.querySelector('#ketikNo').value.trim().toUpperCase() !== P.no_registrasi.toUpperCase()) { root.querySelector('#errHapus').innerHTML = '<small class="err">Nomor registrasi tidak sama.</small>'; return false; }
          const { data, error } = await sb.rpc('hapus_pendaftar', { p_id: P.id });
          if (error) throw error;
          if ((data.drive_ids || []).length) await hapusBerkasPendaftar(data.drive_ids).catch(e => toast('Data terhapus, tetapi berkas Drive gagal dibuang: ' + pesanGalat(e), 'warn', 8000));
          return true;
        } }]
      });
      if (ok) { toast('Pendaftar dihapus permanen.'); location.hash = '#/pendaftar'; }
    }

    /* ---------- Bukti PDF dan cetak data ---------- */
    async function unduhBukti() {
      const b = $('#btnBukti'); b.disabled = true; const isiLama = b.innerHTML; b.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span> Menyiapkan…';
      const nama = `Bukti Pendaftaran ${P.no_registrasi}.pdf`;
      try {
        try { await unduhPdfDokumen(dokumenBukti({ ...P, gelombang: G?.nama || '' }, B.map(x => x.jenis), S.pengaturan), nama); }
        catch (e) { console.warn('PDF peramban gagal, memakai Apps Script', e); const h = await ambilBuktiPdf({ id: P.id }); simpanPdf(h.pdf, nama); }
        toast('Bukti Pendaftaran PDF diunduh.');
      } catch (err) { toast(`${pesanGalat(err)} Anda tetap dapat memakai tombol Cetak data.`, 'err', 8000); }
      finally { b.disabled = false; b.innerHTML = isiLama; }
    }
    async function unduhDataPdf() {
      try { await unduhPdfDokumen(opsiData(), `Formulir Data ${P.no_registrasi} - ${P.nama_lengkap}.pdf`); toast('Formulir data PDF diunduh.'); }
      catch (err) { toast(pesanGalat(err), 'err', 8000); }
    }
    function cetakData() { cetakDokumen(opsiData()); }
    function opsiData() {
      const kp = S.pengaturan.ketua_panitia || {};
      const r = (a, b) => `<tr><td>${a}</td><td>${esc(b == null || b === '' ? '–' : String(b))}</td></tr>`;
      const bagianTabel = (judul, baris) => `<table><colgroup><col style="width:34%"><col style="width:66%"></colgroup><thead><tr><th colspan="2">${judul}</th></tr></thead><tbody>${baris}</tbody></table><div style="height:4px"></div>`;
      const alamat = [P.alamat_jalan, P.dusun, `RT ${P.rt || '–'}/RW ${P.rw || '–'}`, P.desa, P.kecamatan ? `Kec. ${P.kecamatan}` : '', P.kabupaten, P.provinsi, P.kode_pos].filter(Boolean).join(', ');
      return ({
        judul: 'Formulir Data Calon Santri', nomor: P.no_registrasi,
        meta: `Tahun Ajaran ${esc(S.pengaturan.identitas?.tahun_ajaran || '')} · ${esc(G?.nama || '')} · ${esc(P.jenjang)} ${bagianL(P.bagian)} · Status: ${esc(STATUS[P.status]?.[0] || P.status)}${P.uji ? ' · <b>DATA UJI COBA</b>' : ''}`,
        isi: '<span class="dok-rapat"></span>' + bagianTabel('A. Identitas calon santri', r('Nama lengkap', P.nama_lengkap) + r('NISN / NIK', `${P.nisn} / ${P.nik}`) + r('Tempat, tanggal lahir', `${P.tempat_lahir}, ${tglPanjangIso(P.tanggal_lahir)}`)
            + r('Asal daerah', `${P.asal_kabupaten}, ${P.asal_provinsi}`) + r('Alamat domisili', alamat) + r('Sekolah asal', `${P.asal_sekolah}${P.npsn_sekolah ? ` (NPSN ${P.npsn_sekolah})` : ''}`))
          + bagianTabel('B. Orang tua dan kontak', r('Ayah', `${P.nama_ayah || '–'} · ${P.pekerjaan_ayah || '–'}`) + r('Ibu', `${P.nama_ibu || '–'} · ${P.pekerjaan_ibu || '–'}`)
            + r('WhatsApp / email', `+${P.no_wa} / ${P.email}`) + r('Kontak darurat', P.darurat_nama ? `${P.darurat_nama} (${P.darurat_hubungan || '–'}) · +${P.darurat_no || '–'}` : ''))
          + bagianTabel('C. Riwayat dan hafalan', r('Riwayat mondok', P.pernah_mondok ? `${P.pondok_sebelumnya} (${P.lama_mondok || '–'})` : 'Belum pernah') + r('Hafalan Al-Qur\'an', teksHafalan(P))
            + r('Pemberi rekomendasi', P.perekomendasi ? `${P.perekomendasi} (${P.perekomendasi_peran || '–'})` : '') + r('Prestasi', (P.prestasi || []).map(x => `${x.nama} (${x.tingkat}, ${x.tahun})`).join('; ')) + r('Sumber informasi', P.sumber_info))
          + bagianTabel('D. Verifikasi', r('Berkas', `${VERIF[P.verif_berkas]?.[0] || P.verif_berkas}${P.catatan_berkas ? ' · ' + P.catatan_berkas : ''}`) + r('Pembayaran', `${VERIF[P.verif_bayar]?.[0] || P.verif_bayar}${P.catatan_bayar ? ' · ' + P.catatan_bayar : ''}`)
            + r('Berkas terunggah', B.map(b => `${labelBerkas[b.jenis] || b.jenis} (${VERIF[b.status]?.[0] || b.status})`).join('; '))),
        ttd: [{ jabatan: 'Calon santri / wali,', nama: P.nama_lengkap }, { jabatan: 'Ketua Panitia SPMB,', nama: kp.nama, nip: kp.niy ? 'NIY. ' + kp.niy : '' }]
      });
    }

    kerangka();
  }
})();
