// SIMKA PRO | src/lib/slidePantauan.js | v1.1 | Fase 8 – Urutan kolom NIS > Nama | 10/10/2026
// Penyusun slide Layar Pantauan dari muatan pantauan_langsung(): setiap slide berisi kartu statistik (dengan daftar
// nama untuk detail admin/superadmin) dan grafik (batang/lingkaran). Saringan: jenis kelamin, jenjang, bidang.
// Urutan: Santri, Pegawai, Sekolah SMP, Sekolah SMA, Tahfizh, Hafalan, Musyrif, Kegiatan, Klinik, Security, Ekskul.
import {
  PhStudent, PhChalkboardTeacher, PhBookOpenText, PhBed, PhFirstAidKit, PhSignOut, PhSiren, PhUserCheck, PhClock, PhAirplaneTilt, PhUserMinus,
  PhHourglass, PhMoon, PhCalendarCheck, PhSignIn, PhProhibit, PhPackage, PhHandArrowDown, PhIdentificationBadge, PhUsersThree, PhGraduationCap,
  PhBooks, PhMedal, PhTrophy, PhTrendUp, PhWarningCircle, PhStethoscope, PhAmbulance, PhHeartbeat, PhShieldCheck, PhPersonSimpleRun, PhUsers, PhHouseLine,
} from '@phosphor-icons/vue'
import { formatJam, formatWaktu } from './tanggal'
import { JENIS_TITIPAN, PENGAMBIL } from './security'

const W = { hijau: '#1E7D4F', merah: '#C7332F', biru: '#2F5FA8', jingga: '#C26A12', ungu: '#7B3FA0', teal: '#127A7A', abu: '#7A8590', emas: '#A6791A' }
const KODE = { H: 'Hadir', T: 'Terlambat', I: 'Izin', S: 'Sakit', A: 'Absen', B: 'Bolos' }
const hadirKode = (k) => ['H', 'T'].includes(k)
const persen = (a, b) => (b ? Math.round((100 * a) / b) : 0)
const K_SANTRI = [['nis', 'NIS', 10], ['nama', 'Nama santri', 26], ['kelas', 'Kelas', 8], ['kamar', 'Kamar', 16]]
const K_PEG = [['nama', 'Nama pegawai', 28], ['jabatan', 'Jabatan', 24], ['bidang', 'Bidang', 18], ['ket', 'Keterangan', 22]]
const rapiS = (s, tambah = {}) => ({ ...s, kelas: s.kelas || '–', kamar: s.kamar || '–', halaqah: s.halaqah || '–', ...tambah })
const rapiP = (p, tambah = {}) => ({ ...p, jabatan: p.jabatan || '–', bidang: p.bidang || '–', ket: p.ket || STATUS_PEG[p.status] || '–', ...tambah })
const STATUS_PEG = { hadir: 'Hadir', terlambat: 'Terlambat', dinas_luar: 'Dinas luar', izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti', belum: 'Belum presensi',
  menunggu_verval: 'Menunggu verval', tanpa_keterangan: 'Tanpa keterangan', akan_datang: 'Sesi belum dibuka', libur: 'Tidak terjadwal' }
const STATUS_SESI = { terisi: 'Terlaksana', terbuka: 'Berlangsung', belum_buka: 'Belum dimulai', tidak_terisi: 'Lewat, belum diisi', lewat: 'Lewat batas' }
const kartu = (j, v, i, w, ket, daftar) => ({ j, v, i, w, ket, daftar })
const daftarS = (judul, baris, kolomTambah = []) => ({ judul, kolom: [...K_SANTRI, ...kolomTambah], baris })
const daftarP = (judul, baris) => ({ judul, kolom: K_PEG, baris })

/** Kunci sesi halaqah/asrama santri (mis. 'halaqah:subuh') beserta nama dan kehadiran. */
function sesiSantri(santri, awalan) {
  const kunci = [...new Set(santri.flatMap((s) => Object.keys(s.sesi || {}).filter((k) => k.startsWith(awalan))))]
  return kunci.map((k) => { const ada = santri.filter((s) => s.sesi?.[k]); return { k, n: ada[0]?.sesi[k].n || k.split(':')[1], ada, hadir: ada.filter((s) => hadirKode(s.sesi[k].k)) } })
}
const kartuSesiSantri = (h, ikon, w, judulTidak) => kartu(h.n, `${h.hadir.length}/${h.ada.length}`, ikon, w, `${h.ada.length - h.hadir.length} ${judulTidak}`,
  daftarS(`${h.n}: santri tidak hadir`, h.ada.filter((x) => !hadirKode(x.sesi[h.k].k)).map((x) => rapiS(x, { ket: KODE[x.sesi[h.k].k] })), [['ket', 'Status', 10]]))
const kelasSantri = (s) => {
  const kelas = s.filter((x) => x.kelas_sesi > 0); const tidak = kelas.filter((x) => x.kelas_tidak > 0); const penuh = kelas.filter((x) => x.kelas_tidak >= x.kelas_sesi)
  return { kelas, tidak, hadir: kelas.length - penuh.length }
}
const sesiKegiatan = (sesi, jenis) => { const s = sesi.filter((x) => x.jenis === jenis); return { s, ok: s.filter((x) => x.status === 'terisi'), telat: s.filter((x) => x.status === 'tidak_terisi') } }
const daftarSesi = (judul, s) => ({ judul, kolom: [['jam', 'Jam', 7], ['kelompok', 'Kelompok', 16], ['sesi', 'Sesi', 16], ['pengampu', 'Pengampu', 24], ['status', 'Status', 14], ['hadir', 'Hadir', 9]],
  baris: [...s].sort((a, b) => (a.jam_mulai || '').localeCompare(b.jam_mulai || '')).map((x) => ({ ...x, jam: (x.jam_mulai || '').slice(0, 5), pengampu: x.pengampu || '–',
    status: STATUS_SESI[x.status] || x.status, hadir: x.status === 'terisi' ? `${x.hadir ?? 0}/${x.anggota ?? 0}` : '–' })) })
const grafikStatusSesi = (judul, s) => ({ tipe: 'lingkaran', judul, satuan: 'sesi', data: [
  { n: 'Terlaksana', nilai: s.filter((x) => x.status === 'terisi').length, warna: W.hijau }, { n: 'Berlangsung', nilai: s.filter((x) => x.status === 'terbuka').length, warna: W.biru },
  { n: 'Belum dimulai', nilai: s.filter((x) => x.status === 'belum_buka').length, warna: W.abu }, { n: 'Lewat, belum diisi', nilai: s.filter((x) => ['tidak_terisi', 'lewat'].includes(x.status)).length, warna: W.merah }] })
const grafikPerKelompok = (judul, baris, sumbuY = 'Jumlah santri') => ({ tipe: 'batang', judul, sumbuY, label: baris.map((b) => b.n),
  seri: [{ n: 'Hadir', warna: W.hijau, nilai: baris.map((b) => b.h) }, { n: 'Tidak hadir', warna: W.merah, nilai: baris.map((b) => b.t) }] })

// ---------- Slide sekolah (SMP/SMA) ----------
function slideSekolah(k, judul, jenjang, bidangKode, santriAll, pegawaiAll, sesiAll) {
  const s = santriAll.filter((x) => x.jenjang === jenjang); const ks = kelasSantri(s)
  const sesi = sesiAll.filter((x) => x.jenis === 'kelas' && (!x.jenjang || x.jenjang === jenjang)); const ok = sesi.filter((x) => x.status === 'terisi')
  const guru = pegawaiAll.filter((p) => p.bidang_kode === bidangKode && p.status !== 'libur'); const guruHadir = guru.filter((p) => ['hadir', 'terlambat'].includes(p.status))
  const perKelas = {}; for (const x of ks.kelas) { const n = x.kelas || '–'; perKelas[n] = perKelas[n] || { n, h: 0, t: 0 }; x.kelas_tidak >= x.kelas_sesi ? perKelas[n].t++ : perKelas[n].h++ }
  return { k, judul, ikon: PhGraduationCap, w: jenjang === 'sma' ? 'jadwal' : 'santri', sub: `Kelas ${jenjang === 'sma' ? '10–12' : '7–9'} · kehadiran kelas dan guru hari ini`,
    kartu: [
      kartu('Santri aktif', s.length, PhStudent, 'santri', `${s.filter((x) => x.jk === 'L').length} putra · ${s.filter((x) => x.jk === 'P').length} putri`, daftarS(`Santri ${judul}`, s.map((x) => rapiS(x)))),
      kartu('Hadir di kelas', `${ks.hadir}/${ks.kelas.length}`, PhChalkboardTeacher, 'presensi', `${persen(ks.hadir, ks.kelas.length)}% kehadiran`, daftarS('Santri hadir di kelas', ks.kelas.filter((x) => x.kelas_tidak < x.kelas_sesi).map((x) => rapiS(x)))),
      kartu('Tidak hadir (sebagian/seluruh)', ks.tidak.length, PhUserMinus, 'klinik', 'Izin, sakit, absen, atau bolos', daftarS('Santri tidak hadir di kelas', ks.tidak.map((x) => rapiS(x, { ket: `Tidak hadir ${x.kelas_tidak} dari ${x.kelas_sesi} sesi` })), [['ket', 'Keterangan', 20]])),
      kartu('Sesi kelas terlaksana', `${ok.length}/${sesi.length}`, PhCalendarCheck, 'jadwal', `${sesi.filter((x) => x.status === 'tidak_terisi').length} lewat, belum diisi`, daftarSesi(`Sesi kelas ${judul} hari ini`, sesi)),
      kartu('Guru hadir', `${guruHadir.length}/${guru.length}`, PhUserCheck, 'pegawai', `Pegawai bidang ${judul.replace('Sekolah ', '')} terjadwal`, daftarP(`Guru/pegawai ${judul}`, guru.map((p) => rapiP(p)))),
      kartu('Sakit atau di luar', s.filter((x) => x.sakit || x.luar).length, PhFirstAidKit, 'klinik', `${s.filter((x) => x.sakit).length} sakit · ${s.filter((x) => x.luar).length} di luar`,
        daftarS('Santri sakit atau di luar pondok', s.filter((x) => x.sakit || x.luar).map((x) => rapiS(x, { ket: x.sakit || 'Di luar: ' + x.luar.alasan })), [['ket', 'Keterangan', 22]])),
    ],
    grafik: [grafikPerKelompok('Kehadiran per kelas', Object.values(perKelas).sort((a, b) => a.n.localeCompare(b.n, 'id', { numeric: true }))), grafikStatusSesi('Status sesi kelas', sesi)] }
}

/** Susun semua slide. d = muatan pantauan_langsung, f = { jk, jenjang, bidang } */
export function susunSlide(d, f) {
  const cocokS = (x) => (!f.jk || x.jk === f.jk) && (!f.jenjang || x.jenjang === f.jenjang)
  const santri = d.santri.filter(cocokS); const santriJk = d.santri.filter((x) => !f.jk || x.jk === f.jk)
  const pegawai = d.pegawai.filter((p) => (!f.jk || p.jk === f.jk) && (!f.bidang || p.bidang_id === f.bidang)); const pegawaiJk = d.pegawai.filter((p) => !f.jk || p.jk === f.jk)
  const sesiAll = d.sesi.filter((s) => !f.jk || !s.jk || s.jk === f.jk); const sesi = sesiAll.filter((s) => !f.jenjang || !s.jenjang || s.jenjang === f.jenjang)
  const idSantri = new Set(santri.map((s) => s.id)); const petaSantri = Object.fromEntries(d.santri.map((s) => [s.id, s]))
  const hadirPeg = (p) => ['hadir', 'terlambat'].includes(p.status)
  const slide = []

  // 1. Santri
  {
    const ks = kelasSantri(santri); const sakit = santri.filter((x) => x.sakit); const luar = santri.filter((x) => x.luar); const telat = luar.filter((x) => x.luar.terlambat)
    const asrama = sesiSantri(santri, 'asrama:'); const hq = sesiSantri(santri, 'halaqah:'); const akhirAsrama = asrama[asrama.length - 1]
    slide.push({ k: 'santri', judul: 'Santri', ikon: PhStudent, w: 'santri', sub: 'Kondisi seluruh santri hari ini',
      kartu: [
        kartu('Santri aktif', santri.length, PhStudent, 'santri', `${santri.filter((x) => x.jk === 'L').length} putra · ${santri.filter((x) => x.jk === 'P').length} putri`, daftarS('Santri aktif', santri.map((x) => rapiS(x)), [['halaqah', 'Halaqah', 18]])),
        kartu('Hadir di kelas', `${ks.hadir}/${ks.kelas.length}`, PhChalkboardTeacher, 'jadwal', `${ks.tidak.length} tidak hadir sebagian/seluruh`, daftarS('Santri tidak hadir di kelas', ks.tidak.map((x) => rapiS(x, { ket: `Tidak hadir ${x.kelas_tidak} dari ${x.kelas_sesi} sesi` })), [['ket', 'Keterangan', 20]])),
        akhirAsrama ? kartuSesiSantri(akhirAsrama, PhMoon, 'musyrif', 'tidak di asrama') : kartu('Di asrama', '–', PhMoon, 'musyrif', 'Sesi asrama belum diisi', daftarS('Asrama', [])),
        kartu('Sakit', sakit.length, PhFirstAidKit, 'klinik', `${sakit.filter((x) => /Dirawat/.test(x.sakit)).length} dirawat di klinik`, daftarS('Santri sakit', sakit.map((x) => rapiS(x, { ket: x.sakit })), [['ket', 'Keterangan', 20]])),
        kartu('Di luar pondok', luar.length, PhSignOut, 'security', 'Izin atau libur, belum kembali', daftarS('Santri di luar pondok', luar.map((x) => rapiS(x, { ket: x.luar.alasan, batas: formatWaktu(x.luar.batas) })), [['ket', 'Izin', 20], ['batas', 'Batas kembali', 14]])),
        kartu('Terlambat kembali', telat.length, PhSiren, 'klinik', telat.length ? 'Lewat batas kembali' : 'Tidak ada', daftarS('Santri terlambat kembali', telat.map((x) => rapiS(x, { ket: x.luar.alasan, batas: formatWaktu(x.luar.batas) })), [['ket', 'Izin', 20], ['batas', 'Batas kembali', 14]])),
      ],
      grafik: [
        { tipe: 'batang', judul: 'Kehadiran per kegiatan hari ini (%)', sumbuY: 'Persen hadir', label: ['Kelas', ...hq.map((h) => h.n), ...asrama.map((h) => h.n)],
          seri: [{ n: 'Hadir (%)', warna: W.hijau, nilai: [persen(ks.hadir, ks.kelas.length), ...hq.map((h) => persen(h.hadir.length, h.ada.length)), ...asrama.map((h) => persen(h.hadir.length, h.ada.length))] }] },
        f.jk ? { tipe: 'lingkaran', judul: 'Santri per jenjang', data: [{ n: 'SMP (Wustha)', nilai: santri.filter((x) => x.jenjang === 'wustha').length, warna: W.biru }, { n: 'SMA', nilai: santri.filter((x) => x.jenjang === 'sma').length, warna: W.teal }] }
          : { tipe: 'lingkaran', judul: 'Santri putra dan putri', data: [{ n: 'Putra', nilai: santri.filter((x) => x.jk === 'L').length, warna: W.biru }, { n: 'Putri', nilai: santri.filter((x) => x.jk === 'P').length, warna: W.ungu }] },
      ] })
  }

  // 2. Pegawai (umum)
  {
    const n = (fn) => pegawai.filter(fn); const terjadwal = n((p) => p.status !== 'libur'); const isc = (p) => ['izin', 'sakit', 'cuti'].includes(p.status); const belum = (p) => ['belum', 'menunggu_verval', 'tanpa_keterangan'].includes(p.status)
    const perBidang = d.bidang.filter((b) => !f.bidang || b.id === f.bidang).map((b) => { const x = pegawai.filter((p) => p.bidang_id === b.id && p.status !== 'libur'); return { n: b.nama.replace(/^Bidang /, ''), h: x.filter(hadirPeg).length, t: x.length - x.filter(hadirPeg).length } }).filter((b) => b.h + b.t > 0)
    slide.push({ k: 'pegawai', judul: 'Pegawai', ikon: PhUserCheck, w: 'pegawai', sub: 'Presensi seluruh pegawai hari ini',
      kartu: [
        kartu('Hadir', `${n(hadirPeg).length}/${terjadwal.length}`, PhUserCheck, 'presensi', `${persen(n(hadirPeg).length, terjadwal.length)}% dari pegawai terjadwal`, daftarP('Pegawai hadir', n(hadirPeg).map((p) => rapiP(p)))),
        kartu('Terlambat', n((p) => p.status === 'terlambat').length, PhClock, 'pengajuan', 'Datang lewat batas tepat waktu', daftarP('Pegawai terlambat', n((p) => p.status === 'terlambat').map((p) => rapiP(p)))),
        kartu('Dinas luar', n((p) => p.status === 'dinas_luar').length, PhAirplaneTilt, 'jadwal', 'Bertugas di luar pondok', daftarP('Pegawai dinas luar', n((p) => p.status === 'dinas_luar').map((p) => rapiP(p)))),
        kartu('Izin, sakit, cuti', n(isc).length, PhUserMinus, 'klinik', `${n((p) => p.status === 'izin').length} izin · ${n((p) => p.status === 'sakit').length} sakit · ${n((p) => p.status === 'cuti').length} cuti`, daftarP('Pegawai izin, sakit, cuti', n(isc).map((p) => rapiP(p)))),
        kartu('Belum presensi', n(belum).length, PhHourglass, 'agenda', `${n((p) => p.status === 'akan_datang').length} sesinya belum dibuka`, daftarP('Pegawai belum presensi', n(belum).map((p) => rapiP(p, { ket: STATUS_PEG[p.status] })))),
        kartu('Tidak terjadwal', n((p) => p.status === 'libur').length, PhCalendarCheck, 'hakakses', 'Libur/tidak ada sesi hari ini', daftarP('Pegawai tidak terjadwal', n((p) => p.status === 'libur').map((p) => rapiP(p)))),
      ],
      grafik: [
        { tipe: 'lingkaran', judul: 'Status presensi pegawai', satuan: 'pegawai', data: [
          { n: 'Hadir tepat', nilai: n((p) => p.status === 'hadir').length, warna: W.hijau }, { n: 'Terlambat', nilai: n((p) => p.status === 'terlambat').length, warna: W.jingga },
          { n: 'Dinas luar', nilai: n((p) => p.status === 'dinas_luar').length, warna: W.biru }, { n: 'Izin/sakit/cuti', nilai: n(isc).length, warna: W.ungu },
          { n: 'Belum presensi', nilai: n(belum).length + n((p) => p.status === 'akan_datang').length, warna: W.abu }] },
        { tipe: 'batang', judul: 'Kehadiran per bidang', sumbuY: 'Jumlah pegawai', label: perBidang.map((b) => b.n), seri: [{ n: 'Hadir', warna: W.hijau, nilai: perBidang.map((b) => b.h) }, { n: 'Belum/tidak hadir', warna: W.abu, nilai: perBidang.map((b) => b.t) }] },
      ] })
  }

  // 3–4. Sekolah SMP dan SMA (jenjang tetap, saringan jenis kelamin berlaku)
  slide.push(slideSekolah('smp', 'Sekolah SMP', 'wustha', 'WUSTHA', santriJk, pegawaiJk, sesiAll))
  slide.push(slideSekolah('sma', 'Sekolah SMA', 'sma', 'SMA', santriJk, pegawaiJk, sesiAll))

  // 5. Tahfizh (kehadiran halaqah)
  {
    const hq = sesiSantri(santri, 'halaqah:'); const sk = sesiKegiatan(sesi, 'halaqah')
    const muh = pegawaiJk.filter((p) => (p.muhaffizh || p.bidang_kode === 'TAHFIZH') && p.status !== 'libur')
    const tidak = santri.filter((s) => Object.entries(s.sesi || {}).some(([k, v]) => k.startsWith('halaqah:') && !hadirKode(v.k)))
    slide.push({ k: 'tahfizh', judul: 'Tahfizh', ikon: PhBookOpenText, w: 'tahfizh', sub: 'Halaqah hari ini: kehadiran santri, sesi, dan muhaffizh',
      kartu: [
        ...hq.map((h) => kartuSesiSantri(h, PhBookOpenText, 'tahfizh', 'tidak hadir')),
        kartu('Sesi halaqah terlaksana', `${sk.ok.length}/${sk.s.length}`, PhCalendarCheck, 'jadwal', `${sk.telat.length} lewat, belum diisi`, daftarSesi('Sesi halaqah hari ini', sk.s)),
        kartu('Muhaffizh hadir', `${muh.filter(hadirPeg).length}/${muh.length}`, PhUserCheck, 'pegawai', 'Muhaffizh terjadwal hari ini', daftarP('Muhaffizh hari ini', muh.map((p) => rapiP(p)))),
        kartu('Santri tidak hadir halaqah', tidak.length, PhUserMinus, 'klinik', 'Minimal satu sesi hari ini', daftarS('Santri tidak hadir halaqah', tidak.map((x) => rapiS(x, { ket: Object.entries(x.sesi).filter(([k, v]) => k.startsWith('halaqah:') && !hadirKode(v.k)).map(([, v]) => `${v.n}: ${KODE[v.k]}`).join('; ') })), [['halaqah', 'Halaqah', 16], ['ket', 'Keterangan', 22]])),
      ],
      grafik: [grafikPerKelompok('Kehadiran per sesi halaqah', hq.map((h) => ({ n: h.n, h: h.hadir.length, t: h.ada.length - h.hadir.length }))), grafikStatusSesi('Status sesi halaqah', sk.s)] })
  }

  // 6. Hafalan santri
  {
    const hf = (d.hafalan || []).filter((h) => idSantri.has(h.id)).map((h) => ({ ...petaSantri[h.id], ...h }))
    const terdata = hf.filter((h) => h.status !== 'tidak_terdata'); const capai = hf.filter((h) => ['tercapai', 'khatam'].includes(h.status)); const tidakCapai = hf.filter((h) => h.status === 'tidak_tercapai')
    const setor = hf.filter((h) => h.setor_hari_ini); const halHari = hf.reduce((a, h) => a + (h.hari_ini || 0), 0); const halBulan = hf.reduce((a, h) => a + Math.max(0, h.tambah || 0), 0)
    const rata = hf.length ? (hf.reduce((a, h) => a + (h.resmi || 0), 0) / hf.length).toFixed(1).replace('.', ',') : '0'
    const khatam = hf.filter((h) => (h.resmi || 0) >= 30)
    const ember = [['0', 0, 0], ['1–5', 1, 5], ['6–10', 6, 10], ['11–15', 11, 15], ['16–20', 16, 20], ['21–29', 21, 29], ['30', 30, 30]]
    const K_H = [['halaqah', 'Halaqah', 16], ['resmi', 'Juz resmi', 8], ['tambah', 'Tambah bulan ini (hal)', 10], ['target', 'Target (hal)', 8]]
    const bH = (x) => rapiS(x, { resmi: x.resmi ?? 0, tambah: x.tambah ?? 0, target: x.target ?? 0, hari_ini: x.hari_ini ?? 0 })
    slide.push({ k: 'hafalan', judul: 'Hafalan Santri', ikon: PhBooks, w: 'tahfizh', sub: 'Capaian hafalan bulan berjalan dan setoran hari ini',
      kartu: [
        kartu('Rata-rata hafalan resmi', `${rata} juz`, PhBooks, 'tahfizh', `${hf.length} santri terdata`, daftarS('Hafalan resmi santri', [...hf].sort((a, b) => (b.resmi || 0) - (a.resmi || 0)).map(bH), K_H)),
        kartu('Khatam 30 juz', khatam.length, PhTrophy, 'gaji', 'Juz resmi tervalidasi', daftarS('Santri khatam 30 juz', khatam.map(bH), K_H)),
        kartu('Setor hari ini', `${setor.length}`, PhCalendarCheck, 'presensi', `${halHari} halaman hafalan baru`, daftarS('Santri setor hari ini', setor.map((x) => bH(x)), [['halaqah', 'Halaqah', 16], ['hari_ini', 'Tambah hari ini (hal)', 10]])),
        kartu('Tambahan bulan ini', `${halBulan} hal`, PhTrendUp, 'jadwal', `Rata-rata ${hf.length ? Math.round(halBulan / hf.length) : 0} hal per santri`, daftarS('Tambahan hafalan bulan ini', [...hf].sort((a, b) => (b.tambah || 0) - (a.tambah || 0)).map(bH), K_H)),
        kartu('Mencapai target bulan ini', `${capai.length}/${terdata.length}`, PhMedal, 'presensi', `${persen(capai.length, terdata.length)}% dari santri terdata`, daftarS('Santri mencapai target', capai.map(bH), K_H)),
        kartu('Belum mencapai target', tidakCapai.length, PhWarningCircle, 'klinik', 'Perlu pendampingan muhaffizh', daftarS('Santri belum mencapai target', tidakCapai.map(bH), K_H)),
      ],
      grafik: [
        { tipe: 'lingkaran', judul: 'Capaian target bulan ini', data: [{ n: 'Tercapai/khatam', nilai: capai.length, warna: W.hijau }, { n: 'Belum tercapai', nilai: tidakCapai.length, warna: W.merah },
          { n: 'Belum terdata', nilai: hf.length - terdata.length, warna: W.abu }] },
        { tipe: 'batang', judul: 'Sebaran hafalan resmi (juz)', sumbuY: 'Jumlah santri', label: ember.map((e) => e[0] + ' juz'),
          seri: [{ n: 'Santri', warna: W.teal, nilai: ember.map(([, a, b]) => hf.filter((h) => (h.resmi || 0) >= a && (h.resmi || 0) <= b).length) }] },
      ] })
  }

  // 7. Musyrif dan asrama
  {
    const asrama = sesiSantri(santri, 'asrama:'); const sk = sesiKegiatan(sesi, 'asrama'); const akhir = asrama[asrama.length - 1]
    const mus = pegawaiJk.filter((p) => p.musyrif && p.status !== 'libur'); const sakit = santri.filter((x) => x.sakit && !/Dirujuk/.test(x.sakit))
    const perKamar = {}; if (akhir) for (const x of akhir.ada) { const n = x.kamar || '–'; perKamar[n] = perKamar[n] || { n, h: 0, t: 0 }; hadirKode(x.sesi[akhir.k].k) ? perKamar[n].h++ : perKamar[n].t++ }
    slide.push({ k: 'musyrif', judul: 'Asrama dan Musyrif', ikon: PhBed, w: 'musyrif', sub: 'Kehadiran asrama, sesi, dan musyrif hari ini',
      kartu: [
        kartu('Kamar aktif', d.kelompok?.kamar ?? 0, PhHouseLine, 'musyrif', `${santri.filter((x) => x.kamar).length} santri berkamar`, daftarS('Santri per kamar', [...santri].sort((a, b) => (a.kamar || '').localeCompare(b.kamar || '')).map((x) => rapiS(x)))),
        ...asrama.map((h) => kartuSesiSantri(h, PhMoon, 'musyrif', 'tidak di asrama')),
        kartu('Sesi asrama terlaksana', `${sk.ok.length}/${sk.s.length}`, PhCalendarCheck, 'jadwal', `${sk.telat.length} lewat, belum diisi`, daftarSesi('Sesi asrama hari ini', sk.s)),
        kartu('Musyrif hadir', `${mus.filter(hadirPeg).length}/${mus.length}`, PhUserCheck, 'pegawai', 'Musyrif terjadwal hari ini', daftarP('Musyrif hari ini', mus.map((p) => rapiP(p)))),
        kartu('Sakit di asrama/klinik', sakit.length, PhFirstAidKit, 'klinik', 'Istirahat atau dirawat', daftarS('Santri sakit', sakit.map((x) => rapiS(x, { ket: x.sakit })), [['ket', 'Keterangan', 20]])),
      ],
      grafik: [grafikPerKelompok(akhir ? `Kehadiran per kamar (${akhir.n})` : 'Kehadiran per kamar', Object.values(perKamar).sort((a, b) => a.n.localeCompare(b.n, 'id'))), grafikStatusSesi('Status sesi asrama', sk.s)] })
  }

  // 8. Kegiatan santri dan pengampu
  {
    const J = [['kelas', 'Sesi kelas', PhChalkboardTeacher, 'jadwal'], ['halaqah', 'Sesi halaqah', PhBookOpenText, 'tahfizh'], ['asrama', 'Sesi asrama', PhBed, 'musyrif'], ['ekskul', 'Sesi ekskul', PhUsersThree, 'ekskul']]
    const telat = sesi.filter((x) => x.status === 'tidak_terisi')
    slide.push({ k: 'kegiatan', judul: 'Kegiatan Santri dan Pengampu', ikon: PhCalendarCheck, w: 'jadwal', sub: 'Sesi yang sudah dan belum terlaksana beserta pengampunya',
      kartu: [
        ...J.map(([k, j, i, w]) => { const s = sesiKegiatan(sesi, k); return kartu(j, `${s.ok.length}/${s.s.length}`, i, w, s.telat.length ? `${s.telat.length} lewat, belum diisi` : `${s.s.length - s.ok.length} belum terlaksana`, daftarSesi(`${j} hari ini`, s.s)) }),
        kartu('Lewat waktu, belum diisi', telat.length, PhWarningCircle, 'klinik', 'Perlu diingatkan ke pengampu', daftarSesi('Sesi lewat waktu, belum diisi', telat)),
        kartu('Sedang berlangsung', sesi.filter((x) => x.status === 'terbuka').length, PhHourglass, 'agenda', 'Sesi terbuka saat ini', daftarSesi('Sesi sedang berlangsung', sesi.filter((x) => x.status === 'terbuka'))),
      ],
      grafik: [{ tipe: 'batang', judul: 'Status sesi per kegiatan', sumbuY: 'Jumlah sesi', label: J.map((x) => x[1].replace('Sesi ', '')),
        seri: [['terisi', 'Terlaksana', W.hijau], ['terbuka', 'Berlangsung', W.biru], ['belum_buka', 'Belum dimulai', W.abu], ['tidak_terisi', 'Lewat, belum diisi', W.merah]]
          .map(([st, n, warna]) => ({ n, warna, nilai: J.map(([k]) => sesi.filter((x) => x.jenis === k && x.status === st).length) })) }] })
  }

  // 9. Medis / klinik
  {
    const kl = (d.klinik || []).filter((c) => (!f.jk || c.jk === f.jk) && (!f.jenjang || c.jenjang === f.jenjang)); const hari = d.tanggal
    const tgl = (iso) => iso && new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10)
    const buka = kl.filter((c) => ['menunggu', 'ditangani'].includes(c.status)); const tl = (t) => buka.filter((c) => c.status === 'ditangani' && c.tindak_lanjut === t)
    const sembuh = kl.filter((c) => c.status === 'selesai' && tgl(c.selesai_pada) === hari); const baru = kl.filter((c) => tgl(c.dibuka_pada) === hari)
    const petugas = pegawaiJk.filter((p) => p.unit_kode === 'KLINIK' && p.status !== 'libur')
    const K_K = [['nama', 'Nama santri', 24], ['kelas', 'Kelas', 7], ['kamar', 'Kamar', 14], ['keluhan', 'Keluhan', 26], ['ket', 'Keterangan', 16]]
    const TL = { kembali: 'Kembali beraktivitas', istirahat: 'Istirahat di kamar', rawat: 'Dirawat di klinik', rujuk: 'Dirujuk', pulang: 'Dipulangkan' }
    const bK = (c) => ({ ...c, kelas: c.kelas || '–', kamar: c.kamar || '–', ket: c.status === 'menunggu' ? 'Menunggu pemeriksaan' : c.status === 'selesai' ? 'Sembuh/selesai' : TL[c.tindak_lanjut] || 'Ditangani' })
    const dK = (judul, x) => ({ judul, kolom: K_K, baris: x.map(bK) })
    slide.push({ k: 'klinik', judul: 'Medis dan Klinik', ikon: PhStethoscope, w: 'klinik', sub: 'Klinik putra dan putri hari ini (tanpa diagnosis)',
      kartu: [
        kartu('Menunggu pemeriksaan', buka.filter((c) => c.status === 'menunggu').length, PhHourglass, 'pengajuan', 'Rujukan belum diperiksa', dK('Menunggu pemeriksaan', buka.filter((c) => c.status === 'menunggu'))),
        kartu('Dirawat di klinik', tl('rawat').length, PhHeartbeat, 'klinik', 'Rawat inap klinik', dK('Dirawat di klinik', tl('rawat'))),
        kartu('Istirahat di kamar', tl('istirahat').length, PhBed, 'musyrif', 'Dipantau musyrif', dK('Istirahat di kamar', tl('istirahat'))),
        kartu('Dirujuk', tl('rujuk').length + tl('pulang').length, PhAmbulance, 'shift', `${tl('pulang').length} dipulangkan`, dK('Dirujuk atau dipulangkan', [...tl('rujuk'), ...tl('pulang')])),
        kartu('Diperiksa hari ini', kl.filter((c) => c.periksa_hari_ini > 0).length, PhStethoscope, 'jadwal', `${baru.length} kasus baru hari ini`, dK('Diperiksa hari ini', kl.filter((c) => c.periksa_hari_ini > 0))),
        kartu('Sembuh hari ini', sembuh.length, PhMedal, 'presensi', 'Kasus selesai', dK('Sembuh hari ini', sembuh)),
        kartu('Petugas klinik hadir', `${petugas.filter(hadirPeg).length}/${petugas.length}`, PhUserCheck, 'pegawai', 'Unit Klinik terjadwal', daftarP('Petugas klinik', petugas.map((p) => rapiP(p)))),
      ],
      grafik: [
        { tipe: 'lingkaran', judul: 'Kasus terbuka menurut tindak lanjut', data: [{ n: 'Menunggu', nilai: buka.filter((c) => c.status === 'menunggu').length, warna: W.jingga },
          { n: 'Dirawat', nilai: tl('rawat').length, warna: W.merah }, { n: 'Istirahat', nilai: tl('istirahat').length, warna: W.ungu }, { n: 'Dirujuk/pulang', nilai: tl('rujuk').length + tl('pulang').length, warna: W.biru },
          { n: 'Lainnya', nilai: tl('kembali').length, warna: W.abu }] },
        { tipe: 'batang', judul: 'Kasus terbuka putra dan putri', sumbuY: 'Jumlah santri', label: ['Putra', 'Putri'],
          seri: [{ n: 'Kasus terbuka', warna: W.merah, nilai: ['putra', 'putri'].map((k) => buka.filter((c) => c.klinik === k).length) }, { n: 'Sembuh hari ini', warna: W.hijau, nilai: ['putra', 'putri'].map((k) => sembuh.filter((c) => c.klinik === k).length) }] },
      ] })
  }

  // 10. Security
  {
    const s = d.security; const g = s.gerbang.filter((x) => (!f.jk || x.jk === f.jk) && (!f.jenjang || x.jenjang === f.jenjang)); const t = s.titipan.filter((x) => !f.jk || !x.jenis_kelamin || x.jenis_kelamin === f.jk)
    const tm = s.tamu; const kj = s.kunjungan.filter((x) => !f.jk || !x.jenis_kelamin || x.jenis_kelamin === f.jk)
    const hari = (iso) => iso && new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10) === d.tanggal
    const K_G = [['jam', 'Jam', 7], ['nama', 'Nama santri', 24], ['kelas', 'Kelas', 7], ['kamar', 'Kamar', 14], ['ket', 'Keterangan', 26], ['petugas', 'Petugas', 16]]
    const gb = (j) => ({ judul: { keluar: 'Santri keluar hari ini', kembali: 'Santri kembali hari ini', ditolak: 'Santri ditolak di gerbang' }[j], kolom: K_G,
      baris: g.filter((x) => x.jenis === j).map((x) => ({ ...x, jam: formatJam(x.waktu), kelas: x.kelas || '–', kamar: x.kamar || '–', petugas: x.petugas || '–',
        ket: [x.penjemput && 'Penjemput ' + x.penjemput, x.terlambat_menit && 'Terlambat ' + x.terlambat_menit + ' menit', x.catatan].filter(Boolean).join('; ') || '–' })) })
    const K_T = [['nama', 'Santri', 22], ['kelas', 'Kelas', 7], ['barang', 'Barang', 26], ['pengirim', 'Pengirim', 16], ['diterima', 'Diterima', 14], ['ambil', 'Pengambilan', 24]]
    const tB = (fn) => t.filter(fn).map((x) => ({ ...x, kelas: x.kelas || '–', barang: `${JENIS_TITIPAN[x.jenis]?.n}: ${x.uraian}`, diterima: formatWaktu(x.diterima_pada),
      ambil: x.status === 'di_pos' ? 'Masih di pos' : x.status === 'diambil' ? `${x.pengambil_nama} (${PENGAMBIL[x.pengambil_jenis] || ''}) ${formatJam(x.diambil_pada)}` : x.status }))
    const petugas = pegawaiJk.filter((p) => p.unit_kode === 'SECURITY' && p.status !== 'libur')
    const nj = (j) => g.filter((x) => x.jenis === j).length
    slide.push({ k: 'security', judul: 'Security', ikon: PhShieldCheck, w: 'security', sub: 'Gerbang, titipan, tamu, dan kunjungan hari ini',
      kartu: [
        kartu('Keluar hari ini', nj('keluar'), PhSignOut, 'shift', 'Tercatat di gerbang', gb('keluar')),
        kartu('Kembali hari ini', nj('kembali'), PhSignIn, 'presensi', `${g.filter((x) => x.jenis === 'kembali' && x.terlambat_menit).length} terlambat`, gb('kembali')),
        kartu('Ditolak di gerbang', nj('ditolak'), PhProhibit, 'klinik', 'Tanpa izin berlaku', gb('ditolak')),
        kartu('Titipan di pos', t.filter((x) => x.status === 'di_pos').length, PhPackage, 'pengajuan', `${t.filter((x) => hari(x.diterima_pada)).length} diterima hari ini`, { judul: 'Titipan di pos dan diterima hari ini', kolom: K_T, baris: tB((x) => x.status === 'di_pos' || hari(x.diterima_pada)) }),
        kartu('Titipan diambil', t.filter((x) => x.status === 'diambil' && hari(x.diambil_pada)).length, PhHandArrowDown, 'gaji', 'Hari ini, tercatat pengambilnya', { judul: 'Titipan diambil hari ini', kolom: K_T, baris: tB((x) => x.status === 'diambil' && hari(x.diambil_pada)) }),
        kartu('Tamu', tm.filter((x) => !x.keluar_pada).length, PhIdentificationBadge, 'pegawai', `di dalam · ${tm.filter((x) => hari(x.masuk_pada)).length} tamu hari ini`,
          { judul: 'Tamu hari ini', kolom: [['jam', 'Masuk', 7], ['nama', 'Nama tamu', 20], ['instansi', 'Instansi', 18], ['keperluan', 'Keperluan', 24], ['ditemui', 'Menemui', 18], ['keluar', 'Keluar', 9]],
            baris: tm.map((x) => ({ ...x, jam: formatJam(x.masuk_pada), instansi: x.instansi || 'Pribadi', ditemui: x.ditemui || '–', keluar: x.keluar_pada ? formatJam(x.keluar_pada) : 'Di dalam' })) }),
        kartu('Kunjungan wali', kj.filter((x) => !x.pulang_pada).length, PhUsers, 'tahfizh', `berlangsung · ${kj.filter((x) => hari(x.datang_pada)).length} hari ini`,
          { judul: 'Kunjungan orang tua hari ini', kolom: [['jam', 'Datang', 7], ['nama', 'Santri', 22], ['kelas', 'Kelas', 7], ['pengunjung', 'Pengunjung', 24], ['pulang', 'Pulang', 10]],
            baris: kj.map((x) => ({ ...x, jam: formatJam(x.datang_pada), kelas: x.kelas || '–', pengunjung: x.pengunjung + (x.hubungan ? ` (${x.hubungan})` : ''), pulang: x.pulang_pada ? formatJam(x.pulang_pada) : 'Berlangsung' })) }),
        kartu('Petugas Security hadir', `${petugas.filter(hadirPeg).length}/${petugas.length}`, PhUserCheck, 'pegawai', 'Unit Security terjadwal', daftarP('Petugas Security', petugas.map((p) => rapiP(p)))),
      ],
      grafik: [
        { tipe: 'batang', judul: 'Gerbang hari ini', sumbuY: 'Jumlah santri', label: ['Keluar', 'Kembali', 'Ditolak'], seri: [{ n: 'Santri', warna: W.biru, nilai: [nj('keluar'), nj('kembali'), nj('ditolak')] }] },
        { tipe: 'lingkaran', judul: 'Titipan (di pos dan hari ini)', satuan: 'titipan', data: [{ n: 'Di pos', nilai: t.filter((x) => x.status === 'di_pos').length, warna: W.jingga },
          { n: 'Diambil hari ini', nilai: t.filter((x) => x.status === 'diambil' && hari(x.diambil_pada)).length, warna: W.hijau }, { n: 'Dikembalikan', nilai: t.filter((x) => x.status === 'dikembalikan' && hari(x.diambil_pada)).length, warna: W.abu }] },
      ] })
  }

  // 11. Ekskul
  {
    const sk = sesiKegiatan(sesi, 'ekskul'); const hadir = sk.ok.reduce((a, x) => a + (x.hadir || 0), 0); const anggota = sk.ok.reduce((a, x) => a + (x.anggota || 0), 0)
    const ikut = santri.filter((x) => x.ekskul)
    slide.push({ k: 'ekskul', judul: 'Ekskul', ikon: PhPersonSimpleRun, w: 'ekskul', sub: 'Kegiatan ekstrakurikuler hari ini',
      kartu: [
        kartu('Ekskul aktif', d.kelompok?.ekskul ?? 0, PhPersonSimpleRun, 'ekskul', `${ikut.length} santri terdaftar`, daftarS('Santri peserta ekskul', ikut.map((x) => rapiS(x, { ekskul: x.ekskul })), [['ekskul', 'Ekskul', 20]])),
        kartu('Sesi ekskul terlaksana', `${sk.ok.length}/${sk.s.length}`, PhCalendarCheck, 'jadwal', `${sk.telat.length} lewat, belum diisi`, daftarSesi('Sesi ekskul hari ini', sk.s)),
        kartu('Kehadiran ekskul', `${persen(hadir, anggota)}%`, PhUsersThree, 'presensi', `${hadir} dari ${anggota} peserta pada sesi terlaksana`, daftarSesi('Kehadiran sesi ekskul', sk.ok)),
        kartu('Belum terlaksana', sk.s.length - sk.ok.length, PhHourglass, 'agenda', 'Belum dimulai atau belum diisi', daftarSesi('Sesi ekskul belum terlaksana', sk.s.filter((x) => x.status !== 'terisi'))),
      ],
      grafik: [grafikPerKelompok('Kehadiran per ekskul (sesi terlaksana)', sk.ok.map((x) => ({ n: x.kelompok, h: x.hadir || 0, t: Math.max(0, (x.anggota || 0) - (x.hadir || 0)) }))), grafikStatusSesi('Status sesi ekskul', sk.s)] })
  }
  return slide
}
