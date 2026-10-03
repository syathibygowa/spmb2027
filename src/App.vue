<!-- SIMKA PRO | src/App.vue | v1.1 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
// Ikon tab peramban dan ikon layar utama iOS mengikuti "Ikon SIMKA PRO" dari Pengaturan.
import { watch } from 'vue'
import { useLembaga } from '@/stores/lembaga'
const lembaga = useLembaga()
lembaga.muatIdentitas()
function pasangIkon(url) {
  if (!url) return
  for (const rel of ['icon', 'apple-touch-icon']) {
    let el = document.querySelector(`link[rel="${rel}"]`)
    if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el) }
    el.href = url; el.removeAttribute('type')
  }
}
watch(() => lembaga.identitas?.ikon_url, pasangIkon, { immediate: true })
</script>
<template><router-view /></template>
