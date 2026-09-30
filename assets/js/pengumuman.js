/* =====================================================================
   PENGUMUMAN HASIL SELEKSI (Fase 4 · Langkah 5) · halaman pengumuman.html
   - Status pengumuman tiap gelombang (hitung mundur sampai waktu pengumuman)
   - Cek hasil perorangan: nomor registrasi + tanggal lahir (pembatas
     percobaan sama dengan Cek Status)
   - Surat Keterangan Lulus (PDF/cetak F4) dengan QR validasi
   - Validasi keaslian SKL: pengumuman.html?v=KODE
   - Daftar nama lulus dan cadangan (bila dinyalakan Superadmin)
   Dimuat sebelum situs.js; situs.js memanggil SPMB_HAL['pengumuman']().
   ===================================================================== */
(function () {
  'use strict';
  window.SPMB_HAL = window.SPMB_HAL || {};
  const KUNCI_NO = 'spmb-cek-no';

  window.SPMB_HAL.pengumuman = async api => {
    const { sb, fmt, esc, pesanGalat, toast, dokumenSKL, siapkanQr, buatPdfDokumen, simpanPdf, cetakDokumen } = window.SPMB;
    const $ = (s, r = document) => r.querySelector(s);
    const S = api.S, pg = S.p.pengumuman || {};
    const kp = S.p.ketua_panitia || {};
    const kontak = (S.konten.kontak_panitia || []).find(k => k.data.no_wa);
    const noWA = String(kp.no_wa || kontak?.data.no_wa || '').replace(/\D/g, '').replace(/^0/, '62');
    const namaWA = kp.no_wa ? (kp.nama || 'Ketua Panitia') : kontak?.judul || 'Panitia';
    const waTautan = pesan => `https://wa.me/${noWA}?text=${encodeURIComponent(pesan)}`;
    const tglId = iso => iso ? fmt.tglPanjang(new Date(String(iso).slice(0, 10) + 'T00:00:00')) : '';
    const tsId = ts => { if (!ts) return ''; const s = new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Makassar' }); return `${tglId(s.slice(0, 10))} pukul ${s.slice(11, 16).replace(':', '.')} WITA`; };
    const rentang = (a, b) => !a ? '' : !b || a === b ? tglId(a) : `${tglId(a)} – ${tglId(b)}`;
    const bagL = b => b === 'putra' ? 'Putra' : 'Putri';
    const q = new URLSearchParams(location.search);
    const noAwal = q.get('no') || (() => { try { return localStorage.getItem(KUNCI_NO) || ''; } catch (e) { return ''; } })();
    const judul = pg.judul_halaman || 'Pengumuman Hasil Seleksi';
    document.title = `${judul} · ${S.p.identitas?.nama_singkat || 'SPMB'}`;

    let gels = [];
    try { const { data, error } = await sb.rpc('pengumuman_publik'); if (error) throw error; gels = data || []; }
    catch (err) { gels = []; console.error(err); }
    const adaTerbuka = gels.some(g => g.terbuka);

    $('#isi').innerHTML = `${api.kepalaHalaman(judul, `SPMB Tahun Ajaran ${S.ta}`, 'ph-megaphone', 'var(--c3)')}
      <section class="sek"><div class="wadah pgm-wadah">
        <div id="pVerif"></div>
        <div class="pgm-gel">${gels.length ? gels.map(kartuGelombang).join('') : `<div class="kartu"><div class="empty"><i class="ph-duotone ph-megaphone"></i><b>Belum ada jadwal pengumuman</b>Jadwal pengumuman akan tampil di sini.</div></div>`}</div>
        <div class="cek-wadah pgm-cek">
          <form class="kartu cek-form" id="fHasil" novalidate>
            <h2><i class="ph-duotone ph-magnifying-glass" style="color:var(--c3)"></i>Lihat hasil seleksi</h2>
            ${adaTerbuka ? '' : '<div class="note info"><i class="ph-duotone ph-hourglass-medium"></i><div>Hasil belum diumumkan. Formulir ini menampilkan hasil setelah waktu pengumuman tiba.</div></div>'}
            <div class="field"><label for="hNo">Nomor registrasi <span class="req">*</span></label>
              <input class="input mono" id="hNo" value="${esc(noAwal)}" placeholder="Contoh: SPMB27-SMP-P-0001" autocomplete="off" autocapitalize="characters" maxlength="40"></div>
            <div class="field"><label for="hLahir">Tanggal lahir calon santri <span class="req">*</span></label>
              <input class="input" id="hLahir" name="lahir" type="date" max="${fmt.isoTgl()}" required></div>
            <div id="hPesan"></div>
            <button class="btn block" type="submit" id="hTombol"><i class="ph-duotone ph-magnifying-glass"></i>Lihat hasil</button>
            <p class="muted kecil" style="margin:12px 0 0"><i class="ph-duotone ph-lock-simple"></i> Hasil hanya dapat dilihat dengan nomor registrasi dan tanggal lahir yang cocok. Lima kali salah akan dikunci 15 menit.</p>
          </form>
          <div id="hHasil"></div>
        </div>
        <div id="pDaftar"></div>
      </div></section>`;

    // ---------- kartu status gelombang ----------
    function kartuGelombang(g) {
      const nanti = g.pengumuman && new Date(g.pengumuman) > Date.now();
      let st, tone, ikon, teks;
      if (g.terbuka) { st = 'Sudah diumumkan'; tone = 'var(--ok)'; ikon = 'ph-megaphone'; teks = g.nomor_sk ? `Berdasarkan Keputusan Ketua Panitia Nomor ${esc(g.nomor_sk)} tanggal ${esc(tglId(g.tanggal_sk))}.` : 'Hasil seleksi sudah dapat dilihat.'; }
      else if (nanti) { st = 'Segera diumumkan'; tone = 'var(--c2)'; ikon = 'ph-hourglass-medium'; teks = `Pengumuman: <b>${esc(tsId(g.pengumuman))}</b>`; }
      else { st = 'Sedang disiapkan'; tone = 'var(--c6)'; ikon = 'ph-clipboard-text'; teks = 'Hasil seleksi sedang disiapkan panitia. Silakan kembali beberapa saat lagi.'; }
      const ring = g.ringkasan || [];
      return `<div class="kartu pgm-kartu" style="--tone:${tone}">
        <div class="pgm-kepala"><span class="ic-box"><i class="ph-duotone ${ikon}"></i></span>
          <div><small>${esc(g.nama)}</small><h3>${st}</h3></div></div>
        <p class="muted" style="margin:0 0 10px">${teks}</p>
        ${!g.terbuka && nanti ? `<div class="hitung-kecil" data-hitung="${esc(g.pengumuman)}"></div>` : ''}
        ${g.terbuka && ring.length ? `<div class="pgm-ring">${ring.map(r => `<div><b>${r.jenjang} ${bagL(r.bagian)}</b><span class="pill" style="--tone:var(--ok)">Lulus ${r.lulus}</span>${r.cadangan ? `<span class="pill" style="--tone:var(--c6)">Cadangan ${r.cadangan}</span>` : ''}</div>`).join('')}</div>` : ''}
        ${g.daftar_ulang_mulai ? `<p class="kecil" style="margin:10px 0 0"><i class="ph-duotone ph-calendar-check" style="color:var(--c5)"></i> Daftar ulang: <b>${esc(rentang(g.daftar_ulang_mulai, g.daftar_ulang_selesai))}</b></p>` : ''}
      </div>`;
    }
    // hitung mundur: muat ulang halaman saat waktunya tiba
    document.querySelectorAll('.pgm-gel [data-hitung]').forEach(el => {
      const sasaran = new Date(el.dataset.hitung).getTime();
      const tik = () => {
        const s = Math.max(0, Math.floor((sasaran - Date.now()) / 1000));
        const b = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
        el.innerHTML = ['hari', 'jam', 'menit', 'detik'].map((l, i) => `<span><b>${String(b[i]).padStart(2, '0')}</b>${l}</span>`).join('');
        if (!s) { clearInterval(t); setTimeout(() => location.reload(), 2500); }
      };
      const t = setInterval(tik, 1000); tik();
    });

    // ---------- validasi SKL ----------
    if (q.get('v')) {
      const { data: v, error } = await sb.rpc('verifikasi_skl', { p_kode: q.get('v') });
      const sah = !error && v?.ok && v.sah;
      $('#pVerif').innerHTML = `<div class="kartu pgm-verif" style="--tone:${sah ? 'var(--ok)' : 'var(--danger)'}">
        <span class="ic-box"><i class="ph-duotone ${sah ? 'ph-seal-check' : 'ph-seal-warning'}"></i></span>
        <div><small>Validasi Surat Keterangan Lulus</small>
          <h3>${sah ? 'Surat ini SAH' : v?.ok ? 'Surat ini tidak berlaku lagi' : 'Surat tidak dikenali'}</h3>
          ${v?.ok ? `<p>${esc(v.nama_lengkap)} · <span class="mono">${esc(v.no_registrasi)}</span><br>${esc(v.jenjang)} ${bagL(v.bagian)} · ${esc(v.gelombang)} · Nomor ${esc(v.nomor_skl || '–')}
            ${v.daftar_ulang ? '<br><b>Sudah menyelesaikan daftar ulang.</b>' : ''}${v.uji ? '<br><b>Data uji coba, tidak berlaku.</b>' : ''}
            ${!sah ? '<br>Status kelulusan pada surat ini sudah berubah. Hubungi panitia untuk keterangan.' : ''}</p>`
            : `<p>${esc(error ? pesanGalat(error) : v?.pesan || 'Kode validasi tidak ditemukan.')}</p>`}
        </div></div>`;
    }

    // ---------- cek hasil perorangan ----------
    const f = $('#fHasil');
    $('#hNo').addEventListener('input', e => { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); e.target.setSelectionRange(p, p); });
    f.onsubmit = async e => {
      e.preventDefault();
      const no = $('#hNo').value.trim().toUpperCase(), lahir = f.elements.lahir.value;
      const pesan = (t, jenis = 'err') => { $('#hPesan').innerHTML = t ? `<div class="note ${jenis}"><i class="ph-duotone ${jenis === 'err' ? 'ph-warning-circle' : 'ph-lock'}"></i><div>${esc(t)}</div></div>` : ''; };
      if (no.length < 5) return pesan('Isi nomor registrasi.');
      if (!lahir) return pesan('Isi tanggal lahir dengan format dd/mm/yyyy.');
      const b = $('#hTombol'); b.disabled = true; b.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-color:#fff4;border-top-color:#fff"></span> Memeriksa…';
      try {
        const { data, error } = await sb.rpc('hasil_seleksi', { p_no: no, p_tanggal_lahir: lahir });
        if (error) throw error;
        if (!data.ok) { pesan(data.pesan, data.terkunci ? 'warn' : 'err'); $('#hHasil').innerHTML = ''; return; }
        pesan('');
        try { localStorage.setItem(KUNCI_NO, data.no_registrasi); } catch (e) {}
        tampilHasil(data);
      } catch (err) { pesan(pesanGalat(err)); }
      finally { b.disabled = false; b.innerHTML = '<i class="ph-duotone ph-magnifying-glass"></i>Lihat hasil'; }
    };

    function tampilHasil(d) {
      const lulus = !!d.skl, du = ['daftar_ulang_menunggu', 'daftar_ulang_selesai'].includes(d.status);
      const H = {
        lulus: ['LULUS', 'var(--ok)', 'ph-confetti', pg.pesan_lulus || 'Alhamdulillah, ananda dinyatakan lulus seleksi.'],
        cadangan: ['CADANGAN', 'var(--c6)', 'ph-hourglass-medium', pg.pesan_cadangan || 'Ananda berada di daftar cadangan.'],
        tidak_lulus: ['BELUM LULUS', 'var(--c8)', 'ph-hand-heart', pg.pesan_tidak_lulus || 'Mohon maaf, ananda belum dapat kami terima.'],
        menunggu_pengumuman: ['Menunggu pengumuman', 'var(--c2)', 'ph-hourglass-medium', `Hasil seleksi belum diumumkan.${d.pengumuman ? ` Pengumuman: ${tsId(d.pengumuman)}.` : ''}`]
      };
      const k = lulus || du ? 'lulus' : H[d.status] ? d.status : null;
      const [lbl, tone, ikon, ket] = k ? H[k] : ['Belum ada hasil', 'var(--c7)', 'ph-info', 'Ananda belum sampai tahap pengumuman hasil. Periksa tahapan pendaftaran di halaman Cek Status.'];
      $('#hHasil').innerHTML = `
        <div class="kartu pgm-hasil${k === 'lulus' ? ' rayakan' : ''}" style="--tone:${tone}">
          <div class="pgm-hasil-ikon"><i class="ph-duotone ${ikon}"></i></div>
          <small>${esc(d.nama_lengkap)} · <span class="mono">${esc(d.no_registrasi)}</span></small>
          <h2>${esc(lbl)}</h2>
          ${d.uji ? '<span class="pill" style="--tone:var(--c6)">Data uji coba</span>' : ''}
          <p>${esc(ket)}</p>
          <dl class="cek-data">
            <div><dt>Jenjang</dt><dd>${esc(d.jenjang)} ${bagL(d.bagian)}</dd></div>
            <div><dt>Gelombang</dt><dd>${esc(d.gelombang || '–')}</dd></div>
            ${k === 'lulus' ? `<div><dt>Daftar ulang</dt><dd>${esc(rentang(d.daftar_ulang_mulai, d.daftar_ulang_selesai) || 'Jadwal menyusul')}</dd></div>` : ''}
            ${lulus ? `<div><dt>Nomor SKL</dt><dd class="mono">${esc(d.skl.nomor_skl || '–')}</dd></div>` : ''}
          </dl>
          ${d.status === 'daftar_ulang_selesai' ? '<div class="note ok-note"><i class="ph-duotone ph-graduation-cap"></i><div>Daftar ulang sudah selesai. Selamat bergabung.</div></div>' : ''}
          ${lulus ? `<div class="pgm-aksi">
            <button type="button" class="btn" id="hPdf"><i class="ph-duotone ph-file-pdf"></i>Unduh Surat Keterangan Lulus</button>
            <button type="button" class="btn ghost" id="hCetak"><i class="ph-duotone ph-printer" style="color:var(--c1)"></i>Cetak</button></div>` : ''}
        </div>
        <div class="hero-actions cek-aksi">
          <a class="btn ghost" href="cek-status.html?no=${encodeURIComponent(d.no_registrasi)}"><i class="ph-duotone ph-path" style="color:var(--c4)"></i>Tahapan di Cek Status</a>
          ${noWA.length >= 10 ? `<a class="btn ghost" target="_blank" rel="noopener" href="${waTautan(`Assalamu'alaikum, saya ingin bertanya tentang hasil seleksi SPMB nomor ${d.no_registrasi} atas nama ${d.nama_lengkap}.`)}"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i>Tanya ${esc(namaWA)}</a>` : ''}
          <button type="button" class="btn ghost" id="hLain"><i class="ph-duotone ph-arrow-counter-clockwise"></i>Cek nomor lain</button>
        </div>`;
      $('#hHasil').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#hLain').onclick = () => { $('#hHasil').innerHTML = ''; f.elements.lahir.value = ''; $('#hNo').value = ''; $('#hNo').focus(); };
      if (lulus) {
        const opsi = async () => { await siapkanQr(); return dokumenSKL(d.skl, S.p); };
        $('#hPdf').onclick = async e => {
          const b = e.currentTarget; b.disabled = true; const t = toast('Menyusun PDF…', 'info', 60000);
          try { simpanPdf(await buatPdfDokumen(await opsi()), `SKL ${d.skl.nama_lengkap} ${d.skl.no_registrasi}.pdf`); }
          catch (err) { toast(pesanGalat(err), 'err', 6000); } finally { t.remove(); b.disabled = false; }
        };
        $('#hCetak').onclick = async () => cetakDokumen(await opsi());
      }
    }
    if (noAwal && q.get('no')) $('#hLahir').focus();

    // ---------- daftar nama publik ----------
    const daftar = gels.filter(g => g.terbuka && Array.isArray(g.daftar) && g.daftar.length);
    if (daftar.length) {
      const semua = daftar.flatMap(g => g.daftar.map(x => ({ ...x, gelombang: g.nama })));
      const klp = [...new Set(semua.map(x => `${x.jenjang} ${bagL(x.bagian)}`))];
      let aktif = klp[0], cari = '';
      $('#pDaftar').innerHTML = `<div class="kartu pgm-daftar">
        <h3><i class="ph-duotone ph-list-numbers" style="color:var(--c5)"></i>Daftar calon santri lulus dan cadangan</h3>
        <div class="pgm-daftar-alat"><input class="input" id="dCari" type="search" placeholder="Cari nama atau nomor registrasi…" aria-label="Cari nama">
          <div class="chips-select" id="dKlp">${klp.map(k => `<label><input type="radio" name="klp" value="${esc(k)}" ${k === aktif ? 'checked' : ''}>${esc(k)}</label>`).join('')}</div></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th class="c" style="width:48px">No</th><th>Nama</th><th class="hide-sm">Nomor registrasi</th><th class="hide-sm">Asal daerah</th><th class="c">Hasil</th></tr></thead><tbody id="dIsi"></tbody></table></div>
      </div>`;
      const isi = () => {
        const c = cari.toLowerCase();
        const rows = semua.filter(x => (c ? true : `${x.jenjang} ${bagL(x.bagian)}` === aktif) && (!c || (x.nama + ' ' + x.no_registrasi).toLowerCase().includes(c)));
        $('#dIsi').innerHTML = rows.length ? rows.map((x, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(x.nama)}</b><small class="show-sm mono muted">${esc(x.no_registrasi)}</small>${c ? `<small class="muted"> · ${x.jenjang} ${bagL(x.bagian)}</small>` : ''}</td>
          <td class="hide-sm mono">${esc(x.no_registrasi)}</td><td class="hide-sm">${esc(x.asal || '–')}</td>
          <td class="c"><span class="pill" style="--tone:${x.hasil === 'lulus' ? 'var(--ok)' : 'var(--c6)'}">${x.hasil === 'lulus' ? 'Lulus' : 'Cadangan'}</span></td></tr>`).join('')
          : '<tr><td colspan="5"><div class="empty"><i class="ph-duotone ph-magnifying-glass"></i><b>Tidak ditemukan</b>Periksa ejaan nama atau gunakan formulir Lihat hasil.</div></td></tr>';
      };
      $('#dCari').oninput = e => { cari = e.target.value.trim(); isi(); };
      $('#dKlp').onchange = e => { aktif = e.target.value; isi(); };
      isi();
    }
  };
})();
