<!-- SIMKA PRO | src/pages/organisasi/Organisasi.vue | v1.1 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
import { computed, onMounted, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { PhTreeStructure, PhIdentificationBadge, PhCrown, PhEye, PhPrinter } from '@phosphor-icons/vue'
import { useOrganisasi } from '@/stores/organisasi'
import { useLembaga } from '@/stores/lembaga'
import { useSesi } from '@/stores/sesi'
import { formatPanjang } from '@/lib/tanggal'
import TabUnit from './TabUnit.vue'
import TabJabatan from './TabJabatan.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'

const props = defineProps({ tab: { type: String, default: 'unit' } })
const router = useRouter(); const org = useOrganisasi(); const lembaga = useLembaga(); const sesi = useSesi()
const pratinjau = ref(false)
onMounted(async () => {
  await Promise.all([org.muat(), lembaga.muat()])
  await nextTick(); document.querySelector('[role=tab][aria-selected=true]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
})
const TAB = [
  { k: 'unit', n: 'Bidang dan unit', ikon: PhTreeStructure, w: 'santri' },
  { k: 'fungsional', n: 'Jabatan fungsional (P1)', ikon: PhIdentificationBadge, w: 'presensi' },
  { k: 'struktural', n: 'Jabatan struktural (P2)', ikon: PhCrown, w: 'pengaturan' },
]
const aktif = computed(() => TAB.find((t) => t.k === props.tab) || TAB[0])
const direktur = computed(() => lembaga.signatories.find((s) => /^direktur$/i.test(s.jabatan_tertulis)) || lembaga.signatories[0] || {})
const JENIS = { pimpinan: 'Pimpinan', bidang: 'Bidang', unit: 'Unit' }
const induk = (u) => org.cariUnit(u.parent_id)?.nama || '–'
</script>
<template>
  <div>
    <div class="layar-saja">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <nav class="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="Bagian struktur organisasi">
          <button v-for="t in TAB" :key="t.k" role="tab" :aria-selected="aktif.k === t.k" @click="router.replace(`/organisasi/${t.k}`)"
            :class="['tab flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold', 'w-' + t.w, aktif.k === t.k ? 'aktif text-teks' : 'border-garis bg-permukaan text-teks2 hover:text-teks']">
            <span class="chip-ikon h-8 w-8 rounded-lg"><component :is="t.ikon" :size="20" weight="duotone" /></span><span class="whitespace-nowrap">{{ t.n }}</span>
          </button>
        </nav>
        <button class="tombol-garis" @click="pratinjau = true"><PhEye :size="20" weight="duotone" /> Pratinjau cetak</button>
      </div>
      <p v-if="!org.dimuat" class="py-10 text-center text-teks3">Memuat struktur organisasi…</p>
      <div v-else :class="'w-' + aktif.w">
        <TabUnit v-if="aktif.k === 'unit'" />
        <TabJabatan v-else :key="aktif.k" :jenis="aktif.k" />
      </div>
    </div>

    <!-- Dokumen cetak: daftar bidang/unit dan jabatan -->
    <div v-if="org.dimuat">
      <DokumenCetak judul="Struktur Organisasi" :subjudul="`Keadaan per ${formatPanjang(new Date())}`"  v-model:pratinjau="pratinjau" :pencetak="sesi.pengguna?.nama_lengkap">
        <table class="tabel">
          <colgroup><col style="width:7%"><col style="width:35%"><col style="width:17%"><col style="width:11%"><col style="width:19%"><col style="width:11%"></colgroup>
          <thead><tr><th>No.</th><th>Bidang/Unit</th><th>Kode</th><th>Jenis</th><th>Induk</th><th>Pegawai</th></tr></thead>
          <tbody>
            <tr v-for="(u, i) in org.datar" :key="u.id">
              <td class="tengah">{{ i + 1 }}</td><td :style="{ paddingLeft: 5 + u.tingkat * 12 + 'pt' }">{{ u.nama }}{{ u.aktif ? '' : ' (nonaktif)' }}</td>
              <td class="tengah">{{ u.kode }}</td><td class="tengah">{{ JENIS[u.jenis] }}</td><td>{{ induk(u) }}</td><td class="tengah">{{ org.jumlahCabang(u.id) }}</td>
            </tr>
          </tbody>
        </table>
        <p style="margin: 10pt 0 4pt">Jabatan struktural (P2)</p>
        <table class="tabel">
          <colgroup><col style="width:7%"><col style="width:45%"><col style="width:16%"><col style="width:20%"><col style="width:12%"></colgroup>
          <thead><tr><th>No.</th><th>Jabatan</th><th>Tingkat</th><th>Menyetujui</th><th>Pegawai</th></tr></thead>
          <tbody>
            <tr v-for="(j, i) in [...org.struktural].sort((a, b) => a.tingkat - b.tingkat)" :key="j.id">
              <td class="tengah">{{ i + 1 }}</td><td>{{ j.nama }}</td><td class="tengah">{{ j.tingkat }}</td>
              <td class="tengah">{{ j.boleh_menyetujui ? 'Ya' : 'Tidak' }}</td><td class="tengah">{{ org.jumlahStruktural[j.id] || 0 }}</td>
            </tr>
          </tbody>
        </table>
        <template #ttd>
          <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }"
            :kanan="{ jabatan: 'Pengelola Sistem', nama: sesi.pengguna?.nama_lengkap || '' }" />
        </template>
      </DokumenCetak>
    </div>
  </div>
</template>
<style scoped>
.tab.aktif { border-color: color-mix(in srgb, var(--c) 35%, transparent); background: color-mix(in srgb, var(--c) 12%, rgb(var(--permukaan))); }

</style>
