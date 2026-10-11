<!-- SIMKA PRO | src/pages/laporan/TabKehadiranPegawai.vue | v1.2 | Fase 8 – Tahap 5 Terbitkan resmi (salinan beku, tanda tangan elektronik) | 10/10/2026 -->
<script setup>
// Laporan kehadiran pegawai (menu Rekap → Kehadiran pegawai).
// Jenis: rekap ringkas, rekap matriks (nama × tanggal, F4 mendatar), laporan individu, daftar perhatian.
// Cakupan (admin dan pimpinan): semua pegawai, bidang/unit beserta cabangnya, jabatan fungsional, atau individu.
// Pegawai lain hanya melihat laporan dirinya. Hak cakupan diperiksa server. Periode: hari ini, pekan, bulan,
// bulan lalu, semester, atau rentang bebas (paling lama 186 hari). Keluaran: layar, Excel, dan cetak F4.
// v1.2: Terbitkan resmi (PanelResmi): salinan beku + permintaan tanda tangan pimpinan; versi resmi dibuka lewat ?resmi=id.
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhUsersThree, PhChartPieSlice, PhWarningCircle, PhUserMinus, PhMagnifyingGlass, PhFileXls, PhPrinter, PhInfo, PhListBullets, PhGridNine, PhUser, PhFlag } from '@phosphor-icons/vue'
import { useLaporanKehadiran } from '@/stores/laporanKehadiran'
import { usePegawai } from '@/stores/pegawai'
import { useOrganisasi } from '@/stores/organisasi'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { STATUS_HADIR, JENIS_LAPORAN, PERIODE_CEPAT, periodeCepat, daftarTanggal, hariSingkat, keteranganPegawai, susunMatriks, persenTeks } from '@/lib/laporanKehadiran'
import { formatPanjang, formatPendek, formatJam, formatHari } from '@/lib/tanggal'
import { ambilPenandaTangan } from '@/lib/penandatangan'
import { STATUS_PEGAWAI } from '@/lib/kepegawaian'
import KartuStatistik from '@/components/KartuStatistik.vue'
import InputTanggal from '@/components/InputTanggal.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TtdResmi from '@/components/cetak/TtdResmi.vue'
import PanelResmi from '@/components/PanelResmi.vue'
import { useDokumenResmi } from '@/stores/dokumenResmi'

const lk = useLaporanKehadiran(); const peg = usePegawai(); const org = useOrganisasi(); const sesi = useSesi(); const ui = useUI()
const route = useRoute(); const router = useRouter(); const dr = useDokumenResmi()
const resmi = ref(null) // versi resmi (salinan beku) yang sedang ditampilkan
const pemantau = computed(() => sesi.isAdmin || sesi.pimpinanTinggi)
const JENIS = computed(() => (pemantau.value ? ['ringkas', 'matriks', 'individu', 'perhatian'] : ['individu']))
const IKON_JENIS = { ringkas: PhListBullets, matriks: PhGridNine, individu: PhUser, perhatian: PhFlag }

const jenis = ref(pemantau.value ? 'ringkas' : 'individu')
const cakupan = ref('semua'); const nilai = ref('')
const awal = periodeCepat('bulan'); const mulai = ref(awal.mulai); const selesai = ref(awal.selesai); const cepat = ref('bulan')
const ambang = ref(80); const cari = ref('')

onMounted(async () => {
  if (pemantau.value) { await Promise.all([org.muat(), peg.daftar.length ? null : peg.muat()]) }
  if (route.query.resmi) { try { terapkanResmi(await dr.ambil(String(route.query.resmi))); return } catch (e) { ui.toast(e.message, 'galat') } }
  muat()
})
function pilihCepat(k) { cepat.value = k; const p = periodeCepat(k); mulai.value = p.mulai; selesai.value = p.selesai }
watch([mulai, selesai], () => { const p = periodeCepat(cepat.value); if (p.mulai !== mulai.value || p.selesai !== selesai.value) cepat.value = '' })
watch(jenis, (j) => { if (resmi.value) return; if (j === 'individu' && pemantau.value && cakupan.value !== 'individu') { cakupan.value = 'individu'; nilai.value = '' } })
watch(cakupan, () => { if (!resmi.value) nilai.value = '' })

const pegawaiPilihan = computed(() => peg.daftar.filter((p) => p.status_akun === 'aktif' && p.peran !== 'superadmin'))
const unitPilihan = computed(() => org.datar)
const cakupanEfektif = computed(() => (!pemantau.value ? 'saya' : jenis.value === 'individu' ? 'individu' : cakupan.value))
const namaCakupan = computed(() => {
  if (resmi.value) return resmi.value.isi?.param?.namaCakupan || '–'
  const c = cakupanEfektif.value
  if (c === 'saya') return sesi.pengguna?.nama_lengkap
  if (c === 'semua') return 'Seluruh pegawai'
  if (c === 'bidang') return org.cariUnit(nilai.value)?.nama || '–'
  if (c === 'fungsional') return 'Jabatan ' + (org.fungsional.find((f) => f.id === nilai.value)?.nama || '–')
  return peg.cari(nilai.value)?.nama_lengkap || '–'
})

async function muat() {
  if (resmi.value) return
  if (selesai.value < mulai.value) { ui.toast('Tanggal akhir tidak boleh sebelum tanggal mulai.', 'galat'); return }
  if (['bidang', 'fungsional', 'individu'].includes(cakupanEfektif.value) && !nilai.value) { lk.data = null; return }
  try {
    await lk.muat({ mulai: mulai.value, selesai: selesai.value, cakupan: cakupanEfektif.value, nilai: nilai.value || null, rinci: ['matriks', 'individu'].includes(jenis.value) })
  } catch (e) { ui.toast(e.message, 'galat') }
}
watch([jenis, cakupan, nilai], muat)

const pegawai = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return (lk.data?.pegawai || []).filter((p) => !q || [p.nama, p.niy, p.unit, p.jabatan].join(' ').toLowerCase().includes(q))
})
const perhatian = computed(() => pegawai.value.filter((p) => p.sesi_wajib > 0 && (p.persen ?? 0) < Number(ambang.value)).sort((a, b) => (a.persen ?? 0) - (b.persen ?? 0)))
const tampilBaris = computed(() => (jenis.value === 'perhatian' ? perhatian.value : pegawai.value))
const statistik = computed(() => {
  const d = pegawai.value.filter((p) => p.sesi_wajib > 0); const rata = d.length ? d.reduce((n, p) => n + (p.persen || 0), 0) / d.length : null
  return [
    { judul: 'Pegawai', nilai: pegawai.value.length, ikon: PhUsersThree, warna: 'pegawai', keterangan: namaCakupan.value },
    { judul: 'Rata-rata kehadiran', nilai: rata == null ? '–' : rata.toFixed(1).replace('.', ','), satuan: rata == null ? '' : '%', ikon: PhChartPieSlice, warna: 'presensi', keterangan: 'Hadir + terlambat + dinas luar' },
    { judul: `Di bawah ${ambang.value}%`, nilai: perhatian.value.length, ikon: PhWarningCircle, warna: 'klinik', keterangan: 'Perlu pembinaan' },
    { judul: 'Sesi tanpa keterangan', nilai: pegawai.value.reduce((n, p) => n + (p.tanpa_keterangan || 0), 0), ikon: PhUserMinus, warna: 'beranda', keterangan: 'Termasuk tidak presensi' },
  ]
})

// ---------- Matriks dan individu ----------
const tanggal = computed(() => (lk.data ? daftarTanggal(lk.data.mulai, lk.data.selesai) : []))
const matriks = computed(() => susunMatriks(lk.data?.rinci))
const individu = computed(() => pegawai.value[0] || null)
const rinciIndividu = computed(() => (lk.data?.rinci || []).filter((r) => r.employee_id === individu.value?.employee_id))
const statusPeg = (v) => STATUS_PEGAWAI[v] || v || '–'
const jam = (v) => (v ? formatJam(v) : '–')
const jadwal = (r) => `${formatJam(r.mulai)}–${formatJam(r.selesai)}`

// ---------- Excel ----------
async function excel() {
  const XLSX = await import('xlsx'); const per = `Periode ${formatPanjang(lk.data.mulai)} s.d. ${formatPanjang(lk.data.selesai)}`
  let judul; let kepala; let isi; let lebar
  if (jenis.value === 'matriks') {
    judul = 'REKAP MATRIKS KEHADIRAN PEGAWAI'
    kepala = ['No', 'NIY', 'Nama', ...tanggal.value.map((t) => t.slice(8, 10)), 'H', 'T', 'DL', 'I', 'S', 'C', 'A', 'Persentase']
    isi = pegawai.value.map((p, i) => [i + 1, p.niy || '', p.nama, ...tanggal.value.map((t) => STATUS_HADIR[matriks.value[p.employee_id]?.[t]]?.s || ''),
      p.hadir, p.terlambat, p.dinas_luar, p.izin, p.sakit, p.cuti, p.tanpa_keterangan, persenTeks(p.persen)])
    lebar = [5, 16, 30, ...tanggal.value.map(() => 4), 5, 5, 5, 5, 5, 5, 5, 11]
  } else if (jenis.value === 'individu') {
    judul = 'LAPORAN KEHADIRAN PEGAWAI'
    kepala = ['No', 'Tanggal', 'Hari', 'Sesi', 'Jadwal', 'Datang', 'Pulang', 'Titik', 'Status', 'Keterangan']
    isi = rinciIndividu.value.map((r, i) => [i + 1, formatPendek(r.tanggal), formatHari(r.tanggal).split(',')[0], r.nama_sesi, jadwal(r), jam(r.datang_pada), jam(r.pulang_pada), r.titik || '',
      (STATUS_HADIR[r.status]?.n || r.status) + (r.status === 'terlambat' ? ` ${r.terlambat_menit} menit` : ''), r.keterangan || ''])
    lebar = [5, 12, 9, 22, 13, 9, 9, 18, 20, 30]
  } else {
    judul = jenis.value === 'perhatian' ? `DAFTAR PERHATIAN KEHADIRAN PEGAWAI (DI BAWAH ${ambang.value}%)` : 'REKAP KEHADIRAN PEGAWAI'
    kepala = ['No', 'NIY', 'Nama', 'Status kepegawaian', 'Bidang/unit', 'Sesi wajib', 'Hadir', 'Terlambat', 'Dinas luar', 'Izin', 'Sakit', 'Cuti', 'Tanpa keterangan', 'Cepat pulang', 'Total kehadiran', 'Persentase', 'Keterangan']
    isi = tampilBaris.value.map((p, i) => [i + 1, p.niy || '', p.nama, statusPeg(p.status_kepegawaian), p.unit || '', p.sesi_wajib, p.hadir, p.terlambat, p.dinas_luar, p.izin, p.sakit, p.cuti,
      p.tanpa_keterangan, p.cepat_pulang, p.total_hadir, persenTeks(p.persen), keteranganPegawai(p)])
    lebar = [5, 16, 30, 16, 22, 9, 7, 9, 9, 6, 6, 6, 9, 9, 10, 11, 40]
  }
  const ws = XLSX.utils.aoa_to_sheet([[judul], [per], [`Cakupan: ${namaCakupan.value}`], [], kepala, ...isi])
  ws['!cols'] = lebar.map((w) => ({ wch: w }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, JENIS_LAPORAN[jenis.value].n.slice(0, 30))
  XLSX.writeFile(wb, `${JENIS_LAPORAN[jenis.value].n.replace(/\s+/g, '-')}-${namaCakupan.value.replace(/[^A-Za-z0-9]+/g, '-')}-${lk.data.mulai}-sd-${lk.data.selesai}.xlsx`)
}

// ---------- Cetak ----------
const pratinjau = ref(false); const penanda = ref({ jabatan: 'Direktur', nama: '', niy: '' })
const judulCetak = computed(() => ({ ringkas: 'Rekap Kehadiran Pegawai', matriks: 'Rekap Matriks Kehadiran Pegawai', individu: 'Laporan Kehadiran Pegawai', perhatian: 'Daftar Perhatian Kehadiran Pegawai' })[jenis.value])
const jabPenanda = computed(() => {
  const unitNama = cakupanEfektif.value === 'bidang' ? org.cariUnit(nilai.value)?.nama : null
  return unitNama && /^bidang\s/i.test(unitNama) ? 'Kepala ' + unitNama : 'Direktur'
})
async function cetak() {
  if (!resmi.value) penanda.value = await ambilPenandaTangan(jabPenanda.value).catch(() => penanda.value)
  pratinjau.value = true
}

// ---------- Terbitkan resmi ----------
const kunci = computed(() => (lk.data && !resmi.value
  ? ['kehadiran_pegawai', jenis.value, cakupanEfektif.value, cakupanEfektif.value === 'saya' ? sesi.pengguna?.id : nilai.value || '-', lk.data.mulai, lk.data.selesai, jenis.value === 'perhatian' ? ambang.value : ''].join('|')
  : ''))
const isiBeku = () => ({ versi: 1, param: { jenis: jenis.value, cakupan: cakupan.value, nilai: nilai.value, mulai: lk.data.mulai, selesai: lk.data.selesai, ambang: ambang.value, namaCakupan: namaCakupan.value }, data: lk.data })
function terapkanResmi(d) {
  const p = d.isi?.param; if (!p) return ui.toast('Salinan beku dokumen tidak dapat dibaca.', 'galat')
  resmi.value = d; cari.value = ''
  jenis.value = p.jenis; cakupan.value = p.cakupan; nilai.value = p.nilai; mulai.value = p.mulai; selesai.value = p.selesai; ambang.value = p.ambang ?? ambang.value
  lk.data = d.isi.data
  if (route.query.resmi !== d.id) router.replace({ query: { ...route.query, resmi: d.id } })
}
function tutupResmi() { resmi.value = null; const q = { ...route.query }; delete q.resmi; router.replace({ query: q }); muat() }
const periodeTeks = computed(() => (lk.data ? `${formatPendek(lk.data.mulai)} s.d. ${formatPendek(lk.data.selesai)}` : ''))
const kanan = computed(() => (jenis.value === 'individu' && individu.value
  ? { jabatan: 'Pegawai yang bersangkutan', nama: individu.value.nama, niy: individu.value.niy }
  : { jabatan: 'Pencetak', nama: sesi.pengguna?.nama_lengkap, niy: sesi.pengguna?.niy }))
const subjudul = computed(() => lk.data ? `Periode ${formatPanjang(lk.data.mulai)} s.d. ${formatPanjang(lk.data.selesai)} · ${namaCakupan.value}` : '')
</script>
<template>
  <div class="space-y-4">
    <!-- Saringan -->
    <fieldset :disabled="!!resmi" :class="['kartu min-w-0 space-y-4 p-4', resmi && 'opacity-60']">
      <div v-if="JENIS.length > 1" class="flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis laporan">
        <button v-for="k in JENIS" :key="k" type="button" role="radio" :aria-checked="jenis === k" @click="jenis = k"
          :class="['flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-semibold', jenis === k ? 'border-transparent bg-[#C7332F] text-white' : 'border-garis bg-permukaan text-teks2 hover:text-teks']">
          <component :is="IKON_JENIS[k]" :size="18" weight="duotone" /> {{ JENIS_LAPORAN[k].n }}</button>
      </div>
      <p class="flex items-center gap-1.5 text-sm text-teks2"><PhInfo :size="16" /> {{ JENIS_LAPORAN[jenis].ket }}.</p>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <template v-if="pemantau && jenis !== 'individu'">
          <label class="block"><span class="label-isian">Cakupan</span>
            <select v-model="cakupan" class="isian"><option value="semua">Semua pegawai</option><option value="bidang">Bidang/unit (beserta cabangnya)</option><option value="fungsional">Jabatan fungsional</option></select></label>
          <label v-if="cakupan === 'bidang'" class="block"><span class="label-isian">Bidang/unit</span>
            <select v-model="nilai" class="isian"><option value="" disabled>Pilih bidang/unit</option>
              <option v-for="u in unitPilihan" :key="u.id" :value="u.id">{{ ' '.repeat(u.tingkat * 2) }}{{ u.nama }}</option></select></label>
          <label v-else-if="cakupan === 'fungsional'" class="block"><span class="label-isian">Jabatan fungsional</span>
            <select v-model="nilai" class="isian"><option value="" disabled>Pilih jabatan</option>
              <option v-for="f in org.fungsional" :key="f.id" :value="f.id">{{ f.nama }}</option></select></label>
        </template>
        <label v-if="pemantau && jenis === 'individu'" class="block sm:col-span-2"><span class="label-isian">Pegawai</span>
          <select v-model="nilai" class="isian"><option value="" disabled>Pilih pegawai</option>
            <option v-for="p in pegawaiPilihan" :key="p.id" :value="p.id">{{ p.nama_lengkap }}{{ p.nama_unit ? ' – ' + p.nama_unit : '' }}</option></select></label>
        <label v-if="jenis === 'perhatian'" class="block"><span class="label-isian">Ambang persentase</span>
          <input v-model.number="ambang" type="number" min="1" max="100" class="isian" /></label>
      </div>

      <div class="flex flex-wrap gap-2">
        <button v-for="p in PERIODE_CEPAT" :key="p.k" type="button" @click="pilihCepat(p.k)"
          :class="['min-h-[40px] rounded-full border px-3.5 text-sm font-semibold', cepat === p.k ? 'border-transparent bg-[#C7332F] text-white' : 'border-garis bg-permukaan text-teks2']">{{ p.n }}</button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <InputTanggal v-model="mulai" label="Dari tanggal" />
        <InputTanggal v-model="selesai" label="Sampai tanggal" />
        <button type="button" class="tombol-utama" :disabled="lk.memuat" @click="muat"><PhMagnifyingGlass :size="20" weight="bold" /> Tampilkan</button>
      </div>
    </fieldset>

    <PanelResmi v-if="lk.data || resmi" :kunci="kunci" :beku="resmi" jenis="laporan_kehadiran_pegawai" jenis-nama="Laporan kehadiran pegawai" :perihal="judulCetak"
      :periode="periodeTeks" :subjek="namaCakupan" kop="pondok" tautan="/rekap/pegawai" :isi="isiBeku" :penanda-jabatan="jabPenanda"
      :kanan-jabatan="cakupanEfektif === 'saya' ? 'Pegawai yang bersangkutan' : 'Pembuat laporan'" @buka="terapkanResmi" @tutup="tutupResmi" />

    <p v-if="lk.memuat" class="py-10 text-center text-teks3">Menghitung kehadiran…</p>
    <p v-else-if="!lk.data" class="kartu p-8 text-center text-teks3">Pilih {{ jenis === 'individu' ? 'pegawai' : cakupan === 'bidang' ? 'bidang/unit' : 'jabatan fungsional' }} lalu tekan Tampilkan.</p>
    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <label v-if="jenis !== 'individu'" class="relative min-w-[14rem] flex-1"><span class="sr-only">Cari pegawai</span>
          <PhMagnifyingGlass :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" class="isian pl-10" placeholder="Cari nama, NIY, bidang, atau jabatan" /></label>
        <span v-else class="flex-1" />
        <button type="button" class="tombol-garis" :disabled="!tampilBaris.length" @click="excel"><PhFileXls :size="18" weight="duotone" /> Excel</button>
        <button type="button" class="tombol-garis" :disabled="!tampilBaris.length" @click="cetak"><PhPrinter :size="18" weight="duotone" /> Cetak</button>
      </div>
      <p v-if="lk.data.penutupan_mulai === null" class="flex items-start gap-1.5 rounded-xl bg-permukaan2 px-3 py-2 text-xs text-teks2"><PhInfo :size="16" class="mt-px shrink-0" />
        Sesi terjadwal yang sudah lewat tetapi tidak tercatat dihitung sebagai tanpa keterangan (tidak presensi). Data dihitung sampai {{ formatPanjang(lk.data.dihitung_sampai) }}.</p>

      <!-- Ringkas / perhatian -->
      <template v-if="jenis === 'ringkas' || jenis === 'perhatian'">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><KartuStatistik v-for="s in statistik" :key="s.judul" v-bind="s" /></div>
        <p v-if="!tampilBaris.length" class="kartu p-8 text-center text-teks3">{{ jenis === 'perhatian' ? `Tidak ada pegawai dengan kehadiran di bawah ${ambang}%.` : 'Tidak ada data.' }}</p>
        <ul v-else class="space-y-2 lg:hidden">
          <li v-for="p in tampilBaris" :key="p.employee_id" class="kartu p-3.5">
            <div class="flex items-center gap-3"><span class="min-w-0 flex-1"><span v-if="p.niy" class="block text-xs font-semibold tabular-nums text-teks3">{{ p.niy }}</span><span class="block font-bold">{{ p.nama }}</span><span class="block truncate text-xs text-teks3">{{ p.unit || '–' }} · {{ p.sesi_wajib }} sesi wajib</span></span>
              <span :class="['text-xl font-extrabold tabular-nums', (p.persen ?? 100) < ambang ? 'text-[rgb(var(--merah))]' : '']">{{ persenTeks(p.persen) }}</span></div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-permukaan2"><div class="h-full rounded-full bg-[#1E7D4F]" :style="{ width: (p.persen || 0) + '%' }" /></div>
            <div class="mt-2 flex flex-wrap gap-1">
              <span v-for="k in ['hadir', 'terlambat', 'dinas_luar', 'izin', 'sakit', 'cuti', 'tanpa_keterangan']" v-show="p[k]" :key="k" :class="['lencana', 'w-' + STATUS_HADIR[k].w]">{{ STATUS_HADIR[k].n }} {{ p[k] }}</span></div>
            <p v-if="keteranganPegawai(p)" class="mt-1.5 text-xs text-teks3">{{ keteranganPegawai(p) }}</p>
          </li>
        </ul>
        <div v-if="tampilBaris.length" class="kartu hidden overflow-x-auto lg:block">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>NIY</th><th>Nama</th><th>Status</th><th class="text-right">Wajib</th><th class="text-right">Hadir</th><th class="text-right">Terlambat</th><th class="text-right">Dinas luar</th>
              <th class="text-right">Izin</th><th class="text-right">Sakit</th><th class="text-right">Cuti</th><th class="text-right">Tanpa ket.</th><th class="text-right">Cepat pulang</th><th class="text-right">Persentase</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr v-for="p in tampilBaris" :key="p.employee_id" class="border-b border-garis last:border-0 [&>td]:p-2.5">
                <td class="whitespace-nowrap text-xs tabular-nums">{{ p.niy || '–' }}</td><td><span class="block font-semibold">{{ p.nama }}</span><span class="block text-xs text-teks3">{{ p.unit || '–' }}</span></td>
                <td class="text-xs">{{ statusPeg(p.status_kepegawaian) }}</td>
                <td class="text-right tabular-nums">{{ p.sesi_wajib }}</td><td class="text-right tabular-nums">{{ p.hadir }}</td>
                <td class="text-right tabular-nums">{{ p.terlambat }}<span v-if="p.menit_terlambat" class="block text-[11px] text-teks3">{{ p.menit_terlambat }} mnt</span></td>
                <td class="text-right tabular-nums">{{ p.dinas_luar }}</td><td class="text-right tabular-nums">{{ p.izin }}</td><td class="text-right tabular-nums">{{ p.sakit }}</td>
                <td class="text-right tabular-nums">{{ p.cuti }}</td><td class="text-right tabular-nums">{{ p.tanpa_keterangan }}</td><td class="text-right tabular-nums">{{ p.cepat_pulang }}</td>
                <td :class="['text-right font-bold tabular-nums', (p.persen ?? 100) < ambang ? 'text-[rgb(var(--merah))]' : '']">{{ persenTeks(p.persen) }}</td>
                <td class="max-w-[16rem] text-xs text-teks3">{{ keteranganPegawai(p) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Matriks -->
      <template v-else-if="jenis === 'matriks'">
        <div class="kartu overflow-x-auto">
          <table class="matriks text-xs">
            <thead><tr><th class="nis">NIY</th><th class="lekat">Nama</th><th v-for="t in tanggal" :key="t" class="tgl"><span class="block font-bold">{{ t.slice(8, 10) }}</span><span class="block font-normal text-teks3">{{ hariSingkat(t) }}</span></th><th>Persen</th></tr></thead>
            <tbody>
              <tr v-for="p in pegawai" :key="p.employee_id">
                <td class="nis tabular-nums text-teks3">{{ p.niy || '–' }}</td><td class="lekat font-semibold">{{ p.nama }}</td>
                <td v-for="t in tanggal" :key="t" class="tgl"><span v-if="matriks[p.employee_id]?.[t]" :class="['sel', 'w-' + STATUS_HADIR[matriks[p.employee_id][t]].w]">{{ STATUS_HADIR[matriks[p.employee_id][t]].s }}</span></td>
                <td class="text-right font-bold tabular-nums">{{ persenTeks(p.persen) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-teks2"><span v-for="(s, k) in STATUS_HADIR" :key="k"><b>{{ s.s }}</b> = {{ s.n }}</span><span>Sel menampilkan status terberat pada hari itu.</span></p>
      </template>

      <!-- Individu -->
      <template v-else-if="jenis === 'individu' && individu">
        <section class="kartu p-4">
          <p class="text-lg font-bold">{{ individu.nama }}</p>
          <p class="text-sm text-teks2">{{ [individu.jabatan, individu.unit, statusPeg(individu.status_kepegawaian)].filter(Boolean).join(' · ') }}</p>
          <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div class="rounded-xl bg-permukaan2 p-2 text-center"><p class="text-xl font-extrabold tabular-nums">{{ persenTeks(individu.persen) }}</p><p class="text-xs text-teks3">Kehadiran</p></div>
            <div v-for="k in ['hadir', 'terlambat', 'izin', 'sakit', 'tanpa_keterangan']" :key="k" :class="['rounded-xl p-2 text-center', 'w-' + STATUS_HADIR[k].w]" style="background: color-mix(in srgb, var(--c) 10%, transparent)">
              <p class="text-xl font-extrabold tabular-nums">{{ individu[k] }}</p><p class="text-xs text-teks2">{{ STATUS_HADIR[k].n }}</p></div>
          </div>
        </section>
        <p v-if="!rinciIndividu.length" class="kartu p-8 text-center text-teks3">Tidak ada sesi wajib pada periode ini.</p>
        <ul v-else class="space-y-2 lg:hidden">
          <li v-for="(r, i) in rinciIndividu" :key="i" class="kartu flex items-start gap-3 p-3">
            <span class="w-14 shrink-0 text-center"><span class="block text-lg font-extrabold tabular-nums">{{ r.tanggal.slice(8, 10) }}</span><span class="block text-xs text-teks3">{{ hariSingkat(r.tanggal) }}</span></span>
            <span class="min-w-0 flex-1"><span class="block font-semibold">{{ r.nama_sesi }}</span><span class="block text-xs text-teks3">{{ jadwal(r) }} · datang {{ jam(r.datang_pada) }} · pulang {{ jam(r.pulang_pada) }}</span>
              <span v-if="r.keterangan" class="block text-xs text-teks2">{{ r.keterangan }}</span></span>
            <span :class="['lencana shrink-0', 'w-' + (STATUS_HADIR[r.status]?.w || 'beranda')]">{{ STATUS_HADIR[r.status]?.n }}</span>
          </li>
        </ul>
        <div v-if="rinciIndividu.length" class="kartu hidden overflow-x-auto lg:block">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>Tanggal</th><th>Sesi</th><th>Jadwal</th><th>Datang</th><th>Pulang</th><th>Titik</th><th>Status</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in rinciIndividu" :key="i" class="border-b border-garis last:border-0 [&>td]:p-2.5">
                <td class="whitespace-nowrap">{{ formatHari(r.tanggal) }}</td><td>{{ r.nama_sesi }}<span class="block text-xs text-teks3">{{ r.nama_pola }}</span></td>
                <td class="tabular-nums">{{ jadwal(r) }}</td><td class="tabular-nums">{{ jam(r.datang_pada) }}</td><td class="tabular-nums">{{ jam(r.pulang_pada) }}</td><td class="text-xs">{{ r.titik || '–' }}</td>
                <td><span :class="['lencana', 'w-' + (STATUS_HADIR[r.status]?.w || 'beranda')]">{{ STATUS_HADIR[r.status]?.n }}{{ r.status === 'terlambat' ? ` ${r.terlambat_menit} mnt` : '' }}</span></td>
                <td class="text-xs text-teks3">{{ r.keterangan || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <!-- Cetak F4 -->
    <DokumenCetak v-if="lk.data" v-model:pratinjau="pratinjau" kop="pondok" :judul="judulCetak" :subjudul="subjudul" :mendatar="jenis === 'matriks'" :pencetak="sesi.pengguna?.nama_lengkap">
      <template v-if="jenis === 'ringkas' || jenis === 'perhatian'">
        <p v-if="jenis === 'perhatian'" style="margin-bottom: 6pt">Pegawai dengan persentase kehadiran di bawah {{ ambang }}%, diurutkan dari yang terendah.</p>
        <table class="tabel kecil rapat">
          <colgroup><col style="width:4%"><col style="width:10%"><col style="width:14%"><col style="width:8%"><col style="width:5%"><col style="width:7%"><col style="width:5%"><col style="width:4%"><col style="width:5%"><col style="width:4%"><col style="width:5%"><col style="width:6%"><col style="width:6%"><col style="width:7%"><col style="width:10%"></colgroup>
          <thead><tr><th>No.</th><th>NIY</th><th>Nama</th><th>Status kepegawaian</th><th>Hadir</th><th>Terlambat</th><th>Dinas luar</th><th>Izin</th><th>Sakit</th><th>Cuti</th><th>Absen</th><th>Cepat pulang</th><th>Total kehadiran</th><th>Persentase</th><th>Keterangan</th></tr></thead>
          <tbody>
            <tr v-for="(p, i) in tampilBaris" :key="p.employee_id">
              <td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ p.niy || '–' }}</td><td>{{ p.nama }}</td><td>{{ statusPeg(p.status_kepegawaian) }}</td>
              <td class="tengah">{{ p.hadir }}</td><td class="tengah">{{ p.terlambat }}</td><td class="tengah">{{ p.dinas_luar }}</td><td class="tengah">{{ p.izin }}</td><td class="tengah">{{ p.sakit }}</td>
              <td class="tengah">{{ p.cuti }}</td><td class="tengah">{{ p.tanpa_keterangan }}</td><td class="tengah">{{ p.cepat_pulang }}</td><td class="tengah">{{ p.total_hadir }}</td>
              <td class="tengah">{{ persenTeks(p.persen) }}</td><td>{{ keteranganPegawai(p) }}</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top: 4pt; font-size: 8pt">Total kehadiran = Hadir + Terlambat + Dinas luar. Persentase = total kehadiran ÷ sesi wajib. Absen = tanpa keterangan. Cepat pulang = jumlah kejadian.</p>
      </template>
      <template v-else-if="jenis === 'matriks'">
        <table class="tabel kecil matriks-cetak">
          <thead><tr><th style="width:3%">No.</th><th style="width:8%">NIY</th><th style="width:14%">Nama</th><th v-for="t in tanggal" :key="t">{{ t.slice(8, 10) }}</th><th>H</th><th>T</th><th>I</th><th>S</th><th>A</th><th style="width:5%">%</th></tr></thead>
          <tbody>
            <tr v-for="(p, i) in pegawai" :key="p.employee_id">
              <td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ p.niy || '' }}</td><td>{{ p.nama }}</td>
              <td v-for="t in tanggal" :key="t" class="tengah">{{ STATUS_HADIR[matriks[p.employee_id]?.[t]]?.s || '' }}</td>
              <td class="tengah">{{ p.hadir }}</td><td class="tengah">{{ p.terlambat }}</td><td class="tengah">{{ p.izin }}</td><td class="tengah">{{ p.sakit }}</td><td class="tengah">{{ p.tanpa_keterangan }}</td>
              <td class="tengah">{{ persenTeks(p.persen) }}</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top: 4pt; font-size: 8pt">Keterangan: <span v-for="(s, k, i) in STATUS_HADIR" :key="k">{{ s.s }} = {{ s.n }}{{ i < 7 ? '; ' : '.' }}</span> Sel berisi status terberat pada hari itu.</p>
      </template>
      <template v-else-if="jenis === 'individu' && individu">
        <table class="data" style="margin-bottom: 8pt">
          <tbody>
            <tr><td style="width: 40mm">NIY</td><td style="width: 4mm">:</td><td>{{ individu.niy || '–' }}</td></tr>
            <tr><td>Nama</td><td>:</td><td>{{ individu.nama }}</td></tr>
            <tr><td>Jabatan</td><td>:</td><td>{{ individu.jabatan || '–' }}</td></tr>
            <tr><td>Bidang/unit</td><td>:</td><td>{{ individu.unit || '–' }}</td></tr>
            <tr><td>Status kepegawaian</td><td>:</td><td>{{ statusPeg(individu.status_kepegawaian) }}</td></tr>
          </tbody>
        </table>
        <table class="tabel kecil">
          <colgroup><col style="width:5%"><col style="width:17%"><col style="width:17%"><col style="width:11%"><col style="width:8%"><col style="width:8%"><col style="width:13%"><col style="width:21%"></colgroup>
          <thead><tr><th>No.</th><th>Tanggal</th><th>Sesi</th><th>Jadwal</th><th>Datang</th><th>Pulang</th><th>Status</th><th>Keterangan</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in rinciIndividu" :key="i">
              <td class="tengah">{{ i + 1 }}</td><td>{{ formatHari(r.tanggal) }}</td><td>{{ r.nama_sesi }}</td><td class="tengah">{{ jadwal(r) }}</td>
              <td class="tengah">{{ jam(r.datang_pada) }}</td><td class="tengah">{{ jam(r.pulang_pada) }}</td>
              <td>{{ STATUS_HADIR[r.status]?.n }}{{ r.status === 'terlambat' ? ` ${r.terlambat_menit} menit` : '' }}</td><td>{{ [r.titik, r.keterangan].filter(Boolean).join('; ') }}</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top: 6pt">Ringkasan: sesi wajib {{ individu.sesi_wajib }}; hadir {{ individu.hadir }}; terlambat {{ individu.terlambat }}; dinas luar {{ individu.dinas_luar }};
          izin {{ individu.izin }}; sakit {{ individu.sakit }}; cuti {{ individu.cuti }}; tanpa keterangan {{ individu.tanpa_keterangan }}. Persentase kehadiran {{ persenTeks(individu.persen) }}.</p>
      </template>
      <template #ttd>
        <TtdResmi :dok="resmi" :kiri="{ jabatan: penanda.jabatan || 'Direktur', nama: penanda.nama, niy: penanda.niy }" :kanan="kanan" />
      </template>
    </DokumenCetak>
  </div>
</template>
<style scoped>
.matriks { border-collapse: separate; border-spacing: 0; }
.matriks th, .matriks td { padding: 6px 4px; border-bottom: 1px solid rgb(var(--garis)); white-space: nowrap; }
.matriks th.tgl, .matriks td.tgl { min-width: 2.1rem; text-align: center; }
.matriks .nis { padding-left: 12px; text-align: left; }
.matriks .lekat { position: sticky; left: 0; z-index: 1; min-width: 11rem; max-width: 14rem; overflow: hidden; text-overflow: ellipsis; padding-left: 12px; background: rgb(var(--permukaan)); text-align: left; }
.matriks .sel { display: inline-grid; place-items: center; min-width: 1.6rem; height: 1.6rem; border-radius: 6px; font-weight: 800; color: var(--c);
  background: color-mix(in srgb, var(--c) 14%, transparent); }
</style>
