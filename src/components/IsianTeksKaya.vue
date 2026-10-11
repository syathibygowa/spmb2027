<!-- SIMKA PRO | src/components/IsianTeksKaya.vue | v1.0 | Fase 8 – Isian teks dengan tombol Tebal, Miring, Normal | 10/10/2026 -->
<script setup>
// Kotak isian teks panjang dengan bilah gaya: Tebal (*teks*), Miring (_teks_), Normal (lepas gaya), dan Pratinjau.
// Pintasan papan ketik: Ctrl/⌘ + B (tebal), Ctrl/⌘ + I (miring). Dipakai di Pengumuman; kelak juga di Persuratan.
import { ref, nextTick } from 'vue'
import { PhTextB, PhTextItalic, PhTextT, PhEye, PhPencilSimpleLine } from '@phosphor-icons/vue'
import { teksKaya, terapkanGaya } from '@/lib/teksKaya'

const props = defineProps({
  modelValue: { type: String, default: '' }, id: { type: String, default: 'isian-kaya' }, label: { type: String, default: '' },
  placeholder: { type: String, default: '' }, wajib: { type: Boolean, default: false }, tinggi: { type: String, default: '9rem' },
})
const emit = defineEmits(['update:modelValue'])
const kotak = ref(null); const pratinjau = ref(false)

async function gaya(jenis) {
  if (pratinjau.value) pratinjau.value = false
  await nextTick()
  const el = kotak.value; if (!el) return
  const h = terapkanGaya(props.modelValue || '', el.selectionStart, el.selectionEnd, jenis)
  emit('update:modelValue', h.nilai)
  await nextTick(); el.focus(); el.setSelectionRange(h.awal, h.akhir)
}
function pintasan(e) {
  if (!(e.ctrlKey || e.metaKey)) return
  const k = e.key.toLowerCase()
  if (k === 'b') { e.preventDefault(); gaya('tebal') } else if (k === 'i') { e.preventDefault(); gaya('miring') }
}
const TOMBOL = [
  { k: 'tebal', n: 'Tebal', ikon: PhTextB, ket: 'Tebal (Ctrl+B)' },
  { k: 'miring', n: 'Miring', ikon: PhTextItalic, ket: 'Miring (Ctrl+I)' },
  { k: 'normal', n: 'Normal', ikon: PhTextT, ket: 'Kembalikan ke teks normal' },
]
</script>
<template>
  <div>
    <label v-if="label" class="label-isian" :for="id">{{ label }}</label>
    <div class="overflow-hidden rounded-xl border border-garis bg-permukaan focus-within:border-[#2F5FA8]">
      <div class="flex flex-wrap items-center gap-1 border-b border-garis bg-permukaan2 px-1.5 py-1" role="toolbar" aria-label="Gaya teks">
        <button v-for="t in TOMBOL" :key="t.k" type="button" class="bilah-gaya" :title="t.ket" :aria-label="t.ket" @mousedown.prevent @click="gaya(t.k)">
          <component :is="t.ikon" :size="18" weight="bold" /><span class="hidden sm:inline">{{ t.n }}</span>
        </button>
        <span class="flex-1" />
        <button type="button" class="bilah-gaya" :aria-pressed="pratinjau" @click="pratinjau = !pratinjau">
          <component :is="pratinjau ? PhPencilSimpleLine : PhEye" :size="18" weight="duotone" /><span>{{ pratinjau ? 'Ubah' : 'Pratinjau' }}</span>
        </button>
      </div>
      <textarea v-show="!pratinjau" :id="id" ref="kotak" :value="modelValue" :required="wajib" :placeholder="placeholder" :style="{ minHeight: tinggi }"
        class="block w-full resize-y bg-transparent px-3 py-2 text-teks outline-none placeholder:text-teks3" @input="emit('update:modelValue', $event.target.value)" @keydown="pintasan" />
      <!-- eslint-disable-next-line vue/no-v-html -- teks sudah di-escape oleh teksKaya() -->
      <div v-if="pratinjau" class="whitespace-pre-line px-3 py-2 leading-relaxed text-teks" :style="{ minHeight: tinggi }" v-html="teksKaya(modelValue) || '<span class=&quot;text-teks3&quot;>Belum ada isi.</span>'" />
    </div>
    <p class="mt-1 text-xs text-teks3">Pilih kata, lalu ketuk <strong>Tebal</strong> atau <em>Miring</em>. Penulisan langsung juga bisa: *tebal*, _miring_ (sama seperti WhatsApp).</p>
  </div>
</template>
<style scoped>
.bilah-gaya { display: inline-flex; min-height: 36px; align-items: center; gap: .35rem; border-radius: .6rem; padding: 0 .6rem; font-size: .8125rem; font-weight: 600; color: rgb(var(--teks-2)); }
.bilah-gaya:hover, .bilah-gaya[aria-pressed='true'] { background: rgb(var(--permukaan)); color: rgb(var(--teks)); }
</style>
