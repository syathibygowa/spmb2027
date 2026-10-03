// SIMKA PRO | src/router/index.js | v1.5 | Fase 1 – Jabatan dan tunjangan | 03/10/2026
// Router berbasis hash (cocok untuk GitHub Pages). meta.cetak menampilkan tombol cetak
// di bilah atas; meta.peran membatasi halaman untuk peran tertentu.
import { createRouter, createWebHashHistory } from 'vue-router'
import { useSesi } from '@/stores/sesi'
import TataLetakAplikasi from '@/layouts/TataLetakAplikasi.vue'

const ADMIN = ['admin', 'superadmin']
const routes = [
  { path: '/masuk', component: () => import('@/pages/auth/Masuk.vue'), meta: { publik: true, judul: 'Masuk' } },
  { path: '/daftar', component: () => import('@/pages/auth/Daftar.vue'), meta: { publik: true, judul: 'Daftar akun' } },
  { path: '/lupa-sandi', component: () => import('@/pages/auth/LupaSandi.vue'), meta: { publik: true, judul: 'Lupa kata sandi' } },
  { path: '/atur-sandi', component: () => import('@/pages/auth/AturSandi.vue'), meta: { publik: true, bebas: true, judul: 'Atur kata sandi' } },
  { path: '/ganti-sandi', component: () => import('@/pages/auth/GantiSandi.vue'), meta: { judul: 'Ganti kata sandi' } },
  {
    path: '/', component: TataLetakAplikasi,
    children: [
      { path: '', component: () => import('@/pages/beranda/Beranda.vue'), meta: { judul: 'Beranda' } },
      { path: 'notifikasi', component: () => import('@/pages/notifikasi/Notifikasi.vue'), meta: { judul: 'Notifikasi', kembali: '/' } },
      { path: 'tugas', component: () => import('@/pages/umum/Tugas.vue'), meta: { judul: 'Tugas dan menu' } },
      { path: 'profil', component: () => import('@/pages/profil/Profil.vue'), meta: { judul: 'Profil' } },
      { path: 'pegawai', component: () => import('@/pages/pegawai/DaftarPegawai.vue'), meta: { judul: 'Data Pegawai', peran: ADMIN, cetak: true, kembali: '/tugas' } },
      { path: 'pegawai/baru', component: () => import('@/pages/pegawai/FormPegawai.vue'), meta: { judul: 'Tambah Pegawai', peran: ADMIN, kembali: '/pegawai' } },
      { path: 'pegawai/impor', component: () => import('@/pages/pegawai/ImporPegawai.vue'), meta: { judul: 'Impor Data Pegawai', peran: ADMIN, kembali: '/pegawai' } },
      { path: 'pegawai/rekap', component: () => import('@/pages/pegawai/RekapPegawai.vue'), meta: { judul: 'Rekap Kepegawaian', peran: ADMIN, cetak: true, kembali: '/pegawai' } },
      { path: 'pegawai/:id/ubah', component: () => import('@/pages/pegawai/FormPegawai.vue'), meta: { judul: 'Ubah Data Pegawai', peran: ADMIN, kembali: '/pegawai' } },
      { path: 'pegawai/:id', component: () => import('@/pages/pegawai/DetailPegawai.vue'), meta: { judul: 'Biodata Pegawai', peran: ADMIN, cetak: true, kembali: '/pegawai' } },
      { path: 'jabatan-tunjangan/:tab?', component: () => import('@/pages/tunjangan/JabatanTunjangan.vue'), props: true, meta: { judul: 'Jabatan dan Tunjangan', peran: ['superadmin'], kembali: '/tugas' } },
      { path: 'presensi', component: () => import('@/pages/umum/Segera.vue'), props: { kode: 'presensi' }, meta: { judul: 'Presensi' } },
      { path: 'verifikasi/:tab?', component: () => import('@/pages/akun/Verifikasi.vue'), props: true, meta: { judul: 'Verifikasi dan Akun', peran: ADMIN, kembali: '/tugas' } },
      { path: 'organisasi/:tab?', component: () => import('@/pages/organisasi/Organisasi.vue'), props: true, meta: { judul: 'Struktur Organisasi', peran: ['superadmin'], cetak: true, kembali: '/tugas' } },
      { path: 'hak-akses/:tab?', component: () => import('@/pages/hakakses/HakAkses.vue'), props: true, meta: { judul: 'Hak Akses Fitur', peran: ['superadmin'], kembali: '/tugas' } },
      { path: 'pengaturan/:tab?', component: () => import('@/pages/pengaturan/Pengaturan.vue'), props: true, meta: { judul: 'Pengaturan', peran: ['superadmin'], kembali: '/tugas' } },
      { path: 'segera/:kode', component: () => import('@/pages/umum/Segera.vue'), props: true, meta: { judul: 'Segera hadir', kembali: '/tugas' } },
      { path: ':salah(.*)*', component: () => import('@/pages/umum/TidakDitemukan.vue'), meta: { judul: 'Halaman tidak ditemukan', kembali: '/' } },
    ],
  },
]

const router = createRouter({ history: createWebHashHistory(), routes, scrollBehavior: () => ({ top: 0 }) })

router.beforeEach(async (to) => {
  const sesi = useSesi()
  if (!sesi.siap) await sesi.mulai()
  if (to.meta.publik) return sesi.masuk && !to.meta.bebas ? (to.query.lanjut || '/') : true
  if (!sesi.masuk) return { path: '/masuk', query: to.fullPath !== '/' ? { lanjut: to.fullPath } : {} }
  // Akun dengan sandi sementara wajib mengganti sandi lebih dulu
  if (sesi.wajibGantiSandi && to.path !== '/ganti-sandi') return '/ganti-sandi'
  if (to.meta.peran && !to.meta.peran.includes(sesi.peran)) return '/'
  return true
})
router.afterEach((to) => { document.title = `${to.meta.judul || 'SIMKA PRO'} – SIMKA PRO` })

export default router
