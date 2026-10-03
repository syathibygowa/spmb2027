<!-- SIMKA PRO | src/components/LogoSimka.vue | v1.1 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
// Logo aplikasi. Memakai "Ikon SIMKA PRO" dari Pengaturan → Identitas lembaga;
// bila belum diisi atau gagal dimuat, memakai tanda bawaan (bintang delapan).
import { ref, computed, watch } from 'vue'
import { useLembaga } from '@/stores/lembaga'
const props = defineProps({ size: { type: Number, default: 40 } })
const lembaga = useLembaga()
const url = computed(() => lembaga.identitas?.ikon_url || '')
const gagal = ref(false)
watch(url, () => { gagal.value = false })
</script>
<template>
  <img v-if="url && !gagal" :src="url" :width="size" :height="size" alt="" class="object-contain" :style="{ width: size + 'px', height: size + 'px' }" @error="gagal = true" />
  <svg v-else :width="size" :height="size" viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="lg-simka" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#B02A26" /><stop offset="1" stop-color="#F08A45" />
      </linearGradient>
    </defs>
    <rect x="10" y="10" width="28" height="28" rx="4" fill="url(#lg-simka)" />
    <rect x="10" y="10" width="28" height="28" rx="4" fill="url(#lg-simka)" transform="rotate(45 24 24)" />
    <circle cx="24" cy="24" r="8.5" fill="none" stroke="#fff" stroke-width="2.4" />
    <circle cx="24" cy="24" r="3" fill="#fff" />
  </svg>
</template>
