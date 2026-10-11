<!-- SIMKA PRO | src/pages/presensi/Presensi.vue | v1.5 | Fase 8 – Sesi hari ini hanya tanggal hari ini (kemarin di Riwayat 14 hari) | 10/10/2026 -->
<script setup>
// Halaman presensi pegawai (Bagian 9 blueprint): kartu lokasi besar, satu tombol bulat,
// selfie wajib dari kamera langsung dengan watermark, dan deretan sesi hari ini.
// Alur: baca GPS → periksa lokasi di server → (konfirmasi pulang cepat) → (di luar area: pilih & alasan)
//       → selfie → kirim. Gagal karena sinyal → "Coba lagi" dengan permintaan yang sama (tidak dobel).
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { PhFingerprint, PhMapPin, PhWarningCircle, PhCheckCircle, PhNavigationArrow, PhClock, PhArrowClockwise, PhGearSix, PhCalendarStar, PhHourglassMedium, PhXCircle, PhInfo } from '@phosphor-icons/vue'
import { useDataPresensi } from '@/stores/presensi'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { MODE_DEMO } from '@/lib/supabase'
import { sekarang, formatHari, formatJam, formatPendek, hariIniISO } from '@/lib/tanggal'
import { titikTerdekat, formatJarak, lencanaSesi, STATUS_PULANG, STATUS_PRESENSI, idPermintaan } from '@/lib/presensi'
import KameraSelfie from '@/components/KameraSelfie.vue'
import LembarBawah from '@/components/LembarBawah.vue'

const dp = useDataPresensi(); const sesi = useSesi(); const ui = useUI(); const router = useRouter(); const route = useRoute()
// Dari Absensi Santri: setelah presensi berhasil, kembali ke halaman absensi (route.query.lanjut)
const lanjut = computed(() => (typeof route.query.lanjut === 'string' && route.query.lanjut.startsWith('/absensi-santri/') ? route.query.lanjut : ''))

// ---------- Jam server berjalan ----------
const kini = ref(sekarang()); let detak
// ---------- GPS ----------
const posisi = ref(null); const galatGps = ref(''); let pantau = null
function mulaiGps() {
  galatGps.value = ''
  if (!navigator.geolocation) { galatGps.value = 'Perangkat ini tidak mendukung GPS.'; return }
  if (pantau !== null) navigator.geolocation.clearWatch(pantau)
  pantau = navigator.geolocation.watchPosition(
    (p) => { posisi.value = { lat: p.coords.latitude, lng: p.coords.longitude, akurasi: Math.round(p.coords.accuracy), waktu: Date.now() }; galatGps.value = '' },
    (e) => { galatGps.value = e.code === 1 ? 'Izin lokasi ditolak. Izinkan lokasi untuk aplikasi ini di pengaturan peramban.' : 'Lokasi belum terbaca. Pastikan GPS menyala dan Anda di tempat terbuka.' },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 })
}
onMounted(() => {
  detak = setInterval(() => { kini.value = sekarang() }, 1000)
  mulaiGps(); dp.muatHarian(); dp.muatRiwayat(); dp.muatBulanIni()
})
onBeforeUnmount(() => { clearInterval(detak); if (pantau !== null) navigator.geolocation.clearWatch(pantau) })

const lokasi = computed(() => posisi.value ? titikTerdekat(dp.titik, posisi.value.lat, posisi.value.lng) : null)
const kartuLokasi = computed(() => {
  if (galatGps.value) return { w: 'beranda', ikon: PhWarningCircle, judul: 'Lokasi tidak terbaca', ket: galatGps.value }
  if (!posisi.value) return { w: 'hakakses', ikon: PhNavigationArrow, judul: 'Membaca lokasi…', ket: 'Tunggu sebentar, GPS sedang mencari posisi Anda.' }
  if (!dp.titik.length) return { w: 'laporan', ikon: PhWarningCircle, judul: 'Titik GPS belum diatur', ket: 'Presensi akan tercatat di luar area dan diverifikasi admin.' }
  if (lokasi.value?.diArea) return { w: 'presensi', ikon: PhCheckCircle, judul: `Anda di ${lokasi.value.nama}`, ket: `${formatJarak(lokasi.value.jarak)} dari titik · akurasi ±${posisi.value.akurasi} m` }
  return { w: 'laporan', ikon: PhMapPin, judul: 'Di luar area pondok', ket: `${formatJarak(lokasi.value?.jarak ?? 0)} dari ${lokasi.value?.nama} · akurasi ±${posisi.value.akurasi} m` }
})

// ---------- Tombol utama: perkiraan aksi (server tetap penentu) ----------
const aksiTampil = computed(() => {
  const t = dp.sesi.filter((s) => s.keadaan === 'terbuka')
  if (t.length) return { label: t.map((s) => s.label_datang || 'Datang').filter((v, i, a) => a.indexOf(v) === i).join(' / '), ket: t.map((s) => s.nama_sesi).join(', '), aktif: true }
  const p = dp.sesi.filter((s) => s.keadaan === 'menunggu_pulang' && s.pulang_buka && kini.value >= new Date(s.pulang_buka))
  if (p.length) return { label: p[0].label_pulang || 'Pulang', ket: p.map((s) => s.nama_sesi).join(', '), aktif: true }
  const b = dp.berikut
  return { label: 'Presensi', ket: b ? `Berikutnya ${b.nama_sesi}, dibuka pukul ${formatJam(b.buka)}` : 'Tidak ada sesi terbuka saat ini', aktif: MODE_DEMO }
})

// ---------- Alur presensi ----------
const tahap = ref('siap')   // siap | memeriksa | luar | kamera | mengirim | gagal | berhasil
const cek = ref(null); const konfirmasi = ref(false); const pilihan = ref('hadir'); const alasan = ref('')
const kamera = ref(false); const selfie = ref(null); const permintaan = ref(''); const galatKirim = ref(null); const hasil = ref(null)
const nama = computed(() => (sesi.pengguna?.nama_lengkap || '').split(',')[0])

async function bacaPosisiSegar() {
  if (posisi.value && Date.now() - posisi.value.waktu < 20000) return posisi.value
  return await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
    (p) => { posisi.value = { lat: p.coords.latitude, lng: p.coords.longitude, akurasi: Math.round(p.coords.accuracy), waktu: Date.now() }; res(posisi.value) },
    (e) => rej(new Error(e.code === 1 ? 'Izin lokasi ditolak. Izinkan lokasi lalu coba lagi.' : 'Lokasi belum terbaca. Pastikan GPS menyala lalu coba lagi.')),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }))
}
async function mulai() {
  if (!navigator.onLine) return ui.toast('Tidak ada sinyal internet. Presensi memerlukan koneksi; coba lagi saat sinyal tersedia.', 'galat')
  tahap.value = 'memeriksa'; konfirmasi.value = false; pilihan.value = 'hadir'; alasan.value = ''; selfie.value = null; galatKirim.value = null
  try {
    const p = await bacaPosisiSegar()
    cek.value = await dp.periksa(p.lat, p.lng, p.akurasi)
    if (!cek.value.rencana?.length) {
      tahap.value = 'siap'
      const b = cek.value.sesi_berikut
      return ui.toast(b ? `Belum ada sesi terbuka. ${b.nama_sesi} dibuka pukul ${formatJam(b.buka)}.` : 'Tidak ada sesi yang terbuka untuk presensi saat ini.', 'info')
    }
    if (cek.value.perlu_konfirmasi) {
      const cepat = cek.value.rencana.filter((r) => r.perlu_konfirmasi)
      konfirmasi.value = await ui.konfirmasi({ judul: 'Pulang lebih awal?', ya: 'Ya, catat pulang',
        pesan: cepat.map((r) => `${r.nama_pola} – ${r.nama_sesi}: ${r.menit} menit sebelum jam selesai`).join('; ') + '. Bila Anda belum pulang, pilih Batal; presensi sesi lain tetap dicatat.' })
      if (!konfirmasi.value && cek.value.rencana.every((r) => r.perlu_konfirmasi)) { tahap.value = 'siap'; return }
    }
    permintaan.value = idPermintaan()
    if (!cek.value.di_area) { tahap.value = 'luar'; return }
    tahap.value = 'kamera'; kamera.value = true
  } catch (e) { tahap.value = 'siap'; ui.toast(e.message, 'galat') }
}
function lanjutLuar() {
  if (alasan.value.trim().length < 5) return ui.toast('Tulis alasan minimal 5 karakter.', 'galat')
  tahap.value = 'kamera'; kamera.value = true
}
function kameraTutup(v) { if (!v && tahap.value === 'kamera' && !selfie.value) tahap.value = 'siap' }
const watermark = computed(() => cek.value ? [
  `${formatPendek(cek.value.tanggal)} ${String(cek.value.jam).slice(0, 8).replace(/:/g, '.')} WITA`,
  cek.value.di_area ? `${cek.value.titik} · ${formatJarak(cek.value.jarak_m)}` : `Di luar area · ${formatJarak(cek.value.jarak_m ?? 0)} dari ${cek.value.titik || 'titik pondok'}`,
  `${nama.value}${sesi.pengguna?.niy ? ' · NIY ' + sesi.pengguna.niy : ''}`,
  'SIMKA PRO · Imam Asy-Syathiby Gowa',
] : [])
async function ambil(blob) { selfie.value = blob; await kirim() }
async function kirim() {
  tahap.value = 'mengirim'; galatKirim.value = null
  try {
    hasil.value = await dp.kirim({ cekId: cek.value.cek_id, selfie: selfie.value, pilihan: cek.value.di_area ? null : pilihan.value,
      alasan: cek.value.di_area ? null : alasan.value.trim(), konfirmasiCepat: konfirmasi.value, permintaanId: permintaan.value })
    tahap.value = 'berhasil'
    dp.muatHarian(); dp.muatRiwayat()
  } catch (e) {
    galatKirim.value = { pesan: e.message, ulang: e.jaringan || ['UNGGAH_GAGAL', 'GAGAL'].includes(e.kode) }
    tahap.value = 'gagal'
  }
}
function tutupHasil() { tahap.value = 'siap'; cek.value = null; hasil.value = null; selfie.value = null }

const teksHasil = (h) => {
  const st = h.aksi === 'pulang' ? (STATUS_PULANG[h.status]?.n || h.status) : (STATUS_PRESENSI[h.status]?.n || h.status)
  return `${st}${h.menit ? ` ${h.menit} menit` : ''}`
}
const riwayatPerTanggal = computed(() => {
  const g = {}
  dp.riwayat.filter((r) => r.tanggal !== hariIniISO()).forEach((r) => { (g[r.tanggal] ||= []).push(r) })
  return Object.entries(g)
})
// ---------- Izin per sesi ----------
const izin = ref(null)
function bukaIzin(s) { izin.value = { s, jenis: 'izin', alasan: '', proses: false } }
async function kirimIzin() {
  const z = izin.value
  if (z.alasan.trim().length < 5) return ui.toast('Tulis alasan minimal 5 karakter.', 'galat')
  z.proses = true
  try { await dp.ajukanIzin(z.s.tanggal, z.s.session_id, z.jenis, z.alasan.trim()); ui.toast('Pengajuan izin sesi terkirim dan menunggu verval admin.'); izin.value = null; dp.muatHarian() }
  catch (e) { ui.toast(e.message, 'galat') } finally { if (izin.value) z.proses = false }
}
async function batalIzin(s) {
  if (!(await ui.konfirmasi({ judul: 'Batalkan pengajuan izin?', pesan: `${s.nama_sesi} ${formatJam(s.mulai)}. Anda kembali wajib presensi pada sesi ini.`, ya: 'Batalkan izin' }))) return
  try { await dp.batalkanIzin(s.attendance_id, s.session_id); ui.toast('Pengajuan izin dibatalkan.'); dp.muatHarian() } catch (e) { ui.toast(e.message, 'galat') }
}
const PILIHAN = [{ k: 'hadir', n: 'Hadir (tugas/dinas di luar)' }, { k: 'izin', n: 'Izin' }, { k: 'sakit', n: 'Sakit' }]
</script>
<template>
  <div class="w-presensi">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6">
      <!-- Kolom kiri: jam, lokasi, tombol -->
      <section class="space-y-4">
        <div class="kepala relative overflow-hidden rounded-[1.5rem] p-5 text-white shadow-apung">
          <p class="text-sm font-semibold opacity-90">{{ formatHari(kini) }}</p>
          <p class="mt-1 text-5xl font-extrabold tabular-nums tracking-tight">{{ formatJam(kini) }}<span class="ml-1 text-xl font-bold opacity-80">.{{ String(kini.getSeconds()).padStart(2, '0') }}</span></p>
          <p class="text-sm opacity-90">Waktu server · WITA</p>
          <PhFingerprint :size="120" weight="duotone" class="absolute -right-4 -bottom-6 opacity-15" aria-hidden="true" />
        </div>

        <div :class="['kartu flex items-start gap-3 p-4', 'w-' + kartuLokasi.w]" role="status" aria-live="polite">
          <span class="chip-ikon h-12 w-12 rounded-2xl"><component :is="kartuLokasi.ikon" :size="28" weight="duotone" /></span>
          <div class="min-w-0 flex-1">
            <p class="text-lg font-extrabold leading-tight" style="color: var(--c)">{{ kartuLokasi.judul }}</p>
            <p class="text-sm text-teks2">{{ kartuLokasi.ket }}</p>
          </div>
          <button v-if="galatGps" class="tombol-ikon" @click="mulaiGps" aria-label="Baca ulang lokasi"><PhArrowClockwise :size="22" /></button>
        </div>

        <div class="kartu flex flex-col items-center px-4 py-6 text-center">
          <button :class="['tombol-bulat grid h-44 w-44 place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-60', !aksiTampil.aktif && 'redup']"
            :disabled="tahap !== 'siap'" @click="mulai" :aria-label="`Presensi ${aksiTampil.label}`">
            <span class="flex flex-col items-center gap-1">
              <PhFingerprint :size="64" weight="duotone" />
              <span class="text-lg font-extrabold">{{ tahap === 'memeriksa' ? 'Memeriksa…' : tahap === 'mengirim' ? 'Mengirim…' : aksiTampil.label }}</span>
            </span>
          </button>
          <p class="mt-4 max-w-xs text-sm font-semibold text-teks2">{{ aksiTampil.ket }}</p>
          <p class="mt-1 max-w-xs text-xs text-teks3">Selfie wajib pada setiap presensi. Waktu dan jarak ditentukan server.</p>
        </div>
      </section>

      <!-- Kolom kanan: sesi hari ini dan riwayat -->
      <section class="space-y-4">
        <div class="kartu p-4 sm:p-5">
          <div class="mb-2 flex items-center gap-2">
            <h2 class="judul-bagian flex-1">Sesi hari ini</h2>
            <span v-if="dp.jumlahWajib" class="lencana">{{ dp.selesaiWajib }} dari {{ dp.jumlahWajib }} sesi</span>
            <button class="tombol-ikon" @click="dp.muatHarian()" aria-label="Muat ulang sesi"><PhArrowClockwise :size="20" /></button>
          </div>
          <p v-if="dp.galat" class="rounded-xl bg-[#C7332F]/10 p-3 text-sm font-semibold text-merah">{{ dp.galat }}</p>
          <p v-else-if="dp.memuat && !dp.harian" class="py-6 text-center text-teks3">Memuat sesi…</p>
          <div v-else-if="!dp.sesiHariIni.length" class="flex flex-col items-center py-6 text-center">
            <span class="chip-ikon h-12 w-12 rounded-2xl"><PhCalendarStar :size="26" weight="duotone" /></span>
            <p class="mt-2 font-semibold">Tidak ada sesi hari ini</p>
            <p class="text-sm text-teks3">Hari libur atau jadwal Anda belum diatur. Hubungi admin bila seharusnya ada sesi.</p>
          </div>
          <ol v-else class="relative space-y-2">
            <li v-for="s in dp.sesiHariIni" :key="s.session_id + s.tanggal" :class="['flex gap-3 rounded-2xl border p-3', 'w-' + lencanaSesi(s).w, s.keadaan === 'terbuka' ? 'border-[color:var(--c)] bg-[color-mix(in_srgb,var(--c)_8%,transparent)]' : 'border-garis']">
              <div class="w-14 shrink-0 text-center">
                <p class="font-extrabold tabular-nums">{{ formatJam(s.mulai) }}</p>
                <p class="text-xs text-teks3 tabular-nums">{{ formatJam(s.selesai) }}</p>
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold">{{ s.nama_sesi }} <span class="text-xs font-normal text-teks3">· {{ s.nama_pola }}</span></p>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span class="lencana">{{ lencanaSesi(s).n }}{{ s.status === 'terlambat' && s.terlambat_menit ? ` ${s.terlambat_menit} menit` : '' }}</span>
                  <span v-if="s.opsional" class="lencana w-tahfizh">Opsional</span>
                  <span v-if="s.status_pulang && s.status_pulang !== 'belum'" :class="['lencana', 'w-' + STATUS_PULANG[s.status_pulang].w]">{{ STATUS_PULANG[s.status_pulang].n }}</span>
                </div>
                <p class="mt-1 text-xs text-teks3">
                  <template v-if="s.datang_pada">{{ s.label_datang || 'Datang' }} {{ formatJam(s.datang_pada) }}</template>
                  <template v-if="s.pulang_pada"> · {{ s.label_pulang || 'Pulang' }} {{ formatJam(s.pulang_pada) }}</template>
                  <template v-if="!s.datang_pada && s.keadaan === 'akan_datang'">Dibuka pukul {{ formatJam(s.buka) }}</template>
                  <template v-if="!s.datang_pada && s.keadaan === 'terbuka'">Ditutup pukul {{ formatJam(s.tutup) }}</template>
                  <template v-if="s.keadaan === 'menunggu_pulang' && s.pulang_buka">{{ s.label_pulang || 'Pulang' }} dibuka pukul {{ formatJam(s.pulang_buka) }}</template>
                  <template v-if="s.sumber === 'izin_sesi'">Pengajuan izin sesi{{ s.status === 'menunggu_verval' ? ' menunggu verval admin' : '' }}</template>
                </p>
                <button v-if="!s.status && !s.opsional && ['akan_datang', 'terbuka'].includes(s.keadaan)" class="mt-1 text-xs font-bold text-merah" @click="bukaIzin(s)">Ajukan izin sesi ini</button>
                <button v-if="s.sumber === 'izin_sesi' && s.status === 'menunggu_verval'" class="mt-1 text-xs font-bold text-merah" @click="batalIzin(s)">Batalkan pengajuan</button>
              </div>
            </li>
          </ol>
          <div v-if="sesi.isAdmin" class="mt-3 flex flex-wrap gap-2">
            <button class="tombol-teks min-h-[40px] text-sm" @click="router.push('/atur-presensi/pola')"><PhGearSix :size="18" /> Pengaturan presensi</button>
          </div>
        </div>

        <div v-if="dp.bulanIni?.sesi" class="kartu w-rekap flex items-center gap-4 p-4">
          <div class="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-lg font-extrabold tabular-nums" style="color: var(--c); background: color-mix(in srgb, var(--c) 12%, rgb(var(--permukaan)))">
            {{ dp.bulanIni.persen == null ? '–' : Math.round(dp.bulanIni.persen) + '%' }}</div>
          <div class="min-w-0 flex-1">
            <p class="font-bold">Kehadiran bulan ini</p>
            <p class="text-sm text-teks2">{{ dp.bulanIni.sesi }} sesi · hadir {{ dp.bulanIni.hadir }} · terlambat {{ dp.bulanIni.terlambat }} · izin/sakit {{ dp.bulanIni.izin + dp.bulanIni.sakit }} · tanpa keterangan {{ dp.bulanIni.tanpa_keterangan }}</p>
          </div>
        </div>

        <div v-if="riwayatPerTanggal.length" class="kartu p-4 sm:p-5">
          <h2 class="judul-bagian mb-2">Riwayat 14 hari</h2>
          <ul class="divide-y divide-garis">
            <li v-for="[tgl, daftar] in riwayatPerTanggal" :key="tgl" class="py-2">
              <p class="text-sm font-bold">{{ formatHari(tgl) }}</p>
              <ul class="mt-1 space-y-1">
                <li v-for="r in daftar" :key="r.id" class="flex flex-wrap items-center gap-1.5 text-sm">
                  <span class="w-12 tabular-nums text-teks3">{{ formatJam(r.jadwal_mulai) }}</span>
                  <span class="min-w-0 flex-1">{{ r.nama_sesi }} <span class="text-xs text-teks3">· {{ r.nama_pola }}</span></span>
                  <span :class="['lencana', 'w-' + (STATUS_PRESENSI[r.status]?.w || 'hakakses')]">{{ STATUS_PRESENSI[r.status]?.n }}</span>
                  <span v-if="r.status_pulang && !['belum', 'tepat'].includes(r.status_pulang)" :class="['lencana', 'w-' + STATUS_PULANG[r.status_pulang].w]">{{ STATUS_PULANG[r.status_pulang].n }}</span>
                </li>
              </ul>
            </li>
          </ul>
        </div>
        <p v-if="MODE_DEMO" class="text-xs text-teks3">Mode demo: presensi tidak disimpan. Bila tidak ada sesi terbuka, tersedia "Sesi uji" agar alur dapat dicoba.</p>
      </section>
    </div>

    <!-- Di luar area: pilih dan alasan -->
    <LembarBawah :model-value="tahap === 'luar'" @update:model-value="(v) => !v && tahap === 'luar' && (tahap = 'siap')" judul="Presensi di luar area">
      <div v-if="cek" class="w-laporan space-y-4 pb-2">
        <div class="flex gap-2 rounded-xl p-3 text-sm" style="background: color-mix(in srgb, var(--c) 12%, transparent)">
          <PhMapPin :size="20" weight="duotone" class="shrink-0" style="color: var(--c)" />
          <span>Anda {{ formatJarak(cek.jarak_m ?? 0) }} dari {{ cek.titik || 'titik pondok' }}. Presensi tetap dicatat dengan waktu server dan masuk antrian verval admin.</span>
        </div>
        <fieldset>
          <legend class="label-isian">Keterangan</legend>
          <div class="grid gap-2">
            <label v-for="p in PILIHAN" :key="p.k" :class="['flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 font-semibold', pilihan === p.k ? 'border-[#C7332F] bg-[#C7332F]/5' : 'border-garis']">
              <input v-model="pilihan" type="radio" :value="p.k" class="h-5 w-5 accent-[#C7332F]" /> {{ p.n }}</label>
          </div>
        </fieldset>
        <div><label class="label-isian" for="pr-alasan">Alasan <span class="text-merah">*</span></label>
          <textarea id="pr-alasan" v-model="alasan" rows="3" class="isian py-2.5" placeholder="Contoh: mengantar santri lomba tahfizh di Makassar" /></div>
        <button class="tombol-utama w-full" @click="lanjutLuar">Lanjut ambil selfie</button>
      </div>
    </LembarBawah>

    <!-- Izin per sesi -->
    <LembarBawah :model-value="!!izin" @update:model-value="(v) => !v && (izin = null)" judul="Izin untuk sesi ini">
      <div v-if="izin" class="space-y-4 pb-2">
        <p class="rounded-xl bg-permukaan2 p-3 text-sm"><b>{{ izin.s.nama_sesi }}</b> · {{ izin.s.nama_pola }} · {{ formatJam(izin.s.mulai) }}–{{ formatJam(izin.s.selesai) }}</p>
        <div class="flex gap-2">
          <label v-for="j in [{ k: 'izin', n: 'Izin' }, { k: 'sakit', n: 'Sakit' }]" :key="j.k" :class="['flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border font-semibold', izin.jenis === j.k ? 'border-[#C7332F] bg-[#C7332F]/5' : 'border-garis']">
            <input v-model="izin.jenis" type="radio" :value="j.k" class="h-5 w-5 accent-[#C7332F]" /> {{ j.n }}</label>
        </div>
        <div><label class="label-isian" for="iz-alasan">Alasan <span class="text-merah">*</span></label>
          <textarea id="iz-alasan" v-model="izin.alasan" rows="3" class="isian py-2.5" placeholder="Contoh: mengantar orang tua berobat" /></div>
        <p class="text-xs text-teks3">Izin hanya untuk sesi ini dan diverval admin. Bila Anda tetap hadir dan presensi, izin otomatis gugur. Izin satu hari penuh atau lebih diajukan lewat menu Pengajuan.</p>
        <button class="tombol-utama w-full" :disabled="izin.proses" @click="kirimIzin">{{ izin.proses ? 'Mengirim…' : 'Kirim pengajuan' }}</button>
      </div>
    </LembarBawah>

    <KameraSelfie v-model="kamera" :watermark="watermark" :judul="cek?.rencana?.[0] ? `Selfie – ${cek.rencana[0].label}` : 'Selfie presensi'" @ambil="ambil" @update:model-value="kameraTutup" />

    <!-- Hasil / gagal -->
    <LembarBawah :model-value="['berhasil', 'gagal', 'mengirim'].includes(tahap)" @update:model-value="(v) => !v && tahap !== 'mengirim' && tutupHasil()" :judul="tahap === 'berhasil' ? 'Presensi tercatat' : tahap === 'gagal' ? 'Presensi belum terkirim' : 'Mengirim presensi'">
      <div class="space-y-4 pb-2">
        <div v-if="tahap === 'mengirim'" class="flex flex-col items-center py-6 text-center">
          <PhHourglassMedium :size="48" weight="duotone" class="animate-pulse text-teks3" />
          <p class="mt-2 font-semibold">Mengirim selfie dan mencatat presensi…</p>
          <p class="text-sm text-teks3">Jangan tutup aplikasi.</p>
        </div>
        <template v-else-if="tahap === 'berhasil' && hasil">
          <div class="flex flex-col items-center text-center">
            <span :class="['chip-ikon h-20 w-20 rounded-full', hasil.menunggu_verval ? 'w-pengajuan' : 'w-presensi']"><component :is="hasil.menunggu_verval ? PhHourglassMedium : PhCheckCircle" :size="48" weight="duotone" /></span>
            <p class="mt-2 text-3xl font-extrabold tabular-nums">{{ String(hasil.jam || '').slice(0, 5).replace(':', '.') }} <span class="text-base font-bold text-teks3">WITA</span></p>
            <p v-if="hasil.menunggu_verval" class="text-sm text-teks2">Presensi di luar area menunggu verifikasi admin.</p>
          </div>
          <ul class="divide-y divide-garis rounded-xl border border-garis">
            <li v-for="(h, i) in hasil.hasil" :key="i" class="flex items-center gap-2 px-3 py-2.5 text-sm">
              <span class="flex-1"><b>{{ h.label }}</b> · {{ h.nama_sesi }} <span class="text-teks3">({{ h.nama_pola }})</span></span>
              <span class="lencana">{{ teksHasil(h) }}</span>
            </li>
          </ul>
          <button v-if="lanjut" class="tombol-utama w-full" @click="tutupHasil(); router.replace(lanjut)">Lanjut mengabsen santri</button>
          <button v-else class="tombol-utama w-full" @click="tutupHasil">Selesai</button>
        </template>
        <template v-else-if="tahap === 'gagal' && galatKirim">
          <div class="flex gap-3 rounded-xl bg-[#C7332F]/10 p-3 text-sm font-semibold text-merah"><PhXCircle :size="22" class="shrink-0" /> {{ galatKirim.pesan }}</div>
          <button v-if="galatKirim.ulang" class="tombol-utama w-full" @click="kirim"><PhArrowClockwise :size="20" weight="bold" /> Coba lagi</button>
          <button v-else class="tombol-utama w-full" @click="tutupHasil(); mulai()"><PhArrowClockwise :size="20" weight="bold" /> Ulangi presensi</button>
          <p class="flex gap-2 text-xs text-teks3"><PhInfo :size="16" class="mt-0.5 shrink-0" /> Mengirim ulang tidak membuat data dobel.</p>
        </template>
      </div>
    </LembarBawah>
  </div>
</template>
<style scoped>
.kepala { background: linear-gradient(135deg, #12573A 0%, #1E7D4F 55%, #0B7F81 100%); }
.tombol-bulat { background: radial-gradient(circle at 30% 25%, #2FA36B 0%, #1E7D4F 55%, #155C3A 100%); box-shadow: 0 0 0 10px color-mix(in srgb, #1E7D4F 14%, transparent), 0 14px 30px -10px rgb(21 92 58 / .7); }
.tombol-bulat.redup { background: radial-gradient(circle at 30% 25%, #8A9A90 0%, #5E6E66 60%, #4A5852 100%); box-shadow: 0 0 0 10px rgb(94 110 102 / .14); }
</style>
