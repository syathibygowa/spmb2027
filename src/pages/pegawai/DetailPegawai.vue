<!-- SIMKA PRO | src/pages/pegawai/DetailPegawai.vue | v1.2 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { PhIdentificationCard, PhBriefcase, PhPhone, PhCalendarBlank, PhBuildings, PhEye, PhPencilSimple, PhTrash, PhClockCounterClockwise } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'
import { useUI } from '@/stores/ui'
import { useOrganisasi } from '@/stores/organisasi'
import { PENDIDIKAN, STATUS_KELUARGA, KEAKTIFAN, LEVEL_MUHAFFIZH, KATEGORI_HONORER, STATUS_AKUN as AKUN } from '@/lib/kepegawaian'
import { usePegawai } from '@/stores/pegawai'
import { formatPanjang, formatPendek } from '@/lib/tanggal'
import { ambilPenandaTangan } from '@/lib/penandatangan'
import { useSesi } from '@/stores/sesi'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'
import TombolCetak from '@/components/TombolCetak.vue'

const route = useRoute(); const router = useRouter(); const peg = usePegawai(); const sesi = useSesi(); const ui = useUI(); const org = useOrganisasi()
const pimpinan = ref({ jabatan: 'Direktur', nama: '', niy: '' })
const pratinjau = ref(false)
onMounted(async () => {
  if (!peg.daftar.length) await peg.muat()
  org.muat(); peg.muatRiwayat(route.params.id)
  pimpinan.value = await ambilPenandaTangan('Direktur')
})
const riwayat = computed(() => peg.riwayat[route.params.id] || [])
const JENIS_RIWAYAT = { status_kepegawaian: 'Status kepegawaian', status_keaktifan: 'Status keaktifan', pendidikan: 'Pendidikan', level_muhaffizh: 'Level muhaffizh',
  kategori_honorer: 'Kategori honorer', tmt: 'TMT tugas', unit: 'Bidang/unit', jabatan_fungsional: 'Jabatan fungsional', jabatan_struktural: 'Jabatan struktural' }
function nilaiRiwayat(r, v) {
  if (!v) return '–'
  if (r.jenis === 'unit') return org.cariUnit(v)?.nama || v
  if (r.jenis === 'tmt') return formatPanjang(v)
  if (r.jenis === 'pendidikan') return PENDIDIKAN[v] || v
  return KEAKTIFAN[v] || STATUS_PEG[v] || LEVEL_MUHAFFIZH[v] || KATEGORI_HONORER[v] || v
}
const bolehHapus = computed(() => sesi.isSuperadmin && p.value && ['tanpa_akun', 'ditolak'].includes(p.value.status_akun))
async function hapus() {
  if (!(await ui.konfirmasi({ judul: 'Hapus data pegawai?', pesan: `${p.value.nama_lengkap} beserta jabatan dan riwayatnya akan dihapus permanen.`, ya: 'Hapus', bahaya: true }))) return
  try { await peg.hapus(p.value.id); ui.toast('Data pegawai dihapus.'); router.replace('/pegawai') } catch (e) { ui.toast(e.message, 'galat') }
}
const p = computed(() => peg.cari(route.params.id))

const masaKerja = (tmt) => {
  if (!tmt) return '–'
  const a = new Date(tmt), b = new Date()
  let bln = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) bln--
  return `${Math.floor(bln / 12)} tahun ${bln % 12} bulan`
}
const STATUS_PEG = { tetap: 'Tetap', kontrak: 'Kontrak', honorer: 'Honorer' }
const STATUS_AKUN = Object.fromEntries(Object.entries(AKUN).map(([k, v]) => [k, [v.n, v.w]]))
const baris = computed(() => !p.value ? [] : [
  ['Nama lengkap', p.value.nama_lengkap], ['NIY', p.value.niy || '–'],
  ['Jenis kelamin', p.value.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'],
  ['Tempat, tanggal lahir', p.value.ttl || [p.value.tempat_lahir, p.value.tanggal_lahir && formatPanjang(p.value.tanggal_lahir)].filter(Boolean).join(', ') || '–'],
  ['Pendidikan terakhir', PENDIDIKAN[p.value.pendidikan_terakhir] || '–'], ['Status keluarga', STATUS_KELUARGA[p.value.status_keluarga] || '–'],
  ['Bidang/unit', p.value.nama_unit || '–'], ['Jabatan struktural', p.value.jabatan_struktural || '–'],
  ['Jabatan fungsional', (p.value.jabatan_fungsional || []).join(', ') || '–'],
  ['Status kepegawaian', [STATUS_PEG[p.value.status_kepegawaian], p.value.kategori_honorer && `(honorer ${KATEGORI_HONORER[p.value.kategori_honorer].toLowerCase()})`].filter(Boolean).join(' ') || '–'],
  ['Status keaktifan', KEAKTIFAN[p.value.status_keaktifan] || '–'],
  ['TMT tugas', p.value.tmt_tugas ? formatPanjang(p.value.tmt_tugas) : '–'], ['Masa kerja', p.value.masa_kerja?.teks || masaKerja(p.value.tmt_tugas)],
  ['Nomor HP', p.value.no_hp || '–'], ['Email', p.value.email || '–'],
])
</script>
<template>
  <div v-if="p" class="mx-auto max-w-4xl">
    <div class="layar-saja">
      <section class="kartu w-pegawai overflow-hidden">
        <div class="kepala h-20 sm:h-24" />
        <div class="-mt-10 flex flex-wrap items-end gap-4 px-5 pb-5">
          <span :class="['grid h-20 w-20 place-items-center rounded-2xl border-4 border-permukaan text-2xl font-extrabold text-white', p.jenis_kelamin === 'P' ? 'bg-[#B42A5E]' : 'bg-[#2F5FA8]']">
            {{ p.nama_lengkap.replace(/^(Ust\.|Ustzh\.)\s*/, '').split(/\s+/).slice(0, 2).map((k) => k[0]).join('') }}
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-extrabold leading-tight">{{ p.nama_lengkap }}</h2>
            <p class="text-sm text-teks3">NIY {{ p.niy || 'belum ada' }}</p>
          </div>
          <span :class="['lencana', 'w-' + STATUS_AKUN[p.status_akun][1]]">{{ STATUS_AKUN[p.status_akun][0] }}</span>
        </div>
        <div class="grid gap-3 border-t border-garis p-5 sm:grid-cols-2">
          <div class="w-pegawai flex items-center gap-3"><span class="chip-ikon h-10 w-10"><PhBriefcase :size="20" weight="duotone" /></span>
            <div><p class="text-xs text-teks3">Jabatan</p><p class="font-semibold">{{ [p.jabatan_struktural, ...(p.jabatan_fungsional || [])].filter(Boolean).join(', ') }}</p></div></div>
          <div class="w-santri flex items-center gap-3"><span class="chip-ikon h-10 w-10"><PhBuildings :size="20" weight="duotone" /></span>
            <div><p class="text-xs text-teks3">Bidang/unit</p><p class="font-semibold">{{ p.nama_unit }}</p></div></div>
          <div class="w-tahfizh flex items-center gap-3"><span class="chip-ikon h-10 w-10"><PhCalendarBlank :size="20" weight="duotone" /></span>
            <div><p class="text-xs text-teks3">TMT tugas</p><p class="font-semibold">{{ formatPendek(p.tmt_tugas) }} ({{ p.masa_kerja?.teks || masaKerja(p.tmt_tugas) }})</p></div></div>
          <div class="w-gaji flex items-center gap-3"><span class="chip-ikon h-10 w-10"><PhIdentificationCard :size="20" weight="duotone" /></span>
            <div><p class="text-xs text-teks3">Status kepegawaian</p><p class="font-semibold">{{ STATUS_PEG[p.status_kepegawaian] || '–' }}</p></div></div>
        </div>
      </section>
      <div class="mt-4 flex flex-wrap gap-2">
        <router-link :to="`/pegawai/${p.id}/ubah`" class="tombol-utama"><PhPencilSimple :size="20" weight="duotone" /> Ubah data</router-link>
        <button v-if="bolehHapus" class="tombol-garis" @click="hapus"><PhTrash :size="20" weight="duotone" /> Hapus</button>
        <button class="tombol-garis" @click="pratinjau = true"><PhEye :size="20" weight="duotone" /> Pratinjau biodata</button>
        <TombolCetak label="Cetak biodata" />
      </div>

      <section class="kartu w-pengajuan mt-4 p-5">
        <div class="mb-3 flex items-center gap-3"><span class="chip-ikon h-10 w-10"><PhClockCounterClockwise :size="22" weight="duotone" /></span>
          <div><h3 class="judul-bagian">Riwayat kepegawaian</h3><p class="text-sm text-teks3">Dasar perhitungan gaji per periode.</p></div></div>
        <ol v-if="riwayat.length" class="relative ml-2 space-y-3 border-l-2 border-garis pl-5">
          <li v-for="r in riwayat" :key="r.id" class="relative">
            <span class="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full" style="background: var(--c)" aria-hidden="true" />
            <p class="text-sm font-semibold">{{ JENIS_RIWAYAT[r.jenis] || r.jenis }}</p>
            <p class="text-sm text-teks2">{{ nilaiRiwayat(r, r.nilai_lama) }} → <span class="font-semibold text-teks">{{ nilaiRiwayat(r, r.nilai_baru) }}</span></p>
            <p class="text-xs text-teks3">Berlaku {{ formatPanjang(r.tanggal_berlaku) }}</p>
          </li>
        </ol>
        <p v-else class="py-3 text-sm text-teks3">Belum ada perubahan tercatat.</p>
      </section>
    </div>

    <div>
      <DokumenCetak judul="Biodata Pegawai"  v-model:pratinjau="pratinjau" :pencetak="sesi.pengguna?.nama_lengkap">
        <table class="tabel">
          <colgroup><col style="width:7%"><col style="width:33%"><col style="width:60%"></colgroup>
          <thead><tr><th>No.</th><th>Data</th><th>Keterangan</th></tr></thead>
          <tbody><tr v-for="(b, i) in baris" :key="b[0]"><td class="tengah">{{ i + 1 }}</td><td>{{ b[0] }}</td><td>{{ b[1] }}</td></tr></tbody>
        </table>
        <template #ttd>
          <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: pimpinan.jabatan, nama: pimpinan.nama, niy: pimpinan.niy }"
            :kanan="{ jabatan: 'Pegawai yang bersangkutan', nama: p.nama_lengkap, niy: p.niy }" />
        </template>
      </DokumenCetak>
    </div>
  </div>
  <p v-else-if="!peg.memuat" class="py-16 text-center text-teks3">Data pegawai tidak ditemukan.</p>
</template>
<style scoped>
.kepala { background: var(--gradasi-utama); }

</style>
