// SIMKA PRO | src/lib/tunjangan.js | v1.0 | Fase 1 – Jabatan dan tunjangan | 03/10/2026
// Perkiraan tunjangan per pegawai dari tarif berlaku (Bagian 36 blueprint).
// Ini PERKIRAAN untuk pemetaan jabatan; slip gaji resmi dihitung server pada Fase 11
// (termasuk honor per jam dari jurnal mengajar dan potongan berbasis kehadiran).
import { masaKerja } from './kepegawaian'

export const KATEGORI = {
  struktural: { n: 'Jabatan struktural', w: 'pengaturan', ket: 'Satu jabatan, tidak dapat rangkap' },
  fungsional: { n: 'Jabatan fungsional', w: 'presensi', ket: 'Setiap jabatan dijumlahkan' },
  pendidikan: { n: 'Pendidikan', w: 'pengajuan', ket: 'Pendidikan terakhir terverifikasi' },
  masa_kerja: { n: 'Masa kerja', w: 'tahfizh', ket: 'Tahun penuh sejak TMT, maksimal 12 tahun' },
  kepegawaian: { n: 'Kepegawaian', w: 'pegawai', ket: 'Sesuai status (tetap/kontrak)' },
  kesehatan: { n: 'Kesehatan', w: 'klinik', ket: 'Sesuai status (tetap/kontrak)' },
  level_muhaffizh: { n: 'Level muhaffizh', w: 'santri', ket: 'Khusus pemegang jabatan muhaffizh' },
  honorer_jam: { n: 'Honor per jam', w: 'laporan', ket: 'Jam dihitung dari jurnal mengajar (Fase 4 dan 11)' },
}

export const formatRupiah = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID')

/** Peta tarif berlaku pada tanggal: { kategori: { kunci: baris } } */
export function petaTarif(semua, tanggal) {
  const peta = {}
  for (const r of semua) {
    if (r.berlaku_mulai > tanggal) continue
    const k = (peta[r.kategori] ||= {})
    if (!k[r.kunci] || k[r.kunci].berlaku_mulai < r.berlaku_mulai) k[r.kunci] = r
  }
  return peta
}

/**
 * Hitung perkiraan tunjangan seorang pegawai.
 * @returns {{ rincian: {kategori, label, besaran}[], per: Record<string, number>, total: number, catatan: string[] }}
 */
export function hitungTunjangan(p, tarif, org, tanggal) {
  const rincian = [], catatan = [], per = {}
  const tambah = (kategori, label, besaran) => { rincian.push({ kategori, label, besaran }); per[kategori] = (per[kategori] || 0) + besaran }
  const t = (kat, kunci) => tarif[kat]?.[kunci]

  // Struktural
  const sp = org.struktural.find((s) => s.id === p.structural_position_id)
  if (sp) { const r = t('struktural', sp.kode); r ? tambah('struktural', sp.nama, Number(r.besaran)) : catatan.push(`Tarif jabatan struktural ${sp.nama} belum diatur.`) }

  // Fungsional (akumulasi)
  const fung = (p.fungsional_ids || []).map((id) => org.fungsional.find((f) => f.id === id)).filter(Boolean)
  if (!fung.length) catatan.push('Belum memiliki jabatan fungsional.')
  for (const f of fung) { const r = t('fungsional', f.kode); r ? tambah('fungsional', f.nama, Number(r.besaran)) : catatan.push(`Tarif ${f.nama} belum diatur.`) }

  // Pendidikan
  if (!p.pendidikan_terakhir) catatan.push('Pendidikan terakhir belum diisi.')
  else { const r = t('pendidikan', p.pendidikan_terakhir); r ? tambah('pendidikan', r.nama, Number(r.besaran)) : catatan.push(`Tarif pendidikan ${p.pendidikan_terakhir} belum diatur.`) }

  // Masa kerja (tahun penuh, maksimal 12)
  if (!p.tmt_tugas) catatan.push('TMT tugas belum diisi, masa kerja tidak dapat dihitung.')
  else {
    const a = new Date(p.tmt_tugas + 'T00:00:00'), b = new Date(tanggal + 'T00:00:00')
    let bln = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) bln--
    const th = Math.min(12, Math.max(0, Math.floor(bln / 12)))
    if (th >= 1) { const r = t('masa_kerja', String(th)); r ? tambah('masa_kerja', `${th} tahun`, Number(r.besaran)) : catatan.push(`Tarif masa kerja ${th} tahun belum diatur.`) }
  }

  // Kepegawaian dan kesehatan
  if (!p.status_kepegawaian) catatan.push('Status kepegawaian belum diisi.')
  else if (p.status_kepegawaian === 'honorer') {
    catatan.push(p.kategori_honorer ? `Honorer ${p.kategori_honorer}: honor per jam dihitung dari jurnal mengajar.` : 'Kategori honorer (lama/baru) belum diisi.')
  } else {
    for (const kat of ['kepegawaian', 'kesehatan']) {
      const r = t(kat, p.status_kepegawaian); r ? tambah(kat, r.nama, Number(r.besaran)) : catatan.push(`Tarif ${KATEGORI[kat].n.toLowerCase()} ${p.status_kepegawaian} belum diatur.`)
    }
  }

  // Level muhaffizh
  if (fung.some((f) => f.kode === 'MUHAFFIZH')) {
    if (!p.level_muhaffizh) catatan.push('Level muhaffizh belum diisi.')
    else { const r = t('level_muhaffizh', p.level_muhaffizh); r ? tambah('level_muhaffizh', `Level ${r.nama.toLowerCase()}`, Number(r.besaran)) : catatan.push('Tarif level muhaffizh belum diatur.') }
  }

  return { rincian, per, total: rincian.reduce((a, x) => a + x.besaran, 0), catatan }
}
