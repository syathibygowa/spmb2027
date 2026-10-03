// SIMKA PRO | src/lib/menu.js | v1.1 | Fase 1 – Jabatan dan tunjangan | 03/10/2026
// Daftar menu SIMKA PRO. Setiap menu memiliki ikon Phosphor (duotone) dan
// warna sendiri (kelas .w-* di token.css). "fase" menandai menu yang dibangun
// pada fase berikutnya; menu tersebut tampil dengan lencana fase.
import {
  PhHouse, PhFingerprint, PhUsersThree, PhStudent, PhBookOpenText, PhFileText, PhFirstAidKit,
  PhShieldCheck, PhChartBar, PhEnvelopeSimple, PhWallet, PhMegaphone, PhKey, PhGearSix, PhBell,
  PhUserCircle, PhSquaresFour, PhUserCheck, PhNotebook, PhIdentificationCard, PhTreeStructure, PhCoins,
} from '@phosphor-icons/vue'

const ADMIN = ['admin', 'superadmin']
export const MENU = [
  { kode: 'beranda',    nama: 'Beranda',         ikon: PhHouse,          warna: 'beranda',    ke: '/',                  grup: 'Utama' },
  { kode: 'notifikasi', nama: 'Notifikasi',      ikon: PhBell,           warna: 'notifikasi', ke: '/notifikasi',        grup: 'Utama' },
  { kode: 'presensi',   nama: 'Presensi',        ikon: PhFingerprint,    warna: 'presensi',   ke: '/presensi',          grup: 'Kepegawaian', fase: 2 },
  { kode: 'pegawai',    nama: 'Data Pegawai',    ikon: PhUsersThree,     warna: 'pegawai',    ke: '/pegawai',           grup: 'Kepegawaian', peran: ADMIN },
  { kode: 'tunjangan',  nama: 'Jabatan dan Tunjangan', ikon: PhCoins,    warna: 'gaji',       ke: '/jabatan-tunjangan', grup: 'Kepegawaian', peran: ['superadmin'] },
  { kode: 'verifikasi', nama: 'Verifikasi Akun', ikon: PhUserCheck,      warna: 'verifikasi', ke: '/verifikasi',        grup: 'Kepegawaian', peran: ADMIN },
  { kode: 'pengajuan',  nama: 'Pengajuan',       ikon: PhFileText,       warna: 'pengajuan',  ke: '/segera/pengajuan',  grup: 'Kepegawaian', fase: 3 },
  { kode: 'jurnal',     nama: 'Jurnal Harian',   ikon: PhNotebook,       warna: 'tatausaha',  ke: '/segera/jurnal',     grup: 'Kepegawaian', fase: 3 },
  { kode: 'kartu',      nama: 'Kartu Pegawai',   ikon: PhIdentificationCard, warna: 'profil', ke: '/segera/kartu',      grup: 'Kepegawaian', fase: 3 },
  { kode: 'santri',     nama: 'Santri',          ikon: PhStudent,        warna: 'santri',     ke: '/segera/santri',     grup: 'Santri', fase: 4 },
  { kode: 'tahfizh',    nama: 'Tahfizh',         ikon: PhBookOpenText,   warna: 'tahfizh',    ke: '/segera/tahfizh',    grup: 'Santri', fase: 5 },
  { kode: 'klinik',     nama: 'Klinik',          ikon: PhFirstAidKit,    warna: 'klinik',     ke: '/segera/klinik',     grup: 'Layanan', fase: 6 },
  { kode: 'security',   nama: 'Security',        ikon: PhShieldCheck,    warna: 'security',   ke: '/segera/security',   grup: 'Layanan', fase: 7 },
  { kode: 'laporan',    nama: 'Laporan',         ikon: PhChartBar,       warna: 'laporan',    ke: '/segera/laporan',    grup: 'Administrasi', fase: 8 },
  { kode: 'tatausaha',  nama: 'Tata Usaha',      ikon: PhEnvelopeSimple, warna: 'tatausaha',  ke: '/segera/tatausaha',  grup: 'Administrasi', fase: 10 },
  { kode: 'gaji',       nama: 'Gaji',            ikon: PhWallet,         warna: 'gaji',       ke: '/segera/gaji',       grup: 'Administrasi', fase: 11 },
  { kode: 'pengumuman', nama: 'Pengumuman',      ikon: PhMegaphone,      warna: 'pengumuman', ke: '/segera/pengumuman', grup: 'Sistem', fase: 3 },
  { kode: 'organisasi', nama: 'Struktur Organisasi', ikon: PhTreeStructure, warna: 'sistem',  ke: '/organisasi',        grup: 'Sistem', peran: ['superadmin'] },
  { kode: 'hakakses',   nama: 'Hak Akses',       ikon: PhKey,            warna: 'hakakses',   ke: '/hak-akses',         grup: 'Sistem', peran: ['superadmin'] },
  { kode: 'pengaturan', nama: 'Pengaturan',      ikon: PhGearSix,        warna: 'pengaturan', ke: '/pengaturan',        grup: 'Sistem', peran: ['superadmin'] },
  { kode: 'profil',     nama: 'Profil',          ikon: PhUserCircle,     warna: 'profil',     ke: '/profil',            grup: 'Akun' },
]

// Navigasi bawah (mobile) — empat tab seperti aplikasi Android
export const NAV_BAWAH = [
  { kode: 'beranda',  nama: 'Beranda',  ikon: PhHouse,       warna: 'beranda',  ke: '/' },
  { kode: 'presensi', nama: 'Presensi', ikon: PhFingerprint, warna: 'presensi', ke: '/presensi' },
  { kode: 'tugas',    nama: 'Tugas',    ikon: PhSquaresFour, warna: 'tugas',    ke: '/tugas' },
  { kode: 'profil',   nama: 'Profil',   ikon: PhUserCircle,  warna: 'profil',   ke: '/profil' },
]

export const GRUP = ['Utama', 'Kepegawaian', 'Santri', 'Layanan', 'Administrasi', 'Sistem']
export const menuUntuk = (peran) => MENU.filter((m) => !m.peran || m.peran.includes(peran))
export const cariMenu = (kode) => MENU.find((m) => m.kode === kode)
