<!-- SIMKA PRO | src/pages/laporan/TabDokumenResmi.vue | v1.1 | Fase 8 – Tahap 5 buka versi resmi laporan, status ditolak | 10/10/2026 -->
<script setup>
// Registri dokumen resmi bertanda tangan elektronik: kode validasi, jenis, nomor, perihal, atas nama, penanda tangan,
// status, dan berapa kali diperiksa. Admin/superadmin melihat semua; pegawai melihat dokumen yang diterbitkan atau
// ditandatanganinya. Superadmin dapat mencabut dokumen (alasan wajib). Ekspor Excel dan cetak F4 mendatar.
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { PhSealCheck, PhSealWarning, PhFileText, PhMagnifyingGlass, PhArrowSquareOut, PhFileXls, PhPrinter, PhProhibit, PhQrCode, PhEye } from '@phosphor-icons/vue'
import { useDokumen } from '@/stores/dokumen'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { STATUS_DOKUMEN, JENIS_DOKUMEN, svgQR, alamatCek } from '@/lib/dokumen'
import { formatPendek, formatWaktu, formatPanjang, hariIniISO } from '@/lib/tanggal'
import { ambilPenandaTangan } from '@/lib/penandatangan'
import KartuStatistik from '@/components/KartuStatistik.vue'
import InputTanggal from '@/components/InputTanggal.vue'
import LembarBawah from '@/components/LembarBawah.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'

const dok = useDokumen(); const sesi = useSesi(); const ui = useUI(); const router = useRouter()
const awalBulan = () => hariIniISO().slice(0, 8) + '01'
const mulai = ref(awalBulan()); const selesai = ref(hariIniISO()); const jenis = ref(''); const status = ref(''); const cari = ref('')
const muat = () => dok.muat({ mulai: mulai.value, selesai: selesai.value, jenis: jenis.value, status: status.value }).catch((e) => ui.toast(e.message, 'galat'))
onMounted(muat)

const tampil = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return dok.daftar.filter((d) => !q || [d.kode, d.nomor, d.perihal, d.subjek, d.jenis_nama].join(' ').toLowerCase().includes(q))
})
const statistik = computed(() => {
  const d = dok.daftar
  return [
    { judul: 'Dokumen terbit', nilai: d.length, ikon: PhFileText, warna: 'laporan', ket: 'Pada periode terpilih' },
    { judul: 'Sah', nilai: d.filter((x) => x.status === 'sah').length, ikon: PhSealCheck, warna: 'presensi', ket: 'Berlaku' },
    { judul: 'Dicabut', nilai: d.filter((x) => x.status === 'dicabut').length, ikon: PhProhibit, warna: 'beranda', ket: 'Tidak berlaku lagi' },
    { judul: 'Diperiksa publik', nilai: d.reduce((n, x) => n + (x.jumlah_cek || 0), 0), ikon: PhMagnifyingGlass, warna: 'verifikasi', ket: 'Kali kode dicek' },
  ]
})
const ttdRingkas = (d) => (d.penanda || []).filter((p) => p.status === 'ditandatangani' && p.jabatan !== 'Pemohon').map((p) => p.nama).join('; ') || '–'

// ---------- Rincian & cabut ----------
const pilih = ref(null); const lembar = ref(false); const alasan = ref(''); const proses = ref(false)
function buka(d) { pilih.value = d; alasan.value = ''; lembar.value = true }
const bolehCabut = computed(() => sesi.isSuperadmin && pilih.value?.status !== 'dicabut' && pilih.value?.ref_tabel !== 'leave_requests')
async function cabut() {
  if (alasan.value.trim().length < 5) { ui.toast('Tuliskan alasan pencabutan (paling sedikit 5 karakter).', 'galat'); return }
  if (!(await ui.konfirmasi({ judul: 'Cabut dokumen?', pesan: `Dokumen ${pilih.value.kode} akan berstatus Dicabut di halaman Cek Keabsahan. Tindakan ini tidak dapat dibatalkan.`, ya: 'Cabut dokumen', bahaya: true }))) return
  proses.value = true
  try { await dok.cabut(pilih.value.id, alasan.value.trim()); ui.toast('Dokumen dicabut.'); lembar.value = false } catch (e) { ui.toast(e.message, 'galat') } finally { proses.value = false }
}

// ---------- Excel & cetak ----------
async function excel() {
  const XLSX = await import('xlsx')
  const judul = [['REGISTRI DOKUMEN RESMI SIMKA PRO'], [`Periode ${formatPanjang(mulai.value)} s.d. ${formatPanjang(selesai.value)}`], []]
  const kepala = ['No', 'Kode validasi', 'Jenis dokumen', 'Nomor', 'Perihal', 'Atas nama', 'Penanda tangan', 'Diterbitkan', 'Status', 'Keterangan', 'Diperiksa (kali)']
  const isi = tampil.value.map((d, i) => [i + 1, d.kode, d.jenis_nama, d.nomor || '', d.perihal || '', d.subjek || '', ttdRingkas(d), formatWaktu(d.diterbitkan_pada),
    STATUS_DOKUMEN[d.status]?.n || d.status, d.alasan_cabut || '', d.jumlah_cek || 0])
  const ws = XLSX.utils.aoa_to_sheet([...judul, kepala, ...isi])
  ws['!cols'] = [5, 12, 26, 28, 40, 30, 40, 18, 10, 26, 10].map((w) => ({ wch: w }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Registri dokumen')
  XLSX.writeFile(wb, `Registri-Dokumen-${mulai.value}-sd-${selesai.value}.xlsx`)
}
const pratinjau = ref(false); const penanda = ref({ jabatan: 'Direktur', nama: '', niy: '' })
async function cetak() { penanda.value = await ambilPenandaTangan('Direktur').catch(() => penanda.value); pratinjau.value = true }
</script>
<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KartuStatistik v-for="s in statistik" :key="s.judul" v-bind="s" />
    </div>

    <section class="kartu space-y-3 p-4">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
        <InputTanggal v-model="mulai" label="Dari tanggal" />
        <InputTanggal v-model="selesai" label="Sampai tanggal" />
        <label class="block"><span class="label-isian">Jenis dokumen</span>
          <select v-model="jenis" class="isian"><option value="">Semua jenis</option><option v-for="(n, k) in JENIS_DOKUMEN" :key="k" :value="k">{{ n }}</option></select></label>
        <label class="block"><span class="label-isian">Status</span>
          <select v-model="status" class="isian"><option value="">Semua status</option><option v-for="(s, k) in STATUS_DOKUMEN" :key="k" :value="k">{{ s.n }}</option></select></label>
        <button type="button" class="tombol-utama" @click="muat"><PhMagnifyingGlass :size="20" weight="bold" /> Tampilkan</button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="relative min-w-[14rem] flex-1"><span class="sr-only">Cari dokumen</span>
          <PhMagnifyingGlass :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" class="isian pl-10" placeholder="Cari kode, nomor, perihal, atau nama" /></label>
        <router-link to="/cek" target="_blank" class="tombol-garis"><PhArrowSquareOut :size="18" /> Halaman Cek Keabsahan</router-link>
        <button type="button" class="tombol-garis" :disabled="!tampil.length" @click="excel"><PhFileXls :size="18" weight="duotone" /> Excel</button>
        <button type="button" class="tombol-garis" :disabled="!tampil.length" @click="cetak"><PhPrinter :size="18" weight="duotone" /> Cetak</button>
      </div>
    </section>

    <p v-if="dok.memuat" class="py-8 text-center text-teks3">Memuat registri…</p>
    <p v-else-if="!tampil.length" class="kartu p-8 text-center text-teks3">Belum ada dokumen resmi pada periode ini.</p>
    <!-- HP: kartu; desktop: tabel -->
    <ul v-else class="space-y-2 lg:hidden">
      <li v-for="d in tampil" :key="d.id">
        <button type="button" class="kartu flex w-full items-start gap-3 p-3.5 text-left" @click="buka(d)">
          <span :class="['chip-ikon h-10 w-10 shrink-0', 'w-' + (STATUS_DOKUMEN[d.status]?.w || 'laporan')]"><component :is="d.status === 'sah' ? PhSealCheck : PhSealWarning" :size="22" weight="duotone" /></span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2"><span class="font-mono text-sm font-bold tracking-wider">{{ d.kode }}</span>
              <span :class="['lencana', 'w-' + (STATUS_DOKUMEN[d.status]?.w || 'laporan')]">{{ STATUS_DOKUMEN[d.status]?.n }}</span></span>
            <span class="mt-0.5 block font-semibold">{{ d.jenis_nama }}</span>
            <span class="block truncate text-sm text-teks2">{{ d.subjek }} · {{ d.perihal }}</span>
            <span class="block text-xs text-teks3">{{ formatPendek(d.diterbitkan_pada) }}{{ d.nomor ? ' · ' + d.nomor : '' }}</span>
          </span>
        </button>
      </li>
    </ul>
    <div v-if="!dok.memuat && tampil.length" class="kartu hidden overflow-x-auto lg:block">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-garis text-left [&>th]:p-3"><th class="w-28">Kode</th><th>Dokumen</th><th>Atas nama</th><th>Penanda tangan</th><th class="w-28">Terbit</th><th class="w-24">Status</th><th class="w-16 text-right">Dicek</th></tr></thead>
        <tbody>
          <tr v-for="d in tampil" :key="d.id" class="cursor-pointer border-b border-garis last:border-0 hover:bg-permukaan2 [&>td]:p-3" @click="buka(d)">
            <td class="font-mono font-bold tracking-wider">{{ d.kode }}</td>
            <td><span class="block font-semibold">{{ d.jenis_nama }}</span><span class="block text-xs text-teks3">{{ d.nomor || '–' }} · {{ d.perihal }}</span></td>
            <td>{{ d.subjek }}</td>
            <td class="text-xs">{{ ttdRingkas(d) }}</td>
            <td class="text-xs">{{ formatWaktu(d.diterbitkan_pada) }}</td>
            <td><span :class="['lencana', 'w-' + (STATUS_DOKUMEN[d.status]?.w || 'laporan')]">{{ STATUS_DOKUMEN[d.status]?.n }}</span></td>
            <td class="text-right tabular-nums">{{ d.jumlah_cek || 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <LembarBawah v-model="lembar" :judul="pilih ? 'Dokumen ' + pilih.kode : 'Dokumen'">
      <div v-if="pilih" class="space-y-4 px-5 pb-2">
        <div class="flex items-start gap-4">
          <span class="qr-layar h-24 w-24 shrink-0 rounded-xl bg-white p-1.5" v-html="svgQR(alamatCek(pilih.kode))" aria-label="Kode QR cek keabsahan" />
          <div class="min-w-0 text-sm">
            <p class="font-bold">{{ pilih.jenis_nama }}</p>
            <p class="text-teks2">{{ pilih.perihal }}</p>
            <p class="mt-1"><span :class="['lencana', 'w-' + (STATUS_DOKUMEN[pilih.status]?.w || 'laporan')]">{{ STATUS_DOKUMEN[pilih.status]?.n }}</span></p>
          </div>
        </div>
        <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt class="text-teks3">Nomor</dt><dd>{{ pilih.nomor || '–' }}</dd>
          <dt class="text-teks3">Atas nama</dt><dd>{{ pilih.subjek }}</dd>
          <dt class="text-teks3">Diterbitkan</dt><dd>{{ formatWaktu(pilih.diterbitkan_pada) }} WITA</dd>
          <dt class="text-teks3">Diperiksa</dt><dd>{{ pilih.jumlah_cek || 0 }} kali{{ pilih.terakhir_dicek ? ', terakhir ' + formatWaktu(pilih.terakhir_dicek) + ' WITA' : '' }}</dd>
          <template v-if="pilih.status === 'dicabut'"><dt class="text-teks3">Dicabut</dt><dd>{{ formatWaktu(pilih.dicabut_pada) }} WITA · {{ pilih.alasan_cabut }}</dd></template>
        </dl>
        <div>
          <p class="mb-1.5 text-sm font-bold">Penanda tangan</p>
          <ul class="space-y-1.5">
            <li v-for="(p, i) in pilih.penanda" :key="i" class="rounded-xl bg-permukaan2 px-3 py-2 text-sm">
              <span class="block font-semibold">{{ p.nama }}</span><span class="block text-xs text-teks3">{{ p.jabatan }} · {{ p.waktu ? formatWaktu(p.waktu) + ' WITA' : 'menunggu' }}</span></li>
          </ul>
        </div>
        <button v-if="pilih.tautan" type="button" class="tombol-utama w-full justify-center" @click="router.push(`${pilih.tautan}?resmi=${pilih.id}`)"><PhEye :size="18" weight="duotone" /> Buka dokumen</button>
        <router-link :to="`/cek/${pilih.kode.replace('-', '')}`" target="_blank" class="tombol-garis w-full justify-center"><PhQrCode :size="18" /> Buka di halaman Cek Keabsahan</router-link>
        <div v-if="bolehCabut" class="space-y-2 rounded-2xl border border-garis p-3">
          <label class="block"><span class="label-isian">Alasan pencabutan</span>
            <textarea v-model="alasan" rows="2" class="isian" placeholder="Contoh: terdapat kesalahan data, diganti surat baru" /></label>
          <button type="button" class="tombol-utama w-full justify-center" :disabled="proses" @click="cabut"><PhProhibit :size="18" /> Cabut dokumen</button>
        </div>
        <p v-else-if="sesi.isSuperadmin && pilih.ref_tabel === 'leave_requests' && pilih.status !== 'dicabut'" class="text-xs text-teks3">
          Surat pengajuan dicabut dengan membatalkan pengajuannya di menu Pengajuan.</p>
      </div>
    </LembarBawah>

    <DokumenCetak v-model:pratinjau="pratinjau" kop="pondok" judul="Registri Dokumen Resmi" mendatar
      :subjudul="`Periode ${formatPanjang(mulai)} s.d. ${formatPanjang(selesai)}`" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="tabel kecil">
        <colgroup><col style="width:4%"><col style="width:9%"><col style="width:14%"><col style="width:15%"><col style="width:20%"><col style="width:14%"><col style="width:13%"><col style="width:6%"><col style="width:5%"></colgroup>
        <thead><tr><th>No.</th><th>Kode validasi</th><th>Jenis dokumen</th><th>Nomor</th><th>Perihal</th><th>Atas nama</th><th>Penanda tangan</th><th>Terbit</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="(d, i) in tampil" :key="d.id">
            <td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ d.kode }}</td><td>{{ d.jenis_nama }}</td><td>{{ d.nomor || '–' }}</td>
            <td>{{ d.perihal }}</td><td>{{ d.subjek }}</td><td>{{ ttdRingkas(d) }}</td><td class="tengah">{{ formatPendek(d.diterbitkan_pada) }}</td>
            <td class="tengah">{{ STATUS_DOKUMEN[d.status]?.n }}</td>
          </tr>
        </tbody>
      </table>
      <template #ttd>
        <TandaTangan :kiri="{ jabatan: penanda.jabatan || 'Direktur', nama: penanda.nama, niy: penanda.niy }"
                     :kanan="{ jabatan: 'Pencetak', nama: sesi.pengguna?.nama_lengkap, niy: sesi.pengguna?.niy }" />
      </template>
    </DokumenCetak>
  </div>
</template>
<style scoped>
.qr-layar :deep(svg) { width: 100%; height: 100%; display: block; }
</style>
