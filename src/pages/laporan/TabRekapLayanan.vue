<!-- SIMKA PRO | src/pages/laporan/TabRekapLayanan.vue | v1.1 | Fase 8 – Tahap 5 Terbitkan resmi (salinan beku, tanda tangan elektronik) | 10/10/2026 -->
<script setup>
// Laporan periode modul layanan (menu Dokumen → Rekap layanan): Security, libur santri, pengajuan pegawai, klinik.
// Pilihan laporan tampil sesuai hak (diperiksa server). Daftar santri berurutan NIS, Nama, JK. Data klinik tanpa diagnosis.
// Keluaran: layar, Excel, cetak F4 berkop dengan tanda tangan pimpinan (kiri) dan pencetak (kanan).
// v1.1: Terbitkan resmi (PanelResmi): salinan beku + permintaan tanda tangan pimpinan; versi resmi dibuka lewat ?resmi=id.
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhShieldCheck, PhAirplaneTilt, PhFileText, PhFirstAidKit, PhMagnifyingGlass, PhFileXls, PhPrinter, PhSignOut, PhSignIn, PhClockCountdown, PhProhibit,
  PhPackage, PhUsers, PhHouseLine, PhWarningCircle, PhStethoscope, PhHeartbeat, PhBed, PhUserList, PhHourglass } from '@phosphor-icons/vue'
import { useLaporanLayanan } from '@/stores/laporanLayanan'
import { useOrganisasi } from '@/stores/organisasi'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { useDokumenResmi } from '@/stores/dokumenResmi'
import { PERIODE_CEPAT, periodeCepat, hariSingkat } from '@/lib/laporanKehadiran'
import { formatPanjang, formatPendek, formatWaktu, formatJam } from '@/lib/tanggal'
import { ambilPenandaTangan } from '@/lib/penandatangan'
import KartuStatistik from '@/components/KartuStatistik.vue'
import InputTanggal from '@/components/InputTanggal.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TtdResmi from '@/components/cetak/TtdResmi.vue'
import PanelResmi from '@/components/PanelResmi.vue'

const ll = useLaporanLayanan(); const org = useOrganisasi(); const sesi = useSesi(); const ui = useUI()
const route = useRoute(); const router = useRouter(); const dr = useDokumenResmi()
const resmi = ref(null) // versi resmi (salinan beku) yang sedang ditampilkan
const pantauSantri = computed(() => sesi.isAdmin || sesi.pimpinanTinggi || sesi.tingkat('gerbang') >= 1 || sesi.tingkat('pantauan') >= 1)
const JENIS = computed(() => [
  pantauSantri.value && { k: 'security', n: 'Security', ikon: PhShieldCheck, ket: 'Gerbang keluar/kembali, titipan, tamu, kunjungan' },
  pantauSantri.value && { k: 'libur', n: 'Libur santri', ikon: PhAirplaneTilt, ket: 'Periode libur: peserta, pulang, kembali tepat/terlambat' },
  { k: 'pengajuan', n: sesi.isAdmin || sesi.pimpinanTinggi ? 'Pengajuan pegawai' : 'Pengajuan saya', ikon: PhFileText, ket: 'Izin, sakit, cuti, dinas luar per pegawai (kali dan hari)' },
  (sesi.isAdmin || sesi.pimpinanTinggi || (sesi.tugas?.klinik || []).length) && { k: 'klinik', n: 'Klinik', ikon: PhFirstAidKit, ket: 'Kasus, pemeriksaan, tindak lanjut (tanpa diagnosis)' },
].filter(Boolean))
const jenis = ref(JENIS.value[0].k)
const info = computed(() => JENIS.value.find((j) => j.k === jenis.value) || { n: JUDUL[jenis.value] || '', ket: 'Versi resmi' })
const awal = periodeCepat('bulan'); const mulai = ref(awal.mulai); const selesai = ref(awal.selesai); const cepat = ref('bulan')
const unit = ref(''); const cari = ref('')
onMounted(async () => {
  if (sesi.isAdmin || sesi.pimpinanTinggi) await org.muat()
  if (route.query.resmi) { try { terapkanResmi(await dr.ambil(String(route.query.resmi))); return } catch (e) { ui.toast(e.message, 'galat') } }
  muat()
})
function pilihCepat(k) { cepat.value = k; const p = periodeCepat(k); mulai.value = p.mulai; selesai.value = p.selesai }
watch([mulai, selesai], () => { const p = periodeCepat(cepat.value); if (p.mulai !== mulai.value || p.selesai !== selesai.value) cepat.value = '' })
const muat = () => (resmi.value ? null : ll.muat(jenis.value, mulai.value, selesai.value, unit.value || null))
watch([jenis, unit], muat)
const d = computed(() => (ll.jenis === jenis.value ? ll.data : null))
const per = computed(() => d.value ? `Periode ${formatPanjang(mulai.value)} s.d. ${formatPanjang(selesai.value)}` : '')
const jkTeks = (v) => v || '–'

// ---------- Security ----------
const statSecurity = computed(() => { const r = d.value?.ringkas || {}; return [
  { judul: 'Keluar', nilai: r.keluar, ikon: PhSignOut, warna: 'jadwal', keterangan: 'Dicatat di gerbang' },
  { judul: 'Kembali', nilai: r.kembali, ikon: PhSignIn, warna: 'presensi', keterangan: `${r.terlambat ?? 0} terlambat` },
  { judul: 'Ditolak di gerbang', nilai: r.ditolak, ikon: PhProhibit, warna: 'beranda', keterangan: 'Tanpa izin berlaku' },
  { judul: 'Titipan', nilai: r.titipan, ikon: PhPackage, warna: 'tahfizh', keterangan: `${r.titipan_belum ?? 0} belum diambil` },
  { judul: 'Tamu', nilai: r.tamu, ikon: PhUsers, warna: 'pengumuman', keterangan: `${r.tamu_orang ?? 0} orang` },
  { judul: 'Kunjungan wali', nilai: r.kunjungan, ikon: PhHouseLine, warna: 'santri', keterangan: `${r.kunjungan_luar_jadwal ?? 0} di luar jadwal` },
] })
// ---------- Pengajuan ----------
const pegawaiAju = computed(() => { const q = cari.value.trim().toLowerCase(); return (d.value?.pegawai || []).filter((p) => !q || [p.niy, p.nama, p.unit].join(' ').toLowerCase().includes(q)) })
const jenisAju = computed(() => (d.value?.jenis || []).filter((j) => (d.value?.pegawai || []).some((p) => p.per_jenis?.[j.id])))
const sel = (p, j) => { const x = p.per_jenis?.[j.id]; return x ? `${x.kali}× / ${x.hari} hr` : '–' }
// ---------- Klinik ----------
const BARIS_KLINIK = [['kasus', 'Kasus baru'], ['rujukan', 'Rujukan pengasuh/absensi'], ['datang_sendiri', 'Datang sendiri'], ['pemeriksaan', 'Pemeriksaan'], ['kontrol', 'Kontrol'],
  ['kembali', 'Kembali beraktivitas'], ['istirahat', 'Istirahat di kamar'], ['rawat', 'Dirawat di klinik'], ['rujuk', 'Dirujuk RS/puskesmas'], ['pulang', 'Dipulangkan'], ['sembuh', 'Dinyatakan sembuh'], ['surat_sakit', 'Surat keterangan sakit']]
const TL = { kembali: 'Kembali beraktivitas', istirahat: 'Istirahat', rawat: 'Dirawat', rujuk: 'Dirujuk', pulang: 'Dipulangkan' }
const total = (k) => (d.value?.per_klinik || []).reduce((n, x) => n + (x[k] || 0), 0)
const statKlinik = computed(() => [
  { judul: 'Kasus baru', nilai: total('kasus'), ikon: PhUserList, warna: 'klinik', keterangan: `${total('datang_sendiri')} datang sendiri` },
  { judul: 'Pemeriksaan', nilai: total('pemeriksaan'), ikon: PhStethoscope, warna: 'presensi', keterangan: `${total('kontrol')} kontrol` },
  { judul: 'Dirawat/istirahat', nilai: total('rawat') + total('istirahat'), ikon: PhBed, warna: 'tahfizh', keterangan: `${total('rujuk')} dirujuk keluar` },
  { judul: 'Sembuh', nilai: total('sembuh'), ikon: PhHeartbeat, warna: 'santri', keterangan: `${total('surat_sakit')} surat sakit` },
])

// ---------- Excel ----------
async function excel() {
  const XLSX = await import('xlsx'); const wb = XLSX.utils.book_new()
  const lembar = (nama, judul, kepala, isi, lebar) => {
    const ws = XLSX.utils.aoa_to_sheet([[judul], [per.value], [], kepala, ...isi]); ws['!cols'] = lebar.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, nama)
  }
  const s = (x) => [x.nis, x.nama, jkTeks(x.jk), x.kelas || '', x.kamar || '']
  if (jenis.value === 'security') {
    lembar('Harian', 'LAPORAN SECURITY – HARIAN', ['Tanggal', 'Keluar', 'Kembali', 'Terlambat', 'Ditolak', 'Titipan', 'Tamu', 'Kunjungan'],
      d.value.harian.map((h) => [formatPendek(h.tanggal), h.keluar, h.kembali, h.terlambat, h.ditolak, h.titipan, h.tamu, h.kunjungan]), [12, 8, 8, 10, 8, 8, 8, 10])
    lembar('Terlambat kembali', 'SANTRI TERLAMBAT KEMBALI', ['No', 'NIS', 'Nama', 'JK', 'Kelas', 'Kamar', 'Waktu kembali', 'Terlambat (menit)', 'Alasan izin'],
      d.value.terlambat.map((x, i) => [i + 1, ...s(x), formatWaktu(x.waktu), x.menit, x.alasan || '']), [5, 10, 26, 4, 8, 16, 16, 10, 30])
    lembar('Ditolak', 'SANTRI DITOLAK DI GERBANG', ['No', 'NIS', 'Nama', 'JK', 'Kelas', 'Kamar', 'Waktu', 'Catatan'],
      d.value.ditolak_daftar.map((x, i) => [i + 1, ...s(x), formatWaktu(x.waktu), x.catatan || '']), [5, 10, 26, 4, 8, 16, 16, 30])
    lembar('Titipan belum diambil', 'TITIPAN BELUM DIAMBIL', ['No', 'NIS', 'Nama', 'JK', 'Kelas', 'Kamar', 'Diterima', 'Jenis', 'Uraian', 'Pengirim'],
      d.value.titipan_belum_daftar.map((x, i) => [i + 1, ...s(x), formatWaktu(x.diterima), x.jenis, x.uraian || '', x.pengirim || '']), [5, 10, 26, 4, 8, 16, 16, 10, 26, 18])
  } else if (jenis.value === 'libur') {
    lembar('Periode libur', 'LAPORAN LIBUR SANTRI', ['No', 'Periode', 'Pulang', 'Batas kembali', 'Peserta', 'Boleh', 'Tidak', 'Sudah pulang', 'Kembali tepat', 'Terlambat', 'Belum kembali'],
      d.value.periode.map((p, i) => [i + 1, p.nama, formatWaktu(p.pulang_pada), formatWaktu(p.kembali_batas), p.peserta, p.boleh, p.tidak, p.pulang, p.kembali_tepat, p.kembali_terlambat, p.belum_kembali]),
      [5, 30, 16, 16, 9, 8, 8, 12, 12, 10, 12])
    lembar('Terlambat & belum kembali', 'SANTRI TERLAMBAT ATAU BELUM KEMBALI', ['No', 'NIS', 'Nama', 'JK', 'Kelas', 'Kamar', 'Periode', 'Batas kembali', 'Kembali', 'Keadaan'],
      d.value.masalah.map((x, i) => [i + 1, ...s(x), x.periode, formatWaktu(x.batas), x.kembali ? formatWaktu(x.kembali) : '', x.keadaan]), [5, 10, 26, 4, 8, 16, 26, 16, 16, 16])
  } else if (jenis.value === 'pengajuan') {
    lembar('Pengajuan', 'REKAP PENGAJUAN PEGAWAI', ['No', 'NIY', 'Nama', 'JK', 'Bidang/unit', ...jenisAju.value.map((j) => j.nama), 'Total hari', 'Menunggu', 'Ditolak'],
      pegawaiAju.value.map((p, i) => [i + 1, p.niy || '', p.nama, jkTeks(p.jk), p.unit || '', ...jenisAju.value.map((j) => sel(p, j)), p.total_hari, p.menunggu, p.ditolak]),
      [5, 16, 30, 4, 22, ...jenisAju.value.map(() => 12), 10, 10, 9])
  } else {
    lembar('Ringkasan', 'LAPORAN KLINIK', ['Uraian', ...d.value.per_klinik.map((k) => 'Klinik ' + k.klinik), 'Jumlah'],
      BARIS_KLINIK.map(([k, n]) => [n, ...d.value.per_klinik.map((x) => x[k]), total(k)]), [28, 14, 14, 10])
    lembar('Kasus', 'DAFTAR KASUS KLINIK', ['No', 'NIS', 'Nama', 'JK', 'Kelas', 'Kamar', 'Dibuka', 'Klinik', 'Keluhan', 'Tindak lanjut', 'Status'],
      d.value.kasus.map((x, i) => [i + 1, ...s(x), formatWaktu(x.dibuka), x.klinik, x.keluhan, TL[x.tindak_lanjut] || '', x.hasil === 'sembuh' ? 'Sembuh' : x.status === 'selesai' ? 'Selesai' : 'Ditangani']),
      [5, 10, 26, 4, 8, 16, 16, 8, 30, 18, 10])
  }
  XLSX.writeFile(wb, `Laporan-${info.value.n.replace(/\s+/g, '-')}-${mulai.value}-sd-${selesai.value}.xlsx`)
}

// ---------- Cetak ----------
const pratinjau = ref(false); const penanda = ref({ jabatan: 'Direktur', nama: '', niy: '' })
const JUDUL = { security: 'Laporan Security', libur: 'Laporan Libur Santri', pengajuan: 'Rekap Pengajuan Pegawai', klinik: 'Laporan Klinik' }
const jabPenanda = computed(() => (['security', 'libur', 'klinik'].includes(jenis.value) ? 'Kepala Bidang Kesantrian' : 'Direktur'))
async function cetak() {
  if (!resmi.value) penanda.value = await ambilPenandaTangan(jabPenanda.value).catch(() => penanda.value)
  pratinjau.value = true
}

// ---------- Terbitkan resmi ----------
const namaUnit = computed(() => (resmi.value ? resmi.value.isi?.param?.namaUnit : unit.value ? org.cariUnit(unit.value)?.nama : ''))
const kunci = computed(() => (d.value && !resmi.value
  ? ['layanan', jenis.value, jenis.value === 'pengajuan' && !(sesi.isAdmin || sesi.pimpinanTinggi) ? sesi.pengguna?.id : unit.value || '-', mulai.value, selesai.value].join('|') : ''))
const isiBeku = () => ({ versi: 1, param: { jenis: jenis.value, unit: unit.value, mulai: mulai.value, selesai: selesai.value, namaUnit: namaUnit.value || '' }, data: d.value })
function terapkanResmi(x) {
  const p = x.isi?.param; if (!p) return ui.toast('Salinan beku dokumen tidak dapat dibaca.', 'galat')
  resmi.value = x; cari.value = ''
  jenis.value = p.jenis; unit.value = p.unit; mulai.value = p.mulai; selesai.value = p.selesai
  ll.jenis = p.jenis; ll.data = x.isi.data
  if (route.query.resmi !== x.id) router.replace({ query: { ...route.query, resmi: x.id } })
}
function tutupResmi() { resmi.value = null; const q = { ...route.query }; delete q.resmi; router.replace({ query: q }); muat() }
const ada = computed(() => !!d.value)
</script>
<template>
  <div class="space-y-4">
    <fieldset :disabled="!!resmi" :class="['kartu min-w-0 space-y-4 p-4', resmi && 'opacity-60']">
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis laporan layanan">
        <button v-for="j in JENIS" :key="j.k" type="button" role="radio" :aria-checked="jenis === j.k" @click="jenis = j.k"
          :class="['flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-semibold', jenis === j.k ? 'border-transparent bg-[#C7332F] text-white' : 'border-garis bg-permukaan text-teks2 hover:text-teks']">
          <component :is="j.ikon" :size="18" weight="duotone" /> {{ j.n }}</button>
      </div>
      <p class="text-sm text-teks2">{{ info.ket }}.</p>
      <label v-if="jenis === 'pengajuan' && (sesi.isAdmin || sesi.pimpinanTinggi)" class="block max-w-md"><span class="label-isian">Bidang/unit</span>
        <select v-model="unit" class="isian"><option value="">Semua yang dapat Anda lihat</option>
          <option v-for="u in org.datar" :key="u.id" :value="u.id">{{ ' '.repeat(u.tingkat * 2) }}{{ u.nama }}</option></select></label>
      <div class="flex flex-wrap gap-2">
        <button v-for="p in PERIODE_CEPAT" :key="p.k" type="button" @click="pilihCepat(p.k)"
          :class="['min-h-[40px] rounded-full border px-3.5 text-sm font-semibold', cepat === p.k ? 'border-transparent bg-[#C7332F] text-white' : 'border-garis bg-permukaan text-teks2']">{{ p.n }}</button>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <InputTanggal v-model="mulai" label="Dari tanggal" />
        <InputTanggal v-model="selesai" label="Sampai tanggal" />
        <button type="button" class="tombol-utama" :disabled="ll.memuat" @click="muat"><PhMagnifyingGlass :size="20" weight="bold" /> Tampilkan</button>
      </div>
    </fieldset>

    <PanelResmi v-if="d || resmi" :kunci="kunci" :beku="resmi" jenis="laporan_layanan" :jenis-nama="JUDUL[jenis]" :perihal="JUDUL[jenis]"
      :periode="`${formatPendek(mulai)} s.d. ${formatPendek(selesai)}`" :subjek="namaUnit || ''" kop="pondok" tautan="/rekap/layanan" :isi="isiBeku" :penanda-jabatan="jabPenanda"
      @buka="terapkanResmi" @tutup="tutupResmi" />

    <p v-if="ll.memuat" class="py-10 text-center text-teks3">Menyusun laporan…</p>
    <p v-else-if="ll.galat" class="kartu w-beranda flex items-center gap-2 p-5 text-sm font-semibold"><PhWarningCircle :size="22" weight="duotone" style="color: var(--c)" /> {{ ll.galat }}</p>
    <template v-else-if="d">
      <div class="flex flex-wrap items-center gap-2">
        <label v-if="jenis === 'pengajuan'" class="relative min-w-[14rem] flex-1"><span class="sr-only">Cari pegawai</span>
          <PhMagnifyingGlass :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" class="isian pl-10" placeholder="Cari NIY, nama, atau bidang" /></label>
        <span v-else class="flex-1" />
        <button type="button" class="tombol-garis" :disabled="!ada" @click="excel"><PhFileXls :size="18" weight="duotone" /> Excel</button>
        <button type="button" class="tombol-garis" :disabled="!ada" @click="cetak"><PhPrinter :size="18" weight="duotone" /> Cetak</button>
      </div>

      <!-- SECURITY -->
      <template v-if="jenis === 'security'">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"><KartuStatistik v-for="s in statSecurity" :key="s.judul" v-bind="s" /></div>
        <section class="kartu overflow-x-auto">
          <h3 class="judul-bagian px-4 pt-4">Rekap harian</h3>
          <table class="mt-2 w-full text-sm">
            <thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>Tanggal</th><th class="text-right">Keluar</th><th class="text-right">Kembali</th><th class="text-right">Terlambat</th><th class="text-right">Ditolak</th><th class="text-right">Titipan</th><th class="text-right">Tamu</th><th class="text-right">Kunjungan</th></tr></thead>
            <tbody><tr v-for="h in d.harian" :key="h.tanggal" class="border-b border-garis last:border-0 tabular-nums [&>td]:p-2.5">
              <td class="whitespace-nowrap">{{ formatPendek(h.tanggal) }} <span class="text-xs text-teks3">{{ hariSingkat(h.tanggal) }}</span></td>
              <td class="text-right">{{ h.keluar }}</td><td class="text-right">{{ h.kembali }}</td><td :class="['text-right', h.terlambat && 'font-bold text-[rgb(var(--merah))]']">{{ h.terlambat }}</td>
              <td class="text-right">{{ h.ditolak }}</td><td class="text-right">{{ h.titipan }}</td><td class="text-right">{{ h.tamu }}</td><td class="text-right">{{ h.kunjungan }}</td></tr></tbody>
          </table>
        </section>
        <section v-for="blok in [{ k: 'terlambat', n: 'Santri terlambat kembali', ikon: PhClockCountdown }, { k: 'ditolak_daftar', n: 'Santri ditolak di gerbang', ikon: PhProhibit }, { k: 'titipan_belum_daftar', n: 'Titipan belum diambil', ikon: PhHourglass }]"
          :key="blok.k" class="kartu p-4">
          <h3 class="judul-bagian flex items-center gap-2"><component :is="blok.ikon" :size="20" weight="duotone" /> {{ blok.n }} <span class="lencana">{{ d[blok.k].length }}</span></h3>
          <p v-if="!d[blok.k].length" class="py-4 text-sm text-teks3">Tidak ada.</p>
          <ul v-else class="mt-2 divide-y divide-garis">
            <li v-for="(x, i) in d[blok.k]" :key="i" class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-sm">
              <span class="w-16 tabular-nums text-teks3">{{ x.nis }}</span><span class="font-semibold">{{ x.nama }}</span><span class="text-xs text-teks3">{{ jkTeks(x.jk) }} · {{ x.kelas || '–' }} · {{ x.kamar || '–' }}</span>
              <span class="ml-auto text-xs text-teks2">{{ formatWaktu(x.waktu || x.diterima) }}{{ x.menit ? ` · terlambat ${x.menit} menit` : '' }}{{ x.uraian ? ` · ${x.uraian}` : '' }}{{ x.catatan ? ` · ${x.catatan}` : '' }}</span>
            </li>
          </ul>
        </section>
      </template>

      <!-- LIBUR -->
      <template v-else-if="jenis === 'libur'">
        <p v-if="!d.periode.length" class="kartu p-8 text-center text-teks3">Tidak ada periode libur yang pulangnya dalam rentang ini.</p>
        <section v-for="p in d.periode" :key="p.id" class="kartu p-4">
          <div class="flex flex-wrap items-baseline gap-2"><h3 class="judul-bagian flex-1">{{ p.nama }}</h3><span class="text-xs text-teks3">Pulang {{ formatWaktu(p.pulang_pada) }} · batas kembali {{ formatWaktu(p.kembali_batas) }}</span></div>
          <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-7">
            <div v-for="[k, n, w] in [['peserta', 'Peserta', 'santri'], ['boleh', 'Boleh libur', 'presensi'], ['tidak', 'Tidak libur', 'beranda'], ['pulang', 'Sudah pulang', 'jadwal'], ['kembali_tepat', 'Kembali tepat', 'presensi'], ['kembali_terlambat', 'Terlambat', 'tahfizh'], ['belum_kembali', 'Belum kembali', 'klinik']]"
              :key="k" :class="['rounded-xl p-2 text-center', 'w-' + w]" style="background: color-mix(in srgb, var(--c) 10%, transparent)">
              <p class="text-xl font-extrabold tabular-nums">{{ p[k] }}</p><p class="text-xs text-teks2">{{ n }}</p></div>
          </div>
        </section>
        <section class="kartu p-4">
          <h3 class="judul-bagian">Santri terlambat atau belum kembali <span class="lencana">{{ d.masalah.length }}</span></h3>
          <p v-if="!d.masalah.length" class="py-4 text-sm text-teks3">Tidak ada.</p>
          <ul v-else class="mt-2 divide-y divide-garis">
            <li v-for="(x, i) in d.masalah" :key="i" class="flex flex-wrap items-baseline gap-x-3 py-2 text-sm">
              <span class="w-16 tabular-nums text-teks3">{{ x.nis }}</span><span class="font-semibold">{{ x.nama }}</span><span class="text-xs text-teks3">{{ jkTeks(x.jk) }} · {{ x.kelas || '–' }} · {{ x.kamar || '–' }}</span>
              <span :class="['lencana ml-auto', x.kembali ? 'w-tahfizh' : 'w-beranda']">{{ x.keadaan }}{{ x.menit ? ` ${x.menit} menit` : '' }}</span></li>
          </ul>
        </section>
      </template>

      <!-- PENGAJUAN -->
      <template v-else-if="jenis === 'pengajuan'">
        <p v-if="!pegawaiAju.length" class="kartu p-8 text-center text-teks3">Tidak ada data.</p>
        <div v-else class="kartu overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>NIY</th><th>Nama</th><th>JK</th><th v-for="j in jenisAju" :key="j.id" class="text-right">{{ j.nama }}</th>
              <th class="text-right">Total hari</th><th class="text-right">Menunggu</th><th class="text-right">Ditolak</th></tr></thead>
            <tbody><tr v-for="p in pegawaiAju" :key="p.employee_id" class="border-b border-garis last:border-0 [&>td]:p-2.5">
              <td class="whitespace-nowrap text-xs tabular-nums">{{ p.niy || '–' }}</td><td><span class="block font-semibold">{{ p.nama }}</span><span class="block text-xs text-teks3">{{ p.unit || '–' }}</span></td><td>{{ jkTeks(p.jk) }}</td>
              <td v-for="j in jenisAju" :key="j.id" class="whitespace-nowrap text-right tabular-nums">{{ sel(p, j) }}</td>
              <td class="text-right font-bold tabular-nums">{{ p.total_hari }}</td><td class="text-right tabular-nums">{{ p.menunggu }}</td><td class="text-right tabular-nums">{{ p.ditolak }}</td></tr></tbody>
          </table>
        </div>
        <p class="text-xs text-teks3">Angka "kali / hari" hanya pengajuan yang disetujui; hari dihitung yang jatuh di dalam periode.</p>
      </template>

      <!-- KLINIK -->
      <template v-else-if="jenis === 'klinik'">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><KartuStatistik v-for="s in statKlinik" :key="s.judul" v-bind="s" /></div>
        <div class="grid gap-4 lg:grid-cols-2">
          <section class="kartu overflow-x-auto">
            <h3 class="judul-bagian px-4 pt-4">Ringkasan per klinik</h3>
            <table class="mt-2 w-full text-sm"><thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>Uraian</th><th v-for="k in d.per_klinik" :key="k.klinik" class="text-right capitalize">{{ k.klinik }}</th><th class="text-right">Jumlah</th></tr></thead>
              <tbody><tr v-for="[k, n] in BARIS_KLINIK" :key="k" class="border-b border-garis last:border-0 tabular-nums [&>td]:p-2.5"><td>{{ n }}</td><td v-for="x in d.per_klinik" :key="x.klinik" class="text-right">{{ x[k] }}</td><td class="text-right font-bold">{{ total(k) }}</td></tr></tbody></table>
          </section>
          <section class="kartu overflow-x-auto">
            <h3 class="judul-bagian px-4 pt-4">Rekap harian</h3>
            <table class="mt-2 w-full text-sm"><thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>Tanggal</th><th class="text-right">Kasus baru</th><th class="text-right">Pemeriksaan</th><th class="text-right">Dirawat/istirahat</th></tr></thead>
              <tbody><tr v-for="h in d.harian" :key="h.tanggal" class="border-b border-garis last:border-0 tabular-nums [&>td]:p-2.5"><td>{{ formatPendek(h.tanggal) }} <span class="text-xs text-teks3">{{ hariSingkat(h.tanggal) }}</span></td>
                <td class="text-right">{{ h.kasus }}</td><td class="text-right">{{ h.pemeriksaan }}</td><td class="text-right">{{ h.dirawat }}</td></tr></tbody></table>
          </section>
        </div>
        <section class="kartu overflow-x-auto">
          <h3 class="judul-bagian px-4 pt-4">Daftar kasus <span class="lencana">{{ d.kasus.length }}</span></h3>
          <table class="mt-2 w-full text-sm"><thead><tr class="border-b border-garis text-left [&>th]:p-2.5"><th>NIS</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Dibuka</th><th>Klinik</th><th>Keluhan</th><th>Tindak lanjut</th></tr></thead>
            <tbody><tr v-for="(x, i) in d.kasus" :key="i" class="border-b border-garis last:border-0 [&>td]:p-2.5"><td class="tabular-nums text-xs">{{ x.nis }}</td><td class="font-semibold">{{ x.nama }}</td><td>{{ jkTeks(x.jk) }}</td><td>{{ x.kelas || '–' }}</td>
              <td class="whitespace-nowrap text-xs">{{ formatWaktu(x.dibuka) }}</td><td class="capitalize">{{ x.klinik }}</td><td class="text-xs">{{ x.keluhan }}</td><td class="text-xs">{{ TL[x.tindak_lanjut] || '–' }}{{ x.hasil === 'sembuh' ? ' · sembuh' : '' }}</td></tr></tbody></table>
        </section>
      </template>
    </template>

    <!-- CETAK F4 -->
    <DokumenCetak v-if="d" v-model:pratinjau="pratinjau" kop="pondok" :judul="JUDUL[jenis]" :subjudul="per" :mendatar="jenis === 'pengajuan' && jenisAju.length > 4" :pencetak="sesi.pengguna?.nama_lengkap">
      <template v-if="jenis === 'security'">
        <table class="tabel kecil"><colgroup><col style="width:16%"><col span="7" style="width:12%"></colgroup>
          <thead><tr><th>Tanggal</th><th>Keluar</th><th>Kembali</th><th>Terlambat</th><th>Ditolak</th><th>Titipan</th><th>Tamu</th><th>Kunjungan</th></tr></thead>
          <tbody>
            <tr v-for="h in d.harian" :key="h.tanggal"><td class="tengah">{{ formatPendek(h.tanggal) }}</td><td class="tengah">{{ h.keluar }}</td><td class="tengah">{{ h.kembali }}</td><td class="tengah">{{ h.terlambat }}</td>
              <td class="tengah">{{ h.ditolak }}</td><td class="tengah">{{ h.titipan }}</td><td class="tengah">{{ h.tamu }}</td><td class="tengah">{{ h.kunjungan }}</td></tr>
            <tr><th>Jumlah</th><th>{{ d.ringkas.keluar }}</th><th>{{ d.ringkas.kembali }}</th><th>{{ d.ringkas.terlambat }}</th><th>{{ d.ringkas.ditolak }}</th><th>{{ d.ringkas.titipan }}</th><th>{{ d.ringkas.tamu }}</th><th>{{ d.ringkas.kunjungan }}</th></tr>
          </tbody></table>
        <p style="margin: 4pt 0 8pt; font-size: 8.5pt">Titipan: {{ d.ringkas.titipan_diambil }} diambil, {{ d.ringkas.titipan_dikembalikan }} dikembalikan, {{ d.ringkas.titipan_belum }} belum diambil. Tamu {{ d.ringkas.tamu_orang }} orang. Kunjungan di luar jadwal {{ d.ringkas.kunjungan_luar_jadwal }}.</p>
        <p style="margin-bottom: 3pt; font-weight: 700">Santri terlambat kembali</p>
        <table class="tabel kecil rapat"><colgroup><col style="width:5%"><col style="width:10%"><col style="width:21%"><col style="width:5%"><col style="width:7%"><col style="width:13%"><col style="width:14%"><col style="width:10%"><col style="width:15%"></colgroup>
          <thead><tr><th>No.</th><th>NIS</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Kamar</th><th>Waktu kembali</th><th>Terlambat (menit)</th><th>Alasan izin</th></tr></thead>
          <tbody><tr v-for="(x, i) in d.terlambat" :key="i"><td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ x.nis }}</td><td>{{ x.nama }}</td><td class="tengah">{{ jkTeks(x.jk) }}</td><td class="tengah">{{ x.kelas || '–' }}</td><td>{{ x.kamar || '–' }}</td>
            <td class="tengah">{{ formatWaktu(x.waktu) }}</td><td class="tengah">{{ x.menit }}</td><td>{{ x.alasan || '' }}</td></tr>
            <tr v-if="!d.terlambat.length"><td colspan="9" class="tengah">Tidak ada</td></tr></tbody></table>
        <p style="margin: 8pt 0 3pt; font-weight: 700">Santri ditolak di gerbang</p>
        <table class="tabel kecil"><colgroup><col style="width:5%"><col style="width:10%"><col style="width:24%"><col style="width:5%"><col style="width:8%"><col style="width:14%"><col style="width:14%"><col style="width:20%"></colgroup>
          <thead><tr><th>No.</th><th>NIS</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Kamar</th><th>Waktu</th><th>Catatan</th></tr></thead>
          <tbody><tr v-for="(x, i) in d.ditolak_daftar" :key="i"><td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ x.nis }}</td><td>{{ x.nama }}</td><td class="tengah">{{ jkTeks(x.jk) }}</td><td class="tengah">{{ x.kelas || '–' }}</td><td>{{ x.kamar || '–' }}</td>
            <td class="tengah">{{ formatWaktu(x.waktu) }}</td><td>{{ x.catatan || '' }}</td></tr>
            <tr v-if="!d.ditolak_daftar.length"><td colspan="8" class="tengah">Tidak ada</td></tr></tbody></table>
      </template>
      <template v-else-if="jenis === 'libur'">
        <table class="tabel kecil rapat"><colgroup><col style="width:4%"><col style="width:22%"><col style="width:12%"><col style="width:12%"><col span="7" style="width:7%"></colgroup>
          <thead><tr><th>No.</th><th>Periode</th><th>Pulang</th><th>Batas kembali</th><th>Peserta</th><th>Boleh</th><th>Tidak</th><th>Sudah pulang</th><th>Kembali tepat</th><th>Terlambat</th><th>Belum kembali</th></tr></thead>
          <tbody><tr v-for="(p, i) in d.periode" :key="p.id"><td class="tengah">{{ i + 1 }}</td><td>{{ p.nama }}</td><td class="tengah">{{ formatWaktu(p.pulang_pada) }}</td><td class="tengah">{{ formatWaktu(p.kembali_batas) }}</td>
            <td class="tengah">{{ p.peserta }}</td><td class="tengah">{{ p.boleh }}</td><td class="tengah">{{ p.tidak }}</td><td class="tengah">{{ p.pulang }}</td><td class="tengah">{{ p.kembali_tepat }}</td><td class="tengah">{{ p.kembali_terlambat }}</td><td class="tengah">{{ p.belum_kembali }}</td></tr>
            <tr v-if="!d.periode.length"><td colspan="11" class="tengah">Tidak ada periode libur</td></tr></tbody></table>
        <p style="margin: 8pt 0 3pt; font-weight: 700">Santri terlambat atau belum kembali</p>
        <table class="tabel kecil"><colgroup><col style="width:5%"><col style="width:10%"><col style="width:22%"><col style="width:5%"><col style="width:8%"><col style="width:14%"><col style="width:14%"><col style="width:22%"></colgroup>
          <thead><tr><th>No.</th><th>NIS</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Kamar</th><th>Batas kembali</th><th>Keadaan</th></tr></thead>
          <tbody><tr v-for="(x, i) in d.masalah" :key="i"><td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ x.nis }}</td><td>{{ x.nama }}</td><td class="tengah">{{ jkTeks(x.jk) }}</td><td class="tengah">{{ x.kelas || '–' }}</td><td>{{ x.kamar || '–' }}</td>
            <td class="tengah">{{ formatWaktu(x.batas) }}</td><td>{{ x.keadaan }}{{ x.kembali ? ` (${formatWaktu(x.kembali)})` : '' }}</td></tr>
            <tr v-if="!d.masalah.length"><td colspan="8" class="tengah">Tidak ada</td></tr></tbody></table>
      </template>
      <template v-else-if="jenis === 'pengajuan'">
        <table class="tabel kecil rapat">
          <thead><tr><th style="width:4%">No.</th><th style="width:12%">NIY</th><th>Nama</th><th style="width:4%">JK</th><th>Bidang/unit</th><th v-for="j in jenisAju" :key="j.id">{{ j.nama }}</th><th>Total hari</th><th>Menunggu</th><th>Ditolak</th></tr></thead>
          <tbody><tr v-for="(p, i) in pegawaiAju" :key="p.employee_id"><td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ p.niy || '–' }}</td><td>{{ p.nama }}</td><td class="tengah">{{ jkTeks(p.jk) }}</td><td>{{ p.unit || '–' }}</td>
            <td v-for="j in jenisAju" :key="j.id" class="tengah">{{ sel(p, j) }}</td><td class="tengah">{{ p.total_hari }}</td><td class="tengah">{{ p.menunggu }}</td><td class="tengah">{{ p.ditolak }}</td></tr></tbody></table>
        <p style="margin-top: 4pt; font-size: 8pt">Kali / hari: pengajuan yang disetujui; hari dihitung yang jatuh di dalam periode.</p>
      </template>
      <template v-else>
        <table class="tabel kecil"><colgroup><col style="width:40%"><col v-for="k in d.per_klinik" :key="k.klinik" style="width:18%"><col style="width:18%"></colgroup>
          <thead><tr><th>Uraian</th><th v-for="k in d.per_klinik" :key="k.klinik">Klinik {{ k.klinik }}</th><th>Jumlah</th></tr></thead>
          <tbody><tr v-for="[k, n] in BARIS_KLINIK" :key="k"><td>{{ n }}</td><td v-for="x in d.per_klinik" :key="x.klinik" class="tengah">{{ x[k] }}</td><td class="tengah">{{ total(k) }}</td></tr></tbody></table>
        <p style="margin: 8pt 0 3pt; font-weight: 700">Daftar kasus</p>
        <table class="tabel kecil"><colgroup><col style="width:4%"><col style="width:9%"><col style="width:19%"><col style="width:4%"><col style="width:7%"><col style="width:13%"><col style="width:7%"><col style="width:22%"><col style="width:15%"></colgroup>
          <thead><tr><th>No.</th><th>NIS</th><th>Nama</th><th>JK</th><th>Kelas</th><th>Dibuka</th><th>Klinik</th><th>Keluhan</th><th>Tindak lanjut</th></tr></thead>
          <tbody><tr v-for="(x, i) in d.kasus" :key="i"><td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ x.nis }}</td><td>{{ x.nama }}</td><td class="tengah">{{ jkTeks(x.jk) }}</td><td class="tengah">{{ x.kelas || '–' }}</td>
            <td class="tengah">{{ formatWaktu(x.dibuka) }}</td><td class="tengah">{{ x.klinik }}</td><td>{{ x.keluhan }}</td><td>{{ TL[x.tindak_lanjut] || '–' }}{{ x.hasil === 'sembuh' ? '; sembuh' : '' }}</td></tr>
            <tr v-if="!d.kasus.length"><td colspan="9" class="tengah">Tidak ada</td></tr></tbody></table>
      </template>
      <template #ttd>
        <TtdResmi :dok="resmi" :kiri="{ jabatan: penanda.jabatan || 'Direktur', nama: penanda.nama, niy: penanda.niy }" :kanan="{ jabatan: 'Pencetak', nama: sesi.pengguna?.nama_lengkap, niy: sesi.pengguna?.niy }" />
      </template>
    </DokumenCetak>
  </div>
</template>
