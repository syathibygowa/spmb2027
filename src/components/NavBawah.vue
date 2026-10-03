<!-- SIMKA PRO | src/components/NavBawah.vue | v1.1 | Fase 1 – Jabatan dan tunjangan | 03/10/2026 -->
<script setup>
// Navigasi bawah ala Android (Material 3): indikator pil berwarna sesuai tab.
import { useRoute } from 'vue-router'
import { NAV_BAWAH } from '@/lib/menu'
const route = useRoute()
const TUGAS = ['/tugas', '/pegawai', '/jabatan-tunjangan', '/hak-akses', '/segera', '/verifikasi', '/organisasi', '/hak-akses', '/pengaturan', '/notifikasi']
const aktif = (t) => t.ke === '/' ? route.path === '/' : t.kode === 'tugas' ? TUGAS.some((p) => route.path.startsWith(p)) : route.path.startsWith(t.ke)
</script>
<template>
  <nav class="layar-saja fixed inset-x-0 bottom-0 z-30 border-t border-garis bg-permukaan/95 backdrop-blur lg:hidden" style="padding-bottom: env(safe-area-inset-bottom)" aria-label="Navigasi utama">
    <ul class="mx-auto grid max-w-xl grid-cols-4">
      <li v-for="t in NAV_BAWAH" :key="t.kode" :class="'w-' + t.warna">
        <router-link :to="t.ke" class="flex h-[68px] flex-col items-center justify-center gap-1" :aria-current="aktif(t) ? 'page' : undefined">
          <span :class="['pil grid h-8 w-16 place-items-center rounded-full transition', aktif(t) && 'aktif']">
            <component :is="t.ikon" :size="24" :weight="aktif(t) ? 'fill' : 'duotone'" :style="{ color: aktif(t) ? 'var(--c)' : undefined }" :class="!aktif(t) && 'text-teks2'" />
          </span>
          <span :class="['text-xs', aktif(t) ? 'font-bold text-teks' : 'font-medium text-teks2']">{{ t.nama }}</span>
        </router-link>
      </li>
    </ul>
  </nav>
</template>
<style scoped>
.pil.aktif { background: color-mix(in srgb, var(--c) 16%, rgb(var(--permukaan))); }
</style>
