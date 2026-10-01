/* =====================================================================
   WHATSAPP PANITIA (Fase 5) · dipakai Pendaftar, Seleksi, dan pengaturan
   - Data isian templat lengkap per santri: jadwal tes, grup WhatsApp
     (grup umum + grup sesi tes), tagihan yang belum lunas, rekening,
     dan data pertemuan wali.
   - kirimBeruntun(): satu dialog untuk mengirim pesan ke banyak wali
     satu per satu (wa.me), tercatat di riwayat (log_wa).
   Semua templat (bawaan dan buatan sendiri) dapat dipakai.
   ===================================================================== */
(function () {
  'use strict';
  const { sb, CFG, fmt, esc, toast, dialog, pesanGalat, muatPengaturan } = window.SPMB;
  const UI = () => window.SPMB_UI || {};

  // Ikon dan warna templat bawaan; templat buatan sendiri memakai ikon umum
  const IKON = {
    diterima: ['ph-check-circle', 'var(--ok)'], berkas_kurang: ['ph-file-x', 'var(--c7)'], bayar_ok: ['ph-credit-card', 'var(--c5)'],
    jadwal_tes: ['ph-calendar-check', 'var(--c2)'], pengingat_tes: ['ph-alarm', 'var(--c3)'], lulus: ['ph-confetti', 'var(--ok)'], cadangan: ['ph-hourglass-medium', 'var(--c6)'],
    tidak_lulus: ['ph-hand-heart', 'var(--c8)'], undangan_du: ['ph-envelope-open', 'var(--c1)'], du_perbaikan: ['ph-arrow-u-up-left', 'var(--c3)'], du_selesai: ['ph-graduation-cap', 'var(--c4)'],
    tagihan: ['ph-receipt', 'var(--c7)'], undangan_pertemuan: ['ph-users-three', 'var(--c2)'], undangan_grup: ['ph-chats-circle', 'var(--ok)']
  };
  const ikon = k => IKON[k] || ['ph-chat-circle-text', 'var(--c1)'];
  const urutkan = T => { const u = Object.keys(IKON); return Object.keys(T).sort((a, b) => (u.indexOf(a) + 1 || 99) - (u.indexOf(b) + 1 || 99) || String(T[a].judul).localeCompare(String(T[b].judul), 'id')); };

  // Isian yang dapat dipakai di templat (dipakai juga oleh tab Templat WhatsApp)
  const ISIAN = [
    ['nama', 'Nama santri'], ['no_registrasi', 'Nomor registrasi'], ['jenjang', 'Jenjang dan bagian'], ['gelombang', 'Gelombang'], ['nama_ayah', 'Nama ayah'], ['nama_ibu', 'Nama ibu'],
    ['catatan', 'Catatan petugas'], ['jadwal_tes', 'Jadwal tes'], ['grup_wa', 'Daftar grup WhatsApp'], ['tautan_status', 'Tautan Cek Status'], ['tautan_pengumuman', 'Tautan Pengumuman'],
    ['jadwal_daftar_ulang', 'Jadwal daftar ulang'], ['tautan_daftar_ulang', 'Tautan Daftar Ulang'],
    ['rincian_tagihan', 'Rincian tagihan belum lunas'], ['sisa_tagihan', 'Total sisa tagihan'], ['total_tagihan', 'Total tagihan'], ['sudah_dibayar', 'Sudah dibayar'], ['rekening', 'Rekening pembayaran'],
    ['judul_pertemuan', 'Judul pertemuan'], ['jadwal_pertemuan', 'Hari, tanggal, jam pertemuan'], ['tempat_pertemuan', 'Tempat pertemuan'], ['tautan_pertemuan', 'Tautan pertemuan daring'], ['keterangan_pertemuan', 'Keterangan pertemuan'],
    ['nama_lembaga', 'Nama lembaga'], ['tahun_ajaran', 'Tahun ajaran']
  ];
  const NAMA_TAHAP = { pendaftaran: 'Biaya pendaftaran', daftar_ulang: 'Biaya daftar ulang', tahunan: 'Biaya tahunan', bulanan: 'Biaya bulanan', lainnya: 'Biaya lainnya' };
  const rp = n => 'Rp' + fmt.angka(Math.round(+n || 0));
  const bagL = b => b === 'putri' ? 'Putri' : 'Putra';
  const alamatSitus = () => (CFG.alamatSitus || location.href.replace(/\/[^/]*$/, '')).replace(/\/$/, '');
  const dIso = v => new Date(String(v).slice(0, 10) + 'T00:00:00');
  const tglP = v => v ? fmt.tglPanjang(dIso(v)) : '';
  const rentang = (a, b) => !a ? '' : !b || a === b ? tglP(a) : `${tglP(a)} s.d. ${tglP(b)}`;
  const STATUS_LULUS = ['lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai'];

  // Grup umum cocok untuk santri ini?
  const grupCocok = (g, p) => (!g.jenjang || g.jenjang === 'semua' || g.jenjang === p.jenjang) && (!g.bagian || g.bagian === 'semua' || g.bagian === p.bagian)
    && (!g.status || g.status === 'semua' || g.status === 'pendaftar' || (g.status === 'lulus' && STATUS_LULUS.includes(p.status)) || (g.status === 'santri_baru' && p.status === 'daftar_ulang_selesai'));

  function teksPertemuan(m) {
    m = m || {};
    const jam = m.jam ? ` pukul ${m.jam.replace(':', '.')} WITA` : '';
    return {
      judul_pertemuan: m.judul || 'Pertemuan Wali Calon Santri',
      jadwal_pertemuan: m.tanggal ? `${fmt.hariTgl(dIso(m.tanggal))}${jam}` : 'akan diinformasikan',
      tempat_pertemuan: m.mode === 'online' ? `Daring${m.tempat ? ' melalui ' + m.tempat : ''}` : (m.tempat || 'Kampus pondok'),
      tautan_pertemuan: m.tautan ? `Tautan: ${m.tautan}` : '',
      keterangan_pertemuan: m.keterangan || ''
    };
  }

  /* Data isian untuk sekumpulan pendaftar. daftar: baris pendaftar (minimal id, nama_lengkap, no_registrasi, jenjang, bagian, status, gelombang_id) */
  async function siapkanData(daftar, opsi = {}) {
    const peng = opsi.pengaturan || await muatPengaturan(true);
    const id_ = peng.identitas || {}, info = peng.wa_info || {}, situs = alamatSitus();
    const ids = daftar.map(p => p.id);
    const potong = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
    const uji = daftar.some(p => p.uji);
    const [sesiRes, gelRes, rekRes, keuRes] = await Promise.all([
      Promise.all(potong(ids, 150).map(c => sb.from('peserta_sesi').select('pendaftar_id,sesi_tes(*)').in('pendaftar_id', c))),
      sb.from('gelombang').select('id,nama,tes_mulai,tes_selesai,daftar_ulang_mulai,daftar_ulang_selesai'),
      sb.from('rekening').select('*').eq('tampil', true).is('diarsipkan_pada', null).order('urutan'),
      sb.rpc('keuangan_santri', { p_gelombang: null, p_uji: uji })
    ]);
    const sesiPer = {}; sesiRes.forEach(r => (r.data || []).forEach(x => (sesiPer[x.pendaftar_id] = sesiPer[x.pendaftar_id] || []).push(x.sesi_tes)));
    const gel = Object.fromEntries((gelRes.data || []).map(g => [g.id, g]));
    const keu = Object.fromEntries(((keuRes.error ? [] : keuRes.data) || []).map(k => [k.id, k]));
    const rekening = rekRes.data || [];
    const pertemuan = teksPertemuan(info.pertemuan);
    const hasil = {};
    for (const p of daftar) {
      const G = gel[p.gelombang_id] || {}, sesi = (sesiPer[p.id] || []).filter(Boolean), k = keu[p.id];
      // grup: umum yang cocok + grup tiap sesi tes yang diikuti
      const grup = [...(info.grup || []).filter(g => g.tautan && grupCocok(g, p)).map(g => [g.nama || 'Grup SPMB', g.tautan]),
        ...sesi.filter(s => s.grup_wa).map(s => [`Grup ${s.nama}`, s.grup_wa])];
      const unik = grup.filter((g, i) => grup.findIndex(x => x[1] === g[1]) === i);
      // tagihan per tahap yang belum lunas
      const tahap = k ? Object.entries(k.tahap || {}).filter(([, x]) => (+x.bayar || 0) > (+x.dibayar || 0)) : [];
      const rek = rekening.filter(r => (r.bagian === 'semua' || r.bagian === p.bagian));
      hasil[p.id] = {
        nama: p.nama_lengkap, no_registrasi: p.no_registrasi, jenjang: `${p.jenjang} ${bagL(p.bagian)}`, gelombang: G.nama || '',
        nama_ayah: p.nama_ayah || '', nama_ibu: p.nama_ibu || '',
        catatan: p.catatan_berkas || p.catatan_bayar || opsi.catatan || '',
        jadwal_tes: (UI().teksJadwalTes ? UI().teksJadwalTes(sesi, peng) : '') || rentang(G.tes_mulai, G.tes_selesai) || 'jadwal menyusul',
        grup_wa: unik.length ? unik.map(([n, t]) => `• ${n}:\n${t}`).join('\n\n') : '(grup WhatsApp akan diinformasikan)',
        tautan_status: `${situs}/cek-status.html?no=${encodeURIComponent(p.no_registrasi)}`,
        tautan_pengumuman: `${situs}/pengumuman.html?no=${encodeURIComponent(p.no_registrasi)}`,
        tautan_daftar_ulang: `${situs}/daftar-ulang.html?no=${encodeURIComponent(p.no_registrasi)}`,
        jadwal_daftar_ulang: rentang(G.daftar_ulang_mulai, G.daftar_ulang_selesai) || 'jadwal menyusul',
        rincian_tagihan: tahap.length ? tahap.map(([t, x]) => `• ${NAMA_TAHAP[t] || t}: ${rp(x.bayar)}${+x.dibayar ? `, sudah dibayar ${rp(x.dibayar)}, sisa *${rp(x.bayar - x.dibayar)}*` : ''}`).join('\n') : '• Tidak ada tagihan yang belum lunas',
        sisa_tagihan: rp(k ? k.sisa : 0), total_tagihan: rp(k ? k.tagihan : 0), sudah_dibayar: rp(k ? k.dibayar : 0),
        rekening: rek.length ? rek.map(r => `• ${r.bank} ${r.nomor_rekening} a.n. ${r.atas_nama}`).join('\n') : '(rekening disampaikan panitia)',
        ...pertemuan,
        nama_lembaga: id_.nama_lembaga || '', tahun_ajaran: id_.tahun_ajaran || '',
        _sisa: k ? +k.sisa || 0 : 0
      };
    }
    return hasil;
  }

  // Templat yang cocok untuk status santri (pilihan awal)
  function templatAwal(p, T) {
    const ada = k => T[k] ? k : null;
    if (p.verif_berkas === 'perbaikan') return ada('berkas_kurang');
    if (p.status === 'ikut_tes') return ada('jadwal_tes');
    if (p.status === 'lulus') return ada('lulus') || ada('undangan_du');
    if (p.status === 'cadangan') return ada('cadangan');
    if (p.status === 'tidak_lulus') return ada('tidak_lulus');
    if (p.status === 'daftar_ulang_selesai') return ada('du_selesai');
    if (p.verif_bayar === 'diterima') return ada('bayar_ok');
    return ada('diterima');
  }

  /* ---------- Kirim berurutan ke banyak wali (atau satu wali) ----------
     daftar: baris pendaftar lengkap; opsi: { awal, pilihan:[kunci], judul, catatan } */
  async function kirimBeruntun(daftar, opsi = {}) {
    if (!daftar.length) return toast('Tidak ada penerima.', 'warn');
    const peng = await muatPengaturan(true);
    const T = peng.templat_wa || {};
    const kunci = (opsi.pilihan || urutkan(T)).filter(k => T[k]);
    if (!kunci.length) return toast('Templat WhatsApp belum tersedia. Periksa Pengaturan SPMB > Templat WhatsApp.', 'err');
    let data;
    try { data = await siapkanData(daftar, { pengaturan: peng, catatan: opsi.catatan }); }
    catch (err) { return toast(pesanGalat(err), 'err'); }
    const { data: log } = await sb.from('log_wa').select('pendaftar_id,templat,pada').in('pendaftar_id', daftar.slice(0, 500).map(p => p.id)).order('pada', { ascending: false });
    const terkirim = {}; (log || []).forEach(l => { const k = l.pendaftar_id + '|' + l.templat; if (!terkirim[k]) terkirim[k] = l.pada; });
    const satu = daftar.length === 1;
    let templat = kunci.includes(opsi.awal) ? opsi.awal : satu ? (templatAwal(daftar[0], T) || kunci[0]) : kunci[0];
    let urut = daftar.slice(), i = 0, jml = 0, ke = 'utama', lewati = !satu, hanyaTagihan = false;
    const aktif = () => urut.filter(p => !hanyaTagihan || data[p.id]._sisa > 0);
    const lompat = n => { const a = aktif(); let j = n; if (lewati) while (j < a.length && terkirim[a[j].id + '|' + templat]) j++; return j < a.length ? j : Math.min(n, a.length - 1); };
    i = lompat(0);

    const tampil = root => {
      const a = aktif();
      root.querySelector('#waKosong').hidden = !!a.length;
      root.querySelector('#waUtama').hidden = !a.length;
      if (!a.length) return;
      i = Math.max(0, Math.min(i, a.length - 1));
      const p = a[i], sudah = terkirim[p.id + '|' + templat], nomor = ke === 'darurat' && p.darurat_no ? p.darurat_no : p.no_wa;
      root.querySelector('#waNo').textContent = `${i + 1} / ${a.length}`;
      root.querySelector('#waBar').style.width = `${Math.round((i + 1) / a.length * 100)}%`;
      root.querySelector('#waPenerima').innerHTML = `<b>${esc(p.nama_lengkap)}</b> <span class="mono muted">${esc(p.no_registrasi)}</span>
        <div>${nomor ? `<i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i> +${esc(nomor)}${ke === 'darurat' && p.darurat_no ? ` (${esc(p.darurat_nama || 'kontak darurat')})` : ' (orang tua)'}` : '<span style="color:var(--danger)">Nomor WhatsApp kosong</span>'}
        ${sudah ? `<span class="pill" style="--tone:var(--ok)"><i class="ph-duotone ph-check"></i>Sudah dikirim ${fmt.tglJam(sudah)}</span>` : ''}
        ${templat === 'tagihan' && !data[p.id]._sisa ? '<span class="pill" style="--tone:var(--c8)">Tidak ada sisa tagihan</span>' : ''}</div>`;
      const ta = root.querySelector('#waIsi');
      ta.value = UI().isiTemplat(T[templat]?.isi || '', data[p.id]);
      root.querySelector('#waPrev').innerHTML = UI().formatWA(ta.value);
    };

    await dialog({
      judul: opsi.judul || (satu ? 'Kirim WhatsApp' : `WhatsApp beruntun · ${fmt.angka(daftar.length)} penerima`), ikon: 'ph-whatsapp-logo', tone: '#16a34a', lebar: true,
      isi: `<div class="wa-urut">
        <div class="field" style="margin:0 0 10px"><label>Templat pesan</label>
          <div class="chips-select templat-pilih" id="waTpl">${kunci.map(x => { const [ic, t] = ikon(x); return `<label><input type="radio" name="tpl" value="${x}" ${x === templat ? 'checked' : ''}><i class="ph-duotone ${ic}" style="color:${t}"></i>${esc(T[x].judul || x)}</label>`; }).join('')}</div></div>
        <div class="wa-opsi">
          <label class="check"><input type="radio" name="waKe" value="utama" checked>Kirim ke orang tua</label>
          <label class="check"><input type="radio" name="waKe" value="darurat">Kirim ke kontak darurat</label>
          ${satu ? '' : `<label class="check"><input type="checkbox" id="waLewati" ${lewati ? 'checked' : ''}>Lewati yang sudah dikirimi templat ini</label>
          <label class="check"><input type="checkbox" id="waTagihan">Hanya yang masih punya tagihan</label>`}
        </div>
        <p class="note info" id="waKosong" hidden style="margin:8px 0"><i class="ph-duotone ph-info"></i>Tidak ada penerima yang cocok dengan pilihan ini.</p>
        <div id="waUtama">
          ${satu ? '' : '<div class="wa-urut-kepala"><b id="waNo"></b><div class="gr-kemajuan" style="flex:1"><i id="waBar" style="--gr-w:#16a34a"></i></div></div>'}
          ${satu ? '<b id="waNo" hidden></b><i id="waBar" hidden></i>' : ''}
          <div class="wa-kirim"><div>
            <div class="wa-penerima" id="waPenerima"></div>
            <div class="field"><label>Isi pesan (dapat diubah sebelum dikirim)</label><textarea class="textarea" id="waIsi" rows="10"></textarea>
              <small>*tebal*, _miring_. Teks {dalam kurung kurawal} belum terisi datanya; ubah sebelum mengirim.</small></div></div>
            <div class="wa-layar"><div class="wa-gelembung" id="waPrev"></div></div></div>
        </div>
        ${satu ? '' : '<p class="muted kecil" style="margin:6px 0 0"><i class="ph-duotone ph-info"></i> Setiap klik <b>Buka WhatsApp</b> membuka satu percakapan di tab baru dan tercatat di riwayat santri. Kembali ke tab ini untuk penerima berikutnya.</p>'}
      </div>`,
      tombol: [
        { label: satu ? 'Batal' : 'Selesai', kelas: 'ghost', nilai: true },
        ...(satu ? [] : [
          { label: 'Sebelumnya', ikon: 'ph-caret-left', kelas: 'ghost', aksi: root => { if (i > 0) { i--; tampil(root); } return false; } },
          { label: 'Lewati', ikon: 'ph-skip-forward', kelas: 'ghost', aksi: root => { if (i < aktif().length - 1) { i++; tampil(root); } else toast('Ini penerima terakhir.', 'info'); return false; } }]),
        { label: 'Buka WhatsApp', ikon: 'ph-paper-plane-tilt', kelas: 'wa-btn', aksi: async root => {
          const a = aktif(); if (!a.length) return false;
          const p = a[i], nomor = String((ke === 'darurat' && p.darurat_no ? p.darurat_no : p.no_wa) || '').replace(/\D/g, ''), pesan = root.querySelector('#waIsi').value.trim();
          if (!nomor) { toast('Nomor WhatsApp kosong.', 'warn'); return false; }
          if (!pesan) { toast('Isi pesan masih kosong.', 'warn'); return false; }
          window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`, '_blank', 'noopener');
          const { error } = await sb.from('log_wa').insert({ pendaftar_id: p.id, templat, nomor, pesan });
          if (error) toast('WhatsApp dibuka, tetapi riwayat tidak tersimpan: ' + pesanGalat(error), 'warn');
          terkirim[p.id + '|' + templat] = new Date().toISOString(); jml++;
          if (satu) { toast('WhatsApp dibuka dan tercatat di riwayat.'); opsi.saatKirim?.(); return true; }
          if (i < a.length - 1) i++; else toast(`Selesai. ${jml} pesan dibuka.`, 'ok');
          tampil(root); opsi.saatKirim?.(); return false;
        } }
      ],
      saatBuka: root => {
        root.querySelectorAll('[name=tpl]').forEach(r => r.onchange = () => { templat = r.value; i = lompat(0); tampil(root); });
        root.querySelectorAll('[name=waKe]').forEach(r => r.onchange = () => { ke = r.value; tampil(root); });
        const cl = root.querySelector('#waLewati'); if (cl) cl.onchange = () => { lewati = cl.checked; i = lompat(0); tampil(root); };
        const ct = root.querySelector('#waTagihan'); if (ct) ct.onchange = () => { hanyaTagihan = ct.checked; i = lompat(0); tampil(root); };
        root.querySelector('#waIsi').oninput = e => { root.querySelector('#waPrev').innerHTML = UI().formatWA(e.target.value); };
        if (templat === 'tagihan' && ct) { ct.checked = true; hanyaTagihan = true; i = lompat(0); }
        tampil(root);
      }
    });
    return jml;
  }

  window.SPMB_WA = { IKON, ikon, ISIAN, urutkan, siapkanData, kirimBeruntun, teksPertemuan, templatAwal };
})();
