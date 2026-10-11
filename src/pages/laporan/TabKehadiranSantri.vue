<!-- SIMKA PRO | src/pages/laporan/TabKehadiranSantri.vue | v1.2 | Fase 8 – Tahap 5 Terbitkan resmi (salinan beku, tanda tangan elektronik) | 10/10/2026 -->
<script setup>
// Laporan kehadiran santri (menu Dokumen → Kehadiran santri), absensi HISBAT.
// Jenis: rekap ringkas, rekap matriks (F4 mendatar), laporan individu, daftar perhatian, kepatuhan pengisian (pemantau).
// Kegiatan: gabungan program pokok (kelas + halaqah + asrama) atau per kegiatan; ekskul dilaporkan terpisah.
// Cakupan: kelompok (kelas, halaqah, kamar, ekskul), jenjang, seluruh santri, atau satu santri. Pengasuh hanya
// melihat kelompok asuhannya (diperiksa server). Keluaran: layar, Excel, cetak F4.
// v1.2: Terbitkan resmi (PanelResmi): salinan beku + permintaan tanda tangan pimpinan; versi resmi dibuka lewat ?resmi=id.
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhStudent, PhChartPieSlice, PhWarningCircle, PhUserMinus, PhMagnifyingGlass, PhFileXls, PhPrinter, PhInfo, PhListBullets, PhGridNine, PhUser, PhFlag, PhClipboardText } from '@phosphor-icons/vue'
import { useLaporanSantri } from '@/stores/laporanSantri'
import { useKelompokSantri } from '@/stores/kelompokSantri'
import { useSantri } from '@/stores/santri'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { STATUS_SANTRI, KEGIATAN_SANTRI, NAMA_KEGIATAN, PERIODE_CEPAT, periodeCepat, daftarTanggal, hariSingkat, susunMatriksSantri, keteranganSantri, persenTeks } from '@/lib/laporanKehadiran'
import { JENIS_KELOMPOK, penandaKelompok, penandaJenjang } from '@/lib/santri'
import { formatPanjang, formatPendek, formatHari } from '@/lib/tanggal'
import { ambilPenandaTangan } from '@/lib/penandatangan'
import KartuStatistik from '@/components/KartuStatistik.vue'
import InputTanggal from '@/components/InputTanggal.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TtdResmi from '@/components/cetak/TtdResmi.vue'
import PanelResmi from '@/components/PanelResmi.vue'
import { useDokumenResmi } from '@/stores/dokumenResmi'

const ls = useLaporanSantri(); const kel = useKelompokSantri(); const st = useSantri(); const sesi = useSesi(); const ui = useUI()
const route = useRoute(); const router = useRouter(); const dr = useDokumenResmi()
const resmi = ref(null) // versi resmi (salinan beku) yang sedang ditampilkan
const pemantau = computed(() => sesi.isAdmin || sesi.luas('data_santri') || sesi.pimpinanTinggi)
const JENIS_LAP = { ringkas: { n: 'Rekap ringkas', ikon: PhListBullets, ket: 'Jumlah setiap status HISBAT per santri dan persentase' },
  matriks: { n: 'Rekap matriks', ikon: PhGridNine, ket: 'Nama × tanggal, kertas mendatar' },
  individu: { n: 'Laporan individu', ikon: PhUser, ket: 'Rincian per tanggal dan kegiatan untuk satu santri' },
  perhatian: { n: 'Daftar perhatian', ikon: PhFlag, ket: 'Kehadiran di bawah ambang, untuk pembinaan' },
  pengisian: { n: 'Kepatuhan pengisian', ikon: PhClipboardText, ket: 'Sesi terjadwal dibanding sesi yang sudah diisi pengampu' } }
const JENIS = computed(() => Object.keys(JENIS_LAP).filter((k) => k !== 'pengisian' || pemantau.value))

const jenis = ref('ringkas'); const kegiatan = ref('pokok')
const cakupan = ref(pemantau.value ? 'semua' : 'kelompok'); const kelompok = ref(''); const jenjang = ref('wustha'); const santriId = ref('')
const awal = periodeCepat('bulan'); const mulai = ref(awal.mulai); const selesai = ref(awal.selesai); const cepat = ref('bulan')
const ambang = ref(80); const cari = ref('')

const kelompokPilihan = computed(() => kel.dariTA.filter((g) => g.aktif && ['kelas', 'halaqah', 'kamar', 'ekskul'].includes(g.jenis) && (pemantau.value || g.asuhan_saya))
  .filter((g) => kegiatan.value === 'pokok' ? g.jenis !== 'ekskul' : g.jenis === (kegiatan.value === 'asrama' ? 'kamar' : kegiatan.value)))
const santriPilihan = computed(() => st.daftar.filter((s) => s.status === 'aktif'))
onMounted(async () => {
  await Promise.all([kel.daftar.length ? null : kel.muat(), st.daftar.length ? null : st.muat()])
  if (route.query.resmi) { try { terapkanResmi(await dr.ambil(String(route.query.resmi))); return } catch (e) { ui.toast(e.message, 'galat') } }
  if (!pemantau.value) kelompok.value = kelompokPilihan.value[0]?.id || ''
  muat()
})
function pilihCepat(k) { cepat.value = k; const p = periodeCepat(k); mulai.value = p.mulai; selesai.value = p.selesai }
watch([mulai, selesai], () => { const p = periodeCepat(cepat.value); if (p.mulai !== mulai.value || p.selesai !== selesai.value) cepat.value = '' })
watch(kegiatan, () => { if (resmi.value) return; if (kelompok.value && !kelompokPilihan.value.some((g) => g.id === kelompok.value)) kelompok.value = pemantau.value ? '' : (kelompokPilihan.value[0]?.id || '') })

const cakupanEfektif = computed(() => (jenis.value === 'individu' ? 'santri' : cakupan.value))
const namaCakupan = computed(() => {
  if (resmi.value) return resmi.value.isi?.param?.namaCakupan || '–'
  if (cakupanEfektif.value === 'santri') return st.daftar.find((s) => s.id === santriId.value)?.nama_lengkap || '–'
  if (cakupanEfektif.value === 'semua') return 'Seluruh santri'
  if (cakupanEfektif.value === 'jenjang') return jenjang.value === 'sma' ? 'Jenjang SMA' : 'Jenjang Kesetaraan Wustha'
  const g = kel.cari?.(kelompok.value) || kel.dariTA.find((x) => x.id === kelompok.value)
  return g ? `${JENIS_KELOMPOK[g.jenis]?.n || ''} ${g.nama}`.trim() : '–'
})

async function muat() {
  if (resmi.value) return
  if (selesai.value < mulai.value) { ui.toast('Tanggal akhir tidak boleh sebelum tanggal mulai.', 'galat'); return }
  if ((cakupanEfektif.value === 'kelompok' && !kelompok.value) || (cakupanEfektif.value === 'santri' && !santriId.value)) { ls.data = null; return }
  try {
    await ls.muat({ mulai: mulai.value, selesai: selesai.value, cakupan: cakupanEfektif.value,
      kelompok: cakupanEfektif.value === 'santri' ? santriId.value : cakupanEfektif.value === 'kelompok' ? kelompok.value : null,
      jenjang: cakupanEfektif.value === 'jenjang' ? jenjang.value : null, kegiatan: kegiatan.value, rinci: ['matriks', 'individu'].includes(jenis.value) })
  } catch (e) { ui.toast(e.message, 'galat') }
}
watch([jenis, cakupan, kelompok, jenjang, santriId, kegiatan], muat)

const santri = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return (ls.data?.santri || []).filter((s) => !q || [s.nama, s.nis, s.kelas, s.kamar, s.halaqah].join(' ').toLowerCase().includes(q))
})
const perhatian = computed(() => santri.value.filter((s) => s.sesi > 0 && (s.persen ?? 0) < Number(ambang.value)).sort((a, b) => (a.persen ?? 0) - (b.persen ?? 0)))
const baris = computed(() => (jenis.value === 'perhatian' ? perhatian.value : santri.value))
const statistik = computed(() => {
  const d = santri.value.filter((s) => s.sesi > 0); const rata = d.length ? d.reduce((n, s) => n + (s.persen || 0), 0) / d.length : null
  return [
    { judul: 'Santri', nilai: santri.value.length, ikon: PhStudent, warna: 'santri', keterangan: namaCakupan.value },
    { judul: 'Rata-rata kehadiran', nilai: rata == null ? '–' : rata.toFixed(1).replace('.', ','), satuan: rata == null ? '' : '%', ikon: PhChartPieSlice, warna: 'presensi', keterangan: KEGIATAN_SANTRI[ls.data?.kegiatan || kegiatan.value] },
    { judul: `Di bawah ${ambang.value}%`, nilai: perhatian.value.length, ikon: PhWarningCircle, warna: 'klinik', keterangan: 'Perlu pembinaan' },
    { judul: 'Sesi absen', nilai: santri.value.reduce((n, s) => n + (s.absen || 0), 0), ikon: PhUserMinus, warna: 'beranda', keterangan: `Bolos ${santri.value.reduce((n, s) => n + (s.bolos || 0), 0)} sesi` },
  ]
})
const tanggal = computed(() => (ls.data ? daftarTanggal(ls.data.mulai, ls.data.selesai) : []))
const matriks = computed(() => susunMatriksSantri(ls.data?.rinci))
const individu = computed(() => santri.value[0] || null)
const rinciIndividu = computed(() => (ls.data?.rinci || []).filter((r) => r.student_id === individu.value?.student_id))
const pengisian = computed(() => (ls.data?.pengisian || []).map((g) => ({ ...g, persen: g.rencana ? Math.round((1000 * Math.min(g.terisi, g.rencana)) / g.rencana) / 10 : null })))
const kodeKegiatan = (k) => Object.keys(KEGIATAN_SANTRI).filter((x) => x !== 'pokok').map((x) => ({ k: x === 'asrama' ? 'asrama' : x, n: NAMA_KEGIATAN[x] })).filter((x) => k[x.k])

// ---------- Excel ----------
async function excel() {
  const XLSX = await import('xlsx'); const per = `Periode ${formatPanjang(ls.data.mulai)} s.d. ${formatPanjang(ls.data.selesai)} · ${KEGIATAN_SANTRI[ls.data.kegiatan]}`
  let judul; let kepala; let isi; let lebar
  if (jenis.value === 'matriks') {
    judul = 'REKAP MATRIKS KEHADIRAN SANTRI'
    kepala = ['No', 'NIS', 'Nama', 'JK', ...tanggal.value.map((t) => t.slice(8, 10)), 'H', 'T', 'B', 'I', 'S', 'A', 'Kehadiran']
    isi = santri.value.map((s, i) => [i + 1, s.nis, s.nama, s.jenis_kelamin || '', ...tanggal.value.map((t) => matriks.value[s.student_id]?.[t] || ''), s.hadir, s.terlambat, s.bolos, s.izin, s.sakit, s.absen, persenTeks(s.persen)])
    lebar = [5, 10, 28, 4, ...tanggal.value.map(() => 4), 5, 5, 5, 5, 5, 5, 11]
  } else if (jenis.value === 'individu') {
    judul = 'LAPORAN KEHADIRAN SANTRI'
    kepala = ['No', 'Tanggal', 'Kegiatan', 'Sesi', 'Kelompok', 'Status', 'Keterangan']
    isi = rinciIndividu.value.map((r, i) => [i + 1, formatPendek(r.tanggal), NAMA_KEGIATAN[r.jenis], r.nama_sesi, r.kelompok || '', STATUS_SANTRI[r.kode].n, r.keterangan || ''])
    lebar = [5, 12, 10, 20, 22, 12, 34]
  } else if (jenis.value === 'pengisian') {
    judul = 'KEPATUHAN PENGISIAN ABSENSI SANTRI'
    kepala = ['No', 'Kelompok', 'Jenis', 'Pengampu', 'Sesi terjadwal', 'Sesi diisi', 'Kepatuhan']
    isi = pengisian.value.map((g, i) => [i + 1, g.nama, JENIS_KELOMPOK[g.jenis]?.n || g.jenis, g.pengampu || '', g.rencana, g.terisi, persenTeks(g.persen)])
    lebar = [5, 26, 10, 30, 14, 12, 12]
  } else {
    judul = jenis.value === 'perhatian' ? `DAFTAR PERHATIAN KEHADIRAN SANTRI (DI BAWAH ${ambang.value}%)` : 'REKAP KEHADIRAN SANTRI'
    kepala = ['No', 'NIS', 'Nama', 'JK', 'Kelas', 'Kamar', 'Halaqah', 'Sesi wajib', 'Hadir', 'Terlambat', 'Bolos', 'Izin', 'Sakit', 'Absen', 'Kehadiran', 'Keterangan']
    isi = baris.value.map((s, i) => [i + 1, s.nis, s.nama, s.jenis_kelamin || '', s.kelas || '', s.kamar || '', s.halaqah || '', s.sesi, s.hadir, s.terlambat, s.bolos, s.izin, s.sakit, s.absen, persenTeks(s.persen), keteranganSantri(s)])
    lebar = [5, 10, 28, 4, 10, 16, 20, 9, 7, 9, 7, 6, 6, 7, 10, 34]
  }
  const ws = XLSX.utils.aoa_to_sheet([[judul], [per], [`Cakupan: ${namaCakupan.value}`], [], kepala, ...isi])
  ws['!cols'] = lebar.map((w) => ({ wch: w }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, JENIS_LAP[jenis.value].n.slice(0, 30))
  XLSX.writeFile(wb, `${JENIS_LAP[jenis.value].n.replace(/\s+/g, '-')}-Santri-${namaCakupan.value.replace(/[^A-Za-z0-9]+/g, '-')}-${ls.data.mulai}-sd-${ls.data.selesai}.xlsx`)
}

// ---------- Cetak ----------
const pratinjau = ref(false); const penanda = ref({ jabatan: 'Direktur', nama: '', niy: '' })
const judulCetak = computed(() => ({ ringkas: 'Rekap Kehadiran Santri', matriks: 'Rekap Matriks Kehadiran Santri', individu: 'Laporan Kehadiran Santri',
  perhatian: 'Daftar Perhatian Kehadiran Santri', pengisian: 'Kepatuhan Pengisian Absensi Santri' })[jenis.value])
const kelompokAktif = computed(() => kel.dariTA.find((g) => g.id === kelompok.value))
const ambilPenanda = () => {
  const g = cakupanEfektif.value === 'kelompok' ? kelompokAktif.value : null
  return (g ? penandaKelompok(g) : cakupanEfektif.value === 'jenjang' ? penandaJenjang(jenjang.value) : ambilPenandaTangan('Direktur')).catch(() => penanda.value)
}
async function cetak() {
  if (!resmi.value) penanda.value = await ambilPenanda()
  pratinjau.value = true
}
const kopCetak = computed(() => (resmi.value ? resmi.value.kop_kode || 'pondok'
  : cakupanEfektif.value === 'jenjang' ? (jenjang.value === 'sma' ? 'sma' : 'wustha') : kelompokAktif.value?.jenis === 'kelas' ? (kelompokAktif.value.jenjang === 'sma' ? 'sma' : 'wustha') : 'pondok'))

// ---------- Terbitkan resmi ----------
const kunci = computed(() => (ls.data && !resmi.value
  ? ['kehadiran_santri', jenis.value, ls.data.kegiatan, cakupanEfektif.value, cakupanEfektif.value === 'santri' ? santriId.value : cakupanEfektif.value === 'kelompok' ? kelompok.value : cakupanEfektif.value === 'jenjang' ? jenjang.value : '-',
    ls.data.mulai, ls.data.selesai, jenis.value === 'perhatian' ? ambang.value : ''].join('|')
  : ''))
const jabPenanda = ref('Direktur')
watch(kunci, async (k) => { if (k) jabPenanda.value = (await ambilPenanda())?.jabatan || 'Direktur' })
const isiBeku = () => ({ versi: 1, param: { jenis: jenis.value, kegiatan: kegiatan.value, cakupan: cakupan.value, kelompok: kelompok.value, jenjang: jenjang.value, santriId: santriId.value,
  mulai: ls.data.mulai, selesai: ls.data.selesai, ambang: ambang.value, namaCakupan: namaCakupan.value }, data: ls.data })
function terapkanResmi(d) {
  const p = d.isi?.param; if (!p) return ui.toast('Salinan beku dokumen tidak dapat dibaca.', 'galat')
  resmi.value = d; cari.value = ''
  jenis.value = p.jenis; kegiatan.value = p.kegiatan; cakupan.value = p.cakupan; kelompok.value = p.kelompok; jenjang.value = p.jenjang; santriId.value = p.santriId
  mulai.value = p.mulai; selesai.value = p.selesai; ambang.value = p.ambang ?? ambang.value
  ls.data = d.isi.data
  if (route.query.resmi !== d.id) router.replace({ query: { ...route.query, resmi: d.id } })
}
function tutupResmi() { resmi.value = null; const q = { ...route.query }; delete q.resmi; router.replace({ query: q }); muat() }
const periodeTeks = computed(() => (ls.data ? `${formatPendek(ls.data.mulai)} s.d. ${formatPendek(ls.data.selesai)} · ${KEGIATAN_SANTRI[ls.data.kegiatan]}` : ''))
const kanan = computed(() => {
  const g = kelompokAktif.value
  if (cakupanEfektif.value === 'kelompok' && g?.asuhan_saya) return { jabatan: `${JENIS_KELOMPOK[g.jenis]?.pengasuh || 'Pengasuh'} ${g.nama}`, nama: sesi.pengguna?.nama_lengkap, niy: sesi.pengguna?.niy }
  return { jabatan: 'Pencetak', nama: sesi.pengguna?.nama_lengkap, niy: sesi.pengguna?.niy }
})
const subjudul = computed(() => ls.data ? `Periode ${formatPanjang(ls.data.mulai)} s.d. ${formatPanjang(ls.data.selesai)} · ${KEGIATAN_SANTRI[ls.data.kegiatan]} · ${namaCakupan.value}` : '')
const adaData = computed(() => (jenis.value === 'pengisian' ? pengisian.value.length : jenis.value === 'individu' ? rinciIndividu.value.length : baris.value.length) > 0)
</script>
<template>
  <div class="space-y-4">
    <fieldset :disabled="!!resmi" :class="['kartu min-w-0 space-y-4 p-4', resmi && 'opacity-60']">
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis laporan">
        <button v-for="k in JENIS" :key="k" type="button" role="radio" :aria-checked="jenis === k" @click="jenis = k"
          :class="['flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-semibold', jenis === k ? 'border-transparent bg-[#C7332F] text-white' : 'border-garis bg-permukaan text-teks2 hover:text-teks']">
          <component :is="JENIS_LAP[k].ikon" :size="18" weight="duotone" /> {{ JENIS_LAP[k].n }}</button>
      </div>
      <p class="flex items-center gap-1.5 text-sm text-teks2"><PhInfo :size="16" /> {{ JENIS_LAP[jenis].ket }}.</p>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label class="block"><span class="label-isian">Kegiatan</span>
          <select v-model="kegiatan" class="isian"><option v-for="(n, k) in KEGIATAN_SANTRI" :key="k" :value="k">{{ n }}</option></select></label>
        <template v-if="jenis !== 'individu'">
          <label v-if="pemantau" class="block"><span class="label-isian">Cakupan</span>
            <select v-model="cakupan" class="isian"><option value="semua">Seluruh santri</option><option value="jenjang">Per jenjang</option><option value="kelompok">Per kelompok</option></select></label>
          <label v-if="cakupan === 'kelompok'" class="block"><span class="label-isian">Kelompok</span>
            <select v-model="kelompok" class="isian"><option value="" disabled>Pilih kelompok</option>
              <option v-for="g in kelompokPilihan" :key="g.id" :value="g.id">{{ JENIS_KELOMPOK[g.jenis]?.n }} {{ g.nama }}</option></select></label>
          <label v-else-if="cakupan === 'jenjang'" class="block"><span class="label-isian">Jenjang</span>
            <select v-model="jenjang" class="isian"><option value="wustha">Kesetaraan Wustha</option><option value="sma">SMA</option></select></label>
        </template>
        <label v-else class="block sm:col-span-2"><span class="label-isian">Santri</span>
          <select v-model="santriId" class="isian"><option value="" disabled>Pilih santri</option>
            <option v-for="s in santriPilihan" :key="s.id" :value="s.id">{{ s.nama_lengkap }} ({{ s.nis }})</option></select></label>
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
        <button type="button" class="tombol-utama" :disabled="ls.memuat" @click="muat"><PhMagnifyingGlass :size="20" weight="bold" /> Tampilkan</button>
      </div>
    </fieldset>

    <PanelResmi v-if="ls.data || resmi" :kunci="kunci" :beku="resmi" jenis="laporan_kehadiran_santri" jenis-nama="Laporan kehadiran santri" :perihal="judulCetak"
      :periode="periodeTeks" :subjek="namaCakupan" :kop="kopCetak" tautan="/rekap/santri" :isi="isiBeku" :penanda-jabatan="jabPenanda" :kanan-jabatan="kanan.jabatan === 'Pencetak' ? 'Pembuat laporan' : kanan.jabatan"
      @buka="terapkanResmi" @tutup="tutupResmi" />

    <p v-if="ls.memuat" class="py-10 text-center text-teks3">Menghitung kehadiran santri…</p>
    <p v-else-if="!ls.data" class="kartu p-8 text-center text-teks3">{{ jenis === 'individu' ? 'Pilih santri' : !kelompokPilihan.length && !pemantau ? 'Anda belum ditetapkan sebagai pengasuh kelompok mana pun' : 'Pilih kelompok' }}, lalu tekan Tampilkan.</p>
    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <label v-if="!['individu', 'pengisian'].includes(jenis)" class="relative min-w-[14rem] flex-1"><span class="sr-only">Cari santri</span>
          <PhMagnifyingGlass :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" class="isian pl-10" placeholder="Cari nama, NIS, kelas, kamar, atau halaqah" /></label>
        <span v-else class="flex-1" />
        <button type="button" class="tombol-garis" :disabled="!adaData" @click="excel"><PhFileXls :size="18" weight="duotone" /> Excel</button>
        <button type="button" class="tombol-garis" :disabled="!adaData" @click="cetak"><PhPrinter :size="18" weight="duotone" /> Cetak</button>
      </div>

      <!-- Ringkas / perhatian -->
      <template v-if="jenis === 'ringkas' || jenis === 'perhatian'">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><KartuStatistik v-for="s in statistik" :key="s.judul" v-bind="s" /></div>
        <p v-if="!baris.length" class="kartu p-8 text-center text-teks3">{{ jenis === 'perhatian' ? `Tidak ada santri dengan kehadiran di bawah ${ambang}%.` : 'Belum ada absensi tercatat pada periode ini.' }}</p>
        <ul v-else class="space-y-2 lg:hidden">
          <li v-for="s in baris" :key="s.student_id" class="kartu p-3.5">
            <div class="flex items-center gap-3"><span class="min-w-0 flex-1"><span class="block text-xs font-semibold tabular-nums text-teks3">{{ s.nis }}</span><span class="block font-bold">{{ s.nama }}</span>
              <span class="block truncate text-xs text-teks3">{{ [s.jenis_kelamin, s.kelas, s.kamar].filter(Boolean).join(' · ') || '–' }} · {{ s.sesi }} sesi</span></span>
              <span :class="['text-xl font-extrabold tabular-nums', (s.persen ?? 100) < ambang ? 'text-[rgb(var(--merah))]' : '']">{{ persenTeks(s.persen) }}</span></div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-permukaan2"><div class="h-full rounded-full bg-[#1E7D4F]" :style="{ width: (s.persen || 0) + '%' }" /></div>
            <div class="mt-2 flex flex-wrap gap-1">
              <span v-for="(m, k) in { T: 'terlambat', B: 'bolos', I: 'izin', S: 'sakit', A: 'absen' }" v-show="s[m]" :key="k" :class="['lencana', 'w-' + STATUS_SANTRI[k].w]">{{ STATUS_SANTRI[k].n }} {{ s[m] }}</span></div>
          </li>
        </ul>
        <div v-if="baris.length" class="kartu hidden overflow-x-auto lg:block">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>NIS</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Kamar</th><th class="text-right">Sesi</th><th class="text-right">Hadir</th><th class="text-right">Terlambat</th>
              <th class="text-right">Bolos</th><th class="text-right">Izin</th><th class="text-right">Sakit</th><th class="text-right">Absen</th><th class="text-right">Kehadiran</th><th v-if="kegiatan === 'pokok'">Per kegiatan</th></tr></thead>
            <tbody>
              <tr v-for="s in baris" :key="s.student_id" class="border-b border-garis last:border-0 [&>td]:p-2.5">
                <td class="tabular-nums">{{ s.nis }}</td><td class="font-semibold">{{ s.nama }}</td><td>{{ s.jenis_kelamin || '–' }}</td>
                <td class="text-xs">{{ s.kelas || '–' }}</td><td class="text-xs">{{ s.kamar || '–' }}</td>
                <td class="text-right tabular-nums">{{ s.sesi }}</td><td class="text-right tabular-nums">{{ s.hadir }}</td><td class="text-right tabular-nums">{{ s.terlambat }}</td>
                <td class="text-right tabular-nums">{{ s.bolos }}</td><td class="text-right tabular-nums">{{ s.izin }}</td><td class="text-right tabular-nums">{{ s.sakit }}</td><td class="text-right tabular-nums">{{ s.absen }}</td>
                <td :class="['text-right font-bold tabular-nums', (s.persen ?? 100) < ambang ? 'text-[rgb(var(--merah))]' : '']">{{ persenTeks(s.persen) }}</td>
                <td v-if="kegiatan === 'pokok'" class="text-xs text-teks3">
                  <span v-for="x in kodeKegiatan(s.per_kegiatan || {})" :key="x.k" class="mr-2 whitespace-nowrap">{{ x.n }} {{ s.per_kegiatan[x.k].hadir }}/{{ s.per_kegiatan[x.k].sesi }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Matriks -->
      <template v-else-if="jenis === 'matriks'">
        <div class="kartu overflow-x-auto">
          <table class="matriks text-xs">
            <thead><tr><th class="nis">NIS</th><th class="lekat">Nama</th><th v-for="t in tanggal" :key="t" class="tgl"><span class="block font-bold">{{ t.slice(8, 10) }}</span><span class="block font-normal text-teks3">{{ hariSingkat(t) }}</span></th><th>Persen</th></tr></thead>
            <tbody>
              <tr v-for="s in santri" :key="s.student_id">
                <td class="nis tabular-nums text-teks3">{{ s.nis }}</td><td class="lekat font-semibold">{{ s.nama }}</td>
                <td v-for="t in tanggal" :key="t" class="tgl"><span v-if="matriks[s.student_id]?.[t]" :class="['sel', 'w-' + STATUS_SANTRI[matriks[s.student_id][t]].w]">{{ matriks[s.student_id][t] }}</span></td>
                <td class="text-right font-bold tabular-nums">{{ persenTeks(s.persen) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-teks2"><span v-for="(s, k) in STATUS_SANTRI" :key="k"><b>{{ k }}</b> = {{ s.n }}</span><span>Sel menampilkan status terberat pada hari itu.</span></p>
      </template>

      <!-- Individu -->
      <template v-else-if="jenis === 'individu' && individu">
        <section class="kartu p-4">
          <p class="text-sm font-semibold tabular-nums text-teks3">{{ individu.nis }}</p><p class="text-lg font-bold">{{ individu.nama }}</p>
          <p class="text-sm text-teks2">{{ individu.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki' }} · {{ [individu.kelas, individu.kamar, individu.halaqah].filter(Boolean).join(' · ') }}</p>
          <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-7">
            <div class="rounded-xl bg-permukaan2 p-2 text-center"><p class="text-xl font-extrabold tabular-nums">{{ persenTeks(individu.persen) }}</p><p class="text-xs text-teks3">Kehadiran</p></div>
            <div v-for="(m, k) in { H: 'hadir', T: 'terlambat', B: 'bolos', I: 'izin', S: 'sakit', A: 'absen' }" :key="k" :class="['rounded-xl p-2 text-center', 'w-' + STATUS_SANTRI[k].w]" style="background: color-mix(in srgb, var(--c) 10%, transparent)">
              <p class="text-xl font-extrabold tabular-nums">{{ individu[m] }}</p><p class="text-xs text-teks2">{{ STATUS_SANTRI[k].n }}</p></div>
          </div>
        </section>
        <p v-if="!rinciIndividu.length" class="kartu p-8 text-center text-teks3">Belum ada absensi tercatat pada periode ini.</p>
        <div v-else class="kartu overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>Tanggal</th><th>Kegiatan</th><th>Sesi</th><th class="hidden sm:table-cell">Kelompok</th><th>Status</th><th class="hidden sm:table-cell">Keterangan</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in rinciIndividu" :key="i" class="border-b border-garis last:border-0 [&>td]:p-2.5">
                <td class="whitespace-nowrap">{{ formatPendek(r.tanggal) }} <span class="text-xs text-teks3">{{ hariSingkat(r.tanggal) }}</span></td>
                <td>{{ NAMA_KEGIATAN[r.jenis] }}</td><td>{{ r.nama_sesi }}</td><td class="hidden text-xs sm:table-cell">{{ r.kelompok || '–' }}</td>
                <td><span :class="['lencana', 'w-' + STATUS_SANTRI[r.kode].w]">{{ STATUS_SANTRI[r.kode].n }}</span></td>
                <td class="hidden text-xs text-teks3 sm:table-cell">{{ r.keterangan || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Kepatuhan pengisian -->
      <template v-else-if="jenis === 'pengisian'">
        <p v-if="!pengisian.length" class="kartu p-8 text-center text-teks3">Data kepatuhan tersedia untuk periode paling lama 62 hari.</p>
        <div v-else class="kartu overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>Kelompok</th><th>Pengampu</th><th class="text-right">Terjadwal</th><th class="text-right">Diisi</th><th class="w-48">Kepatuhan</th></tr></thead>
            <tbody>
              <tr v-for="g in pengisian" :key="g.group_id" class="border-b border-garis last:border-0 [&>td]:p-2.5">
                <td><span class="block font-semibold">{{ g.nama }}</span><span class="block text-xs text-teks3">{{ JENIS_KELOMPOK[g.jenis]?.n }}</span></td>
                <td class="text-xs">{{ g.pengampu || 'Belum ditetapkan' }}</td>
                <td class="text-right tabular-nums">{{ g.rencana }}</td><td class="text-right tabular-nums">{{ g.terisi }}</td>
                <td><div class="flex items-center gap-2"><div class="h-2 flex-1 overflow-hidden rounded-full bg-permukaan2"><div :class="['h-full rounded-full', (g.persen ?? 0) < 90 ? 'bg-[#C7332F]' : 'bg-[#1E7D4F]']" :style="{ width: (g.persen || 0) + '%' }" /></div>
                  <span class="w-12 text-right font-bold tabular-nums">{{ persenTeks(g.persen) }}</span></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <!-- Cetak F4 -->
    <DokumenCetak v-if="ls.data" v-model:pratinjau="pratinjau" :kop="kopCetak"
      :judul="judulCetak" :subjudul="subjudul" :mendatar="jenis === 'matriks'" :pencetak="sesi.pengguna?.nama_lengkap">
      <template v-if="jenis === 'ringkas' || jenis === 'perhatian'">
        <p v-if="jenis === 'perhatian'" style="margin-bottom: 6pt">Santri dengan persentase kehadiran di bawah {{ ambang }}%, diurutkan dari yang terendah.</p>
        <table class="tabel kecil rapat">
          <colgroup><col style="width:4%"><col style="width:8%"><col style="width:17%"><col style="width:4%"><col style="width:6%"><col style="width:5%"><col style="width:5%"><col style="width:6%"><col style="width:5%"><col style="width:4%"><col style="width:5%"><col style="width:5%"><col style="width:7%"><col style="width:19%"></colgroup>
          <thead><tr><th>No.</th><th>NIS</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Sesi wajib</th><th>Hadir</th><th>Terlambat</th><th>Bolos</th><th>Izin</th><th>Sakit</th><th>Absen</th><th>Kehadiran</th><th>Keterangan</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in baris" :key="s.student_id">
              <td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ s.nis }}</td><td>{{ s.nama }}</td><td class="tengah">{{ s.jenis_kelamin || '–' }}</td><td class="tengah">{{ s.kelas || '–' }}</td>
              <td class="tengah">{{ s.sesi }}</td><td class="tengah">{{ s.hadir }}</td><td class="tengah">{{ s.terlambat }}</td><td class="tengah">{{ s.bolos }}</td>
              <td class="tengah">{{ s.izin }}</td><td class="tengah">{{ s.sakit }}</td><td class="tengah">{{ s.absen }}</td><td class="tengah">{{ persenTeks(s.persen) }}</td><td>{{ keteranganSantri(s) }}</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top: 4pt; font-size: 8pt">Kehadiran = (Hadir + Terlambat + Bolos) ÷ sesi wajib. Sesi wajib = sesi absensi yang sudah diisi pengampu. Keterangan berisi jumlah sesi. {{ ls.data.kegiatan === 'pokok' ? 'Program pokok: kelas, halaqah, dan asrama; ekskul dilaporkan terpisah.' : '' }}</p>
      </template>
      <template v-else-if="jenis === 'matriks'">
        <table class="tabel kecil matriks-cetak">
          <thead><tr><th style="width:3%">No.</th><th style="width:6%">NIS</th><th style="width:14%">Nama</th><th style="width:2.5%">JK</th><th v-for="t in tanggal" :key="t">{{ t.slice(8, 10) }}</th><th>H</th><th>T</th><th>B</th><th>I</th><th>S</th><th>A</th><th style="width:5%">%</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in santri" :key="s.student_id">
              <td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ s.nis }}</td><td>{{ s.nama }}</td><td class="tengah">{{ s.jenis_kelamin || '' }}</td>
              <td v-for="t in tanggal" :key="t" class="tengah">{{ matriks[s.student_id]?.[t] || '' }}</td>
              <td class="tengah">{{ s.hadir }}</td><td class="tengah">{{ s.terlambat }}</td><td class="tengah">{{ s.bolos }}</td><td class="tengah">{{ s.izin }}</td><td class="tengah">{{ s.sakit }}</td><td class="tengah">{{ s.absen }}</td>
              <td class="tengah">{{ persenTeks(s.persen) }}</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top: 4pt; font-size: 8pt">Keterangan: H = Hadir; T = Terlambat; B = Bolos; I = Izin; S = Sakit; A = Absen. Sel berisi status terberat pada hari itu.</p>
      </template>
      <template v-else-if="jenis === 'individu' && individu">
        <table class="data" style="margin-bottom: 8pt">
          <tbody>
            <tr><td style="width: 40mm">NIS</td><td style="width: 4mm">:</td><td>{{ individu.nis }}</td></tr>
            <tr><td>Nama</td><td>:</td><td>{{ individu.nama }}</td></tr>
            <tr><td>Jenis kelamin</td><td>:</td><td>{{ individu.jenis_kelamin === 'P' ? 'Perempuan' : individu.jenis_kelamin === 'L' ? 'Laki-laki' : '–' }}</td></tr>
            <tr><td>Kelas / kamar</td><td>:</td><td>{{ individu.kelas || '–' }} / {{ individu.kamar || '–' }}</td></tr>
            <tr><td>Halaqah</td><td>:</td><td>{{ individu.halaqah || '–' }}</td></tr>
          </tbody>
        </table>
        <table class="tabel kecil">
          <colgroup><col style="width:5%"><col style="width:20%"><col style="width:11%"><col style="width:17%"><col style="width:17%"><col style="width:11%"><col style="width:19%"></colgroup>
          <thead><tr><th>No.</th><th>Tanggal</th><th>Kegiatan</th><th>Sesi</th><th>Kelompok</th><th>Status</th><th>Keterangan</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in rinciIndividu" :key="i">
              <td class="tengah">{{ i + 1 }}</td><td>{{ formatHari(r.tanggal) }}</td><td>{{ NAMA_KEGIATAN[r.jenis] }}</td><td>{{ r.nama_sesi }}</td><td>{{ r.kelompok || '–' }}</td>
              <td>{{ STATUS_SANTRI[r.kode].n }}</td><td>{{ r.keterangan || '' }}</td>
            </tr>
          </tbody>
        </table>
        <p style="margin-top: 6pt">Ringkasan: sesi wajib {{ individu.sesi }}; hadir {{ individu.hadir }}; terlambat {{ individu.terlambat }}; bolos {{ individu.bolos }}; izin {{ individu.izin }};
          sakit {{ individu.sakit }}; absen {{ individu.absen }}. Persentase kehadiran {{ persenTeks(individu.persen) }}.</p>
      </template>
      <template v-else-if="jenis === 'pengisian'">
        <table class="tabel kecil">
          <colgroup><col style="width:5%"><col style="width:25%"><col style="width:12%"><col style="width:28%"><col style="width:10%"><col style="width:10%"><col style="width:10%"></colgroup>
          <thead><tr><th>No.</th><th>Kelompok</th><th>Jenis</th><th>Pengampu</th><th>Sesi terjadwal</th><th>Sesi diisi</th><th>Kepatuhan</th></tr></thead>
          <tbody>
            <tr v-for="(g, i) in pengisian" :key="g.group_id">
              <td class="tengah">{{ i + 1 }}</td><td>{{ g.nama }}</td><td>{{ JENIS_KELOMPOK[g.jenis]?.n }}</td><td>{{ g.pengampu || '–' }}</td>
              <td class="tengah">{{ g.rencana }}</td><td class="tengah">{{ g.terisi }}</td><td class="tengah">{{ persenTeks(g.persen) }}</td>
            </tr>
          </tbody>
        </table>
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
