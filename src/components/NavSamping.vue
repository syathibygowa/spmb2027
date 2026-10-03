<!-- SIMKA PRO | src/components/NavSamping.vue | v1.1 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
// Sidebar desktop: menu berkelompok, setiap menu dengan ikon dan warna sendiri.
// Dapat diciutkan (hanya ikon, 76 px); saat diciutkan, sidebar terbuka sementara
// ketika kursor diarahkan ke atasnya, lalu menutup lagi tanpa menggeser isi halaman.
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { PhCaretDoubleLeft, PhCaretDoubleRight } from '@phosphor-icons/vue'
import { useSesi } from '@/stores/sesi'
import { useNotifikasi } from '@/stores/notifikasi'
import { useUI } from '@/stores/ui'
import { menuUntuk, GRUP } from '@/lib/menu'
import LogoSimka from './LogoSimka.vue'
import PolaKhatam from './PolaKhatam.vue'

const sesi = useSesi(); const notif = useNotifikasi(); const ui = useUI(); const route = useRoute()
const melayang = ref(false)
let tunda
const masuk = () => { if (ui.sidebarCiut) { clearTimeout(tunda); tunda = setTimeout(() => (melayang.value = true), 120) } }
const keluar = () => { clearTimeout(tunda); melayang.value = false }
const lebar = computed(() => !ui.sidebarCiut || melayang.value)
const kelompok = computed(() => {
  const m = menuUntuk(sesi.peran).filter((x) => x.kode !== 'profil')
  return GRUP.map((g) => ({ g, item: m.filter((x) => x.grup === g) })).filter((k) => k.item.length)
})
const aktif = (m) => (m.ke === '/' ? route.path === '/' : route.path.startsWith(m.ke))
</script>
<template>
  <aside :class="['layar-saja fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-garis bg-permukaan transition-[width,box-shadow] duration-200 lg:flex', lebar ? 'w-[272px]' : 'w-[76px]', ui.sidebarCiut && melayang && 'shadow-apung']"
    @mouseenter="masuk" @mouseleave="keluar" @focusin="masuk" @focusout="keluar">
    <div class="relative overflow-hidden px-4 pb-4 pt-5 text-[#C7332F] dark:text-[#FF8070]">
      <PolaKhatam :opasitas="0.08" :ukuran="44" />
      <router-link to="/" class="relative flex items-center gap-3" aria-label="SIMKA PRO, ke beranda">
        <LogoSimka :size="42" class="shrink-0" />
        <span v-show="lebar" class="whitespace-nowrap">
          <span class="block text-[1.05rem] font-extrabold leading-tight text-teks">SIMKA PRO</span>
          <span class="block text-xs font-medium leading-tight text-teks2">Imam Asy-Syathiby Gowa</span>
        </span>
      </router-link>
    </div>
    <nav class="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3" aria-label="Menu utama">
      <div v-for="k in kelompok" :key="k.g" class="mt-3">
        <p v-show="lebar" class="whitespace-nowrap px-3 pb-1 text-xs font-semibold text-teks3">{{ k.g }}</p>
        <hr v-show="!lebar" class="mx-2 mb-2 border-garis" />
        <router-link v-for="m in k.item" :key="m.kode" :to="m.ke" :title="lebar ? undefined : m.nama"
          :class="['menu group relative flex min-h-[44px] items-center gap-3 rounded-xl px-[9px] text-[0.93rem] font-semibold', 'w-' + m.warna, aktif(m) ? 'aktif text-teks' : 'text-teks2 hover:bg-permukaan2 hover:text-teks']"
          :aria-current="aktif(m) ? 'page' : undefined" :aria-label="m.nama">
          <span class="chip-ikon h-8 w-8 rounded-lg"><component :is="m.ikon" :size="20" weight="duotone" /></span>
          <span v-show="lebar" class="flex-1 truncate whitespace-nowrap">{{ m.nama }}</span>
          <template v-if="m.kode === 'notifikasi' && notif.belumDibaca">
            <span v-if="lebar" class="rounded-full bg-[#C7332F] px-1.5 text-xs font-bold leading-5 text-white">{{ notif.belumDibaca }}</span>
            <span v-else class="absolute left-[34px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#C7332F] ring-2 ring-permukaan" aria-hidden="true" />
          </template>
          <span v-else-if="m.fase && lebar" class="whitespace-nowrap text-[11px] font-semibold text-teks3">Fase {{ m.fase }}</span>
        </router-link>
      </div>
    </nav>
    <div class="border-t border-garis p-3">
      <button type="button" class="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-[9px] text-sm font-semibold text-teks2 hover:bg-permukaan2 hover:text-teks"
        @click="ui.aturSidebar(!ui.sidebarCiut); melayang = false" :aria-label="ui.sidebarCiut ? 'Sematkan sidebar agar selalu terbuka' : 'Ciutkan sidebar'">
        <span class="grid h-8 w-8 shrink-0 place-items-center"><component :is="ui.sidebarCiut ? PhCaretDoubleRight : PhCaretDoubleLeft" :size="20" /></span>
        <span v-show="lebar" class="whitespace-nowrap">{{ ui.sidebarCiut ? 'Sematkan sidebar' : 'Ciutkan sidebar' }}</span>
      </button>
    </div>
  </aside>
</template>
<style scoped>
.menu.aktif { background: color-mix(in srgb, var(--c) 12%, rgb(var(--permukaan))); box-shadow: inset 3px 0 0 var(--c); }
</style>
