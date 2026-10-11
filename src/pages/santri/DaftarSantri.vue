<!-- SIMKA PRO | src/pages/santri/DaftarSantri.vue | v1.3 | Fase 8 – Urutan kolom seragam (NIY/NIS > Nama > JK) | 10/10/2026 -->
<script setup>
// Daftar santri sesuai cakupan pengguna (RLS): kartu statistik langsung, cari dan saring,
// ekspor Excel, cetak daftar F4 berkop jenjang.
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import {
  PhMagnifyingGlass, PhStudent, PhUserPlus, PhFileXls, PhDownloadSimple, PhEye, PhSlidersHorizontal, PhPrinter, PhCaretRight,
  PhGenderMale, PhGenderFemale, PhBooks, PhGraduationCap, PhUserMinus,
} from '@phosphor-icons/vue'
import { useSantri } from '@/stores/santri'
import { useSesi } from '@/stores/sesi'
import { JENJANG, JENJANG_PENDEK, TINGKAT, STATUS_SANTRI, HUBUNGAN, kontakUtama, inisial, penandaJenjang, labelRombel, namaKelompok, KOLOM_IMPOR, nilaiEkspor, kurangWajib } from '@/lib/santri'
import { formatPanjang, formatPendek, hariIniISO } from '@/lib/tanggal'
import { ambilPenandaTangan } from '@/lib/penandatangan'
import KartuStatistik from '@/components/KartuStatistik.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'
import LembarBawah from '@/components/LembarBawah.vue'
import TombolAksi from '@/components/TombolAksi.vue'
import InputTanggal from '@/components/InputTanggal.vue'

const san = useSantri(); const sesi = useSesi(); const router = useRouter()
const bolehUbah = computed(() => sesi.bolehAdmin('kelola_santri') || sesi.tingkat('data_santri') >= 2)
const bolehImpor = computed(() => sesi.bolehAdmin('kelola_santri'))

const cari = ref(''); const status = ref('aktif'); const jenjang = ref('semua'); const tingkat = ref(''); const jk = ref(''); const lengkap = ref('')
const pratinjau = ref(false); const opsiCetak = ref(false); const tglDok = ref(hariIniISO())
const pimpinan = ref({ jabatan: '', nama: '', niy: '' })
onMounted(() => san.muat())

// Kartu statistik (langsung: daftar diperbarui Realtime saat ada perubahan)
const aktif = computed(() => san.daftar.filter((s) => s.status === 'aktif'))
const statistik = computed(() => [
  { judul: 'Santri aktif', nilai: aktif.value.length, ikon: PhStudent, warna: 'santri', ket: `${san.daftar.length} santri terdata` },
  { judul: 'Putra', nilai: aktif.value.filter((s) => s.jenis_kelamin === 'L').length, ikon: PhGenderMale, warna: 'pegawai', ket: 'Santri aktif laki-laki' },
  { judul: 'Putri', nilai: aktif.value.filter((s) => s.jenis_kelamin === 'P').length, ikon: PhGenderFemale, warna: 'klinik', ket: 'Santri aktif perempuan' },
  { judul: 'Kesetaraan Wustha', nilai: aktif.value.filter((s) => s.jenjang === 'wustha').length, ikon: PhBooks, warna: 'tahfizh', ket: 'Kelas 7–9' },
  { judul: 'SMA', nilai: aktif.value.filter((s) => s.jenjang === 'sma').length, ikon: PhGraduationCap, warna: 'laporan', ket: 'Kelas 10–12' },
  { judul: 'Data wajib kurang', nilai: aktif.value.filter((s) => kurangWajib(s).length).length, ikon: PhUserMinus, warna: 'klinik', ket: 'NISN, tempat atau tanggal lahir kosong · ketuk untuk menyaring', saring: true },
])

const tingkatPilihan = computed(() => (jenjang.value === 'semua' ? [...TINGKAT.wustha, ...TINGKAT.sma] : TINGKAT[jenjang.value]))
const tampil = computed(() => {
  const q = cari.value.toLowerCase().trim()
  return san.daftar.filter((s) => (status.value === 'semua' || s.status === status.value)
    && (jenjang.value === 'semua' || s.jenjang === jenjang.value)
    && (!tingkat.value || s.tingkat === Number(tingkat.value))
    && (!jk.value || s.jenis_kelamin === jk.value)
    && (!lengkap.value || (lengkap.value === 'kurang' ? kurangWajib(s).length > 0 : kurangWajib(s).length === 0))
    && (!q || [s.nama_lengkap, s.nama_panggilan, s.nis, s.nisn, ...(s.kontak || []).map((k) => k.nama)].join(' ').toLowerCase().includes(q)))
})
function pilihJenjang(j) { jenjang.value = j; if (tingkat.value && !tingkatPilihan.value.includes(Number(tingkat.value))) tingkat.value = '' }

// ---------- Ekspor Excel ----------
// Ekspor memakai susunan kolom templat impor: unduh → lengkapi data yang kosong → impor kembali (NIS sama = diperbarui).
// Kolom berawalan "Info:" hanya keterangan dan diabaikan saat diimpor.
function eksporExcel() {
  const info = ['Info: Rombel', 'Info: Kamar', 'Info: Halaqah', 'Info: Ekskul', 'Info: Status', 'Info: Data wajib kurang']
  const kolom = [...KOLOM_IMPOR.map((c) => c.j + (c.wajib ? ' *' : '')), ...info]
  const data = tampil.value.map((s) => [...KOLOM_IMPOR.map((c) => nilaiEkspor(s, c.k, formatPendek)),
    namaKelompok(s, 'kelas'), namaKelompok(s, 'kamar'), namaKelompok(s, 'halaqah'), namaKelompok(s, 'ekskul'), STATUS_SANTRI[s.status]?.n || s.status, kurangWajib(s).join(', ')])
  const ws = XLSX.utils.aoa_to_sheet([kolom, ...data])
  ws['!cols'] = kolom.map((k, i) => ({ wch: Math.min(36, Math.max(k.length, ...data.map((r) => String(r[i]).length)) + 2) }))
  // NIS, NISN, NIK, Nomor KK, RT, RW, dan HP disimpan sebagai teks agar angka 0 di depan tidak hilang
  for (const r of Object.keys(ws)) if (!r.startsWith('!') && ws[r].t === 's') ws[r].z = '@'
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data santri')
  const petunjuk = XLSX.utils.aoa_to_sheet([['Ekspor Data Santri SIMKA PRO (susunan templat impor v1.1)'], [''],
    ['1. Lengkapi sel yang kosong, terutama kolom bertanda * (NIS, NISN, nama, tempat dan tanggal lahir).'],
    ['2. Jangan mengubah NIS: NIS dipakai untuk mencocokkan santri saat diimpor kembali.'],
    ['3. Simpan, lalu impor di Data Santri → Impor Excel. Sel kosong tidak menghapus data lama.'],
    ['4. Kolom berawalan "Info:" hanya keterangan dan tidak diimpor. Status dan kelompok diubah di aplikasi.']])
  petunjuk['!cols'] = [{ wch: 110 }]; XLSX.utils.book_append_sheet(wb, petunjuk, 'Petunjuk')
  XLSX.writeFile(wb, `Data-Santri-${formatPendek(new Date()).replace(/\//g, '-')}.xlsx`)
}

// ---------- Cetak ----------
const kop = computed(() => (jenjang.value === 'semua' ? 'pondok' : jenjang.value))
const judulCetak = computed(() => {
  const bagian = [jenjang.value !== 'semua' && JENJANG[jenjang.value], tingkat.value && `Kelas ${tingkat.value}`, jk.value && (jk.value === 'L' ? 'Putra' : 'Putri')].filter(Boolean)
  return `Daftar Santri${bagian.length ? ' ' + bagian.join(' ') : ''}`
})
async function siapkanCetak() {
  pimpinan.value = jenjang.value === 'semua' ? await ambilPenandaTangan('Direktur') : await penandaJenjang(jenjang.value)
}
async function bukaPratinjau() { await siapkanCetak(); opsiCetak.value = false; pratinjau.value = true }
async function cetakSekarang() { await siapkanCetak(); opsiCetak.value = false; setTimeout(() => window.print(), 300) }
</script>
<template>
  <div>
    <div class="layar-saja">
      <!-- Kepala halaman desktop -->
      <div class="mb-5 hidden items-center gap-3 lg:flex">
        <span class="w-santri chip-ikon h-12 w-12"><PhStudent :size="28" weight="duotone" /></span>
        <div class="flex-1">
          <h2 class="text-lg font-bold">Data Santri</h2>
          <p class="text-sm text-teks3">{{ tampil.length }} santri tampil sesuai saringan.</p>
        </div>
        <router-link v-if="bolehUbah" to="/santri/baru" class="tombol-utama"><PhUserPlus :size="20" weight="duotone" /> Tambah santri</router-link>
      </div>

      <!-- Kartu statistik langsung -->
      <div class="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-6">
        <KartuStatistik v-for="k in statistik" :key="k.judul" class="w-[46%] shrink-0 snap-start sm:w-auto" :judul="k.judul" :nilai="san.memuat && !san.daftar.length ? '…' : k.nilai" :ikon="k.ikon" :warna="k.warna" :keterangan="k.ket"
          :class="k.saring && 'cursor-pointer'" @click="k.saring && (lengkap = lengkap === 'kurang' ? '' : 'kurang')" />
      </div>

      <!-- Aksi -->
      <div class="-mx-4 mb-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <router-link v-if="bolehImpor" to="/santri/impor" class="w-gaji tombol-garis shrink-0 px-4 text-sm"><PhFileXls :size="20" weight="duotone" style="color: var(--c)" /> Impor Excel</router-link>
        <button class="w-santri tombol-garis shrink-0 px-4 text-sm" @click="eksporExcel"><PhDownloadSimple :size="20" weight="duotone" style="color: var(--c)" /> Ekspor Excel</button>
        <button class="w-pengajuan tombol-garis shrink-0 px-4 text-sm" @click="bukaPratinjau"><PhEye :size="20" weight="duotone" style="color: var(--c)" /> Pratinjau cetak</button>
        <button class="w-tatausaha tombol-garis shrink-0 px-4 text-sm" @click="opsiCetak = true"><PhSlidersHorizontal :size="20" weight="duotone" style="color: var(--c)" /> Atur dan cetak</button>
      </div>

      <!-- Pencarian dan saringan -->
      <div class="flex flex-wrap gap-2">
        <div class="relative min-w-[220px] flex-1">
          <PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" type="search" class="isian pl-11" placeholder="Cari nama, NIS, NISN, atau nama orang tua" aria-label="Cari santri" />
        </div>
        <select v-model="status" class="isian w-auto" aria-label="Saring status">
          <option value="semua">Semua status</option><option v-for="(s, k) in STATUS_SANTRI" :key="k" :value="k">{{ s.n }}</option>
        </select>
        <select v-model="tingkat" class="isian w-auto" aria-label="Saring kelas">
          <option value="">Semua kelas</option><option v-for="t in tingkatPilihan" :key="t" :value="t">Kelas {{ t }}</option>
        </select>
        <select v-model="lengkap" class="isian w-auto" aria-label="Saring kelengkapan data">
          <option value="">Semua kelengkapan</option><option value="kurang">Data wajib kurang</option><option value="lengkap">Data wajib lengkap</option>
        </select>
        <select v-model="jk" class="isian w-auto" aria-label="Saring jenis kelamin">
          <option value="">Putra dan putri</option><option value="L">Putra</option><option value="P">Putri</option>
        </select>
      </div>
      <div class="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <button v-for="j in [{ k: 'semua', n: 'Semua jenjang' }, { k: 'wustha', n: 'Kesetaraan Wustha' }, { k: 'sma', n: 'SMA' }]" :key="j.k" :aria-pressed="jenjang === j.k"
          :class="['min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-semibold transition',
                   jenjang === j.k ? 'border-transparent bg-[#0B7F81] text-white dark:bg-[#4FD1D3] dark:text-[#06292A]' : 'border-garis bg-permukaan text-teks2 hover:text-teks']" @click="pilihJenjang(j.k)">{{ j.n }}</button>
      </div>

      <p v-if="san.galat" class="mt-4 rounded-xl bg-[#C7332F]/10 p-3 text-sm font-semibold text-merah">{{ san.galat }}</p>

      <!-- Tabel desktop -->
      <div class="kartu mt-4 hidden overflow-x-auto lg:block">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-garis bg-permukaan2 text-teks2">
            <tr><th class="px-4 py-3 font-bold">NIS</th><th class="px-4 py-3 font-bold">Nama</th><th class="px-4 py-3 font-bold">L/P</th><th class="px-4 py-3 font-bold">Kelas</th>
              <th class="px-4 py-3 font-bold">Kamar · halaqah</th><th class="px-4 py-3 font-bold">Angkatan</th><th class="px-4 py-3 font-bold">Orang tua/wali utama</th><th class="px-4 py-3 font-bold">Status</th><th class="w-10" /></tr>
          </thead>
          <tbody class="divide-y divide-garis">
            <tr v-for="s in tampil" :key="s.id" class="cursor-pointer hover:bg-permukaan2" @click="router.push(`/santri/${s.id}`)">
              <td class="px-4 py-3 tabular-nums text-teks2">{{ s.nis }}</td>
              <td class="px-4 py-3 font-semibold text-teks"><router-link :to="`/santri/${s.id}`" class="hover:underline" @click.stop>{{ s.nama_lengkap }}</router-link></td>
              <td class="px-4 py-3 text-teks2">{{ s.jenis_kelamin }}</td>
              <td class="px-4 py-3 text-teks2">{{ labelRombel(s) }}</td>
              <td class="px-4 py-3 text-teks2">{{ [namaKelompok(s, 'kamar'), namaKelompok(s, 'halaqah')].filter(Boolean).join(' · ') || '–' }}</td>
              <td class="px-4 py-3 tabular-nums text-teks2">{{ s.angkatan }} ({{ s.tahun_masuk }})</td>
              <td class="px-4 py-3 text-teks2">{{ kontakUtama(s) ? `${kontakUtama(s).nama || '–'} (${HUBUNGAN[kontakUtama(s).hubungan]})` : '–' }}</td>
              <td class="px-4 py-3"><span :class="['lencana', 'w-' + STATUS_SANTRI[s.status]?.w]">{{ STATUS_SANTRI[s.status]?.n }}</span>
                <span v-if="kurangWajib(s).length" class="lencana w-klinik ml-1" :title="'Kurang: ' + kurangWajib(s).join(', ')">Data kurang</span></td>
              <td class="pr-3"><PhCaretRight :size="18" class="text-teks3" /></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!tampil.length && !san.memuat" class="py-10 text-center text-sm text-teks3">{{ san.daftar.length ? 'Tidak ada santri yang cocok dengan saringan.' : 'Belum ada data santri. Tambahkan satu per satu atau impor dari Excel.' }}</p>
      </div>

      <!-- Kartu mobile -->
      <ul class="mt-4 space-y-2.5 lg:hidden">
        <li v-for="s in tampil" :key="s.id">
          <router-link :to="`/santri/${s.id}`" class="kartu flex items-center gap-3 p-3.5 active:bg-permukaan2">
            <span :class="['chip-ikon h-11 w-11 text-sm font-extrabold', s.jenis_kelamin === 'P' ? 'w-klinik' : 'w-santri']">{{ inisial(s.nama_lengkap) }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-bold">{{ s.nama_lengkap }}</span>
              <span class="block truncate text-sm text-teks3">{{ s.nis }} · {{ labelRombel(s) }}{{ namaKelompok(s, 'kamar') ? ' · ' + namaKelompok(s, 'kamar') : '' }}</span>
              <span v-if="s.status !== 'aktif'" :class="['lencana mt-1', 'w-' + STATUS_SANTRI[s.status]?.w]">{{ STATUS_SANTRI[s.status]?.n }}</span>
              <span v-if="kurangWajib(s).length" class="lencana w-klinik mt-1">Kurang: {{ kurangWajib(s).join(', ') }}</span>
            </span>
            <PhCaretRight :size="20" class="text-teks3" />
          </router-link>
        </li>
        <li v-if="!tampil.length && !san.memuat" class="py-10 text-center text-sm text-teks3">{{ san.daftar.length ? 'Tidak ada santri yang cocok dengan saringan.' : 'Belum ada data santri.' }}</li>
      </ul>
    </div>

    <!-- Dokumen cetak -->
    <DokumenCetak :kop="kop" :judul="judulCetak" :subjudul="`Keadaan per ${formatPanjang(tglDok)}${status !== 'semua' ? ' · Status ' + STATUS_SANTRI[status].n.toLowerCase() : ''}`"
      v-model:pratinjau="pratinjau" :pencetak="sesi.pengguna?.nama_lengkap" mendatar>
      <table class="tabel">
        <colgroup><col style="width:4%"><col style="width:9%"><col style="width:26%"><col style="width:4%"><col style="width:20%">
          <col style="width:9%"><col style="width:16%"><col style="width:12%"></colgroup>
        <thead><tr><th>No.</th><th>NIS</th><th>Nama</th><th>L/P</th><th>Tempat, tanggal lahir</th><th>Kelas</th><th>Orang tua/wali</th><th>Nomor HP</th></tr></thead>
        <tbody>
          <tr v-for="(s, i) in tampil" :key="s.id">
            <td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ s.nis || s.nisn || '–' }}</td><td>{{ s.nama_lengkap }}</td>
            <td class="tengah">{{ s.jenis_kelamin }}</td><td>{{ [s.tempat_lahir, s.tanggal_lahir && formatPendek(s.tanggal_lahir)].filter(Boolean).join(', ') || '–' }}</td>
            <td class="tengah">{{ labelRombel(s).replace('Kelas ', '') }}</td><td>{{ kontakUtama(s)?.nama || '–' }}</td><td class="tengah">{{ kontakUtama(s)?.no_hp || '–' }}</td>
          </tr>
        </tbody>
      </table>
      <template #ttd>
        <TandaTangan :tanggal="tglDok" :kiri="{ pengantar: 'Mengetahui,', jabatan: pimpinan.jabatan, nama: pimpinan.nama, niy: pimpinan.niy }"
          :kanan="{ jabatan: sesi.isSuperadmin ? 'Pengelola Sistem' : 'Petugas Data Santri', nama: sesi.pengguna?.nama_lengkap, niy: sesi.pengguna?.niy }" />
      </template>
    </DokumenCetak>

    <TombolAksi v-if="bolehUbah" label="Tambah" :ikon="PhUserPlus" warna="santri" @klik="router.push('/santri/baru')" />
    <LembarBawah v-model="opsiCetak" judul="Atur dokumen cetak">
      <div class="space-y-4 pb-2">
        <InputTanggal v-model="tglDok" label="Tanggal dokumen" wajib />
        <p class="text-sm text-teks2">Kop mengikuti jenjang yang dipilih: {{ jenjang === 'semua' ? 'Kop Pondok' : jenjang === 'sma' ? 'Kop SMA' : 'Kop Kesetaraan Wustha' }}. Penanda tangan kiri: {{ jenjang === 'semua' ? 'Direktur' : 'kepala jenjang' }}.</p>
        <p class="text-sm text-teks3">{{ tampil.length }} santri akan dicetak sesuai saringan saat ini (kertas F4 mendatar).</p>
        <div class="grid grid-cols-2 gap-2">
          <button class="tombol-garis" @click="bukaPratinjau"><PhEye :size="20" weight="duotone" /> Pratinjau</button>
          <button class="tombol-utama" @click="cetakSekarang"><PhPrinter :size="20" weight="duotone" /> Cetak</button>
        </div>
      </div>
    </LembarBawah>
  </div>
</template>
