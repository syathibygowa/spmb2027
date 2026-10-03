<!-- SIMKA PRO | src/pages/tunjangan/JabatanTunjangan.vue | v1.0 | Fase 1 – Jabatan dan tunjangan | 03/10/2026 -->
<script setup>
// Jabatan dan tunjangan (superadmin): peta jabatan per pegawai beserta perkiraan tunjangan,
// ringkasan per jabatan, dan tarif komponen gaji. Kelak dipakai modul Gaji (Fase 11) dan bendahara.
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { PhTable, PhIdentificationBadge, PhCoins, PhInfo } from '@phosphor-icons/vue'
import { useTunjangan } from '@/stores/tunjangan'
import { useOrganisasi } from '@/stores/organisasi'
import { usePegawai } from '@/stores/pegawai'
import { useLembaga } from '@/stores/lembaga'
import { useUI } from '@/stores/ui'
import { hariIniISO } from '@/lib/tanggal'
import { petaTarif, hitungTunjangan } from '@/lib/tunjangan'
import TabPeta from './TabPeta.vue'
import TabPerJabatan from './TabPerJabatan.vue'
import TabTarif from './TabTarif.vue'

const props = defineProps({ tab: { type: String, default: 'pegawai' } })
const router = useRouter()
const tunj = useTunjangan(); const org = useOrganisasi(); const peg = usePegawai(); const lembaga = useLembaga(); const ui = useUI()
const siap = ref(false); const galat = ref('')
const tanggal = ref(hariIniISO())
onMounted(async () => {
  try { await Promise.all([tunj.muat(), org.muat(), lembaga.muat(), peg.daftar.length ? null : peg.muat()]) }
  catch (e) { galat.value = e.message }
  siap.value = true
  await nextTick(); document.querySelector('[role=tab][aria-selected=true]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
})
const TAB = [
  { k: 'pegawai', n: 'Peta jabatan pegawai', ikon: PhTable, w: 'gaji' },
  { k: 'jabatan', n: 'Ringkasan per jabatan', ikon: PhIdentificationBadge, w: 'presensi' },
  { k: 'tarif', n: 'Tarif komponen', ikon: PhCoins, w: 'tahfizh' },
]
const aktif = computed(() => TAB.find((t) => t.k === props.tab) || TAB[0])
const tarif = computed(() => petaTarif(tunj.tarif, tanggal.value))
// Pegawai aktif beserta hasil hitung (dipakai bersama tab peta dan ringkasan)
const hasil = computed(() => peg.daftar.filter((p) => (p.status_keaktifan || 'aktif') === 'aktif')
  .map((p) => ({ p, h: hitungTunjangan(p, tarif.value, org, tanggal.value) })))
</script>
<template>
  <div>
    <nav class="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="Bagian jabatan dan tunjangan">
      <button v-for="t in TAB" :key="t.k" role="tab" :aria-selected="aktif.k === t.k" @click="router.replace(`/jabatan-tunjangan/${t.k}`)"
        :class="['tab flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold', 'w-' + t.w, aktif.k === t.k ? 'aktif text-teks' : 'border-garis bg-permukaan text-teks2 hover:text-teks']">
        <span class="chip-ikon h-8 w-8 rounded-lg"><component :is="t.ikon" :size="20" weight="duotone" /></span><span class="whitespace-nowrap">{{ t.n }}</span>
      </button>
    </nav>
    <p class="mb-4 flex gap-2 text-sm text-teks3"><PhInfo :size="18" class="mt-0.5 shrink-0" />
      Angka di sini adalah perkiraan tunjangan tetap menurut tarif yang berlaku. Honor per jam dan potongan berbasis kehadiran dihitung pada slip gaji (Fase 11).</p>
    <p v-if="galat" class="rounded-xl bg-[#C7332F]/10 p-3 text-sm font-semibold text-merah">{{ galat }} Jalankan dulu SQL tarif tunjangan v1.0 di Supabase.</p>
    <p v-else-if="!siap" class="py-10 text-center text-teks3">Memuat data…</p>
    <div v-else :class="'w-' + aktif.w">
      <TabPeta v-if="aktif.k === 'pegawai'" v-model:tanggal="tanggal" :hasil="hasil" />
      <TabPerJabatan v-else-if="aktif.k === 'jabatan'" :hasil="hasil" :tarif="tarif" />
      <TabTarif v-else />
    </div>
  </div>
</template>
<style scoped>
.tab.aktif { border-color: color-mix(in srgb, var(--c) 35%, transparent); background: color-mix(in srgb, var(--c) 12%, rgb(var(--permukaan))); }
</style>
