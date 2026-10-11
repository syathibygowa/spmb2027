// SIMKA PRO | src/lib/dokumen.js | v1.1 | Fase 8 – Tahap 5 status Ditolak dan jenis laporan resmi | 10/10/2026
// Kode validasi dokumen bertanda tangan elektronik: alamat halaman Cek Keabsahan (dibuka dengan memindai QR),
// penyeragaman kode ketikan, label status, dan QR (SVG, tanpa layanan luar).
import { svgQR } from './kartu'
export { svgQR }

/** Alamat publik Cek Keabsahan Dokumen untuk satu kode (mengikuti alamat aplikasi saat ini). */
export function alamatCek(kode) {
  const dasar = `${location.origin}${location.pathname}`.replace(/index\.html$/, '')
  return `${dasar}#/cek/${(kode || '').replace(/-/g, '')}`
}
/** Seragamkan ketikan pengguna menjadi XXXX-XXXX (huruf kapital, tanpa spasi/tanda). */
export function rapikanKode(k) {
  const s = String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s
}
export const STATUS_DOKUMEN = {
  sah: { n: 'Sah', w: 'presensi', ket: 'Dokumen sah dan tercatat di SIMKA PRO' },
  draf: { n: 'Menunggu tanda tangan', w: 'shift', ket: 'Dokumen belum disahkan oleh semua penanda tangan' },
  ditolak: { n: 'Ditolak', w: 'beranda', ket: 'Penanda tangan menolak dokumen ini' },
  direvisi: { n: 'Direvisi', w: 'pengajuan', ket: 'Dokumen sudah diganti dengan versi baru' },
  dicabut: { n: 'Dicabut', w: 'beranda', ket: 'Dokumen sudah dicabut dan tidak berlaku lagi' },
}
export const JENIS_DOKUMEN = {
  pengajuan_pegawai: 'Surat pengajuan pegawai',
  surat_sakit: 'Surat keterangan sakit',
  laporan_kehadiran_pegawai: 'Laporan kehadiran pegawai',
  laporan_kehadiran_santri: 'Laporan kehadiran santri',
  laporan_layanan: 'Laporan layanan',
}
