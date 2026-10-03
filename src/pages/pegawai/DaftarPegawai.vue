<!-- SIMKA PRO | src/pages/pegawai/DaftarPegawai.vue | v1.2 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { PhMagnifyingGlass, PhPrinter, PhEye, PhCaretRight, PhUsersThree, PhSlidersHorizontal, PhUserPlus, PhFileXls, PhChartBar, PhDownloadSimple } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { KEAKTIFAN, STATUS_KELUARGA, PENDIDIKAN, LEVEL_MUHAFFIZH } from '@/lib/kepegawaian'
import { usePegawai } from '@/stores/pegawai'
import { useSesi } from '@/stores/sesi'
import { formatPanjang, formatPendek, hariIniISO } from '@/lib/tanggal'
import { ambilPenandaTangan } from '@/lib/penandatangan'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'
import LembarBawah from '@/components/LembarBawah.vue'
import TombolAksi from '@/components/TombolAksi.vue'
import InputTanggal from '@/components/InputTanggal.vue'

const peg = usePegawai(); const sesi = useSesi(); const router = useRouter()
const keaktifan = ref('aktif')
const cari = ref(''); const saring = ref('semua')
const pratinjau = ref(false); const opsiCetak = ref(false)
const tglDok = ref(hariIniISO()); const kop = ref('pondok')
const pimpinan = ref({ jabatan: 'Direktur', nama: '', niy: '' })
onMounted(async () => { if (!peg.daftar.length) peg.muat(); pimpinan.value = await ambilPenandaTangan('Direktur') })

const STATUS_AKUN = { // label status akun
 
  aktif: { n: 'Aktif', w: 'presensi' }, menunggu: { n: 'Menunggu verifikasi', w: 'verifikasi' },
  tanpa_akun: { n: 'Belum punya akun', w: 'tahfizh' }, ditolak: { n: 'Ditolak', w: 'klinik' }, nonaktif: { n: 'Nonaktif', w: 'hakakses' },
}
const SARING = [{ k: 'semua', n: 'Semua' }, { k: 'aktif', n: 'Akun aktif' }, { k: 'menunggu', n: 'Menunggu' }, { k: 'tanpa_akun', n: 'Belum punya akun' }]
const STATUS_PEG = { tetap: 'Tetap', kontrak: 'Kontrak', honorer: 'Honorer' }
const jabatan = (p) => [p.jabatan_struktural, ...(p.jabatan_fungsional || [])].filter(Boolean).join(', ')
const tampil = computed(() => {
  const q = cari.value.toLowerCase().trim()
  return peg.daftar.filter((p) => (saring.value === 'semua' || p.status_akun === saring.value) &&
    (keaktifan.value === 'semua' || (p.status_keaktifan || 'aktif') === keaktifan.value) &&
    (!q || [p.nama_lengkap, p.niy, p.nama_unit, jabatan(p)].join(' ').toLowerCase().includes(q)))
})
function eksporExcel() {
  const kolom = ['No.', 'Nama lengkap bergelar', 'NIY', 'Jenis kelamin', 'Tempat lahir', 'Tanggal lahir', 'TMT tugas', 'Masa kerja', 'Status kepegawaian',
    'Kategori honorer', 'Pendidikan terakhir', 'Status keluarga', 'Nomor HP', 'Email', 'Bidang/Unit', 'Jabatan fungsional', 'Jabatan struktural', 'Level muhaffizh', 'Status keaktifan', 'Status akun']
  const data = tampil.value.map((p, i) => [i + 1, p.nama_lengkap, p.niy || '', p.jenis_kelamin || '', p.tempat_lahir || '', p.tanggal_lahir ? formatPendek(p.tanggal_lahir) : '',
    p.tmt_tugas ? formatPendek(p.tmt_tugas) : '', p.masa_kerja?.teks || '', STATUS_PEG[p.status_kepegawaian] || '', p.kategori_honorer || '', PENDIDIKAN[p.pendidikan_terakhir] || '',
    STATUS_KELUARGA[p.status_keluarga] || '', p.no_hp || '', p.email || '', p.nama_unit || '', (p.jabatan_fungsional || []).join(', '), p.jabatan_struktural || '',
    LEVEL_MUHAFFIZH[p.level_muhaffizh] || '', KEAKTIFAN[p.status_keaktifan] || '', STATUS_AKUN[p.status_akun]?.n || ''])
  const ws = XLSX.utils.aoa_to_sheet([kolom, ...data])
  ws['!cols'] = kolom.map((k, i) => ({ wch: Math.min(40, Math.max(k.length, ...data.map((r) => String(r[i]).length)) + 2) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data pegawai')
  XLSX.writeFile(wb, `Data-Pegawai-${formatPendek(new Date()).replace(/\//g, '-')}.xlsx`)
}
function cetakSekarang() { opsiCetak.value = false; setTimeout(() => window.print(), 300) }
const judulCetak = computed(() => saring.value === 'semua' ? 'Daftar Pegawai' : `Daftar Pegawai (${SARING.find((s) => s.k === saring.value).n})`)
</script>
<template>
  <div>
    <div class="layar-saja">
      <!-- Kepala halaman desktop -->
      <div class="mb-5 hidden items-center gap-3 lg:flex">
        <span class="w-pegawai chip-ikon h-12 w-12"><PhUsersThree :size="28" weight="duotone" /></span>
        <div class="flex-1">
          <h2 class="text-lg font-bold">{{ peg.daftar.length }} pegawai terdata</h2>
          <p class="text-sm text-teks3">{{ tampil.length }} tampil sesuai saringan.</p>
        </div>
        <router-link to="/pegawai/baru" class="tombol-utama"><PhUserPlus :size="20" weight="duotone" /> Tambah pegawai</router-link>
      </div>
      <!-- Aksi: tampil di semua ukuran layar -->
      <div class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <router-link to="/pegawai/impor" class="w-gaji tombol-garis shrink-0 px-4 text-sm"><PhFileXls :size="20" weight="duotone" style="color: var(--c)" /> Impor Excel</router-link>
        <button class="w-pegawai tombol-garis shrink-0 px-4 text-sm" @click="eksporExcel"><PhDownloadSimple :size="20" weight="duotone" style="color: var(--c)" /> Ekspor Excel</button>
        <router-link to="/pegawai/rekap" class="w-laporan tombol-garis shrink-0 px-4 text-sm"><PhChartBar :size="20" weight="duotone" style="color: var(--c)" /> Rekap kepegawaian</router-link>
        <button class="w-pengajuan tombol-garis shrink-0 px-4 text-sm" @click="pratinjau = true"><PhEye :size="20" weight="duotone" style="color: var(--c)" /> Pratinjau cetak</button>
        <button class="w-tatausaha tombol-garis shrink-0 px-4 text-sm" @click="opsiCetak = true"><PhSlidersHorizontal :size="20" weight="duotone" style="color: var(--c)" /> Atur dan cetak</button>
      </div>

      <!-- Pencarian dan saringan -->
      <div class="flex flex-wrap gap-2">
      <div class="relative min-w-[220px] flex-1">
        <PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
        <input v-model="cari" type="search" class="isian pl-11" placeholder="Cari nama, NIY, bidang, atau jabatan" aria-label="Cari pegawai" />
      </div>
      <select v-model="keaktifan" class="isian w-auto" aria-label="Saring status keaktifan">
        <option value="semua">Semua keaktifan</option><option v-for="(n, k) in KEAKTIFAN" :key="k" :value="k">{{ n }}</option>
      </select>
      </div>
      <div class="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <button v-for="s in SARING" :key="s.k" :aria-pressed="saring === s.k"
          :class="['min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-semibold transition',
                   saring === s.k ? 'border-transparent bg-[#C7332F] text-white' : 'border-garis bg-permukaan text-teks2 hover:text-teks']" @click="saring = s.k">{{ s.n }}</button>
      </div>

      <p v-if="peg.galat" class="mt-4 rounded-xl bg-[#C7332F]/10 p-3 text-sm font-semibold text-merah">{{ peg.galat }}</p>

      <!-- Tabel desktop -->
      <div class="kartu mt-4 hidden overflow-x-auto lg:block">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-garis bg-permukaan2 text-teks2">
            <tr><th class="px-4 py-3 font-bold">Nama</th><th class="px-4 py-3 font-bold">NIY</th><th class="px-4 py-3 font-bold">Bidang/unit</th>
              <th class="px-4 py-3 font-bold">Jabatan</th><th class="px-4 py-3 font-bold">Status</th><th class="px-4 py-3 font-bold">Akun</th><th class="w-10" /></tr>
          </thead>
          <tbody class="divide-y divide-garis">
            <tr v-for="p in tampil" :key="p.id" class="hover:bg-permukaan2">
              <td class="px-4 py-3 font-semibold text-teks"><router-link :to="`/pegawai/${p.id}`" class="hover:underline">{{ p.nama_lengkap }}</router-link></td>
              <td class="px-4 py-3 tabular-nums text-teks2">{{ p.niy || '–' }}</td>
              <td class="px-4 py-3 text-teks2">{{ p.nama_unit || '–' }}</td>
              <td class="px-4 py-3 text-teks2">{{ jabatan(p) || '–' }}</td>
              <td class="px-4 py-3 text-teks2">{{ STATUS_PEG[p.status_kepegawaian] || '–' }}</td>
              <td class="px-4 py-3"><span :class="['lencana', 'w-' + STATUS_AKUN[p.status_akun]?.w]">{{ STATUS_AKUN[p.status_akun]?.n }}</span></td>
              <td class="pr-3"><router-link :to="`/pegawai/${p.id}`" class="tombol-ikon h-9 w-9" :aria-label="`Buka ${p.nama_lengkap}`"><PhCaretRight :size="18" /></router-link></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!tampil.length && !peg.memuat" class="py-10 text-center text-sm text-teks3">Tidak ada pegawai yang cocok dengan pencarian.</p>
      </div>

      <!-- Kartu mobile -->
      <ul class="mt-4 space-y-2.5 lg:hidden">
        <li v-for="p in tampil" :key="p.id">
          <router-link :to="`/pegawai/${p.id}`" class="kartu flex items-center gap-3 p-3.5 active:bg-permukaan2">
            <span :class="['chip-ikon h-11 w-11 text-sm font-extrabold', p.jenis_kelamin === 'P' ? 'w-klinik' : 'w-santri']">
              {{ p.nama_lengkap.replace(/^(Ust\.|Ustzh\.)\s*/, '').split(/\s+/).slice(0, 2).map((k) => k[0]).join('') }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-bold">{{ p.nama_lengkap }}</span>
              <span class="block truncate text-sm text-teks3">{{ jabatan(p) }}</span>
              <span :class="['lencana mt-1', 'w-' + STATUS_AKUN[p.status_akun]?.w]">{{ STATUS_AKUN[p.status_akun]?.n }}</span>
            </span>
            <PhCaretRight :size="20" class="text-teks3" />
          </router-link>
        </li>
        <li v-if="!tampil.length && !peg.memuat" class="py-10 text-center text-sm text-teks3">Tidak ada pegawai yang cocok dengan pencarian.</li>
      </ul>

    </div>

    <!-- Dokumen cetak -->
    <div>
      <DokumenCetak :kop="kop" :judul="judulCetak" :subjudul="`Keadaan per ${formatPanjang(tglDok)}`"  v-model:pratinjau="pratinjau" :pencetak="sesi.pengguna?.nama_lengkap">
        <table class="tabel">
          <colgroup><col style="width:6%"><col style="width:24%"><col style="width:14%"><col style="width:6%"><col style="width:22%"><col style="width:16%"><col style="width:12%"></colgroup>
          <thead><tr><th>No.</th><th>Nama</th><th>NIY</th><th>L/P</th><th>Jabatan</th><th>Bidang/Unit</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="(p, i) in tampil" :key="p.id">
              <td class="tengah">{{ i + 1 }}</td><td>{{ p.nama_lengkap }}</td><td class="tengah">{{ p.niy || '–' }}</td>
              <td class="tengah">{{ p.jenis_kelamin }}</td><td>{{ jabatan(p) }}</td><td>{{ p.nama_unit }}</td><td class="tengah">{{ STATUS_PEG[p.status_kepegawaian] || '–' }}</td>
            </tr>
          </tbody>
        </table>
        <template #ttd>
          <TandaTangan :tanggal="tglDok" :kiri="{ pengantar: 'Mengetahui,', jabatan: pimpinan.jabatan, nama: pimpinan.nama, niy: pimpinan.niy }"
            :kanan="{ jabatan: sesi.isSuperadmin ? 'Pengelola Sistem' : 'Admin Kepegawaian', nama: sesi.pengguna?.nama_lengkap, niy: sesi.pengguna?.niy }" />
        </template>
      </DokumenCetak>
    </div>

    <TombolAksi label="Tambah" :ikon="PhUserPlus" warna="pegawai" @klik="router.push('/pegawai/baru')" />
    <LembarBawah v-model="opsiCetak" judul="Atur dokumen cetak">
      <div class="space-y-4 pb-2">
        <InputTanggal v-model="tglDok" label="Tanggal dokumen" wajib />
        <div>
          <label class="label-isian" for="kop">Kop surat</label>
          <select id="kop" v-model="kop" class="isian">
            <option value="pondok">Kop Pondok</option><option value="wustha">Kop Kesetaraan Wustha</option>
            <option value="sma">Kop SMA</option><option value="yayasan">Kop Yayasan</option>
          </select>
        </div>
        <p class="text-sm text-teks3">{{ tampil.length }} pegawai akan dicetak sesuai saringan saat ini.</p>
        <div class="grid grid-cols-2 gap-2">
          <button class="tombol-garis" @click="pratinjau = true; opsiCetak = false"><PhEye :size="20" weight="duotone" /> Pratinjau</button>
          <button class="tombol-utama" @click="cetakSekarang"><PhPrinter :size="20" weight="duotone" /> Cetak</button>
        </div>
      </div>
    </LembarBawah>
  </div>
</template>
<style scoped>

</style>
