/* =====================================================================
   DAFTAR ULANG (Fase 4 · Langkah 6) · halaman daftar-ulang.html
   1. Masuk: nomor registrasi + NISN + tanggal lahir (5 kali salah → 15 menit)
      Panitia: daftar-ulang.html?panitia=<id pendaftar> (sesi dashboard)
   2. Formulir 10 langkah; data pendaftaran tampil otomatis (sebagian terkunci)
   3. Tagihan, rekening, unggah bukti bayar dan berkas (Jembatan Unggah)
   4. Kirim → Menunggu verifikasi → Admin memverifikasi → Selesai
   5. Unduh Bukti Daftar Ulang dan Kuitansi
   Dimuat sebelum situs.js; situs.js memanggil SPMB_HAL['daftar-ulang']().
   ===================================================================== */
(function () {
  'use strict';
  window.SPMB_HAL = window.SPMB_HAL || {};
  const KUNCI_NO = 'spmb-cek-no', KUNCI_TOKEN = 'spmb-du-token';

  window.SPMB_HAL['daftar-ulang'] = async api => {
    const { sb, fmt, esc, toast, konfirmasi, pesanGalat, cetakDokumen, buatPdfDokumen, simpanPdf, unggahBerkasPendaftar } = window.SPMB;
    const DU = window.SPMB_DU;
    const $ = (s, r = document) => r.querySelector(s);
    const S = api.S, cfg = S.p.daftar_ulang || {}, spmb = S.p.spmb || {};
    const kp = S.p.ketua_panitia || {};
    const kontak = (S.konten.kontak_panitia || []).find(k => k.data.no_wa);
    const noWA = String(kp.no_wa || kontak?.data.no_wa || '').replace(/\D/g, '').replace(/^0/, '62');
    const waTautan = pesan => `https://wa.me/${noWA}?text=${encodeURIComponent(pesan)}`;
    const q = new URLSearchParams(location.search);
    const idPanitia = q.get('panitia');
    const tglId = iso => iso ? fmt.tglPanjang(new Date(String(iso).slice(0, 10) + 'T00:00:00')) : '';
    const rentang = (a, b) => !a ? '' : !b || a === b ? tglId(a) : `${tglId(a)} – ${tglId(b)}`;
    const digit = v => String(v ?? '').replace(/\D/g, '');
    const normalWA = v => { let x = digit(v); if (x.startsWith('0')) x = '62' + x.slice(1); else if (x.startsWith('8')) x = '62' + x; return x; };
    document.title = `Daftar Ulang · ${S.p.identitas?.nama_singkat || 'SPMB'}`;

    $('#isi').innerHTML = `${api.kepalaHalaman('Daftar Ulang Santri Baru', `SPMB Tahun Ajaran ${S.ta}`, 'ph-clipboard-text', 'var(--c3)')}
      <section class="sek daftar-sek"><div class="wadah" id="W"><div class="kartu" style="padding:24px"><span class="spinner"></span> Memuat…</div></div></section>`;
    const W = $('#W');

    let token = null, paket = null, D = {}, L = 0, maks = 0, berkasDu = {}, tokenUnggah = null;
    const ISIAN = DU.isianLengkap(cfg);
    const isianLangkah = s => ISIAN.filter(f => f.s === s);
    const tampilKah = f => !f.jika || f.jika(D);
    const wajib = f => DU.wajibKah(f, cfg) && tampilKah(f);
    const BERKAS = () => (cfg.berkas || []).map(b => ({ ...b, wajib: !!b.wajib || (b.kunci === 'kartu_kip' && (D.penerima_kip === 'Ya' || D.penerima_kks === 'Ya')) }));

    /* ---------- 1. Masuk ---------- */
    async function masuk() {
      try { token = sessionStorage.getItem(KUNCI_TOKEN) || null; } catch (e) {}
      if (idPanitia) {
        const { data: s } = await sb.auth.getSession();
        if (!s?.session) { W.innerHTML = `<div class="kartu"><div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>Mode panitia memerlukan sesi dashboard. <a href="masuk.html">Masuk panitia</a> dulu.</div></div></div>`; return; }
        const { data, error } = await sb.rpc('du_masuk_panitia', { p_id: idPanitia });
        if (error) { W.innerHTML = `<div class="kartu"><div class="note err"><i class="ph-duotone ph-warning-circle"></i><div>${esc(pesanGalat(error))}</div></div></div>`; return; }
        token = data; return muatPaket();
      }
      if (token && await muatPaket(true)) return;
      token = null;
      const noAwal = q.get('no') || (() => { try { return localStorage.getItem(KUNCI_NO) || ''; } catch (e) { return ''; } })();
      W.innerHTML = `<div class="cek-wadah" style="margin:0 auto">
        <form class="kartu cek-form" id="fMasuk" novalidate>
          <h2><i class="ph-duotone ph-shield-check" style="color:var(--c3)"></i>Masuk daftar ulang</h2>
          <p class="muted" style="margin:-4px 0 14px">Khusus calon santri yang dinyatakan <b>LULUS</b>. Siapkan Kartu Keluarga, data orang tua, dan bukti transfer biaya daftar ulang.</p>
          <div class="field"><label for="mNo">Nomor registrasi <span class="req">*</span></label>
            <input class="input mono" id="mNo" value="${esc(noAwal)}" placeholder="Contoh: SPMB${String(SPMB.tahunAwalTA(SPMB.taAktif(S.p))).slice(2)}-SMP-P-0001" autocomplete="off" autocapitalize="characters" maxlength="40"></div>
          <div class="field"><label for="mNisn">NISN <span class="req">*</span></label>
            <input class="input mono" id="mNisn" inputmode="numeric" maxlength="14" placeholder="10 digit" autocomplete="off"></div>
          <div class="field"><label for="mLahir">Tanggal lahir calon santri <span class="req">*</span></label>
            <input class="input" id="mLahir" name="lahir" type="date" max="${fmt.isoTgl()}"></div>
          <div id="mPesan"></div>
          <button class="btn block" type="submit" id="mTombol"><i class="ph-duotone ph-sign-in"></i>Masuk</button>
          <p class="muted kecil" style="margin:12px 0 0"><i class="ph-duotone ph-lock-simple"></i> Ketiga data harus cocok dengan data pendaftaran. Lima kali salah akan dikunci 15 menit.
            ${noWA.length >= 10 ? `Kesulitan masuk? <a href="${waTautan(`Assalamu'alaikum, saya kesulitan masuk ke halaman daftar ulang SPMB ${S.ta}. Nama calon santri: `)}" target="_blank" rel="noopener">Hubungi panitia</a>.` : ''}</p>
        </form></div>`;
      const f = $('#fMasuk');
      $('#mNo').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
      f.onsubmit = async e => {
        e.preventDefault();
        const no = $('#mNo').value.trim(), nisn = digit($('#mNisn').value), lahir = f.elements.lahir.value;
        const pesan = (t, j = 'err') => { $('#mPesan').innerHTML = t ? `<div class="note ${j}"><i class="ph-duotone ph-warning-circle"></i><div>${esc(t)}</div></div>` : ''; };
        if (no.length < 5) return pesan('Isi nomor registrasi.');
        if (!/^\d{10}$/.test(nisn)) return pesan('NISN harus 10 digit angka.');
        if (!lahir) return pesan('Isi tanggal lahir dengan format dd/mm/yyyy.');
        const b = $('#mTombol'); b.disabled = true;
        try {
          const { data, error } = await sb.rpc('du_masuk', { p_no: no, p_nisn: nisn, p_tanggal_lahir: lahir });
          if (error) throw error;
          if (!data.ok) return pesan(data.pesan, data.terkunci ? 'warn' : 'err');
          token = data.token;
          try { sessionStorage.setItem(KUNCI_TOKEN, token); localStorage.setItem(KUNCI_NO, no.toUpperCase()); } catch (e) {}
          await muatPaket();
        } catch (err) { pesan(pesanGalat(err)); } finally { b.disabled = false; }
      };
    }

    async function muatPaket(diam = false) {
      const { data, error } = await sb.rpc('du_data', { p_token: token });
      if (error) {
        try { sessionStorage.removeItem(KUNCI_TOKEN); } catch (e) {}
        if (diam) return false;
        toast(pesanGalat(error), 'err', 6000); token = null; return masuk();
      }
      paket = data;
      D = DU.nilaiGabung(paket);
      // nilai bawaan isian baru
      ISIAN.forEach(f => { if (f.k && f.src === 'd' && (D[f.k] == null || D[f.k] === '') && f.bawaan) D[f.k] = f.bawaan; });
      ['rt', 'rw'].forEach(k => { if (D[k]) D[k] = String(+D[k]); });
      D._bayar = { nominal: '', tanggal: fmt.isoTgl(), nama_pengirim: '', bank_pengirim: '', ...(paket.du.bayar || {}) };
      if (!D._bayar.nominal) D._bayar.nominal = String(totalTagihan() || '');
      susunBerkas();
      const st = paket.du.status;
      if (!paket.panitia && ['menunggu', 'selesai'].includes(st)) tampilStatus();
      else tampilForm();
      return true;
    }
    const totalTagihan = () => +DU.ringkasDari(paket).bayar || 0;
    function susunBerkas() {
      berkasDu = {};
      (paket.berkas || []).forEach(b => { berkasDu[b.jenis] = b; });   // terakhir per jenis
    }

    /* ---------- 2. Status (menunggu/selesai) ---------- */
    function tampilStatus() {
      const du = paket.du, p = paket.pendaftar, [lbl, tone, ikon] = DU.STATUS_DU[du.status];
      const selesai = du.status === 'selesai';
      W.innerHTML = `<div class="cek-wadah" style="margin:0 auto">
        <div class="kartu pgm-hasil" style="--tone:${tone}">
          <div class="pgm-hasil-ikon"><i class="ph-duotone ${ikon}"></i></div>
          <small>${esc(p.nama_lengkap)} · <span class="mono">${esc(p.no_registrasi)}</span></small>
          <h2 style="font-size:24px;letter-spacing:0">${esc(lbl)}</h2>
          <p>${selesai ? 'Alhamdulillah, daftar ulang sudah diverifikasi panitia. Simpan Bukti Daftar Ulang dan Kuitansi, lalu bawa saat kedatangan santri ke pondok.'
            : `Daftar ulang terkirim ${fmt.tglJam(du.dikirim_pada)} WITA dan sedang diperiksa panitia. Bila ada yang perlu diperbaiki, panitia menghubungi melalui WhatsApp.`}</p>
          <dl class="cek-data">
            <div><dt>Jenjang</dt><dd>${esc(p.jenjang)} ${p.bagian === 'putri' ? 'Putri' : 'Putra'}</dd></div>
            <div><dt>Tagihan${DU.ringkasDari(paket).potongan ? ' (setelah keringanan)' : ''}</dt><dd>${DU.rupiah(totalTagihan() || du.tagihan)}</dd></div>
            ${selesai && totalTagihan() > +DU.ringkasDari(paket).dibayar ? `<div><dt>Sisa tagihan</dt><dd style="color:var(--c3)">${DU.rupiah(totalTagihan() - DU.ringkasDari(paket).dibayar)}</dd></div>` : ''}
            ${selesai ? `<div><dt>Dibayar</dt><dd>${DU.rupiah(du.diterima_nominal)}</dd></div><div><dt>Nomor kuitansi</dt><dd class="mono">${esc(du.nomor_kuitansi || '–')}</dd></div>` : ''}
          </dl>
          <div class="pgm-aksi">
            <button type="button" class="btn" data-dok="bukti"><i class="ph-duotone ph-file-pdf"></i>Bukti Daftar Ulang</button>
            ${selesai ? '<button type="button" class="btn ghost" data-dok="kuitansi"><i class="ph-duotone ph-receipt" style="color:var(--ok)"></i>Kuitansi</button>' : ''}
          </div>
        </div>
        <div class="hero-actions cek-aksi">
          ${noWA.length >= 10 ? `<a class="btn ghost" target="_blank" rel="noopener" href="${waTautan(`Assalamu'alaikum, saya ingin bertanya tentang daftar ulang nomor ${p.no_registrasi} atas nama ${p.nama_lengkap}.`)}"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i>Tanya panitia</a>` : ''}
          <button type="button" class="btn ghost" id="keluar"><i class="ph-duotone ph-sign-out"></i>Keluar</button>
        </div></div>`;
      pasangDok(W);
      $('#keluar').onclick = keluar;
    }
    function keluar() { try { sessionStorage.removeItem(KUNCI_TOKEN); } catch (e) {} token = null; paket = null; masuk(); window.scrollTo({ top: 0 }); }
    function pasangDok(root) {
      root.querySelectorAll('[data-dok]').forEach(b => b.onclick = async () => {
        const jenis = b.dataset.dok;
        const opsi = jenis === 'kuitansi' ? DU.dokumenKuitansi(paket, S.p) : DU.dokumenBuktiDU(paket, S.p);
        const pil = await window.SPMB.dialog({ judul: jenis === 'kuitansi' ? 'Kuitansi' : 'Bukti Daftar Ulang', ikon: 'ph-printer', tone: 'var(--c1)',
          isi: '<p style="margin:0">Simpan sebagai PDF atau cetak langsung (kertas F4)?</p>',
          tombol: [{ label: 'Batal', kelas: 'ghost', nilai: null }, { label: 'Cetak', ikon: 'ph-printer', kelas: 'ghost', nilai: 'cetak' }, { label: 'Unduh PDF', ikon: 'ph-file-pdf', nilai: 'pdf' }] });
        if (pil === 'cetak') return cetakDokumen(opsi);
        if (pil !== 'pdf') return;
        const t = toast('Menyusun PDF…', 'info', 60000);
        try { simpanPdf(await buatPdfDokumen(opsi), `${jenis === 'kuitansi' ? 'Kuitansi' : 'Bukti Daftar Ulang'} ${paket.pendaftar.no_registrasi}.pdf`); }
        catch (err) { toast(pesanGalat(err), 'err'); } finally { t.remove(); }
      });
    }

    /* ---------- 3. Formulir ---------- */
    const req = '<span class="req">*</span>';
    const opsiDari = f => f.opsiDari === 'pekerjaan' ? (spmb.pekerjaan || []) : (f.opsi || []);
    function htmlIsian(f) {
      if (f.sub) return `<h3 class="daftar-sub full"><i class="ph-duotone ${f.sub[1]}" style="color:${f.sub[2]}"></i>${f.sub[0]}</h3>`;
      if (!tampilKah(f)) return '';
      const v = D[f.k], id = 'u_' + f.k, w = wajib(f);
      const lab = `<label for="${id}">${esc(f.l)}${f.src === 'kunci' ? ' <i class="ph-duotone ph-lock-simple muted"></i>' : w ? ` ${req}` : ' <span class="muted">(opsional)</span>'}</label>`;
      const bantu = f.b ? `<small class="bantu">${esc(f.b)}</small>` : '';
      const kelas = `field${f.full || ['area', 'baris', 'koordinat'].includes(f.t) ? ' full' : ''}${f.src === 'kunci' ? ' terkunci' : ''}`;
      if (f.src === 'kunci') return `<div class="${kelas}">${lab}<input class="input" id="${id}" value="${esc(DU.teksNilai(f, v))}" readonly></div>`;
      let el;
      switch (f.t) {
        case 'pilih': {
          const op = opsiDari(f); const ada = v && !op.includes(v) ? [v, ...op] : op;
          el = `<select class="select" id="${id}" name="${f.k}"><option value="">— Pilih —</option>${ada.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
        }
        case 'chip': el = `<div class="chips-select">${f.opsi.map(o => `<label><input type="radio" name="${f.k}" value="${esc(o)}" ${o === v ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div>`; break;
        case 'area': el = `<textarea class="textarea" id="${id}" name="${f.k}" rows="2" maxlength="300" ${f.contoh ? `placeholder="${esc(f.contoh)}"` : ''}>${esc(v || '')}</textarea>`; break;
        case 'tanggal': el = `<input class="input" id="${id}" name="${f.k}" type="date" value="${esc(v || '')}" max="${fmt.isoTgl()}">`; break;
        case 'koordinat': {
          const c = v || {};
          el = `<div class="du-lokasi"><button type="button" class="btn sm ghost" id="ambilLokasi"><i class="ph-duotone ph-crosshair" style="color:var(--c1)"></i>Ambil lokasi saya</button>
            <span class="muted kecil" id="teksLokasi">${c.lat ? `${(+c.lat).toFixed(6)}, ${(+c.lng).toFixed(6)} <a href="https://maps.google.com/?q=${c.lat},${c.lng}" target="_blank" rel="noopener">Lihat di peta</a>` : 'Belum diambil'}</span></div>
            <input class="input" id="${id}" name="koordinat_url" value="${esc(c.url || '')}" placeholder="Atau tempel tautan Google Maps (opsional)" style="margin-top:8px">`; break;
        }
        case 'baris': {
          const rows = Array.isArray(v) && v.length ? v : [];
          el = `<div class="du-baris" data-baris="${f.k}">${rows.map((r, i) => `<div class="du-baris-item">${f.kolom.map(([k, l, t, op]) => t === 'pilih'
            ? `<select class="select" data-bk="${k}" data-i="${i}" aria-label="${esc(l)}"><option value="">${esc(l)}</option>${op.map(o => `<option ${o === r[k] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
            : `<input class="input" data-bk="${k}" data-i="${i}" value="${esc(r[k] || '')}" placeholder="${esc(l)}" ${t === 'angka' ? 'inputmode="numeric" maxlength="4"' : 'maxlength="120"'}>`).join('')}
            <button type="button" class="icon-btn plain" data-hapus-baris="${i}" aria-label="Hapus baris"><i class="ph-duotone ph-trash" style="color:var(--danger)"></i></button></div>`).join('')}
            <button type="button" class="btn sm ghost" data-tambah-baris="${f.k}"><i class="ph-duotone ph-plus-circle" style="color:var(--c6)"></i>Tambah baris</button></div>`; break;
        }
        default: {
          const mode = { angka: f.desimal ? 'decimal' : 'numeric', nik: 'numeric', kodepos: 'numeric', tel: 'tel', email: 'email' }[f.t] || '';
          const nilai = f.t === 'tel' && v ? '0' + String(v).replace(/^62/, '') : v ?? '';
          const inp = `<input class="input" id="${id}" name="${f.k}" value="${esc(nilai)}" ${mode ? `inputmode="${mode}"` : ''} type="${f.t === 'email' ? 'email' : f.t === 'tel' ? 'tel' : 'text'}"
            maxlength="${f.t === 'nik' ? 20 : f.t === 'kodepos' ? 6 : f.t === 'tel' ? 18 : f.maks || 100}" ${f.contoh ? `placeholder="${esc(f.contoh)}"` : f.t === 'nik' ? 'placeholder="16 digit"' : f.t === 'tel' ? 'placeholder="08xxxxxxxxxx"' : ''} autocomplete="off">`;
          el = f.satuan ? `<div class="isian-satuan">${inp}<span>${f.satuan}</span></div>` : inp;
        }
      }
      return `<div class="${kelas}" data-f="${f.k}">${lab}${el}${bantu}<small class="pesan"></small></div>`;
    }
    // Validasi satu isian: null | pesan galat
    function cek(f) {
      if (!f.k || f.src === 'kunci' || !tampilKah(f)) return null;
      const v = D[f.k], kosong = v == null || String(v).trim() === '' || (Array.isArray(v) && !v.length) || (f.t === 'koordinat' && !(v?.lat || v?.url));
      if (kosong) return wajib(f) ? `${f.l} wajib diisi.` : null;
      if (f.t === 'nik' && !/^\d{16}$/.test(digit(v))) return `${f.l} harus 16 digit angka.`;
      if (f.t === 'kodepos' && !/^\d{5}$/.test(digit(v))) return 'Kode pos harus 5 digit.';
      if (f.t === 'tel' && !/^628\d{7,11}$/.test(normalWA(v))) return 'Nomor diawali 08 atau +62, 10–13 digit.';
      if (f.t === 'email' && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(v).trim())) return 'Alamat email belum benar.';
      if (f.t === 'angka') { const n = parseFloat(String(v).replace(',', '.')); if (isNaN(n) || (f.min != null && n < f.min) || (f.max != null && n > f.max)) return `${f.l} harus angka${f.min != null ? ` ${f.min}–${f.max}` : ''}${f.satuan ? ' ' + f.satuan : ''}.`; }
      return null;
    }
    function tulis(k, pesan) {
      const box = W.querySelector(`[data-f="${k}"]`); if (!box) return;
      box.classList.toggle('salah', !!pesan);
      const inp = box.querySelector('input:not([type=radio]),select,textarea'); if (inp) { inp.classList.toggle('bad', !!pesan); inp.classList.toggle('good', !pesan && !!inp.value); }
      const ps = box.querySelector('.pesan'); if (ps) { ps.textContent = pesan || ''; ps.className = 'pesan' + (pesan ? ' err' : ''); }
    }

    const HAL = {
      8: () => {
        const tag = paket.tagihan || [], rek = paket.rekening || [], b = D._bayar;
        return `${tag.length || rek.length ? `<div class="bayar-kotak">
            ${tag.length ? `<div class="bayar-rincian"><small>Biaya daftar ulang ${esc(paket.pendaftar.jenjang)} ${paket.pendaftar.bagian === 'putri' ? 'Putri' : 'Putra'}</small>
              ${DU.rincianHTML(DU.ringkasDari(paket))}
              ${DU.ringkasDari(paket).ada_keringanan ? '<small class="bayar-catatan"><i class="ph-duotone ph-hand-heart"></i> Ananda mendapat keringanan biaya dari pondok. Transfer sesuai total setelah keringanan.</small>' : ''}</div>` : ''}
            ${rek.length ? `<div class="bayar-rek"><small class="rek-judul"><i class="ph-duotone ph-warning-circle"></i> Rekening khusus <b>daftar ulang</b>. Jangan transfer ke rekening pendaftaran.</small>${rek.map(r => `<div class="rek-item"><span class="ic-box" style="--tone:var(--c5)"><i class="ph-duotone ph-bank"></i></span>
              <div><small>${esc(r.bank)}</small><b>${esc(r.nomor_rekening)}</b><span>a.n. ${esc(r.atas_nama)}</span>${r.keterangan ? `<em>${esc(r.keterangan)}</em>` : ''}</div>
              <button type="button" class="icon-btn plain" data-salin="${esc(digit(r.nomor_rekening))}" title="Salin nomor rekening" aria-label="Salin nomor rekening"><i class="ph-duotone ph-copy"></i></button></div>`).join('')}</div>` : ''}
          </div>` : '<div class="note"><i class="ph-duotone ph-info"></i><div>Rincian biaya daftar ulang belum diumumkan. Tanyakan kepada panitia sebelum transfer.</div></div>'}
          ${cfg.catatan ? `<div class="note info"><i class="ph-duotone ph-info"></i><div>${esc(cfg.catatan)}</div></div>` : ''}
          <h3 class="daftar-sub"><i class="ph-duotone ph-receipt" style="color:var(--ok)"></i>Data transfer</h3>
          <div class="grid-form">
            <div class="field" data-f="_nominal"><label for="bNom">Nominal yang ditransfer ${paket.panitia ? '' : req}</label><div class="isian-satuan pra"><span>Rp</span><input class="input" id="bNom" inputmode="numeric" value="${esc(b.nominal ? fmt.angka(+digit(b.nominal)) : '')}"></div>
              <small class="bantu">Boleh kurang dari total bila disepakati mencicil dengan panitia.</small><small class="pesan"></small></div>
            <div class="field" data-f="_tanggal"><label for="bTgl">Tanggal transfer ${req}</label><input class="input" id="bTgl" type="date" value="${esc(b.tanggal || '')}" max="${fmt.isoTgl()}"><small class="pesan"></small></div>
            <div class="field" data-f="_nama_pengirim"><label for="bNama">Nama pengirim (pemilik rekening) ${paket.panitia ? '' : req}</label><input class="input" id="bNama" maxlength="100" value="${esc(b.nama_pengirim || '')}"><small class="pesan"></small></div>
            <div class="field"><label for="bBank">Bank / dompet digital pengirim <span class="muted">(opsional)</span></label><input class="input" id="bBank" maxlength="60" value="${esc(b.bank_pengirim || '')}"></div>
          </div>
          <h3 class="daftar-sub"><i class="ph-duotone ph-files" style="color:var(--c4)"></i>Unggah berkas</h3>
          <p class="muted" style="margin:0 0 12px;font-size:13.5px"><i class="ph-duotone ph-info"></i> Foto otomatis diperkecil. PDF maksimal 5 MB. Pastikan tulisan terbaca jelas.</p>
          <div class="berkas-daftar">${BERKAS().sort((a, c) => c.wajib - a.wajib).map(kartuBerkas).join('')}</div>`;
      },
      9: () => {
        const blok = s => {
          const baris = isianLangkah(s).filter(f => f.k && tampilKah(f) && f.src !== 'kunci').map(f => `<div><span>${esc(f.l)}</span><b>${esc(DU.teksNilai(f, D[f.k]))}</b></div>`).join('');
          return `<div class="ringkas-blok"><div class="ringkas-kepala"><span class="ic-box" style="--tone:${DU.LANGKAH[s][2]}"><i class="ph-duotone ${DU.LANGKAH[s][1]}"></i></span><b>${DU.LANGKAH[s][0]}</b>
            <button type="button" class="btn sm ghost" data-ke="${s}"><i class="ph-duotone ph-pencil-simple"></i>Ubah</button></div><div class="ringkas-isi">${baris || '<div><span>Tidak ada isian</span><b>–</b></div>'}</div></div>`;
        };
        const b = D._bayar;
        return `${[0, 1, 2, 3, 4, 5, 6, 7].map(blok).join('')}
          <div class="ringkas-blok"><div class="ringkas-kepala"><span class="ic-box" style="--tone:var(--ok)"><i class="ph-duotone ph-wallet"></i></span><b>Pembayaran dan berkas</b>
            <button type="button" class="btn sm ghost" data-ke="8"><i class="ph-duotone ph-pencil-simple"></i>Ubah</button></div>
            <div class="ringkas-isi"><div><span>Total tagihan</span><b>${DU.rupiah(totalTagihan())}</b></div><div><span>Ditransfer</span><b>${b.nominal ? DU.rupiah(digit(b.nominal)) : '–'}</b></div>
              <div><span>Tanggal / pengirim</span><b>${esc(b.tanggal ? tglId(b.tanggal) : '–')} · ${esc(b.nama_pengirim || '–')}</b></div>
              ${BERKAS().map(x => `<div><span>${esc(x.label)}</span><b>${berkasDu[x.kunci] ? '<i class="ph-duotone ph-check-circle" style="color:var(--ok)"></i> Terunggah' : x.wajib ? '<span style="color:var(--danger)">Belum diunggah</span>' : '–'}</b></div>`).join('')}</div></div>
          <label class="check pernyataan" data-f="pernyataan"><input type="checkbox" id="setuju" ${D.pernyataan ? 'checked' : ''}><span>${esc(cfg.pernyataan || 'Saya menyatakan data yang diisi benar.')}</span></label>
          <small class="pesan" data-pesan="pernyataan"></small>`;
      }
    };
    const kartuBerkas = b => {
      const x = berkasDu[b.kunci];
      const st = x ? { menunggu: ['Terunggah, menunggu verifikasi', 'var(--c2)'], diterima: ['Diterima', 'var(--ok)'], ditolak: ['Ditolak: ' + (x.catatan || 'unggah ulang'), 'var(--danger)'] }[x.status] : null;
      return `<div class="berkas-kartu${x ? ' ada' : ''}" data-berkas="${b.kunci}" data-f="berkas_${b.kunci}">
        <div class="berkas-prev">${x ? `<i class="ph-duotone ${x.mime === 'application/pdf' ? 'ph-file-pdf' : 'ph-image'}" style="color:var(--ok)"></i>` : '<i class="ph-duotone ph-file-arrow-up"></i>'}</div>
        <div class="berkas-teks"><b>${esc(b.label)} ${b.wajib ? req : '<span class="muted">(opsional)</span>'}</b>
          <span class="berkas-status">${x ? `<span style="color:${st[1]}">${esc(st[0])}</span> · ${esc(x.nama)}` : 'Foto (JPG/PNG) atau PDF'}</span><small class="pesan"></small></div>
        <label class="btn sm ${x ? 'ghost' : ''}"><i class="ph-duotone ${x ? 'ph-arrows-clockwise' : 'ph-upload-simple'}"></i>${x ? 'Ganti' : 'Pilih'}
          <input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf"></label></div>`;
    };

    function tampilForm() {
      const p = paket.pendaftar, du = paket.du;
      W.innerHTML = `
        ${paket.panitia ? `<div class="note info pita-uji"><i class="ph-duotone ph-user-circle-gear"></i><div><b>Mode panitia:</b> Anda mengisi daftar ulang atas nama <b>${esc(p.nama_lengkap)}</b> (${esc(p.no_registrasi)}). Isian dan berkas tidak wajib lengkap; verifikasi tetap di dashboard.</div></div>` : ''}
        ${du.status === 'perbaikan' ? `<div class="note err"><i class="ph-duotone ph-warning"></i><div><b>Perlu perbaikan dari panitia:</b><br>${esc(du.catatan || '').replace(/\n/g, '<br>')}<br><small>Perbaiki isian atau berkas yang dimaksud, lalu kirim ulang pada langkah terakhir.</small></div></div>` : ''}
        ${du.status === 'selesai' && paket.panitia ? '<div class="note ok-note"><i class="ph-duotone ph-seal-check"></i><div>Daftar ulang ini sudah <b>selesai</b>. Perubahan data tetap tersimpan, status tidak berubah.</div></div>' : ''}
        <div class="du-kepala kartu"><div><small>Calon santri</small><b>${esc(p.nama_lengkap)}</b><span class="mono muted">${esc(p.no_registrasi)} · ${esc(p.jenjang)} ${p.bagian === 'putri' ? 'Putri' : 'Putra'}</span></div>
          <div><small>Batas daftar ulang</small><b>${esc(rentang(paket.gelombang.daftar_ulang_mulai, paket.gelombang.daftar_ulang_selesai) || 'Menyusul')}</b></div>
          ${paket.panitia ? '' : '<button type="button" class="btn sm ghost" id="keluar"><i class="ph-duotone ph-sign-out"></i>Keluar</button>'}</div>
        <div class="kartu daftar-kartu">
          <ol class="stepper-daftar sepuluh" id="stepper"></ol>
          <div class="stepper-hp"><b id="judulLangkah"></b><span id="nomorLangkah"></span><i class="bar"><i id="barLangkah"></i></i></div>
          <form id="fDu" novalidate autocomplete="off"><div id="isiLangkah"></div></form>
          <div class="daftar-aksi">
            <button type="button" class="btn ghost" id="btnKembali"><i class="ph-duotone ph-arrow-left"></i>Kembali</button>
            <span class="muted simpan-status" id="statusSimpan">${du.diperbarui_pada ? `Tersimpan ${fmt.tglJam(du.diperbarui_pada)}` : ''}</span>
            <button type="button" class="btn" id="btnLanjut"></button>
          </div>
        </div>`;
      $('#keluar')?.addEventListener('click', keluar);
      $('#stepper').addEventListener('click', e => { const li = e.target.closest('li.bisa'); if (li) pindah(+li.dataset.ke); });
      $('#btnKembali').onclick = () => pindah(L - 1, true);
      $('#btnLanjut').onclick = () => L < 9 ? pindah(L + 1) : kirim();
      const form = $('#fDu');
      form.addEventListener('input', onUbah);
      form.addEventListener('change', onUbah);
      form.addEventListener('click', onKlik);
      // ditunda agar klik tombol tidak hilang karena tata letak bergeser saat pesan galat berubah
      form.addEventListener('focusout', e => { const box = e.target.closest('[data-f]'); const f = ISIAN.find(x => x.k === box?.dataset.f); if (f && D[f.k] !== undefined && D[f.k] !== '') setTimeout(() => tulis(f.k, cek(f)), 250); });
      maks = du.status === 'belum' ? 0 : 9;
      render();
    }
    function render() {
      maks = Math.max(maks, L);
      $('#stepper').innerHTML = DU.LANGKAH.map(([l, ic, t], i) => `<li class="${i < L ? 'selesai' : i === L ? 'aktif' : ''}${i <= maks && i !== L ? ' bisa' : ''}" data-ke="${i}" style="--tone:${t}">
        <span class="no">${i < L ? '<i class="ph-duotone ph-check"></i>' : i + 1}</span><span class="lbl">${l}</span></li>`).join('');
      $('#judulLangkah').textContent = DU.LANGKAH[L][0];
      $('#nomorLangkah').textContent = `Langkah ${L + 1} dari 10`;
      $('#barLangkah').style.width = `${(L + 1) * 10}%`;
      $('#isiLangkah').innerHTML = HAL[L] ? HAL[L]() : `
        ${L === 5 && (paket.pendaftar.prestasi || []).length ? `<div class="note info"><i class="ph-duotone ph-trophy"></i><div><b>Prestasi saat pendaftaran:</b><br>${paket.pendaftar.prestasi.map(x => esc([x.nama, x.tingkat, x.tahun].filter(Boolean).join(' · '))).join('<br>')}<br><small>Tambahkan prestasi lain di bawah bila ada.</small></div></div>` : ''}
        ${L === 5 ? '<p class="muted" style="margin:0 0 10px">Opsional. Tulis prestasi akademik maupun nonakademik, termasuk lomba tahfizh.</p>' : ''}
        ${L === 2 ? '<p class="muted" style="margin:0 0 10px">Nama ayah dan ibu mengikuti data pendaftaran. Bila keliru, hubungi panitia.</p>' : ''}
        ${L === 1 ? '<p class="muted" style="margin:0 0 10px">Wilayah mengikuti data pendaftaran. Bila pindah wilayah, hubungi panitia untuk memperbaruinya.</p>' : ''}
        <div class="grid-form">${isianLangkah(L).map(htmlIsian).join('')}</div>`;
      $('#btnKembali').style.visibility = L ? 'visible' : 'hidden';
      $('#btnLanjut').innerHTML = L === 9 ? `<i class="ph-duotone ph-paper-plane-tilt"></i>${paket.du.status === 'perbaikan' ? 'Kirim ulang' : paket.panitia && paket.du.status === 'selesai' ? 'Simpan perubahan' : 'Kirim daftar ulang'}`
        : `Simpan, lanjut: ${DU.LANGKAH[L + 1][0]}<i class="ph-duotone ph-arrow-right"></i>`;
      window.SPMB.isiTanggalBawaan?.($('#isiLangkah'));
      if (L === 8) pasangBerkas();
    }
    function onUbah(e) {
      const t = e.target;
      if (t.dataset.bk) {   // baris berulang
        const box = t.closest('[data-baris]'), k = box.dataset.baris; D[k] = Array.isArray(D[k]) ? D[k] : [];
        D[k][+t.dataset.i] = { ...(D[k][+t.dataset.i] || {}), [t.dataset.bk]: t.value }; return;
      }
      if (t.id === 'setuju') { D.pernyataan = t.checked; return; }
      if (t.id === 'bNom') { const n = digit(t.value); D._bayar.nominal = n; if (e.type === 'change') t.value = n ? fmt.angka(+n) : ''; return; }
      if (t.id === 'bTgl') { D._bayar.tanggal = t.value; return; }
      if (t.id === 'bNama') { D._bayar.nama_pengirim = t.value; return; }
      if (t.id === 'bBank') { D._bayar.bank_pengirim = t.value; return; }
      if (t.name === 'koordinat_url') { D.koordinat = { ...(D.koordinat || {}), url: t.value.trim() }; return; }
      const f = ISIAN.find(x => x.k === t.name); if (!f) return;
      let v = t.value;
      if (f.t === 'nik' || f.t === 'kodepos') { v = digit(v); if (t.value !== v && e.type === 'change') t.value = v; }
      D[f.k] = v;
      // isian bersyarat: tampilkan/sembunyikan
      if (e.type === 'change' && (f.t === 'chip' || f.t === 'pilih') && ISIAN.some(x => x.jika && x.s === L)) {
        const y = window.scrollY; render(); window.scrollTo(0, y);
      }
      if (e.type === 'change') setTimeout(() => tulis(f.k, cek(f)), 250);
    }
    function onKlik(e) {
      const tb = e.target.closest('[data-tambah-baris]'), hb = e.target.closest('[data-hapus-baris]'), ke = e.target.closest('[data-ke]'), sl = e.target.closest('[data-salin]');
      if (tb) { const k = tb.dataset.tambahBaris; D[k] = [...(Array.isArray(D[k]) ? D[k] : []), {}]; render(); }
      if (hb) { const k = hb.closest('[data-baris]').dataset.baris; D[k].splice(+hb.dataset.hapusBaris, 1); render(); }
      if (ke) pindah(+ke.dataset.ke, true);
      if (sl) { navigator.clipboard?.writeText(sl.dataset.salin).then(() => toast('Nomor rekening disalin.'), () => {}); }
      if (e.target.closest('#ambilLokasi')) {
        if (!navigator.geolocation) return toast('Perangkat ini tidak mendukung pengambilan lokasi.', 'warn');
        $('#teksLokasi').textContent = 'Mengambil lokasi…';
        navigator.geolocation.getCurrentPosition(pos => {
          D.koordinat = { ...(D.koordinat || {}), lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: Math.round(pos.coords.accuracy) };
          $('#teksLokasi').innerHTML = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)} (±${Math.round(pos.coords.accuracy)} m) <a href="https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}" target="_blank" rel="noopener">Lihat di peta</a>`;
        }, () => { $('#teksLokasi').textContent = 'Lokasi tidak dapat diambil. Izinkan akses lokasi atau tempel tautan Google Maps.'; }, { enableHighAccuracy: true, timeout: 15000 });
      }
    }
    function cekLangkah(s) {
      let pertama = null;
      if (s < 8) isianLangkah(s).forEach(f => { const p = cek(f); if (f.k) tulis(f.k, p); if (p && !pertama) pertama = f.k; });
      if (s === 8) {
        const b = D._bayar, err = {};
        if (!paket.panitia && !(+digit(b.nominal) > 0)) err._nominal = 'Isi nominal yang ditransfer.';
        if (!b.tanggal) err._tanggal = 'Isi tanggal transfer.';
        if (!paket.panitia && (b.nama_pengirim || '').trim().length < 3) err._nama_pengirim = 'Isi nama pemilik rekening pengirim.';
        Object.entries({ _nominal: 0, _tanggal: 0, _nama_pengirim: 0 }).forEach(([k]) => tulis(k, err[k]));
        if (!paket.panitia) BERKAS().forEach(x => { const m = x.wajib && !berkasDu[x.kunci] ? 'Berkas ini wajib diunggah.' : berkasDu[x.kunci]?.status === 'ditolak' ? 'Berkas ditolak panitia. Unggah ulang.' : ''; tulis('berkas_' + x.kunci, m); if (m && !pertama) pertama = 'berkas_' + x.kunci; });
        pertama = pertama || Object.keys(err)[0] || null;
      }
      if (pertama) { const el = W.querySelector(`[data-f="${pertama}"]`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return !pertama;
    }
    async function simpan(kirimkan = false) {
      const pend = {}, data = {};
      ISIAN.forEach(f => {
        if (!f.k || f.src === 'kunci') return;
        let v = D[f.k];
        if (f.t === 'tel' && v) v = normalWA(v);
        if (f.t === 'angka' && v !== '' && v != null) v = String(v).replace(',', '.');
        if (f.src === 'p') pend[f.k] = v ?? ''; else data[f.k] = v ?? '';
      });
      data.pernyataan = !!D.pernyataan;
      const { data: h, error } = await sb.rpc('du_simpan', { p_token: token, p_pendaftar: pend, p_data: data, p_bayar: { ...D._bayar, nominal: digit(D._bayar.nominal) }, p_kirim: kirimkan });
      if (error) throw error;
      paket.du.status = h.status; paket.du.diperbarui_pada = new Date().toISOString();
      $('#statusSimpan') && ($('#statusSimpan').textContent = `Tersimpan ${fmt.jam(new Date())}`);
      return h;
    }
    async function pindah(ke, tanpaCek = false) {
      if (ke < 0 || ke > 9) return;
      if (!tanpaCek && ke > L && !cekLangkah(L)) return toast('Periksa kembali isian yang ditandai merah.', 'warn');
      const b = $('#btnLanjut'); b.disabled = true;
      try { await simpan(false); } catch (err) { toast(pesanGalat(err), 'err', 7000); b.disabled = false; return; }
      b.disabled = false;
      L = ke; render(); $('.daftar-kartu').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    async function kirim() {
      for (let s = 0; s < 9; s++) {
        if (s < 8 && isianLangkah(s).some(f => cek(f))) { L = s; render(); cekLangkah(s); return toast(`Ada isian yang belum benar di langkah ${DU.LANGKAH[s][0]}.`, 'warn', 6000); }
        if (s === 8) { L = 8; render(); if (!cekLangkah(8)) return toast('Lengkapi pembayaran dan berkas wajib.', 'warn'); L = 9; render(); }
      }
      if (!D.pernyataan) { const ps = W.querySelector('[data-pesan="pernyataan"]'); if (ps) { ps.textContent = 'Centang pernyataan untuk mengirim.'; ps.className = 'pesan err'; } return; }
      if (!(await konfirmasi('Kirim daftar ulang?', 'Setelah dikirim, data dikunci sampai panitia selesai memeriksa.', 'Kirim'))) return;
      const b = $('#btnLanjut'); b.disabled = true; b.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-color:#fff4;border-top-color:#fff"></span> Mengirim…';
      try {
        await simpan(true);
        const { data } = await sb.rpc('du_data', { p_token: token }); if (data) paket = data;
        if (paket.panitia) { toast('Daftar ulang tersimpan.', 'ok'); return render(); }
        tampilTerkirim();
      } catch (err) { toast(pesanGalat(err), 'err', 8000); b.disabled = false; render(); }
    }
    function tampilTerkirim() {
      const p = paket.pendaftar;
      W.innerHTML = `<div class="cek-wadah" style="margin:0 auto"><div class="kartu pgm-hasil rayakan" style="--tone:var(--ok)">
        <div class="pgm-hasil-ikon"><i class="ph-duotone ph-paper-plane-tilt"></i></div>
        <h2 style="font-size:24px;letter-spacing:0">Daftar ulang terkirim</h2>
        <p>Jazakumullahu khairan. Panitia akan memeriksa data, berkas, dan pembayaran. Hasilnya dapat dilihat dengan masuk kembali ke halaman ini; panitia juga mengabari melalui WhatsApp.</p>
        <div class="pgm-aksi"><button type="button" class="btn" data-dok="bukti"><i class="ph-duotone ph-file-pdf"></i>Unduh Bukti Daftar Ulang</button>
          ${noWA.length >= 10 ? `<a class="btn ghost wa-btn" target="_blank" rel="noopener" href="${waTautan(`Assalamu'alaikum, saya sudah mengirim daftar ulang SPMB.\nNomor registrasi: *${p.no_registrasi}*\nNama: ${p.nama_lengkap}\nNominal transfer: ${DU.rupiah(digit(D._bayar.nominal))}\n\nMohon diperiksa. Jazakumullahu khairan.`)}"><i class="ph-duotone ph-whatsapp-logo"></i>Konfirmasi ke panitia</a>` : ''}</div>
      </div></div>`;
      pasangDok(W);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function pasangBerkas() {
      W.querySelectorAll('[data-berkas] input[type=file]').forEach(inp => inp.onchange = async () => {
        const file = inp.files[0]; if (!file) return;
        const kartu = inp.closest('[data-berkas]'), jenis = kartu.dataset.berkas, st = kartu.querySelector('.berkas-status');
        st.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span> Mengunggah…';
        try {
          if (!tokenUnggah) { const { data, error } = await sb.rpc('du_token_unggah', { p_token: token }); if (error) throw error; tokenUnggah = data; }
          try { await unggahBerkasPendaftar(file, { token: tokenUnggah, jenis }); }
          catch (err) { if (/Sesi unggah berakhir|tidak dikenal/i.test(String(err.message))) { tokenUnggah = null; const { data } = await sb.rpc('du_token_unggah', { p_token: token }); tokenUnggah = data; await unggahBerkasPendaftar(file, { token: tokenUnggah, jenis }); } else throw err; }
          const { data } = await sb.rpc('du_data', { p_token: token });
          if (data) { paket.berkas = data.berkas; susunBerkas(); }
          kartu.outerHTML = kartuBerkas(BERKAS().find(b => b.kunci === jenis));
          pasangBerkas();
          toast('Berkas terunggah.');
        } catch (err) { st.innerHTML = `<span style="color:var(--danger)">${esc(pesanGalat(err))}</span>`; }
        finally { inp.value = ''; }
      });
    }

    await masuk();
  };
})();
