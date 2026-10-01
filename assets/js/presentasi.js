/* =====================================================================
   PRESENTASI PERKEMBANGAN SPMB (Fase 5) · presentasi.html
   Laporan berbentuk slide 16:9 yang tersusun otomatis dari data terkini.
   Setiap slide berukuran tetap 1600 x 900 lalu diperkecil/diperbesar
   mengikuti layar, sehingga tata letaknya sama di laptop, proyektor,
   tablet, maupun HP (mendatar). Data diperbarui tiap menit.
   Khusus Admin dan Superadmin.
   Navigasi: gulir, tombol panah, PageUp/PageDown, spasi, Home/End,
   F = layar penuh. Arah gulir dapat diganti ke bawah atau ke samping.
   ===================================================================== */
(function () {
  'use strict';
  const { sb, fmt, esc, muatPengaturan, logoPondok, grafik: G, themeSegHTML, toast, pesanGalat } = window.SPMB;
  const $ = (s, r = document) => r.querySelector(s);
  const LEBAR = 1600, TINGGI = 900;
  const KUNCI_ARAH = 'spmb-presentasi-arah';
  const NAMA_TAHAP = { pendaftaran: 'Pendaftaran', daftar_ulang: 'Daftar ulang', tahunan: 'Tahunan', bulanan: 'Bulanan', lainnya: 'Lainnya' };
  const STATUS_LOLOS_VERIF = ['pembayaran_dikonfirmasi', 'ikut_tes', 'nilai_divalidasi', 'lulus', 'cadangan', 'tidak_lulus', 'daftar_ulang_menunggu', 'daftar_ulang_selesai'];
  const S = { p: {}, gels: [], semuaGel: [], biaya: [], alur: [], unggul: [], program: [], stat: null, keu: null, gel: '', uji: false, kini: 0 };

  const rp = n => 'Rp ' + fmt.angka(Math.round(+n || 0));
  const rpRingkas = n => { n = +n || 0; if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(2).replace('.', ',') + ' M'; if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace('.', ',') + ' jt'; return rp(n); };
  const persen = (a, b) => b ? Math.round(a / b * 100) : 0;
  const keDate = v => v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T00:00:00+08:00' : v) : null;
  const tglP = v => v ? fmt.tglPanjang(keDate(v)) : '–';
  const rentang = (a, b) => !a ? 'Belum dijadwalkan' : !b || String(a).slice(0, 10) === String(b).slice(0, 10) ? tglP(a) : `${tglP(a)} – ${tglP(b)}`;
  const bagL = b => b === 'putra' ? 'Putra' : b === 'putri' ? 'Putri' : 'Putra & Putri';
  const potong = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const arahKini = () => $('#slides').classList.contains('arah-h') ? 'h' : 'v';

  /* ---------------- MULAI ---------------- */
  async function mulai() {
    SPMB.setTheme(SPMB.getTheme());
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return location.replace('masuk.html');
    const { data: profil } = await sb.from('profil_pengguna').select('peran,aktif,nama_lengkap').eq('id', session.user.id).maybeSingle();
    if (!profil?.aktif || !['superadmin', 'admin'].includes(profil.peran)) {
      $('#memuat').innerHTML = '<div class="note err" style="max-width:460px"><i class="ph-duotone ph-lock-simple"></i><div><b>Khusus Admin dan Superadmin.</b> <a href="dashboard.html">Kembali ke dashboard</a></div></div>';
      return;
    }
    $('#themeSeg').innerHTML = themeSegHTML; SPMB.setTheme(SPMB.getTheme());
    const q = new URLSearchParams(location.search);
    S.gel = q.get('gelombang') || ''; S.uji = q.get('uji') === '1';
    let arah = 'v'; try { arah = localStorage.getItem(KUNCI_ARAH) || 'v'; } catch (e) {}
    aturArah(arah, false);

    await muatData();
    $('#memuat').remove();
    ['#bilah', '#titik', '#navi'].forEach(s => $(s).classList.remove('hidden'));
    bangun();
    pasangInteraksi();
    setInterval(() => segarkan(false), 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) segarkan(false); });
  }

  async function muatData() {
    const [p, g, b, kont] = await Promise.all([
      muatPengaturan(true),
      sb.from('gelombang').select('*').order('urutan').order('id'),
      sb.from('rincian_biaya').select('*').is('diarsipkan_pada', null).eq('tampil', true).order('urutan').order('id'),
      sb.from('konten_situs').select('jenis,judul,isi,data,urutan').in('jenis', ['alur', 'keunggulan', 'program']).eq('tampil', true).is('diarsipkan_pada', null).order('urutan')
    ]);
    S.p = p;
    const ta = SPMB.taAktif(p);
    S.semuaGel = (g.data || []).filter(x => !x.diarsipkan_pada && (!x.tahun_ajaran || x.tahun_ajaran === ta));
    S.gels = S.semuaGel.filter(x => !!x.uji === S.uji && (!S.gel || String(x.id) === S.gel));
    const idGel = new Set(S.gels.map(x => x.id));
    S.biaya = (b.data || []).filter(x => !x.gelombang_id || idGel.has(x.gelombang_id));
    const kn = kont.data || [];
    S.alur = kn.filter(x => x.jenis === 'alur'); S.unggul = kn.filter(x => x.jenis === 'keunggulan'); S.program = kn.filter(x => x.jenis === 'program');
    const arg = { p_gelombang: S.gel ? +S.gel : null, p_uji: S.uji };
    const [st, ku] = await Promise.all([sb.rpc('statistik_dashboard', arg), sb.rpc('keuangan_ringkas', arg)]);
    if (st.error) throw st.error;
    S.stat = st.data || {};
    S.keu = ku.error ? null : ku.data;
    S.waktu = new Date();
  }

  async function segarkan(beriTahu) {
    const ikon = $('#pSegar i'); ikon.classList.add('berputar');
    try { await muatData(); isiUlang(); if (beriTahu) toast('Data diperbarui.'); }
    catch (err) { if (beriTahu) toast(pesanGalat(err), 'err'); console.warn(err); }
    finally { ikon.classList.remove('berputar'); }
  }

  /* ---------------- KOMPONEN ---------------- */
  const kpi = (l, n, ic, t, sub = '') => `<div class="pp-kpi" style="--tone:${t}"><span class="pp-ikon"><i class="ph-duotone ${ic}"></i></span><b>${n}</b><span class="pp-kpi-l">${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const kosong = t => `<div class="pp-kartu pp-kosong"><i class="ph-duotone ph-info"></i><b>${esc(t)}</b></div>`;
  function donat(bagian, tengah, sub) {
    const total = bagian.reduce((a, [n]) => a + n, 0);
    const r = 70, kel = 2 * Math.PI * r; let off = 0;
    const busur = total ? bagian.filter(([n]) => n > 0).map(([n, w]) => { const pj = n / total * kel; const s = `<circle r="${r}" cx="90" cy="90" fill="none" stroke="${w}" stroke-width="24" stroke-dasharray="${pj} ${kel - pj}" stroke-dashoffset="${-off}"/>`; off += pj; return s; }).join('') : '';
    return `<svg class="pp-donat" viewBox="0 0 180 180" role="img" aria-label="${esc(tengah)} ${esc(sub)}"><circle r="${r}" cx="90" cy="90" fill="none" stroke="var(--surface-3)" stroke-width="24"/>
      <g transform="rotate(-90 90 90)">${busur}</g><text x="90" y="92" text-anchor="middle" class="d-angka">${esc(tengah)}</text><text x="90" y="116" text-anchor="middle" class="d-sub">${esc(sub)}</text></svg>`;
  }
  const lebih = (n, satuan) => n > 0 ? `<p class="pp-lebih">dan ${fmt.angka(n)} ${satuan} lainnya</p>` : '';

  /* ---------------- DAFTAR SLIDE ---------------- */
  function daftarSlide() {
    const st = S.stat || {}, ps = st.per_status || {}, keu = S.keu;
    const id = S.p.identitas || {}, pl = S.p.profil_lembaga || {}, kp = S.p.ketua_panitia || {};
    const ta = SPMB.taAktif(S.p);
    const namaGel = S.gel ? (S.semuaGel.find(x => String(x.id) === S.gel)?.nama || '') : 'Semua gelombang';
    const lolosVerif = STATUS_LOLOS_VERIF.reduce((a, k) => a + (ps[k] || 0), 0);
    const duMenunggu = ps.daftar_ulang_menunggu || 0;
    const lulus = st.lulus || 0, du = st.daftar_ulang || 0, total = st.total || 0;
    const slides = [];

    // 1. Sampul
    slides.push({ id: 'judul', label: 'Sampul', sampul: true, html: `
      <div class="pp-sampul-isi">
        <div class="pp-logo" id="sLogo"></div>
        <span class="pp-eyebrow">Laporan Perkembangan</span>
        <h1>Sistem Penerimaan Murid Baru<br>Tahun Ajaran ${esc(ta)}</h1>
        <p class="pp-lembaga">${esc(id.nama_lembaga || '')}</p>
        <div class="pp-chip-baris">
          <span><i class="ph-duotone ph-calendar-blank"></i>${fmt.hariTgl(S.waktu)}</span>
          <span><i class="ph-duotone ph-clock"></i>Keadaan pukul ${fmt.jam(S.waktu)} WITA</span>
          <span><i class="ph-duotone ph-flag-banner"></i>${esc(namaGel)}</span>
          ${S.uji ? '<span><i class="ph-duotone ph-flask"></i>Data uji coba</span>' : ''}
        </div>
      </div>` });

    // 2. Profil
    const misi = (pl.misi || []).filter(Boolean);
    slides.push({ id: 'profil', label: 'Profil', judul: 'Profil Pondok', ikon: 'ph-buildings', tone: 'var(--c1)', html: `
      <div class="pp-kisi pp-2">
        <div class="pp-kartu">
          <h3>${esc(id.nama_lembaga || '')}</h3>
          ${id.tagline ? `<p class="pp-tagline">“${esc(id.tagline)}”</p>` : ''}
          <dl class="pp-dl">${[['NPSN', id.npsn], ['NSPP', id.nspp], ['Alamat', potong(id.alamat, 90)], ['Telepon', id.telepon], ['Email', id.email]].filter(([, v]) => v).map(([l, v]) => `<dt>${l}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
          ${pl.visi ? `<h4><i class="ph-duotone ph-eye" style="color:var(--c6)"></i>Visi</h4><p class="pp-visi">${esc(potong(pl.visi, 200))}</p>` : ''}
          ${misi.length ? `<h4><i class="ph-duotone ph-target" style="color:var(--c5)"></i>Misi</h4><ol class="pp-misi">${misi.slice(0, 4).map(m => `<li>${esc(potong(m, 110))}</li>`).join('')}</ol>` : ''}
        </div>
        <div class="pp-kartu">
          <h4><i class="ph-duotone ph-star" style="color:var(--c6)"></i>Keunggulan</h4>
          ${S.unggul.length ? `<ul class="pp-cek">${S.unggul.slice(0, 6).map(x => `<li><i class="ph-duotone ph-check-circle"></i><span><b>${esc(potong(x.judul, 60))}</b>${x.isi ? `<small>${esc(potong(x.isi, 80))}</small>` : ''}</span></li>`).join('')}</ul>${lebih(S.unggul.length - 6, 'keunggulan')}` : '<p class="pp-redup">Keunggulan belum diisi di Konten Situs.</p>'}
          ${S.program.length ? `<h4><i class="ph-duotone ph-book-open-text" style="color:var(--c1)"></i>Program</h4><div class="pp-tag">${S.program.slice(0, 8).map(x => `<span>${esc(potong(x.judul, 30))}</span>`).join('')}${S.program.length > 8 ? `<span>+${S.program.length - 8}</span>` : ''}</div>` : ''}
        </div>
      </div>` });

    // 3. Tanggal penting
    const kini = new Date();
    const statusAgenda = (a, b) => {
      const da = keDate(a); if (!da) return ['Belum dijadwalkan', 'var(--c8)'];
      const akhir = keDate(b || a); if (/^\d{4}-\d{2}-\d{2}$/.test(b || a)) akhir.setHours(23, 59, 59);
      return kini > akhir ? ['Selesai', 'var(--ok)'] : kini >= da ? ['Berlangsung', 'var(--c3)'] : ['Akan datang', 'var(--c1)'];
    };
    const gelTampil = S.gels.slice(0, 3);
    slides.push({ id: 'jadwal', label: 'Jadwal', judul: 'Tanggal Penting', ikon: 'ph-calendar-dots', tone: 'var(--c2)', html: gelTampil.length ? `
      <div class="pp-kisi" style="grid-template-columns:repeat(${gelTampil.length},minmax(0,1fr))">${gelTampil.map(g => {
        const agenda = [['Pendaftaran', g.buka, g.tutup, 'ph-note-pencil'], ['Tes seleksi', g.tes_mulai, g.tes_selesai, 'ph-exam'], ['Pengumuman', g.pengumuman, null, 'ph-megaphone'], ['Daftar ulang', g.daftar_ulang_mulai, g.daftar_ulang_selesai, 'ph-clipboard-text'],
          ...(g.kegiatan || []).map(x => [x.judul, x.mulai, x.selesai, 'ph-calendar-star'])].slice(0, gelTampil.length === 1 ? 7 : 6);
        return `<div class="pp-kartu"><h3><i class="ph-duotone ph-flag-banner" style="color:var(--c2)"></i>${esc(g.nama)}</h3>
          <ol class="pp-garis${gelTampil.length === 1 ? ' lebar' : ''}">${agenda.map(([l, a, b, ic]) => { const [sl, t] = statusAgenda(a, b); return `<li style="--tone:${t}"><span class="pp-ikon"><i class="ph-duotone ${ic}"></i></span>
            <div><b>${esc(potong(l, 40))}</b><span>${l === 'Pengumuman' && a ? `${tglP(a)}, ${fmt.jam(keDate(a))} WITA` : rentang(a, b)}</span></div><em>${sl}</em></li>`; }).join('')}</ol></div>`;
      }).join('')}</div>${lebih(S.gels.length - 3, 'gelombang')}` : kosong('Belum ada gelombang pada tahun ajaran ini.') });

    // 4. Alur pendaftaran (saling terhubung)
    const alur = S.alur.slice(0, 8);
    slides.push({ id: 'alur', label: 'Alur', judul: 'Alur Pendaftaran', ikon: 'ph-path', tone: 'var(--c3)', html: alur.length ? `
      <ol class="pp-alur" style="--n:${alur.length}">${alur.map((x, i) => `<li style="--tone:var(--${esc(x.data?.warna || ['c3', 'c1', 'c5', 'c2', 'c4', 'c6', 'c7'][i % 7])})">
        <span class="pp-alur-bulat"><i class="ph-duotone ph-${esc(x.data?.ikon || 'circle')}"></i><em>${i + 1}</em></span>
        <b>${esc(potong(x.judul, 40))}</b>${x.isi ? `<small>${esc(potong(x.isi, 90))}</small>` : ''}</li>`).join('')}</ol>
      <div class="pp-alur-kaki"><span><i class="ph-duotone ph-globe"></i>Pendaftaran online melalui situs SPMB</span><span><i class="ph-duotone ph-magnifying-glass"></i>Status dipantau di halaman Cek Status</span></div>`
      : kosong('Alur pendaftaran belum diisi di Konten Situs.') });

    // 5. Kuota dan keterisian
    let kuotaSt = st.kuota || [];
    const totKuota = kuotaSt.reduce((a, x) => a + (x.kuota || 0), 0), totIsi = kuotaSt.reduce((a, x) => a + (x.terisi || 0), 0);
    if (kuotaSt.length > 8) {   // terlalu banyak baris: ringkas per jenjang dan bagian
      const g = {}; kuotaSt.forEach(x => { const k = x.jenjang + '|' + x.bagian; g[k] = g[k] || { gelombang: 'Semua gelombang', jenjang: x.jenjang, bagian: x.bagian, kuota: 0, terisi: 0 }; g[k].kuota += x.kuota || 0; g[k].terisi += x.terisi || 0; });
      kuotaSt = Object.values(g);
    }
    slides.push({ id: 'kuota', label: 'Kuota', judul: 'Kuota dan Keterisian', ikon: 'ph-users-four', tone: 'var(--c5)', html: kuotaSt.length ? `
      <div class="pp-kisi pp-3 pp-rapat">${kpi('Total kuota', fmt.angka(totKuota), 'ph-chair', 'var(--c5)')}${kpi('Kursi terisi', fmt.angka(totIsi), 'ph-user-check', 'var(--ok)', `${persen(totIsi, totKuota)}% dari kuota`)}${kpi('Sisa kursi', fmt.angka(Math.max(0, totKuota - totIsi)), 'ph-armchair', 'var(--c3)')}</div>
      <div class="pp-kartu pp-isi"><table class="pp-tabel"><thead><tr><th>Gelombang</th><th>Jenjang</th><th>Bagian</th><th class="c">Kuota</th><th class="c">Terisi</th><th style="width:34%">Keterisian</th></tr></thead><tbody>
        ${kuotaSt.map(x => `<tr><td>${esc(x.gelombang)}</td><td>${esc(x.jenjang)}</td><td>${bagL(x.bagian)}</td><td class="c">${x.kuota == null ? '–' : fmt.angka(x.kuota)}</td><td class="c">${fmt.angka(x.terisi)}</td>
          <td><div class="pp-bar">${G.kemajuan(x.terisi, x.kuota || 0, x.bagian === 'putri' ? 'var(--c4)' : 'var(--c1)')}<b>${x.kuota ? persen(x.terisi, x.kuota) + '%' : '–'}</b></div></td></tr>`).join('')}
      </tbody></table>${S.uji ? '<p class="pp-catatan">Data uji tidak dihitung ke kuota, sehingga keterisian tampil 0%.</p>' : ''}</div>` : kosong('Kuota belum diatur di Pengaturan SPMB.') });

    // 6. Rincian biaya
    const tahapAda = ['pendaftaran', 'daftar_ulang', 'tahunan', 'bulanan', 'lainnya'].filter(t => S.biaya.some(x => x.tahap === t)).slice(0, 4);
    slides.push({ id: 'biaya', label: 'Biaya', judul: 'Rincian Biaya', ikon: 'ph-wallet', tone: 'var(--c3)', html: tahapAda.length ? `
      <div class="pp-kisi" style="grid-template-columns:repeat(${tahapAda.length},minmax(0,1fr))">${tahapAda.map(t => { const r = S.biaya.filter(x => x.tahap === t), jml = r.filter(x => x.wajib).reduce((a, x) => a + (+x.nominal || 0), 0);
        return `<div class="pp-kartu pp-biaya"><h3><i class="ph-duotone ph-coins" style="color:var(--c3)"></i>${NAMA_TAHAP[t]}</h3>
          <ul>${r.slice(0, 7).map(x => `<li><span>${esc(potong(x.komponen, 38))}${x.jenjang !== 'semua' || x.bagian !== 'semua' || !x.wajib ? `<small>${esc([x.jenjang !== 'semua' ? x.jenjang : '', x.bagian !== 'semua' ? bagL(x.bagian) : '', x.wajib ? '' : 'opsional'].filter(Boolean).join(' · '))}</small>` : ''}</span><b>${rp(x.nominal)}</b></li>`).join('')}</ul>
          ${lebih(r.length - 7, 'komponen')}
          <div class="pp-biaya-jml"><span>Jumlah biaya wajib</span><b>${rp(jml)}</b></div></div>`; }).join('')}</div>
      <p class="pp-catatan">Tagihan tiap santri menyesuaikan jenjang, bagian, dan keringanan yang diberikan.</p>` : kosong('Rincian biaya belum diatur.') });

    // 7. Ringkasan angka
    slides.push({ id: 'ringkasan', label: 'Ringkasan', judul: 'Ringkasan Perkembangan', ikon: 'ph-chart-line-up', tone: 'var(--c7)', html: `
      <div class="pp-kisi pp-3 pp-penuh">
        ${kpi('Pendaftar', fmt.angka(total), 'ph-identification-card', 'var(--c1)', `${fmt.angka(st.hari_ini || 0)} mendaftar hari ini`)}
        ${kpi('Lolos verifikasi', fmt.angka(lolosVerif), 'ph-seal-check', 'var(--c5)', `${persen(lolosVerif, total)}% dari pendaftar`)}
        ${kpi('Ikut seleksi', fmt.angka(st.terjadwal || 0), 'ph-exam', 'var(--c2)', `${fmt.angka(st.sudah_tes || 0)} sudah mengikuti tes`)}
        ${kpi('Dinyatakan lulus', fmt.angka(lulus), 'ph-trophy', 'var(--c6)', `${fmt.angka(st.cadangan || 0)} cadangan`)}
        ${kpi('Daftar ulang selesai', fmt.angka(du), 'ph-clipboard-text', 'var(--ok)', `${persen(du, lulus)}% dari yang lulus`)}
        ${kpi('Dana masuk', keu ? rpRingkas(keu.total?.dibayar) : '–', 'ph-hand-coins', 'var(--c3)', keu ? `${persen(keu.total?.dibayar, keu.total?.tagihan)}% dari tagihan` : '')}
      </div>` });

    // 8. Pendaftar
    const harian = (st.harian || []).map(x => ({ label: fmt.tgl(keDate(String(x.tanggal).slice(0, 10))).slice(0, 5), nilai: x.jumlah, tip: `${tglP(String(x.tanggal).slice(0, 10))}: ${x.jumlah} pendaftar` }));
    const perJ = st.per_jenjang || [];
    const jml = f => fmt.angka(perJ.filter(f).reduce((a, x) => a + x.jumlah, 0));
    slides.push({ id: 'pendaftar', label: 'Pendaftar', judul: 'Pendaftar', ikon: 'ph-identification-card', tone: 'var(--c1)', html: `
      <div class="pp-kisi pp-kiri-lebar">
        <div class="pp-kartu pp-isi"><h4><i class="ph-duotone ph-chart-bar" style="color:var(--c1)"></i>Pendaftar per hari, 30 hari terakhir</h4>${G.batang(harian, { labelTiap: 5 })}</div>
        <div class="pp-kartu"><h4><i class="ph-duotone ph-users-three" style="color:var(--c5)"></i>Per jenjang dan bagian</h4>
          ${G.mendatar(perJ.map(x => ({ label: `${x.jenjang} ${bagL(x.bagian)}`, nilai: x.jumlah })))}
          <div class="pp-mini">${[['SMP', jml(x => x.jenjang === 'SMP')], ['SMA', jml(x => x.jenjang === 'SMA')], ['Putra', jml(x => x.bagian === 'putra')], ['Putri', jml(x => x.bagian === 'putri')]].map(([l, n]) => `<div><small>${l}</small><b>${n}</b></div>`).join('')}</div></div>
      </div>` });

    // 9. Asal dan sumber informasi
    slides.push({ id: 'asal', label: 'Asal', judul: 'Asal Pendaftar dan Sumber Informasi', ikon: 'ph-map-trifold', tone: 'var(--c4)', html: `
      <div class="pp-kisi pp-2">
        <div class="pp-kartu"><h4><i class="ph-duotone ph-map-pin" style="color:var(--c4)"></i>Kabupaten/kota terbanyak</h4>${G.mendatar((st.per_kabupaten || []).slice(0, 8).map(x => ({ label: x.nama, nilai: x.jumlah })), { warna: 'var(--c4)' })}</div>
        <div class="pp-kartu"><h4><i class="ph-duotone ph-megaphone" style="color:var(--c6)"></i>Mengetahui SPMB dari</h4>${G.mendatar([...(st.per_sumber || [])].sort((a, b) => b.jumlah - a.jumlah).slice(0, 8).map(x => ({ label: x.nama, nilai: x.jumlah })), { warna: 'var(--c6)', satuan: 'pilihan' })}</div>
      </div>` });

    // 10. Tahapan seleksi
    const corong = [['Pendaftar', total, 'var(--c1)'], ['Lolos verifikasi berkas dan pembayaran', lolosVerif, 'var(--c5)'], ['Dijadwalkan tes', st.terjadwal || 0, 'var(--c2)'],
      ['Sudah mengikuti tes', st.sudah_tes || 0, 'var(--c3)'], ['Nilai lengkap atau sudah diputuskan', (st.nilai_lengkap || 0) + lulus + (st.cadangan || 0) + (st.tidak_lulus || 0), 'var(--c6)'], ['Dinyatakan lulus', lulus, 'var(--ok)']];
    slides.push({ id: 'seleksi', label: 'Seleksi', judul: 'Tahapan Seleksi', ikon: 'ph-funnel', tone: 'var(--c2)', html: `
      <div class="pp-kisi pp-kiri-lebar">
        <div class="pp-kartu"><ul class="pp-corong">${corong.map(([l, n, t]) => `<li style="--tone:${t};--lebar:${Math.max(10, persen(n, total || 1))}%"><span class="pp-corong-jalur"><span class="pp-corong-bar"><b>${fmt.angka(n)}</b></span></span><span class="pp-corong-l">${l}<small>${persen(n, total)}% dari pendaftar</small></span></li>`).join('')}</ul></div>
        <div class="pp-kartu"><h4><i class="ph-duotone ph-gavel" style="color:var(--c2)"></i>Hasil seleksi</h4>
          <div class="pp-baris-kpi">${[['Lulus', lulus, 'ph-check-circle', 'var(--ok)'], ['Cadangan', st.cadangan || 0, 'ph-hourglass-medium', 'var(--c6)'], ['Tidak lulus', st.tidak_lulus || 0, 'ph-x-circle', 'var(--c7)']].map(([l, n, ic, t]) => `<div style="--tone:${t}"><span class="pp-ikon"><i class="ph-duotone ${ic}"></i></span><span>${l}</span><b>${fmt.angka(n)}</b></div>`).join('')}</div>
          ${st.nilai_menunggu ? `<p class="pp-catatan"><i class="ph-duotone ph-info"></i> ${fmt.angka(st.nilai_menunggu)} nilai masih menunggu validasi.</p>` : ''}</div>
      </div>` });

    // 11. Daftar ulang
    const belumDU = Math.max(0, lulus - du - duMenunggu);
    slides.push({ id: 'daftarulang', label: 'Daftar ulang', judul: 'Daftar Ulang', ikon: 'ph-clipboard-text', tone: 'var(--ok)', html: `
      <div class="pp-kisi pp-2">
        <div class="pp-kartu pp-donat-wadah">${donat([[du, 'var(--ok)'], [duMenunggu, 'var(--c6)'], [belumDU, 'var(--c8)']], `${persen(du, lulus)}%`, 'selesai')}
          <ul class="pp-legenda"><li style="--tone:var(--ok)">Selesai <b>${fmt.angka(du)}</b></li><li style="--tone:var(--c6)">Menunggu verifikasi <b>${fmt.angka(duMenunggu)}</b></li><li style="--tone:var(--c8)">Belum daftar ulang <b>${fmt.angka(belumDU)}</b></li></ul></div>
        <div class="pp-kartu"><div class="pp-baris-kpi">${[['Santri lulus', lulus, 'ph-trophy', 'var(--c6)'], ['Resmi menjadi santri baru', du, 'ph-graduation-cap', 'var(--ok)'], ['Mengundurkan diri', ps.mengundurkan_diri || 0, 'ph-sign-out', 'var(--c8)']].map(([l, n, ic, t]) => `<div style="--tone:${t}"><span class="pp-ikon"><i class="ph-duotone ${ic}"></i></span><span>${l}</span><b>${fmt.angka(n)}</b></div>`).join('')}</div></div>
      </div>` });

    // 12. Keuangan
    if (keu) {
      const T = keu.total || {}, pt = keu.per_tahap || {}, pm = keu.per_metode || {};
      const tahap = Object.keys(NAMA_TAHAP).filter(t => pt[t] && (pt[t].kotor || pt[t].dibayar));
      slides.push({ id: 'keuangan', label: 'Keuangan', judul: 'Keuangan', ikon: 'ph-hand-coins', tone: 'var(--c3)', html: `
        <div class="pp-kisi pp-3 pp-rapat">${kpi('Dana masuk', rpRingkas(T.dibayar), 'ph-piggy-bank', 'var(--ok)', rp(T.dibayar))}${kpi('Total tagihan', rpRingkas(T.tagihan), 'ph-receipt', 'var(--c1)', `setelah keringanan ${rpRingkas(T.potongan)}`)}${kpi('Sisa tagihan', rpRingkas(T.sisa), 'ph-hourglass-medium', 'var(--c7)', `${persen(T.dibayar, T.tagihan)}% sudah terbayar`)}</div>
        <div class="pp-kisi pp-kiri-lebar pp-isi">
          <div class="pp-kartu"><table class="pp-tabel"><thead><tr><th>Tahap</th><th class="k">Tagihan</th><th class="k">Masuk</th><th class="k">Sisa</th><th class="c">Lunas</th></tr></thead><tbody>
            ${tahap.map(t => { const x = pt[t]; return `<tr><td>${NAMA_TAHAP[t]}</td><td class="k">${rp(x.bayar)}</td><td class="k">${rp(x.dibayar)}</td><td class="k">${rp(Math.max(0, x.bayar - x.dibayar))}</td><td class="c">${fmt.angka(x.lunas || 0)}/${fmt.angka(x.santri || 0)}</td></tr>`; }).join('') || '<tr><td colspan="5">Belum ada tagihan.</td></tr>'}
          </tbody><tfoot><tr><td>Jumlah</td><td class="k">${rp(T.tagihan)}</td><td class="k">${rp(T.dibayar)}</td><td class="k">${rp(T.sisa)}</td><td class="c">${fmt.angka(T.santri || 0)} santri</td></tr></tfoot></table>
            <div class="pp-mini">${['transfer', 'tunai'].map(m => `<div><small>${m === 'tunai' ? 'Tunai' : 'Transfer'}</small><b>${rpRingkas(pm[m] || 0)}</b></div>`).join('')}<div><small>Mendapat keringanan</small><b>${fmt.angka(T.santri_keringanan || 0)} santri</b></div></div></div>
          <div class="pp-kartu pp-isi"><h4><i class="ph-duotone ph-chart-bar" style="color:var(--ok)"></i>Dana masuk per hari, 30 hari</h4>
            ${G.batang((keu.harian || []).map(x => ({ label: fmt.tgl(keDate(String(x.tanggal).slice(0, 10))).slice(0, 5), nilai: +x.jumlah || 0, tip: `${tglP(String(x.tanggal).slice(0, 10))}: ${rp(x.jumlah)}` })), { warna: 'var(--ok)', labelTiap: 6, satuan: 'rupiah' })}</div>
        </div>
        <p class="pp-catatan">Dana masuk adalah saldo penerimaan SPMB; pengeluaran belum dicatat di aplikasi.</p>` });
    }

    // 13. Penutup
    slides.push({ id: 'penutup', label: 'Penutup', sampul: true, html: `
      <div class="pp-sampul-isi">
        <span class="pp-eyebrow">Jazakumullahu khairan</span>
        <h1>Terima kasih</h1>
        <p class="pp-lembaga">Panitia SPMB Tahun Ajaran ${esc(ta)}${kp.nama ? `<br><b>${esc(kp.nama)}</b> · Ketua Panitia` : ''}</p>
        <div class="pp-chip-baris"><span><i class="ph-duotone ph-arrows-clockwise"></i>Data diperbarui otomatis setiap menit</span><span><i class="ph-duotone ph-clock"></i>Terakhir ${fmt.jam(S.waktu)} WITA</span></div>
      </div>` });
    return slides;
  }

  /* ---------------- RENDER ---------------- */
  const isiPanggung = (x, i, n) => x.sampul
    ? `<div class="pp-panggung pp-sampul">${x.html}<span class="pp-hal">${i + 1}/${n}</span></div>`
    : `<div class="pp-panggung">
        <div class="pp-kepala"><span class="pp-ikon besar" style="--tone:${x.tone}"><i class="ph-duotone ${x.ikon}"></i></span>
          <div><h2>${esc(x.judul)}</h2><span>SPMB ${esc(SPMB.taAktif(S.p))} · ${esc(S.p.identitas?.nama_singkat || '')}${S.gel ? ' · ' + esc(S.semuaGel.find(g => String(g.id) === S.gel)?.nama || '') : ''}${S.uji ? ' · data uji' : ''}</span></div>
          <span class="pp-hal">${i + 1}/${n}</span></div>
        <div class="pp-badan">${x.html}</div>
        <div class="pp-kaki"><span><i class="ph-duotone ph-clock"></i>Keadaan ${fmt.tgl(S.waktu)} pukul ${fmt.jam(S.waktu)} WITA</span><span class="pp-live"><i></i>LIVE</span></div>
      </div>`;

  function bangun() {
    const daftar = daftarSlide();
    $('#slides').innerHTML = daftar.map((x, i) => `<section class="pres-slide" data-slide="${x.id}" id="slide-${x.id}" aria-label="${esc(x.label)}">${isiPanggung(x, i, daftar.length)}</section>`).join('');
    $('#titik').innerHTML = daftar.map((x, i) => `<button type="button" data-i="${i}" title="${esc(x.label)}" aria-label="${esc(x.label)}"><span>${esc(x.label)}</span></button>`).join('');
    pasangLogo(); perbaruiBilah(); skala(); amati();
  }
  function isiUlang() {
    const daftar = daftarSlide(), ada = [...document.querySelectorAll('.pres-slide')].map(s => s.dataset.slide);
    if (daftar.map(x => x.id).join() !== ada.join()) { const i = S.kini; bangun(); keSlide(i, false); return; }
    daftar.forEach((x, i) => { $(`#slide-${x.id}`).innerHTML = isiPanggung(x, i, daftar.length); });
    pasangLogo(); perbaruiBilah();
  }
  function pasangLogo() { const el = $('#sLogo'); if (el) SPMB.pasangLogo(el, logoPondok(S.p)); }
  function perbaruiBilah() {
    $('#bJudul').textContent = `Perkembangan SPMB ${SPMB.taAktif(S.p)}`;
    $('#bWaktu').textContent = `Diperbarui ${fmt.jam(S.waktu)} WITA`;
    document.title = `Presentasi SPMB ${SPMB.taAktif(S.p)} · ${S.p.identitas?.nama_singkat || 'SPMB'}`;
    const sel = $('#pGel');
    sel.innerHTML = '<option value="">Semua gelombang</option>' + S.semuaGel.filter(g => !!g.uji === S.uji || !g.uji).map(g => `<option value="${g.id}" ${String(g.id) === S.gel ? 'selected' : ''}>${esc(g.nama)}${g.uji ? ' (uji coba)' : ''}</option>`).join('');
    const adaUji = (S.stat?.data_uji || 0) > 0 || S.semuaGel.some(g => g.uji);
    $('#pUjiLabel').classList.toggle('hidden', !adaUji && !S.uji);
    $('#pUji').checked = S.uji;
  }
  // Skala panggung 1600 x 900 agar pas di layar (di bawah bilah alat)
  function skala() {
    const penuh = document.body.classList.contains('layar-penuh');
    const atas = penuh ? 0 : $('#bilah').offsetHeight, jarak = innerWidth < 700 ? 8 : 20;
    const s = Math.min((innerWidth - jarak * 2) / LEBAR, (innerHeight - atas - jarak * 2) / TINGGI);
    document.documentElement.style.setProperty('--skala', Math.max(.15, s).toFixed(4));
    document.documentElement.style.setProperty('--atas', atas + 'px');
  }

  /* ---------------- NAVIGASI ---------------- */
  const slideEl = () => [...document.querySelectorAll('.pres-slide')];
  function keSlide(i, halus = true) {
    const s = slideEl(); i = Math.max(0, Math.min(s.length - 1, i));
    const w = $('#slides'), t = s[i]; if (!t) return;
    if (arahKini() === 'h') w.scrollTo({ left: t.offsetLeft, behavior: halus ? 'smooth' : 'auto' });
    else w.scrollTo({ top: t.offsetTop, behavior: halus ? 'smooth' : 'auto' });
    tandai(i);
  }
  function tandai(i) {
    S.kini = i; const n = slideEl().length;
    $('#pNomor').textContent = `${i + 1} / ${n}`;
    document.querySelectorAll('#titik [data-i]').forEach(b => b.classList.toggle('aktif', +b.dataset.i === i));
    $('#pPrev').disabled = i === 0; $('#pNext').disabled = i === n - 1;
  }
  let pengamat;
  function amati() {
    pengamat?.disconnect();
    pengamat = new IntersectionObserver(es => {
      const terlihat = es.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (terlihat) tandai(slideEl().indexOf(terlihat.target));
    }, { root: $('#slides'), threshold: [0.6] });
    slideEl().forEach(s => pengamat.observe(s));
    tandai(S.kini);
  }
  function aturArah(a, simpan = true) {
    const w = $('#slides'), i = S.kini;
    w.classList.toggle('arah-h', a === 'h'); w.classList.toggle('arah-v', a !== 'h');
    document.body.classList.toggle('pres-h', a === 'h');
    document.querySelectorAll('[data-arah]').forEach(b => b.classList.toggle('aktif', b.dataset.arah === a));
    $('#pPrev i').className = `ph-duotone ${a === 'h' ? 'ph-caret-left' : 'ph-caret-up'}`;
    $('#pNext i').className = `ph-duotone ${a === 'h' ? 'ph-caret-right' : 'ph-caret-down'}`;
    if (simpan) { try { localStorage.setItem(KUNCI_ARAH, a); } catch (e) {} requestAnimationFrame(() => keSlide(i, false)); }
  }

  function pasangInteraksi() {
    $('#pPrev').onclick = () => keSlide(S.kini - 1);
    $('#pNext').onclick = () => keSlide(S.kini + 1);
    $('#titik').onclick = e => { const b = e.target.closest('[data-i]'); if (b) keSlide(+b.dataset.i); };
    document.querySelectorAll('[data-arah]').forEach(b => b.onclick = () => aturArah(b.dataset.arah));
    $('#pSegar').onclick = () => segarkan(true);
    $('#pLayar').onclick = layarPenuh;
    document.addEventListener('fullscreenchange', () => {
      document.body.classList.toggle('layar-penuh', !!document.fullscreenElement);
      $('#pLayar i').className = `ph-duotone ${document.fullscreenElement ? 'ph-corners-in' : 'ph-corners-out'}`;
      setTimeout(() => { skala(); keSlide(S.kini, false); }, 60);
    });
    // Saat layar penuh, bilah alat muncul bila tetikus mendekati tepi atas
    document.addEventListener('mousemove', e => { if (document.body.classList.contains('layar-penuh')) document.body.classList.toggle('bilah-muncul', e.clientY < 70); });
    const gantiSaring = async () => {
      S.gel = $('#pGel').value; S.uji = $('#pUji').checked;
      const g = S.semuaGel.find(x => String(x.id) === S.gel);
      if (g && !!g.uji !== S.uji) S.uji = !!g.uji;
      if (S.gel && !S.semuaGel.some(x => String(x.id) === S.gel && !!x.uji === S.uji)) S.gel = '';
      const q = new URLSearchParams(); if (S.gel) q.set('gelombang', S.gel); if (S.uji) q.set('uji', '1');
      history.replaceState(null, '', 'presentasi.html' + (q.toString() ? '?' + q : ''));
      await segarkan(false);
    };
    $('#pGel').onchange = gantiSaring; $('#pUji').onchange = () => { $('#pGel').value = ''; gantiSaring(); };
    document.addEventListener('keydown', e => {
      if (e.target.closest('input,select,textarea')) return;
      const maju = ['ArrowDown', 'ArrowRight', 'PageDown', ' '], mundur = ['ArrowUp', 'ArrowLeft', 'PageUp'];
      if (maju.includes(e.key)) { e.preventDefault(); keSlide(S.kini + 1); }
      else if (mundur.includes(e.key)) { e.preventDefault(); keSlide(S.kini - 1); }
      else if (e.key === 'Home') { e.preventDefault(); keSlide(0); }
      else if (e.key === 'End') { e.preventDefault(); keSlide(slideEl().length - 1); }
      else if (e.key === 'f' || e.key === 'F') layarPenuh();
    });
    // Roda tetikus: satu putaran = satu slide (kedua arah)
    $('#slides').addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) < 4 && Math.abs(e.deltaX) < 4) return;
      e.preventDefault();
      if (S.rodaKunci) return; S.rodaKunci = true; setTimeout(() => { S.rodaKunci = false; }, 650);
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      keSlide(S.kini + (d > 0 ? 1 : -1));
    }, { passive: false });
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { skala(); keSlide(S.kini, false); }, 80); });
  }
  function layarPenuh() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => toast('Peramban tidak mengizinkan layar penuh.', 'err'));
  }

  mulai().catch(err => {
    console.error(err);
    const m = $('#memuat');
    if (m) m.innerHTML = `<div class="note err" style="max-width:520px"><i class="ph-duotone ph-warning-circle"></i><div><b>Laporan gagal dimuat.</b> ${esc(pesanGalat(err))}<br><a href="dashboard.html">Kembali ke dashboard</a></div></div>`;
  });
})();
