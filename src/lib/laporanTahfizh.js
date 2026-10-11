// SIMKA PRO | src/lib/laporanTahfizh.js | v1.1 | Fase 8 – Urutan identitas NIS > Nama | 10/10/2026
// Katalog dan penyusun 15 laporan tahfizh (Blueprint Bagian 20). Setiap penyusun menghasilkan bentuk seragam:
//   { judul, subjudul?, mendatar, bagian: [{ judul, kunci, kolom: [{ n, lebar, tengah }], baris: [{ sel: [], sorot }], catatan: [] }], grafik? }
// sehingga satu penampil dipakai untuk layar, cetak F4, dan Excel.
import { formatPosisi, kategoriJuz, labelBulan, PROGRAM, STATUS_BULANAN, ringkasJuz } from './tahfizh'
import { formatPanjang, formatPendek } from './tanggal'

export const KATALOG = [
  { k: 'pekanan', n: 'Capaian hafalan setiap pekan', periode: 'bulan', mendatar: true, w: 'tahfizh' },
  { k: 'bulanan', n: 'Capaian hafalan bulanan', periode: 'bulan', w: 'presensi' },
  { k: 'juz', n: 'Capaian berdasarkan juz yang dihafal', periode: 'bulan', mendatar: true, w: 'pengajuan' },
  { k: 'total', n: 'Daftar santri dengan total hafalan', periode: 'bulan', rentang: true, w: 'santri' },
  { k: 'ujian', n: 'Hasil penilaian ujian tahfizh', periode: 'bulan', mendatar: true, w: 'agenda' },
  { k: 'tidakcapai', n: 'Santri tidak mencapai target', periode: 'semester', w: 'klinik' },
  { k: 'halaqah', n: 'Rekap halaqah bulanan', periode: 'bulan', tanpaKelompok: true, w: 'kelompoksantri' },
  { k: 'semester', n: 'Rekap ketercapaian target semester', periode: 'semester', tanpaKelompok: true, mendatar: true, w: 'laporan' },
  { k: 'kepatuhan', n: 'Kepatuhan laporan muhaffizh', periode: 'bulan', tanpaKelompok: true, w: 'verval' },
  { k: 'g_kategori', n: 'Grafik kategori juz', periode: 'bulan', grafik: true, w: 'tahfizh' },
  { k: 'g_target', n: 'Grafik pencapaian target', periode: 'bulan', grafik: true, w: 'presensi' },
  { k: 'g_total', n: 'Grafik jumlah santri per total juz', periode: 'bulan', grafik: true, w: 'santri' },
  { k: 'g_perjuz', n: 'Grafik sudah/belum hafal per juz', periode: 'bulan', grafik: true, w: 'pengajuan' },
  { k: 'g_tahunan', n: 'Grafik ketercapaian per bulan', periode: 'tahun', grafik: true, w: 'agenda' },
  { k: 'individu', n: 'Laporan individu santri', periode: 'santri', tanpaKelompok: true, w: 'pegawai' },
]
export const KELOMPOK = { halaqah: 'Per halaqah', kelas: 'Per kelas', tingkat: 'Per tingkatan', kamar: 'Per kamar', seluruh: 'Seluruh santri' }
export const kunciKelompok = (r, k) => (k === 'halaqah' ? r.halaqah || 'Belum masuk halaqah' : k === 'kelas' ? r.kelas || 'Belum masuk kelas'
  : k === 'tingkat' ? `Kelas ${r.tingkat}` : k === 'kamar' ? r.kamar || 'Belum masuk kamar' : 'Seluruh santri')

export const WARNA_KATEGORI = { 'Tidak terdata': '#8C8C8C', 'Di bawah 5 juz': '#C7332F', 'Di atas 5 juz': '#E07B39', 'Di atas 10 juz': '#D9A21B',
  'Di atas 15 juz': '#4E9A3E', 'Di atas 20 juz': '#1E7D7D', 'Di atas 25 juz': '#2F5FA8', 'Khatam 30 juz': '#7A3FA0' }
const WARNA_STATUS = { tercapai: '#1E7D4F', tidak_tercapai: '#C7332F', murojaah: '#2F5FA8', khatam: '#7A3FA0', tidak_terdata: '#8C8C8C' }
const pct = (n, d) => (d ? `${(Math.round((n / d) * 1000) / 10).toLocaleString('id-ID')}%` : '0%')
const urutNama = (a, b) => String(a.nama).localeCompare(String(b.nama), 'id')
const terdata = (r) => r.status !== 'tidak_terdata'
const STATUS_KET = (s) => STATUS_BULANAN[s]?.n || s

function catatanUmum(baris) {
  const t = baris.filter(terdata).length
  return [`Jumlah santri ${baris.length} orang, terdata ${t} orang, tidak terdata ${baris.length - t} orang.`, 'Hal = Halaman (1 Juz = 20 Hal).']
}
/** Pecah baris data per kelompok → bagian. */
function perKelompok(data, kelompok, nilai, susunBagian) {
  const peta = new Map()
  data.filter((r) => !nilai || kunciKelompok(r, kelompok) === nilai).forEach((r) => {
    const k = kunciKelompok(r, kelompok); if (!peta.has(k)) peta.set(k, []); peta.get(k).push(r)
  })
  return [...peta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id', { numeric: true })).map(([k, rs]) => ({ kunci: k, ...susunBagian(rs.sort(urutNama), k) }))
}
const muhaffizhDari = (rs) => [...new Set(rs.map((r) => r.muhaffizh).filter(Boolean))].join(', ')

export function susunLaporan(jenis, ctx) {
  const { data = [], kelompok = 'halaqah', nilaiKelompok = '', bulan, pengaturan } = ctx
  const subPeriode = ctx.periodeLabel || (bulan ? labelBulan(bulan) : '')
  switch (jenis) {
    case 'pekanan': return {
      judul: 'Laporan Capaian Hafalan Setiap Pekan', subjudul: subPeriode, mendatar: true,
      bagian: perKelompok(data, kelompok, nilaiKelompok, (rs) => ({
        judul: kelompok === 'halaqah' ? `${kunciKelompok(rs[0], kelompok)} · Muhaffizh: ${muhaffizhDari(rs) || '–'}` : kunciKelompok(rs[0], kelompok),
        muhaffizh: muhaffizhDari(rs),
        kolom: [{ n: 'No.', lebar: 4, tengah: 1 }, { n: 'NIS', lebar: 8, tengah: 1 }, { n: 'Nama', lebar: 20 }, { n: 'Kelas', lebar: 6, tengah: 1 },
          ...[1, 2, 3, 4, 5].map((p) => ({ n: `Pekan ${p}`, lebar: 8, tengah: 1 })), { n: 'Capaian bulan (hal)', lebar: 8, tengah: 1 },
          { n: 'Total hafalan', lebar: 10, tengah: 1 }, { n: 'Keterangan', lebar: 10, tengah: 1 }],
        baris: rs.map((r, i) => ({ sorot: r.status === 'tidak_tercapai', sel: [i + 1, r.nis, r.nama + (r.naqib ? ' (naqib)' : ''), r.kelas || r.tingkat,
          ...(r.pekan || []).map((v) => (v == null ? '–' : formatPosisi(v))), r.tambah_hal, formatPosisi(r.posisi_akhir_hal), STATUS_KET(r.status)] })),
        catatan: [...catatanUmum(rs), 'Posisi pekan = posisi sabaq terakhir pada pekan itu (pekan 1 = tanggal 1–7, pekan 5 = tanggal 29–akhir bulan).'],
      })),
    }
    case 'bulanan': return {
      judul: 'Laporan Capaian Hafalan Bulanan', subjudul: subPeriode,
      bagian: perKelompok(data, kelompok, nilaiKelompok, (rs) => ({
        judul: kunciKelompok(rs[0], kelompok), muhaffizh: kelompok === 'halaqah' ? muhaffizhDari(rs) : '',
        kolom: [{ n: 'No.', lebar: 5, tengah: 1 }, { n: 'NIS', lebar: 11, tengah: 1 }, { n: 'Nama', lebar: 26 }, { n: 'Kelas', lebar: 7, tengah: 1 },
          ...(kelompok === 'halaqah' ? [] : [{ n: 'Muhaffizh', lebar: 19 }]), { n: 'Capaian/ target (hal)', lebar: 11, tengah: 1 }, { n: 'Total hafalan', lebar: 13, tengah: 1 }, { n: 'Keterangan', lebar: 15, tengah: 1 }],
        baris: rs.map((r, i) => ({ sorot: r.status === 'tidak_tercapai', sel: [i + 1, r.nis, r.nama, r.kelas || r.tingkat, ...(kelompok === 'halaqah' ? [] : [r.muhaffizh || '–']), `${r.tambah_hal}/${r.target_hal}`, formatPosisi(r.posisi_akhir_hal), STATUS_KET(r.status)] })),
        catatan: [...catatanUmum(rs), `Tercapai ${rs.filter((r) => r.status === 'tercapai').length}, tidak tercapai ${rs.filter((r) => r.status === 'tidak_tercapai').length} (baris berwarna), Murojaah ${rs.filter((r) => r.status === 'murojaah').length}, Khatam ${rs.filter((r) => r.status === 'khatam').length}.`],
      })),
    }
    case 'juz': return {
      judul: 'Laporan Capaian Berdasarkan Juz yang Dihafal', subjudul: subPeriode, mendatar: true, kecil: true,
      bagian: perKelompok(data, kelompok, nilaiKelompok, (rs) => ({
        judul: kunciKelompok(rs[0], kelompok), muhaffizh: kelompok === 'halaqah' ? muhaffizhDari(rs) : '',
        kolom: [{ n: 'No.', lebar: 2.5, tengah: 1 }, { n: 'Nama', lebar: 14 }, ...Array.from({ length: 30 }, (_, j) => ({ n: String(j + 1), lebar: 2.1, tengah: 1 })),
          { n: 'Total', lebar: 4, tengah: 1 }, { n: 'Baru (hal)', lebar: 4.5, tengah: 1 }, { n: 'Progres', lebar: 5, tengah: 1 }, { n: 'Ket.', lebar: 6, tengah: 1 }],
        baris: rs.map((r, i) => ({ sel: [i + 1, r.nama, ...Array.from({ length: 30 }, (_, j) => ((r.juz_resmi || []).includes(j + 1) ? '✓' : '')), r.total_resmi,
          Math.max(0, r.tambah_hal), pct(r.total_resmi, 30), r.total_resmi >= 30 ? 'Khatam' : ''] })),
        catatan: [`Jumlah santri ${rs.length} orang; khatam ${rs.filter((r) => r.total_resmi >= 30).length} orang. ✓ = juz resmi (lulus ujian/divalidasi/data awal).`, 'Baru = penambahan sabaq bulan ini (halaman).'],
      })),
    }
    case 'total': {
      const min = Number(ctx.rentang?.min ?? 0); const maks = Number(ctx.rentang?.maks ?? 30)
      const pilih = data.filter((r) => r.total_resmi >= min && r.total_resmi <= maks)
      return {
        judul: 'Daftar Santri dengan Total Hafalan', subjudul: `${subPeriode} · total hafalan ${min} s.d. ${maks} juz`,
        bagian: perKelompok(pilih, kelompok, nilaiKelompok, (rs) => ({
          judul: kunciKelompok(rs[0], kelompok),
          kolom: [{ n: 'No.', lebar: 5, tengah: 1 }, { n: 'NIS', lebar: 11, tengah: 1 }, { n: 'Nama', lebar: 26 }, { n: 'Kelas', lebar: 8, tengah: 1 },
            { n: 'Halaqah', lebar: 20 }, { n: 'Total juz', lebar: 9, tengah: 1 }, { n: 'Posisi sabaq', lebar: 12, tengah: 1 }, { n: 'Program', lebar: 9, tengah: 1 }],
          baris: rs.map((r, i) => ({ sel: [i + 1, r.nis, r.nama, r.kelas || r.tingkat, r.halaqah || '–', r.total_resmi, formatPosisi(r.posisi_akhir_hal), PROGRAM[r.program]] })),
          catatan: [`Jumlah santri ${rs.length} orang dengan total hafalan resmi ${min} s.d. ${maks} juz.`],
        })),
      }
    }
    case 'ujian': {
      const u = (ctx.ujian || []).map((x) => ({ ...x, tingkat: data.find((d) => d.student_id === x.student_id)?.tingkat, kamar: data.find((d) => d.student_id === x.student_id)?.kamar,
        muhaffizh: data.find((d) => d.student_id === x.student_id)?.muhaffizh }))
      return {
        judul: 'Hasil Penilaian Ujian Tahfizh', subjudul: subPeriode, mendatar: true,
        bagian: perKelompok(u, kelompok, nilaiKelompok, (rs) => ({
          judul: kunciKelompok(rs[0], kelompok), muhaffizh: kelompok === 'halaqah' ? muhaffizhDari(rs) : '',
          kolom: [{ n: 'No.', lebar: 3.5, tengah: 1 }, { n: 'Nama', lebar: 17 }, { n: 'Kelas', lebar: 5, tengah: 1 }, { n: 'Total hafalan', lebar: 6, tengah: 1 },
            { n: 'Juz diujikan', lebar: 10, tengah: 1 }, { n: 'Penguji', lebar: 15 }, { n: 'Tajwid', lebar: 6, tengah: 1 }, { n: 'Itqan', lebar: 6, tengah: 1 },
            { n: 'Nilai akhir', lebar: 6, tengah: 1 }, { n: 'Huruf', lebar: 5, tengah: 1 }, { n: 'Predikat', lebar: 12 }, { n: 'Ket.', lebar: 8.5, tengah: 1 }],
          baris: rs.sort((a, b) => String(a.diuji_pada).localeCompare(String(b.diuji_pada))).map((r, i) => ({ sorot: r.hasil === 'remidi', sel: [i + 1, r.nama, r.kelas || '–', `${r.total_resmi} juz`,
            r.jenis === 'kenaikan' ? ringkasJuz(r.juz) : `Sertifikasi ${r.jenjang} juz`, r.penguji || '–', r.nilai_tajwid, r.nilai_itqan, r.nilai_akhir, r.huruf || '–', r.predikat || '–',
            r.hasil === 'tuntas' ? 'Tuntas' : 'Remidi'] })),
          catatan: [`Jumlah peserta ${rs.length} orang: Tuntas ${rs.filter((r) => r.hasil === 'tuntas').length}, Remidi ${rs.filter((r) => r.hasil === 'remidi').length}. KKM ${pengaturan?.kkm ?? 80}.`],
        })),
      }
    }
    case 'tidakcapai': {
      const per = new Map()
      for (const [b, rs] of Object.entries(ctx.dataBulan || {})) for (const r of rs) {
        const x = per.get(r.student_id) || { ...r, tambahSmt: 0, targetSmt: 0, bulanTerdata: 0 }
        if (r.status !== 'tidak_terdata' && r.status !== 'murojaah') { x.tambahSmt += r.tambah_hal; x.targetSmt += r.target_hal; x.bulanTerdata++ }
        x.posisi_akhir_hal = r.posisi_akhir_hal; x.total_resmi = r.total_resmi; per.set(r.student_id, x)
      }
      const tidak = [...per.values()].filter((r) => r.bulanTerdata > 0 && r.tambahSmt < r.targetSmt && r.total_resmi < 30)
      return {
        judul: 'Daftar Santri Tidak Mencapai Target', subjudul: ctx.periodeLabel,
        bagian: perKelompok(tidak, kelompok, nilaiKelompok, (rs) => ({
          judul: kunciKelompok(rs[0], kelompok),
          kolom: [{ n: 'No.', lebar: 5, tengah: 1 }, { n: 'NIS', lebar: 11, tengah: 1 }, { n: 'Nama', lebar: 24 }, { n: 'Kelas', lebar: 7, tengah: 1 }, { n: 'Halaqah', lebar: 18 },
            { n: 'Target semester (hal)', lebar: 10, tengah: 1 }, { n: 'Capaian semester (hal)', lebar: 10, tengah: 1 }, { n: 'Total hafalan', lebar: 15, tengah: 1 }],
          baris: rs.map((r, i) => ({ sorot: true, sel: [i + 1, r.nis, r.nama, r.kelas || r.tingkat, r.halaqah || '–', r.targetSmt, r.tambahSmt, formatPosisi(r.posisi_akhir_hal)] })),
          catatan: [`${rs.length} santri belum mencapai target semester (target = target pekan × pekan efektif tiap bulan terdata; bulan Murojaah tidak dihitung).`, 'Hal = Halaman (1 Juz = 20 Hal).'],
        })),
      }
    }
    case 'halaqah': {
      const per = new Map()
      for (const r of data) { const k = r.halaqah_id || '-'; const x = per.get(k) || { halaqah: r.halaqah || 'Belum masuk halaqah', muhaffizh: r.muhaffizh, rs: [] }; x.rs.push(r); per.set(k, x) }
      const baris = [...per.entries()].sort((a, b) => a[1].halaqah.localeCompare(b[1].halaqah, 'id', { numeric: true })).map(([id, x], i) => {
        const capai = x.rs.filter((r) => ['tercapai', 'khatam'].includes(r.status)).length; const dasar = x.rs.filter((r) => !['tidak_terdata', 'murojaah'].includes(r.status)).length
        const hadir = (ctx.kehadiran || []).find((h) => h.halaqah_id === id)
        return { sel: [i + 1, x.muhaffizh || '–', x.halaqah, x.rs.length, capai, x.rs.filter((r) => r.status === 'tidak_tercapai').length,
          dasar ? pct(capai, dasar) : '–', hadir?.persen != null ? `${String(hadir.persen).replace('.', ',')}%` : '–'], sorot: dasar && capai / dasar < 0.5 }
      })
      return { judul: 'Rekap Halaqah Bulanan', subjudul: subPeriode, bagian: [{ judul: '', kolom: [{ n: 'No.', lebar: 5, tengah: 1 }, { n: 'Muhaffizh', lebar: 24 }, { n: 'Halaqah', lebar: 20 },
        { n: 'Jumlah santri', lebar: 9, tengah: 1 }, { n: 'Capai', lebar: 9, tengah: 1 }, { n: 'Tidak capai', lebar: 9, tengah: 1 }, { n: '% capaian', lebar: 12, tengah: 1 }, { n: '% kehadiran', lebar: 12, tengah: 1 }],
      baris, catatan: [...catatanUmum(data), 'Capai = Tercapai + Khatam. % capaian dihitung dari santri terdata selain Murojaah. % kehadiran dari absensi halaqah bulan itu.'] }] }
    }
    case 'semester': {
      const bulanList = Object.keys(ctx.dataBulan || {}).sort()
      const per = new Map()
      for (const b of bulanList) for (const r of ctx.dataBulan[b]) {
        const k = r.halaqah_id || '-'; const x = per.get(k) || { halaqah: r.halaqah || 'Belum masuk halaqah', muhaffizh: r.muhaffizh, bulan: {} }
        const m = x.bulan[b] || { capai: 0, dasar: 0 }; if (['tercapai', 'khatam'].includes(r.status)) m.capai++; if (!['tidak_terdata', 'murojaah'].includes(r.status)) m.dasar++
        x.bulan[b] = m; per.set(k, x)
      }
      const sm = Number(pengaturan?.rekap_sangat_memuaskan ?? 90); const mm = Number(pengaturan?.rekap_memuaskan ?? 75)
      const baris = [...per.values()].sort((a, b) => a.halaqah.localeCompare(b.halaqah, 'id', { numeric: true })).map((x, i) => {
        const capai = bulanList.reduce((t, b) => t + (x.bulan[b]?.capai || 0), 0); const dasar = bulanList.reduce((t, b) => t + (x.bulan[b]?.dasar || 0), 0)
        const p = dasar ? Math.round((capai / dasar) * 1000) / 10 : null
        return { sorot: p != null && p < mm, sel: [i + 1, x.muhaffizh || '–', x.halaqah, ...bulanList.map((b) => (x.bulan[b] ? `${x.bulan[b].capai}/${x.bulan[b].dasar}` : '–')),
          p == null ? '–' : `${String(p).replace('.', ',')}%`, p == null ? '–' : p >= sm ? 'Sangat memuaskan' : p >= mm ? 'Memuaskan' : 'Perlu ditingkatkan'] }
      })
      return { judul: 'Rekap Ketercapaian Target Semester', subjudul: ctx.periodeLabel, mendatar: true,
        bagian: [{ judul: '', kolom: [{ n: 'No.', lebar: 4, tengah: 1 }, { n: 'Muhaffizh', lebar: 20 }, { n: 'Halaqah', lebar: 16 },
          ...bulanList.map((b) => ({ n: labelBulan(b).split(' ')[0].slice(0, 3), lebar: 7, tengah: 1 })), { n: 'Capaian target', lebar: 9, tengah: 1 }, { n: 'Keterangan', lebar: 14, tengah: 1 }],
        baris, catatan: [`Sel bulan = santri tercapai/santri terdata. Sangat memuaskan ≥ ${sm}%, Memuaskan ≥ ${mm}%, di bawahnya Perlu ditingkatkan.`] }] }
    }
    case 'kepatuhan': {
      const status = (s, t) => (!s ? '–' : t >= s ? 'Lengkap' : t > 0 ? 'Sebagian' : 'Belum')
      const baris = (ctx.kepatuhan || []).map((h, i) => {
        const s = h.seharusnya.reduce((a, b) => a + b, 0); const t = h.terisi.reduce((a, b) => a + b, 0); const p = s ? Math.round((t / s) * 1000) / 10 : null
        return { sorot: p != null && p < 100, sel: [i + 1, h.muhaffizh || '–', h.halaqah, ...h.seharusnya.map((x, k) => status(x, h.terisi[k])), p == null ? '–' : `${String(p).replace('.', ',')}%`, p === 100 ? 'Lengkap' : p == null ? '–' : 'Belum lengkap'] }
      })
      return { judul: 'Kepatuhan Laporan Muhaffizh', subjudul: subPeriode,
        bagian: [{ judul: '', kolom: [{ n: 'No.', lebar: 5, tengah: 1 }, { n: 'Muhaffizh', lebar: 23 }, { n: 'Halaqah', lebar: 18 }, ...[1, 2, 3, 4, 5].map((k) => ({ n: `Pekan ${k}`, lebar: 8, tengah: 1 })),
          { n: 'Progres laporan', lebar: 8, tengah: 1 }, { n: 'Keterangan', lebar: 8, tengah: 1 }],
        baris, catatan: ['Lengkap = semua sesi setoran pada pekan itu sudah disimpan; Sebagian = sebagian; Belum = belum ada. Progres = sesi terisi ÷ sesi seharusnya sampai hari ini.'] }] }
    }
    case 'g_kategori': {
      const pilih = data.filter((r) => !nilaiKelompok || kunciKelompok(r, kelompok) === nilaiKelompok)
      const n = Object.keys(WARNA_KATEGORI).map((k) => ({ n: k, warna: WARNA_KATEGORI[k], nilai: pilih.filter((r) => kategoriJuz(r.total_resmi, r.total_resmi > 0 || r.posisi_akhir_hal > 0) === k).length }))
      return { judul: 'Grafik Capaian Hafalan per Kategori Juz', subjudul: `${subPeriode}${nilaiKelompok ? ' · ' + nilaiKelompok : ' · seluruh santri'}`,
        grafik: { jenis: 'lingkaran', data: n }, bagian: [{ judul: '', kolom: [{ n: 'Kategori', lebar: 60 }, { n: 'Jumlah santri', lebar: 20, tengah: 1 }, { n: 'Persentase', lebar: 20, tengah: 1 }],
          baris: n.map((x) => ({ sel: [x.n, x.nilai, pct(x.nilai, pilih.length)] })), catatan: catatanUmum(pilih) }] }
    }
    case 'g_target': {
      const pilih = data.filter((r) => !nilaiKelompok || kunciKelompok(r, kelompok) === nilaiKelompok)
      const n = Object.keys(WARNA_STATUS).map((k) => ({ n: STATUS_BULANAN[k].n, warna: WARNA_STATUS[k], nilai: pilih.filter((r) => r.status === k).length }))
      return { judul: 'Grafik Pencapaian Target Hafalan', subjudul: `${subPeriode}${nilaiKelompok ? ' · ' + nilaiKelompok : ''}`, grafik: { jenis: 'lingkaran', data: n },
        bagian: [{ judul: '', kolom: [{ n: 'Status', lebar: 60 }, { n: 'Jumlah santri', lebar: 20, tengah: 1 }, { n: 'Persentase', lebar: 20, tengah: 1 }],
          baris: n.map((x) => ({ sel: [x.n, x.nilai, pct(x.nilai, pilih.length)] })), catatan: catatanUmum(pilih) }] }
    }
    case 'g_total': {
      const pilih = data.filter((r) => !nilaiKelompok || kunciKelompok(r, kelompok) === nilaiKelompok)
      const label = Array.from({ length: 31 }, (_, i) => String(i))
      const nilai = label.map((_, i) => pilih.filter((r) => r.total_resmi === i).length)
      return { judul: 'Grafik Jumlah Santri per Total Juz', subjudul: `${subPeriode}${nilaiKelompok ? ' · ' + nilaiKelompok : ''}`, mendatar: true,
        grafik: { jenis: 'batang', label, seri: [{ n: 'Jumlah santri', warna: '#8C6200', nilai }], sumbuY: 'Jumlah santri' },
        bagian: [{ judul: '', kolom: [{ n: 'Total juz', lebar: 50, tengah: 1 }, { n: 'Jumlah santri', lebar: 50, tengah: 1 }], baris: label.map((l, i) => ({ sel: [l, nilai[i]] })).filter((x) => x.sel[1] > 0), catatan: catatanUmum(pilih) }] }
    }
    case 'g_perjuz': {
      const pilih = data.filter((r) => !nilaiKelompok || kunciKelompok(r, kelompok) === nilaiKelompok)
      const label = Array.from({ length: 30 }, (_, i) => String(i + 1))
      const sudah = label.map((_, i) => pilih.filter((r) => (r.juz_resmi || []).includes(i + 1)).length)
      return { judul: 'Grafik Santri Sudah dan Belum Hafal per Juz', subjudul: `${subPeriode}${nilaiKelompok ? ' · ' + nilaiKelompok : ''}`, mendatar: true,
        grafik: { jenis: 'batang', label, seri: [{ n: 'Sudah hafal', warna: '#1E7D4F', nilai: sudah }, { n: 'Belum hafal', warna: '#D9CFC9', nilai: sudah.map((s) => pilih.length - s) }] },
        bagian: [{ judul: '', kolom: [{ n: 'Juz', lebar: 34, tengah: 1 }, { n: 'Sudah hafal', lebar: 33, tengah: 1 }, { n: 'Belum hafal', lebar: 33, tengah: 1 }],
          baris: label.map((l, i) => ({ sel: [l, sudah[i], pilih.length - sudah[i]] })), catatan: catatanUmum(pilih) }] }
    }
    case 'g_tahunan': {
      const bulanList = Object.keys(ctx.dataBulan || {}).sort()
      const pilih = (b) => ctx.dataBulan[b].filter((r) => !nilaiKelompok || kunciKelompok(r, kelompok) === nilaiKelompok)
      const capai = bulanList.map((b) => pilih(b).filter((r) => ['tercapai', 'khatam'].includes(r.status)).length)
      const tidak = bulanList.map((b) => pilih(b).filter((r) => r.status === 'tidak_tercapai').length)
      const label = bulanList.map((b) => labelBulan(b).split(' ')[0].slice(0, 3))
      return { judul: 'Grafik Ketercapaian Target per Bulan', subjudul: `${ctx.periodeLabel}${nilaiKelompok ? ' · ' + nilaiKelompok : ''}`, mendatar: true,
        grafik: { jenis: 'batang', label, seri: [{ n: 'Tercapai (termasuk khatam)', warna: '#1E7D4F', nilai: capai }, { n: 'Tidak tercapai', warna: '#C7332F', nilai: tidak }] },
        bagian: [{ judul: '', kolom: [{ n: 'Bulan', lebar: 40 }, { n: 'Tercapai', lebar: 20, tengah: 1 }, { n: 'Tidak tercapai', lebar: 20, tengah: 1 }, { n: '% tercapai', lebar: 20, tengah: 1 }],
          baris: bulanList.map((b, i) => ({ sel: [labelBulan(b), capai[i], tidak[i], capai[i] + tidak[i] ? pct(capai[i], capai[i] + tidak[i]) : '–'] })),
          catatan: ['Bulan yang belum berjalan tidak ditampilkan. Murojaah dan tidak terdata tidak dihitung.'] }] }
    }
    case 'individu': {
      const s = ctx.santri; if (!s) return { judul: 'Laporan Individu Santri', bagian: [] }
      const r = data.find((d) => d.student_id === s.student_id) || {}
      return { judul: 'Laporan Individu Perkembangan Hafalan', subjudul: `${s.nama} · NIS ${s.nis} · ${ctx.periodeLabel}`,
        identitas: [['NIS', s.nis], ['Nama', s.nama], ['Kelas', s.kelas || s.tingkat], ['Halaqah', `${s.halaqah || '–'}${r.muhaffizh ? ' · ' + r.muhaffizh : ''}`],
          ['Program', PROGRAM[s.program]], ['Posisi sabaq', formatPosisi(s.sabaq_hal, true)], ['Total hafalan resmi', `${s.total_resmi} juz${s.juz_resmi?.length ? ' (' + ringkasJuz(s.juz_resmi) + ')' : ''}`]],
        bagian: [
          { judul: 'Riwayat setoran', kolom: [{ n: 'Tanggal', lebar: 14, tengah: 1 }, { n: 'Sesi', lebar: 14 }, { n: 'Sabaq', lebar: 22, tengah: 1 }, { n: 'Tambah (hal)', lebar: 9, tengah: 1 },
            { n: 'Sabqi', lebar: 12, tengah: 1 }, { n: 'Manzil', lebar: 12, tengah: 1 }, { n: 'Catatan', lebar: 17 }],
          baris: (ctx.riwayat || []).slice().reverse().map((x) => ({ sorot: (x.janggal || []).length > 0, sel: [formatPendek(x.tanggal), x.nama_sesi,
            ['I', 'S', 'B', 'A'].includes(x.kehadiran) ? `Tidak setor (${x.kehadiran})` : x.sabaq_hal == null ? 'Sama' : `${formatPosisi(x.sabaq_lama)} → ${formatPosisi(x.sabaq_hal)}`,
            x.tambah_hal || 0, x.sabqi_hal == null ? '–' : formatPosisi(x.sabqi_hal), x.manzil_hal == null ? '–' : formatPosisi(x.manzil_hal), x.catatan || ''] })),
          catatan: [`${(ctx.riwayat || []).length} sesi, penambahan ${(ctx.riwayat || []).reduce((t, x) => t + Math.max(0, x.tambah_hal || 0), 0)} halaman. Sel berwarna = isian ditandai janggal.`] },
          { judul: 'Riwayat ujian', kolom: [{ n: 'Tanggal', lebar: 14, tengah: 1 }, { n: 'Ujian', lebar: 26 }, { n: 'Penguji', lebar: 22 }, { n: 'Tajwid', lebar: 8, tengah: 1 }, { n: 'Itqan', lebar: 8, tengah: 1 },
            { n: 'Akhir', lebar: 8, tengah: 1 }, { n: 'Hasil', lebar: 14, tengah: 1 }],
          baris: (ctx.ujian || []).filter((u) => u.student_id === s.student_id && u.status === 'selesai').map((u) => ({ sorot: u.hasil === 'remidi', sel: [formatPendek(u.diuji_pada),
            u.jenis === 'kenaikan' ? `Kenaikan juz ${ringkasJuz(u.juz)}` : `Sertifikasi ${u.jenjang} juz`, u.penguji || '–', u.nilai_tajwid, u.nilai_itqan, u.nilai_akhir, `${u.hasil === 'tuntas' ? 'Tuntas' : 'Remidi'} (${u.huruf || '–'})`] })),
          catatan: [] },
        ] }
    }
    default: return { judul: '', bagian: [] }
  }
}
export const tanggalCetak = () => formatPanjang(new Date())
