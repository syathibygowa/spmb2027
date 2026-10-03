<!-- SIMKA PRO | src/components/cetak/DokumenCetak.vue | v1.2 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
// Kerangka dokumen cetak F4: kop surat, judul, isi (slot), tanda tangan, catatan cetak.
// Pratinjau tampil sebagai jendela munculan (pop-up) dengan tombol Cetak dan Tutup.
// Dokumen selalu dipindah ke <body>, sehingga saat dicetak hanya dokumen yang tampil.
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { PhPrinter, PhX } from '@phosphor-icons/vue'
import { formatPanjang, formatJam, sekarang } from '@/lib/tanggal'
import { useLembaga } from '@/stores/lembaga'
import KopSurat from './KopSurat.vue'

const lembaga = useLembaga()
lembaga.muat()
const pratinjau = defineModel('pratinjau', { type: Boolean, default: false })
const props = defineProps({
  kop: { type: String, default: 'pondok' }, judul: String, subjudul: String, nomor: String, pencetak: String,
  kopData: { type: Object, default: null }, // draf kop (cetak uji dari Pengaturan)
  mendatar: Boolean,                        // kertas F4 mendatar (330 × 215 mm) untuk tabel lebar
})
const dicetak = computed(() => {
  const s = sekarang()
  const t = `Dicetak melalui SIMKA PRO pada ${formatPanjang(s)} pukul ${formatJam(s)} WITA${props.pencetak ? ' oleh ' + props.pencetak : ''}`
  return t.endsWith('.') ? t : t + '.'
})

// Skala lembar agar muat di layar HP (lebar 215 mm ≈ 812 px; mendatar 330 mm ≈ 1247 px)
const skala = ref(1)
const ukur = () => { skala.value = Math.min(1, (window.innerWidth - 32) / (props.mendatar ? 1247 : 812)) }
const esc = (e) => e.key === 'Escape' && (pratinjau.value = false)
watch(pratinjau, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (v) { ukur(); addEventListener('resize', ukur); addEventListener('keydown', esc) } else { removeEventListener('resize', ukur); removeEventListener('keydown', esc) }
}, { immediate: true })
onBeforeUnmount(() => { document.body.style.overflow = ''; removeEventListener('resize', ukur); removeEventListener('keydown', esc) })
const cetak = () => window.print()
</script>
<template>
  <Teleport to="body">
    <div :class="['cetak-saja', pratinjau && 'tampil munculan']" :role="pratinjau ? 'dialog' : undefined" :aria-modal="pratinjau || undefined" :aria-label="pratinjau ? 'Pratinjau cetak ' + judul : undefined">
      <div v-if="pratinjau" class="bilah-munculan layar-saja">
        <div class="min-w-0 flex-1">
          <p class="truncate font-bold">Pratinjau cetak: {{ judul }}</p>
          <p class="text-xs opacity-80">Kertas F4 {{ mendatar ? '330 × 215 mm (mendatar)' : '215 × 330 mm' }}, margin 2 cm</p>
        </div>
        <button type="button" class="tombol-cetak" @click="cetak"><PhPrinter :size="20" weight="duotone" /> Cetak</button>
        <button type="button" class="tombol-tutup" @click="pratinjau = false" aria-label="Tutup pratinjau"><PhX :size="22" /></button>
      </div>
      <div :class="pratinjau && 'gulir-munculan'">
        <article :class="['dok lembar-f4', mendatar && 'mendatar']" :style="pratinjau ? { zoom: skala } : null">
          <KopSurat :kop="kopData || lembaga.kop(kop)" :kode="kop" />
          <h1 class="judul-dok">{{ judul }}</h1>
          <p v-if="nomor" class="subjudul-dok">Nomor: {{ nomor }}</p>
          <p v-if="subjudul" class="subjudul-dok">{{ subjudul }}</p>
          <slot />
          <slot name="ttd" />
          <p class="catatan-cetak">{{ dicetak }}</p>
        </article>
      </div>
    </div>
  </Teleport>
</template>
<style>
@media screen {
  .munculan { position: fixed; inset: 0; z-index: 80; display: flex !important; flex-direction: column; background: rgba(20, 12, 14, .82); }
  .bilah-munculan { display: flex; align-items: center; gap: 8px; padding: 10px 14px; padding-top: max(10px, env(safe-area-inset-top)); color: #fff; background: #2B1F22; }
  .bilah-munculan .tombol-cetak { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 18px; border-radius: 999px; background: #C7332F; color: #fff; font-weight: 700; }
  .bilah-munculan .tombol-tutup { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; color: #fff; }
  .bilah-munculan .tombol-tutup:hover { background: rgba(255,255,255,.12); }
  .gulir-munculan { flex: 1; overflow: auto; padding: 16px; }
  .munculan .lembar-f4 { margin: 0 auto; }
  .lembar-f4.mendatar { width: 330mm; min-height: 215mm; }
}
@media print {
  .munculan { position: static !important; background: none !important; }
  .gulir-munculan { padding: 0 !important; overflow: visible !important; }
  .lembar-f4 { zoom: 1 !important; }
  .dok.mendatar { page: mendatar; }
}
@page mendatar { size: 330mm 215mm; margin: 20mm; }
</style>
