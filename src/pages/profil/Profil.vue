<!-- SIMKA PRO | src/pages/profil/Profil.vue | v1.3 | Fase 1 – Perbaikan pembaruan | 03/10/2026 -->
<script setup>
import { useRouter } from 'vue-router'
import { PhSignOut, PhPalette, PhBell, PhInfo, PhLockKey } from '@phosphor-icons/vue'
import { useSesi } from '@/stores/sesi'
import { useNotifikasi } from '@/stores/notifikasi'
import { MODE_DEMO } from '@/lib/supabase'
import PilihTema from '@/components/PilihTema.vue'
import AvatarPengguna from '@/components/AvatarPengguna.vue'
import PolaKhatam from '@/components/PolaKhatam.vue'
import { VERSI_APLIKASI, KETERANGAN_VERSI, WAKTU_BUILD } from '@/lib/versi'
import { formatPendek, formatJam } from '@/lib/tanggal'

const sesi = useSesi(); const notif = useNotifikasi(); const router = useRouter()
const PERAN = { superadmin: 'Superadmin', admin: 'Admin', pegawai: 'Pegawai' }
async function keluar() { notif.berhenti(); await sesi.keluar(); router.replace('/masuk') }
function ganti(p) { sesi.masukDemo(p); notif.berhenti(); notif.muat(); router.push('/') }
</script>
<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <section class="kepala relative overflow-hidden rounded-[1.5rem] p-6 text-center text-white">
      <PolaKhatam :opasitas="0.12" />
      <div class="relative flex flex-col items-center">
        <span class="rounded-full ring-4 ring-white/40"><AvatarPengguna :size="76" /></span>
        <h2 class="mt-3 text-xl font-extrabold text-white">{{ sesi.pengguna?.nama_lengkap }}</h2>
        <p class="text-sm text-white/90">{{ sesi.pengguna?.jabatan }}</p>
        <span class="mt-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#8E1C19]">{{ PERAN[sesi.peran] }}</span>
      </div>
    </section>

    <section class="kartu w-pengumuman p-5">
      <div class="mb-3 flex items-center gap-3"><span class="chip-ikon h-10 w-10"><PhPalette :size="22" weight="duotone" /></span>
        <div><h3 class="judul-bagian">Tema tampilan</h3><p class="text-sm text-teks3">Bawaan mengikuti pengaturan perangkat</p></div></div>
      <PilihTema />
    </section>

    <router-link to="/notifikasi" class="kartu w-notifikasi flex items-center gap-3 p-5 hover:bg-permukaan2">
      <span class="chip-ikon h-10 w-10"><PhBell :size="22" weight="duotone" /></span>
      <span class="flex-1"><span class="block font-bold">Notifikasi</span><span class="block text-sm text-teks3">{{ notif.belumDibaca ? `${notif.belumDibaca} belum dibaca` : 'Semua sudah dibaca' }}</span></span>
    </router-link>

    <router-link to="/ganti-sandi" class="kartu w-tahfizh flex items-center gap-3 p-5 hover:bg-permukaan2">
      <span class="chip-ikon h-10 w-10"><PhLockKey :size="22" weight="duotone" /></span>
      <span class="flex-1"><span class="block font-bold">Ganti kata sandi</span><span class="block text-sm text-teks3">Disarankan berkala, minimal 8 karakter berisi huruf dan angka</span></span>
    </router-link>

    <section v-if="MODE_DEMO" class="kartu w-tahfizh p-5">
      <div class="mb-3 flex items-center gap-3"><span class="chip-ikon h-10 w-10"><PhInfo :size="22" weight="duotone" /></span>
        <div><h3 class="judul-bagian">Mode demo</h3><p class="text-sm text-teks3">Coba tampilan sebagai peran lain</p></div></div>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="(n, k) in PERAN" :key="k" :class="['min-h-[44px] rounded-xl text-sm font-bold', sesi.peran === k ? 'bg-[#C7332F] text-white' : 'bg-permukaan2 text-teks2']" @click="ganti(k)">{{ n }}</button>
      </div>
    </section>

    <button class="kartu w-beranda flex w-full items-center gap-3 p-5 text-left hover:bg-permukaan2" @click="keluar">
      <span class="chip-ikon h-10 w-10"><PhSignOut :size="22" weight="duotone" /></span>
      <span class="font-bold">Keluar dari akun</span>
    </button>
    <p class="text-center text-xs text-teks3">SIMKA PRO versi {{ VERSI_APLIKASI }} – {{ KETERANGAN_VERSI }}</p>
    <p v-if="WAKTU_BUILD" class="pb-2 text-center text-xs text-teks3">Dibangun {{ formatPendek(WAKTU_BUILD) }} pukul {{ formatJam(WAKTU_BUILD) }} WITA</p>
  </div>
</template>
<style scoped>.kepala { background: var(--gradasi-utama); }</style>
