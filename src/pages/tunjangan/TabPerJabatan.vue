<!-- SIMKA PRO | src/pages/tunjangan/TabPerJabatan.vue | v1.0 | Fase 1 – Jabatan dan tunjangan | 03/10/2026 -->
<script setup>
// Ringkasan per jabatan: tarif berlaku, jumlah pemegang, total tunjangan jabatan, dan siapa saja pemegangnya.
import { ref, computed } from 'vue'
import { PhCaretDown } from '@phosphor-icons/vue'
import { useOrganisasi } from '@/stores/organisasi'
import { formatRupiah } from '@/lib/tunjangan'

const props = defineProps({ hasil: Array, tarif: Object })
const org = useOrganisasi()
const buka = ref({})
function baris(jenis) {
  const daftar = jenis === 'struktural' ? [...org.struktural].sort((a, b) => a.tingkat - b.tingkat) : org.fungsional
  return daftar.filter((j) => j.aktif).map((j) => {
    const pemegang = props.hasil.filter(({ p }) => jenis === 'struktural' ? p.structural_position_id === j.id : (p.fungsional_ids || []).includes(j.id)).map(({ p }) => p.nama_lengkap)
    const r = props.tarif[jenis]?.[j.kode]
    return { id: j.id, nama: j.nama, tarif: r ? Number(r.besaran) : null, pemegang, total: (r ? Number(r.besaran) : 0) * pemegang.length }
  })
}
const BAGIAN = computed(() => [
  { k: 'struktural', n: 'Jabatan struktural', w: 'pengaturan', baris: baris('struktural') },
  { k: 'fungsional', n: 'Jabatan fungsional', w: 'presensi', baris: baris('fungsional') },
])
</script>
<template>
  <div class="grid gap-4 xl:grid-cols-2">
    <section v-for="b in BAGIAN" :key="b.k" :class="['kartu p-4 sm:p-5', 'w-' + b.w]">
      <div class="mb-3 flex items-baseline justify-between gap-2">
        <h3 class="judul-bagian">{{ b.n }}</h3>
        <p class="text-sm font-bold tabular-nums">{{ formatRupiah(b.baris.reduce((a, x) => a + x.total, 0)) }}</p>
      </div>
      <ul class="divide-y divide-garis">
        <li v-for="j in b.baris" :key="j.id" class="py-2">
          <button class="flex w-full items-center gap-3 text-left" @click="buka[j.id] = !buka[j.id]" :aria-expanded="!!buka[j.id]">
            <div class="min-w-0 flex-1">
              <p class="font-semibold">{{ j.nama }}</p>
              <p class="text-xs text-teks3">{{ j.tarif === null ? 'Tarif belum diatur' : formatRupiah(j.tarif) + ' per orang' }} – {{ j.pemegang.length }} pemegang</p>
            </div>
            <span class="font-bold tabular-nums">{{ formatRupiah(j.total) }}</span>
            <PhCaretDown :size="16" :class="['shrink-0 text-teks3 transition', buka[j.id] && 'rotate-180']" />
          </button>
          <p v-if="buka[j.id]" class="mt-1.5 rounded-lg bg-permukaan2 p-2 text-sm text-teks2">{{ j.pemegang.join(', ') || 'Belum ada pemegang.' }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>
