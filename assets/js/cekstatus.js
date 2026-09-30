/* =====================================================================
   CEK STATUS PENDAFTARAN (Fase 3 · Langkah 6) · halaman cek-status.html
   Masuk dengan nomor registrasi + tanggal lahir santri (5 kali salah →
   dikunci 15 menit oleh server). Menampilkan status, tahapan, catatan
   perbaikan, berkas, jadwal sesi tes (Fase 4), pengumuman, dan daftar ulang.
   Hasil seleksi baru terlihat setelah waktu pengumuman.
   Dimuat sebelum situs.js; situs.js memanggil SPMB_HAL['cek-status']().
   ===================================================================== */
(function () {
  'use strict';
  window.SPMB_HAL = window.SPMB_HAL || {};

  const KUNCI_NO = 'spmb-cek-no';
  const STATUS = {
    terdaftar: ['Pendaftaran diterima', 'var(--c1)', 'ph-note-pencil', 'Data sudah kami terima dan sedang menunggu pemeriksaan berkas dan pembayaran oleh panitia.'],
    berkas_kurang: ['Berkas perlu diperbaiki', 'var(--c3)', 'ph-file-x', 'Ada berkas yang perlu diperbaiki. Baca catatan di bawah, lalu kirim perbaikannya melalui WhatsApp panitia.'],
    berkas_diverifikasi: ['Berkas terverifikasi', 'var(--c5)', 'ph-files', 'Berkas sudah diperiksa dan sesuai. Menunggu konfirmasi pembayaran pendaftaran.'],
    pembayaran_dikonfirmasi: ['Terverifikasi lengkap', 'var(--ok)', 'ph-seal-check', 'Berkas dan pembayaran sudah terverifikasi. Silakan menunggu informasi jadwal tes seleksi.'],
    ikut_tes: ['Peserta tes seleksi', 'var(--c2)', 'ph-exam', 'Ananda terdaftar sebagai peserta tes seleksi. Perhatikan jadwal tes di bawah.'],
    nilai_divalidasi: ['Menunggu pengumuman', 'var(--c2)', 'ph-hourglass-medium', 'Tes seleksi sudah selesai. Hasil akan diumumkan sesuai jadwal pengumuman.'],
    menunggu_pengumuman: ['Menunggu pengumuman', 'var(--c2)', 'ph-hourglass-medium', 'Tes seleksi sudah selesai. Hasil akan diumumkan sesuai jadwal pengumuman.'],
    lulus: ['LULUS seleksi', 'var(--ok)', 'ph-confetti', 'Alhamdulillah, selamat! Ananda dinyatakan lulus seleksi. Silakan melakukan daftar ulang sesuai jadwal.'],
    cadangan: ['Daftar cadangan', 'var(--c6)', 'ph-hourglass-medium', 'Ananda berada di daftar cadangan. Panitia akan menghubungi bila ada kursi yang tersedia.'],
    tidak_lulus: ['Belum lulus', 'var(--c8)', 'ph-hand-heart', 'Mohon maaf, ananda belum lulus pada seleksi ini. Semoga Allah memberikan jalan terbaik. Jazakumullahu khairan atas kepercayaannya.'],
    daftar_ulang_menunggu: ['Menunggu daftar ulang', 'var(--c3)', 'ph-clipboard-text', 'Silakan melakukan daftar ulang sesuai jadwal di bawah.'],
    daftar_ulang_selesai: ['Daftar ulang selesai', 'var(--ok)', 'ph-graduation-cap', 'Daftar ulang selesai. Selamat bergabung, semoga Allah memudahkan ananda menuntut ilmu.'],
    mengundurkan_diri: ['Mengundurkan diri', 'var(--c8)', 'ph-sign-out', 'Pendaftaran ini tercatat mengundurkan diri.'],
    dibatalkan: ['Dibatalkan', 'var(--danger)', 'ph-prohibit', 'Pendaftaran ini dibatalkan oleh panitia. Hubungi panitia bila ada pertanyaan.']
  };
  const VERIF = { menunggu: ['Menunggu pemeriksaan', 'var(--c6)'], diterima: ['Diterima', 'var(--ok)'], perbaikan: ['Perlu perbaikan', 'var(--c3)'], ditolak: ['Ditolak', 'var(--danger)'] };

  window.SPMB_HAL['cek-status'] = async api => {
    const { sb, fmt, esc, pesanGalat } = window.SPMB;
    const $ = (s, r = document) => r.querySelector(s);
    const S = api.S;
    const label = Object.fromEntries((S.p.spmb?.berkas || []).map(b => [b.kunci, b.label]));
    const kp = S.p.ketua_panitia || {};
    const kontak = (S.konten.kontak_panitia || []).find(k => k.data.no_wa);
    const noWA = String(kp.no_wa || kontak?.data.no_wa || '').replace(/\D/g, '').replace(/^0/, '62');
    const namaWA = kp.no_wa ? (kp.nama || 'Ketua Panitia') : kontak?.judul || 'Panitia';
    const tglId = iso => iso ? fmt.tglPanjang(new Date(String(iso).slice(0, 10) + 'T00:00:00')) : '';
    const tsId = ts => { if (!ts) return ''; const s = new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Makassar' }); return `${tglId(s.slice(0, 10))} pukul ${s.slice(11, 16).replace(':', '.')} WITA`; };
    const rentang = (a, b) => !a ? '' : !b || a === b ? tglId(a) : `${tglId(a)} – ${tglId(b)}`;
    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariTgl = iso => iso ? `${HARI[new Date(String(iso).slice(0, 10) + 'T00:00:00').getDay()]}, ${tglId(iso)}` : '';
    const BIDANG = { tahfizh: 'Tahfizh', tertulis: 'Tes Tertulis', wawancara: 'Wawancara' };
    const waTautan = pesan => `https://wa.me/${noWA}?text=${encodeURIComponent(pesan)}`;
    document.title = `Cek Status · ${S.p.identitas?.nama_singkat || 'SPMB'}`;

    const noAwal = new URLSearchParams(location.search).get('no') || (() => { try { return localStorage.getItem(KUNCI_NO) || ''; } catch (e) { return ''; } })();
    $('#isi').innerHTML = `${api.kepalaHalaman('Cek Status Pendaftaran', `SPMB Tahun Ajaran ${S.ta}`, 'ph-magnifying-glass', 'var(--c4)')}
      <section class="sek"><div class="wadah cek-wadah">
        <form class="kartu cek-form" id="fCek" novalidate>
          <h2><i class="ph-duotone ph-shield-check" style="color:var(--c4)"></i>Masukkan data calon santri</h2>
          <div class="field"><label for="cNo">Nomor registrasi <span class="req">*</span></label>
            <input class="input mono" id="cNo" name="no" value="${esc(noAwal)}" placeholder="Contoh: SPMB27-SMP-P-0001" autocomplete="off" autocapitalize="characters" maxlength="40">
            <small>Tertulis di Bukti Pendaftaran dan email konfirmasi.</small></div>
          <div class="field"><label for="cLahir">Tanggal lahir calon santri <span class="req">*</span></label>
            <input class="input" id="cLahir" name="lahir" type="date" max="${fmt.isoTgl()}" required></div>
          <div id="cPesan"></div>
          <button class="btn block" type="submit" id="cTombol"><i class="ph-duotone ph-magnifying-glass"></i>Cek status</button>
          <p class="muted kecil" style="margin:12px 0 0"><i class="ph-duotone ph-lock-simple"></i> Demi keamanan data, lima kali salah memasukkan data akan dikunci 15 menit.
            ${noWA.length >= 10 ? `Lupa nomor registrasi? <a href="${waTautan(`Assalamu'alaikum, saya lupa nomor registrasi SPMB ${S.ta}. Nama calon santri: `)}" target="_blank" rel="noopener">Tanya ${esc(namaWA)}</a>.` : ''}</p>
        </form>
        <div id="cHasil"></div>
      </div></section>`;

    const f = $('#fCek');
    $('#cNo').addEventListener('input', e => { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); e.target.setSelectionRange(p, p); });
    f.onsubmit = async e => {
      e.preventDefault();
      const no = $('#cNo').value.trim().toUpperCase(), lahir = f.elements.lahir.value;
      const pesan = (t, jenis = 'err') => { $('#cPesan').innerHTML = t ? `<div class="note ${jenis}"><i class="ph-duotone ${jenis === 'err' ? 'ph-warning-circle' : 'ph-lock'}"></i><div>${esc(t)}</div></div>` : ''; };
      if (no.length < 5) return pesan('Isi nomor registrasi.');
      if (!lahir) return pesan('Isi tanggal lahir dengan format dd/mm/yyyy.');
      const b = $('#cTombol'); b.disabled = true; b.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-color:#fff4;border-top-color:#fff"></span> Memeriksa…';
      try {
        const { data, error } = await sb.rpc('cek_status', { p_no: no, p_tanggal_lahir: lahir });
        if (error) throw error;
        if (!data.ok) { pesan(data.pesan, data.terkunci ? 'warn' : 'err'); $('#cHasil').innerHTML = ''; return; }
        pesan('');
        try { localStorage.setItem(KUNCI_NO, data.no_registrasi); } catch (e) {}
        tampil(data);
      } catch (err) { pesan(pesanGalat(err)); }
      finally { b.disabled = false; b.innerHTML = '<i class="ph-duotone ph-magnifying-glass"></i>Cek status'; }
    };

    function tampil(d) {
      const [lbl, tone, ikon, ket] = STATUS[d.status] || [d.status, 'var(--c8)', 'ph-info', ''];
      const kini = Date.now(), SELESAI_TES = ['nilai_divalidasi', 'menunggu_pengumuman', 'lulus', 'cadangan', 'tidak_lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai'];
      const diumumkan = ['lulus', 'cadangan', 'tidak_lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai'].includes(d.status);
      const tahap = [
        ['Pendaftaran terkirim', tsId(d.dibuat_pada), 'selesai'],
        ['Pemeriksaan berkas', d.verif_berkas === 'diterima' ? 'Berkas sesuai' : d.verif_berkas === 'perbaikan' ? 'Perlu perbaikan' : 'Sedang diperiksa panitia',
          d.verif_berkas === 'diterima' ? 'selesai' : d.verif_berkas === 'perbaikan' ? 'masalah' : 'berjalan'],
        ['Konfirmasi pembayaran', d.verif_bayar === 'diterima' ? 'Pembayaran diterima' : d.verif_bayar === 'ditolak' ? 'Perlu dicek ulang' : 'Menunggu konfirmasi',
          d.verif_bayar === 'diterima' ? 'selesai' : d.verif_bayar === 'ditolak' ? 'masalah' : 'berjalan'],
        ['Tes seleksi', (d.sesi_tes || []).length ? rentang(d.sesi_tes[0].tanggal, d.sesi_tes[d.sesi_tes.length - 1].tanggal) : rentang(d.tes_mulai, d.tes_selesai) || 'Jadwal menyusul', SELESAI_TES.includes(d.status) ? 'selesai' : ['pembayaran_dikonfirmasi', 'ikut_tes'].includes(d.status) ? 'berjalan' : ''],
        ['Pengumuman hasil', d.pengumuman ? tsId(d.pengumuman) : 'Jadwal menyusul', diumumkan ? 'selesai' : SELESAI_TES.includes(d.status) ? 'berjalan' : ''],
        ['Daftar ulang', rentang(d.daftar_ulang_mulai, d.daftar_ulang_selesai) || 'Jadwal menyusul', d.status === 'daftar_ulang_selesai' ? 'selesai' : ['lulus', 'daftar_ulang_menunggu'].includes(d.status) ? 'berjalan' : '']
      ];
      if (['dibatalkan', 'mengundurkan_diri', 'tidak_lulus'].includes(d.status)) tahap.forEach(t => { if (t[2] === 'berjalan') t[2] = ''; });
      const catatan = [d.verif_berkas === 'perbaikan' && d.catatan_berkas ? ['Catatan perbaikan berkas', d.catatan_berkas] : null,
        d.verif_bayar === 'ditolak' && d.catatan_bayar ? ['Catatan pembayaran', d.catatan_bayar] : null].filter(Boolean);
      const pesanPerbaikan = `Assalamu'alaikum, saya ingin mengirim perbaikan berkas/pembayaran SPMB.\nNomor registrasi: *${d.no_registrasi}*\nNama: ${d.nama_lengkap}\n\n(lampirkan foto berkas perbaikan)`;
      const hitung = d.pengumuman && new Date(d.pengumuman) > kini && !['dibatalkan', 'mengundurkan_diri'].includes(d.status) ? d.pengumuman : null;
      let terakhir = null; try { terakhir = JSON.parse(localStorage.getItem('spmb-daftar-terakhir') || 'null'); } catch (e) {}

      $('#cHasil').innerHTML = `
        <div class="kartu cek-hasil" style="--tone:${tone}">
          <div class="cek-status-kepala"><span class="ic-box"><i class="ph-duotone ${ikon}"></i></span>
            <div><small>Status pendaftaran</small><h2>${esc(lbl)}</h2></div>${d.uji ? '<span class="pill" style="--tone:var(--c6);margin-left:auto">Data uji coba</span>' : ''}</div>
          <p class="cek-ket">${esc(ket)}${d.status === 'menunggu_pengumuman' || d.status === 'nilai_divalidasi' ? (d.pengumuman ? ` Pengumuman: <b>${esc(tsId(d.pengumuman))}</b>.` : '') : ''}</p>
          ${hitung ? `<div class="hitung-kecil" data-hitung="${esc(hitung)}"></div><p class="muted kecil" style="text-align:center;margin:-10px 0 14px">menuju pengumuman hasil seleksi</p>` : ''}
          <dl class="cek-data">
            <div><dt>Nama calon santri</dt><dd>${esc(d.nama_lengkap)}</dd></div>
            <div><dt>Nomor registrasi</dt><dd class="mono">${esc(d.no_registrasi)}</dd></div>
            <div><dt>Jenjang</dt><dd>${esc(d.jenjang)} ${d.bagian === 'putra' ? 'Putra' : 'Putri'}</dd></div>
            <div><dt>Gelombang</dt><dd>${esc(d.gelombang || '–')}</dd></div>
            <div><dt>Asal daerah</dt><dd>${esc(d.asal || '–')}</dd></div>
          </dl>
          ${catatan.map(([j, t]) => `<div class="note"><i class="ph-duotone ph-warning"></i><div><b>${j}:</b><br>${esc(t).replace(/\n/g, '<br>')}</div></div>`).join('')}
          ${catatan.length && noWA.length >= 10 ? `<a class="btn block wa-btn" target="_blank" rel="noopener" href="${waTautan(pesanPerbaikan)}"><i class="ph-duotone ph-whatsapp-logo"></i>Kirim perbaikan via WhatsApp</a>` : ''}
        </div>
        <div class="kartu cek-tahap">
          <h3><i class="ph-duotone ph-path" style="color:var(--c2)"></i>Tahapan</h3>
          <ol class="tahap-daftar">${tahap.map(([j, k, st]) => `<li class="${st}"><span class="titik"><i class="ph-duotone ${st === 'selesai' ? 'ph-check' : st === 'masalah' ? 'ph-exclamation-mark' : st === 'berjalan' ? 'ph-circle-notch' : 'ph-circle'}"></i></span>
            <div><b>${j}</b><small>${esc(k)}</small></div></li>`).join('')}</ol>
        </div>
        ${(d.sesi_tes || []).length && !['dibatalkan', 'mengundurkan_diri'].includes(d.status) ? `<div class="kartu cek-berkas-k">
          <h3><i class="ph-duotone ph-calendar-check" style="color:var(--c2)"></i>Jadwal tes seleksi</h3>
          <ul class="cek-sesi">${d.sesi_tes.map(s => { const on = s.mode === 'online';
            return `<li><span class="ic-box" style="--tone:${on ? 'var(--c2)' : 'var(--c3)'}"><i class="ph-duotone ${on ? 'ph-video-camera' : 'ph-map-pin'}"></i></span>
              <div><b>${esc((s.bidang_label || (s.bidang || []).map(b => BIDANG[b] || b)).join(', '))}</b>
                <small>${esc(hariTgl(s.tanggal))} · pukul ${esc(String(s.jam_mulai).slice(0, 5).replace(':', '.'))}${s.jam_selesai ? '–' + esc(String(s.jam_selesai).slice(0, 5).replace(':', '.')) : ''} WITA</small>
                <small>${on ? 'Daring' : 'Tatap muka'}: ${esc(s.tempat || (on ? 'tautan menyusul' : 'tempat menyusul'))}</small>
                ${on && s.tautan ? `<a class="btn sm" href="${esc(s.tautan)}" target="_blank" rel="noopener" style="margin-top:6px"><i class="ph-duotone ph-video-camera"></i>Buka tautan tes</a>` : ''}
                ${s.catatan ? `<small class="cek-sesi-cat">${esc(s.catatan).replace(/\n/g, '<br>')}</small>` : ''}</div></li>`; }).join('')}</ul></div>` : ''}
        ${(d.berkas || []).length ? `<div class="kartu cek-berkas-k">
          <h3><i class="ph-duotone ph-files" style="color:var(--c4)"></i>Berkas yang diunggah</h3>
          <ul class="cek-berkas">${d.berkas.map(b => `<li><span>${esc(label[b.jenis] || b.jenis)}${b.status === 'ditolak' && b.catatan ? `<small>${esc(b.catatan)}</small>` : ''}</span>
            <span class="pill" style="--tone:${(VERIF[b.status] || VERIF.menunggu)[1]}">${(VERIF[b.status] || VERIF.menunggu)[0]}</span></li>`).join('')}</ul></div>` : ''}
        ${diumumkan ? `<a class="kartu sisi-ajakan cek-ke-pgm" href="pengumuman.html?no=${encodeURIComponent(d.no_registrasi)}" style="--tone:var(--c3)"><i class="ph-duotone ph-megaphone"></i>
          <span><b>Pengumuman hasil seleksi</b><small>${['lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai'].includes(d.status) ? 'Unduh Surat Keterangan Lulus dan lihat ketentuan daftar ulang' : 'Lihat pengumuman lengkap'}</small></span><i class="ph-duotone ph-arrow-right"></i></a>` : ''}
        <div class="hero-actions cek-aksi">
          ${terakhir?.hasil?.no_registrasi === d.no_registrasi ? '<a class="btn ghost" href="daftar.html"><i class="ph-duotone ph-file-pdf" style="color:var(--c7)"></i>Unduh ulang Bukti Pendaftaran</a>' : ''}
          ${noWA.length >= 10 ? `<a class="btn ghost" target="_blank" rel="noopener" href="${waTautan(`Assalamu'alaikum, saya ingin bertanya tentang pendaftaran SPMB nomor ${d.no_registrasi} atas nama ${d.nama_lengkap}.`)}"><i class="ph-duotone ph-whatsapp-logo" style="color:#16a34a"></i>Tanya ${esc(namaWA)}</a>` : ''}
          <button type="button" class="btn ghost" id="cLain"><i class="ph-duotone ph-arrow-counter-clockwise"></i>Cek nomor lain</button>
        </div>`;
      $('#cHasil').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#cLain').onclick = () => { $('#cHasil').innerHTML = ''; f.reset(); f.elements.lahir.value = ''; $('#cNo').value = ''; $('#cNo').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      const el = $('.cek-hasil [data-hitung]');
      if (el) {
        const sasaran = new Date(el.dataset.hitung).getTime();
        const tik = () => {
          const s = Math.max(0, Math.floor((sasaran - Date.now()) / 1000));
          const b = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
          el.innerHTML = ['hari', 'jam', 'menit', 'detik'].map((l, i) => `<span><b>${String(b[i]).padStart(2, '0')}</b>${l}</span>`).join('');
          if (!s) { clearInterval(t); f.requestSubmit(); }
        };
        const t = setInterval(tik, 1000); tik();
      }
    }
  };
})();
