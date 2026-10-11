<!-- SIMKA PRO | src/pages/auth/Masuk.vue | v1.3 | Fase 8 – Perbaikan: catatan Ingat saya dihapus (hemat ruang) | 11/10/2026 -->
<script setup>
// v1.2: "Ingat saya di perangkat ini". Username diingat di perangkat; kata sandi disimpan oleh PENGELOLA SANDI
// peramban/HP (Google Password Manager, iCloud Keychain, dll.), bukan oleh aplikasi, sehingga tetap aman.
// Saat halaman dibuka, isian terisi otomatis dari pengelola sandi (Chrome/Edge/Android lewat Credential Management
// API; Safari/iPhone lewat saran isi otomatis keyboard) → pengguna cukup menekan Masuk.
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { PhUser, PhLockKey, PhEye, PhEyeSlash, PhCrown, PhUserGear, PhIdentificationBadge } from '@phosphor-icons/vue'
import { useSesi } from '@/stores/sesi'
import { MODE_DEMO } from '@/lib/supabase'
import { formatHari, formatHijriah } from '@/lib/tanggal'
import LogoSimka from '@/components/LogoSimka.vue'
import PolaKhatam from '@/components/PolaKhatam.vue'
import PilihTema from '@/components/PilihTema.vue'

const sesi = useSesi(); const router = useRouter(); const route = useRoute()
const KUNCI_INGAT = 'simka.ingat'
const bacaIngat = () => { try { return JSON.parse(localStorage.getItem(KUNCI_INGAT) || 'null') } catch { return null } }
const tersimpan = bacaIngat()
const username = ref(tersimpan?.username || ''); const sandi = ref(''); const lihat = ref(false)
const ingat = ref(tersimpan ? !!tersimpan.aktif : true)
const bisaKredensial = typeof window !== 'undefined' && 'PasswordCredential' in window && !!navigator.credentials
onMounted(async () => {
  if (MODE_DEMO || !ingat.value || !bisaKredensial) return
  try {
    // Ambil sandi tersimpan dari pengelola sandi (bisa menampilkan pilihan akun bila tersimpan lebih dari satu)
    const k = await navigator.credentials.get({ password: true, mediation: 'optional' })
    if (k && k.type === 'password' && k.password) { username.value = k.id; sandi.value = k.password }
  } catch { /* pengguna menutup pilihan akun atau peramban menolak; isi manual */ }
})
async function simpanIngat() {
  try {
    if (ingat.value) localStorage.setItem(KUNCI_INGAT, JSON.stringify({ aktif: true, username: username.value.trim() }))
    else localStorage.setItem(KUNCI_INGAT, JSON.stringify({ aktif: false }))
  } catch { /* penyimpanan peramban tidak tersedia */ }
  if (ingat.value && bisaKredensial) {
    try { await navigator.credentials.store(new window.PasswordCredential({ id: username.value.trim(), password: sandi.value, name: sesi.pengguna?.nama_lengkap || username.value.trim() })) }
    catch { /* pengelola sandi tidak tersedia */ }
  }
}
function lupakan() {
  try { localStorage.setItem(KUNCI_INGAT, JSON.stringify({ aktif: false })) } catch { /* abaikan */ }
  username.value = ''; sandi.value = ''; ingat.value = false
}
const galat = ref(''); const proses = ref(false)
const lanjut = () => router.replace(sesi.wajibGantiSandi ? '/ganti-sandi' : (route.query.lanjut || '/'))

async function kirim() {
  galat.value = ''
  if (!username.value || !sandi.value) { galat.value = 'Isi username dan kata sandi.'; return }
  proses.value = true
  try { await sesi.masukDengan(username.value.trim(), sandi.value); await simpanIngat(); lanjut() }
  catch (e) { galat.value = e.message }
  finally { proses.value = false }
}
function demo(p) { sesi.masukDemo(p); lanjut() }
const PERAN_DEMO = [
  { k: 'superadmin', n: 'Superadmin', ket: 'Seluruh data dan pengaturan sistem', ikon: PhCrown, w: 'pengaturan' },
  { k: 'admin', n: 'Admin', ket: 'Verifikasi dan kendali data pondok', ikon: PhUserGear, w: 'pegawai' },
  { k: 'pegawai', n: 'Pegawai', ket: 'Tampilan harian pegawai', ikon: PhIdentificationBadge, w: 'presensi' },
]
</script>
<template>
  <div class="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
    <section class="panel-merek relative overflow-hidden px-6 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))] text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
      <PolaKhatam :opasitas="0.14" :ukuran="64" />
      <div class="relative flex items-center gap-3">
        <span class="grid h-14 w-14 place-items-center rounded-2xl bg-white"><LogoSimka :size="40" /></span>
        <div>
          <p class="text-xl font-extrabold leading-tight">SIMKA PRO</p>
          <p class="text-sm text-white/90">Sistem Manajemen Kepegawaian Terintegrasi</p>
        </div>
      </div>
      <div class="relative mt-10 lg:mt-0">
        <p class="max-w-md text-[1.9rem] font-extrabold leading-[1.15] lg:text-[2.6rem]">Pondok Pesantren Tahfizhul Qur'an Imam Asy-Syathiby</p>
        <p class="mt-3 max-w-md text-white/90">Wahdah Islamiyah Gowa. Generasi Qur'ani dan Berprestasi.</p>
      </div>
      <p class="relative mt-8 hidden text-sm text-white/90 lg:block">{{ formatHari(new Date()) }}, {{ formatHijriah() }}</p>
    </section>

    <section class="relative -mt-8 rounded-t-[2rem] bg-latar px-5 pb-10 pt-8 sm:px-10 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:rounded-none">
      <div class="mx-auto w-full max-w-md">
        <h1 class="text-2xl font-extrabold">Masuk</h1>
        <p class="mt-1 text-teks2">Gunakan username dan kata sandi akun pegawai Anda.</p>
        <form class="mt-6 space-y-4" method="post" action="#" @submit.prevent="kirim" novalidate>
          <div>
            <label for="u" class="label-isian">Username</label>
            <div class="relative">
              <PhUser :size="20" weight="duotone" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
              <input id="u" v-model="username" name="username" class="isian pl-11" autocomplete="username" autocapitalize="none" placeholder="contoh: hasanbasri" :disabled="MODE_DEMO" />
            </div>
          </div>
          <div>
            <label for="s" class="label-isian">Kata sandi</label>
            <div class="relative">
              <PhLockKey :size="20" weight="duotone" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
              <input id="s" v-model="sandi" name="password" :type="lihat ? 'text' : 'password'" class="isian pl-11 pr-12" autocomplete="current-password" :disabled="MODE_DEMO" />
              <button type="button" class="tombol-ikon absolute right-0.5 top-1/2 -translate-y-1/2" @click="lihat = !lihat" :aria-label="lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'">
                <component :is="lihat ? PhEyeSlash : PhEye" :size="22" />
              </button>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <label class="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm font-semibold">
              <input v-model="ingat" type="checkbox" class="h-5 w-5 accent-[#C7332F]" :disabled="MODE_DEMO" /> Ingat saya di perangkat ini</label>
            <button v-if="tersimpan?.username" type="button" class="text-sm font-semibold text-teks3 hover:text-teks" @click="lupakan">Lupakan</button>
          </div>
          <p v-if="galat" class="rounded-xl bg-[#C7332F]/10 px-3.5 py-2.5 text-sm font-semibold text-merah" role="alert">{{ galat }}</p>
          <button class="tombol-utama w-full" :disabled="proses || MODE_DEMO">{{ proses ? 'Memeriksa…' : 'Masuk' }}</button>
          <div class="flex flex-wrap justify-between gap-2 text-sm">
            <router-link to="/lupa-sandi" class="font-semibold text-merah">Lupa kata sandi?</router-link>
            <span class="text-teks2">Belum punya akun? <router-link to="/daftar" class="font-semibold text-merah">Daftar</router-link></span>
          </div>
        </form>

        <div v-if="MODE_DEMO" class="mt-8">
          <p class="font-bold">Mode demo</p>
          <p class="text-sm text-teks2">Server belum disambungkan. Pilih peran untuk mencoba tampilan dengan data contoh.</p>
          <div class="mt-3 space-y-2">
            <button v-for="p in PERAN_DEMO" :key="p.k" :class="['kartu flex w-full items-center gap-3 p-3 text-left hover:bg-permukaan2', 'w-' + p.w]" @click="demo(p.k)">
              <span class="chip-ikon h-11 w-11"><component :is="p.ikon" :size="24" weight="duotone" /></span>
              <span class="flex-1"><span class="block font-bold">{{ p.n }}</span><span class="block text-sm text-teks3">{{ p.ket }}</span></span>
            </button>
          </div>
        </div>
        <div class="mt-8"><PilihTema /></div>
      </div>
    </section>
  </div>
</template>
<style scoped>.panel-merek { background: var(--gradasi-utama); }</style>
