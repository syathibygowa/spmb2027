// SIMKA PRO | src/lib/versi.js | v8.6.1 | Fase 8 – Perbaikan: catatan Ingat saya dihapus; cek akhir v1.1 | 11/10/2026
// Nomor versi aplikasi yang tampil di halaman Profil. Naikkan setiap kali kode diunggah ke GitHub.
// Keterangan versi tampil kepada pengguna, jadi ditulis tanpa kata "Fase".
export const VERSI_APLIKASI = '8.6.1'
export const KETERANGAN_VERSI = 'Halaman masuk lebih ringkas'

// Waktu kode dibangun oleh GitHub Actions; dipakai untuk memastikan versi yang tayang adalah yang terbaru.
/* global __WAKTU_BUILD__ */
export const WAKTU_BUILD = typeof __WAKTU_BUILD__ !== 'undefined' ? __WAKTU_BUILD__ : ''
