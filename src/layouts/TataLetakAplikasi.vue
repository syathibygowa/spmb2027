<!-- SIMKA PRO | src/layouts/TataLetakAplikasi.vue | v1.2 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
// Tata letak responsif: desktop = sidebar + bilah atas; mobile = bilah aplikasi ringkas,
// navigasi bawah, kartu, FAB, dan bottom sheet (ala aplikasi Android).
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhArrowLeft } from '@phosphor-icons/vue'
import NavSamping from '@/components/NavSamping.vue'
import NavBawah from '@/components/NavBawah.vue'
import PanelNotifikasi from '@/components/PanelNotifikasi.vue'
import MenuAkun from '@/components/MenuAkun.vue'
import TombolCetak from '@/components/TombolCetak.vue'
import AvatarPengguna from '@/components/AvatarPengguna.vue'
import DaftarToast from '@/components/DaftarToast.vue'
import DialogKonfirmasi from '@/components/DialogKonfirmasi.vue'
import { useNotifikasi } from '@/stores/notifikasi'
import { useUI } from '@/stores/ui'
import { MODE_DEMO } from '@/lib/supabase'
import { formatHari, formatHijriah, formatJam, sekarang } from '@/lib/tanggal'

const route = useRoute(); const router = useRouter(); const notif = useNotifikasi(); const ui = useUI()
const judul = computed(() => route.meta.judul || 'SIMKA PRO')
const jam = ref(sekarang())
let detak
onMounted(() => { notif.muat(); detak = setInterval(() => (jam.value = sekarang()), 15000) })
onBeforeUnmount(() => clearInterval(detak))
const kembali = () => (history.length > 1 ? router.back() : router.push(route.meta.kembali || '/'))
</script>
<template>
  <div class="min-h-dvh">
    <NavSamping />
    <div :class="['transition-[padding] duration-200', ui.sidebarCiut ? 'lg:pl-[76px]' : 'lg:pl-[272px]']">
      <!-- Bilah atas desktop -->
      <header class="layar-saja sticky top-0 z-20 hidden h-[72px] items-center gap-4 border-b border-garis bg-latar/90 px-8 backdrop-blur lg:flex">
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-xl font-extrabold">{{ judul }}</h1>
          <p class="text-sm text-teks3">{{ formatHari(jam) }}, {{ formatHijriah(jam) }} – pukul {{ formatJam(jam) }} WITA</p>
        </div>
        <span v-if="MODE_DEMO" class="lencana w-tahfizh">Mode demo</span>
        <TombolCetak v-if="route.meta.cetak" ringkas />
        <PanelNotifikasi />
        <MenuAkun />
      </header>

      <!-- Bilah aplikasi mobile -->
      <header class="layar-saja sticky top-0 z-20 flex items-center gap-1 border-b border-garis/70 bg-permukaan/95 px-2 backdrop-blur lg:hidden"
        style="padding-top: env(safe-area-inset-top); min-height: 60px">
        <button v-if="route.meta.kembali" class="tombol-ikon" @click="kembali" aria-label="Kembali"><PhArrowLeft :size="24" /></button>
        <h1 :class="['min-w-0 flex-1 truncate text-lg font-bold', !route.meta.kembali && 'pl-2']">{{ judul }}</h1>
        <TombolCetak v-if="route.meta.cetak" ringkas />
        <PanelNotifikasi />
        <router-link to="/profil" class="ml-0.5 mr-1 rounded-full" aria-label="Profil"><AvatarPengguna :size="34" /></router-link>
      </header>

      <main class="isi-utama mx-auto max-w-[1280px] px-4 pb-[calc(110px+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="route.matched[route.matched.length - 1]?.path" />
        </router-view>
      </main>
    </div>
    <NavBawah />
    <DaftarToast />
    <DialogKonfirmasi />
  </div>
</template>
