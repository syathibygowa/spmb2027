<!-- SIMKA PRO | src/pages/rekap/RekapPresensi.vue | v1.3 | Fase 8 – Urutan kolom seragam (NIY/NIS > Nama > JK) | 10/10/2026 -->
<script setup>
// Rekap presensi pegawai (admin dan superadmin): harian (semua sesi semua pegawai) dan periode
// (ringkasan per pegawai), saring per bidang, ekspor Excel, dan cetak F4 dengan kop + tanda tangan.
// v1.2: ditanam sebagai tab di menu Rekap (prop tertanam menyembunyikan bilah tab sendiri).
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { PhCalendarCheck, PhCalendarDots, PhMagnifyingGlass, PhEye, PhFileXls, PhArrowClockwise, PhInfo } from '@phosphor-icons/vue'
import { useRekapPresensi } from '@/stores/rekapPresensi'
import { useOrganisasi } from '@/stores/organisasi'
import { useLembaga } from '@/stores/lembaga'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { hariIniISO, formatPanjang, formatPendek, formatJam, formatHari } from '@/lib/tanggal'
import { STATUS_PRESENSI, STATUS_PULANG } from '@/lib/presensi'
import { tambahHari } from '@/lib/shift'
import InputTanggal from '@/components/InputTanggal.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'

const props = defineProps({ tab: { type: String, default: 'harian' }, tertanam: Boolean })
const router = useRouter(); const rp = useRekapPresensi(); const org = useOrganisasi(); const lembaga = useLembaga(); const sesi = useSesi(); const ui = useUI()
const TAB = [{ k: 'harian', n: 'Rekap harian', ikon: PhCalendarCheck, w: 'presensi' }, { k: 'periode', n: 'Rekap bulanan/periode', ikon: PhCalendarDots, w: 'laporan' }]
const aktif = computed(() => TAB.find((t) => t.k === props.tab) || TAB[0])
const unit = ref(''); const cari = ref(''); const memuat = ref(false); const pratinjau = ref(false)
const tgl = ref(hariIniISO()); const harian = ref([]); const saringH = ref('semua')
const awalBulan = (iso) => iso.slice(0, 8) + '01'
const mulai = ref(awalBulan(hariIniISO())); const akhir = ref(hariIniISO()); const periode = ref([])

onMounted(async () => {
  await Promise.all([org.muat(), lembaga.muat()]); muat()
  await nextTick(); document.querySelector('[role=tab][aria-selected=true]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
})
async function muat() {
  memuat.value = true
  try {
    if (aktif.value.k === 'harian') harian.value = await rp.harian(tgl.value)
    else {
      if (akhir.value < mulai.value) { ui.toast('Tanggal akhir tidak boleh sebelum tanggal mulai.', 'galat'); return }
      periode.value = await rp.periode(mulai.value, akhir.value)
    }
  } catch (e) { ui.toast(e.message, 'galat') } finally { memuat.value = false }
}
watch([() => props.tab, tgl, mulai, akhir], muat)
function bulan(geser) {
  const d = new Date(awalBulan(hariIniISO()) + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + geser)
  mulai.value = d.toISOString().slice(0, 10)
  akhir.value = geser === 0 ? hariIniISO() : tambahHari(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10), -1)
}

const unitCocok = (id) => !unit.value || org.turunan(unit.value).has(id)
const cocokCari = (r) => !cari.value.trim() || [r.nama, r.niy].join(' ').toLowerCase().includes(cari.value.toLowerCase().trim())
const SARING_H = [
  { k: 'semua', n: 'Semua' }, { k: 'belum', n: 'Belum/terlewat' }, { k: 'terlambat', n: 'Terlambat' },
  { k: 'izin', n: 'Izin/sakit/cuti' }, { k: 'tk', n: 'Tanpa keterangan' }, { k: 'verval', n: 'Menunggu verval' },
]
const statusBaris = (r) => r.status ? (STATUS_PRESENSI[r.status] || { n: r.status, w: 'hakakses' })
  : r.keadaan === 'terbuka' ? { n: 'Belum presensi', w: 'santri' } : r.keadaan === 'akan_datang' ? { n: 'Akan datang', w: 'hakakses' } : { n: r.opsional ? 'Tidak dipakai' : 'Terlewat', w: r.opsional ? 'hakakses' : 'beranda' }
const tampilH = computed(() => harian.value.filter((r) => unitCocok(r.org_unit_id) && cocokCari(r) && (
  saringH.value === 'semua' || (saringH.value === 'belum' && !r.status && !r.opsional) || (saringH.value === 'terlambat' && r.status === 'terlambat')
  || (saringH.value === 'izin' && ['izin', 'sakit', 'cuti'].includes(r.status)) || (saringH.value === 'tk' && r.status === 'tanpa_keterangan')
  || (saringH.value === 'verval' && (r.status === 'menunggu_verval' || r.status_pulang === 'menunggu_verval')))))
const ringkasH = computed(() => {
  const w = harian.value.filter((r) => !r.opsional && unitCocok(r.org_unit_id))
  const n = (f) => w.filter(f).length
  return { wajib: w.length, hadir: n((r) => ['hadir', 'terlambat', 'dinas_luar'].includes(r.status)), terlambat: n((r) => r.status === 'terlambat'),
    izin: n((r) => ['izin', 'sakit', 'cuti'].includes(r.status)), tk: n((r) => r.status === 'tanpa_keterangan' || (!r.status && r.keadaan === 'terlewat')), belum: n((r) => !r.status && r.keadaan !== 'terlewat') }
})
const tampilP = computed(() => periode.value.filter((r) => unitCocok(r.org_unit_id) && cocokCari(r)))
const totalP = computed(() => {
  const t = { sesi: 0, hadir: 0, terlambat: 0, dinas_luar: 0, izin: 0, sakit: 0, cuti: 0, tanpa_keterangan: 0 }
  tampilP.value.forEach((r) => Object.keys(t).forEach((k) => { t[k] += Number(r[k] || 0) }))
  t.persen = t.sesi ? Math.round((1000 * (t.hadir + t.terlambat + t.dinas_luar)) / t.sesi) / 10 : null
  return t
})
const warnaPersen = (p) => (p == null ? 'hakakses' : p >= 90 ? 'presensi' : p >= 75 ? 'tahfizh' : 'beranda')
const jam = (v) => (v ? formatJam(v) : '–')

function ekspor() {
  let kolom; let data; let nama
  if (aktif.value.k === 'harian') {
    kolom = ['No.', 'NIY', 'Nama', 'Bidang/Unit', 'Pola', 'Sesi', 'Jadwal', 'Datang', 'Pulang', 'Status', 'Terlambat (menit)', 'Status pulang', 'Keterangan']
    data = tampilH.value.map((r, i) => [i + 1, r.niy || '', r.nama, r.unit || '', r.nama_pola, r.nama_sesi, `${jam(r.mulai)}–${jam(r.selesai)}`, jam(r.datang_pada), jam(r.pulang_pada),
      statusBaris(r).n, r.terlambat_menit || 0, r.status_pulang ? STATUS_PULANG[r.status_pulang]?.n : '', r.keterangan || ''])
    nama = `Rekap-Presensi-Harian-${formatPendek(tgl.value).replace(/\//g, '-')}.xlsx`
  } else {
    kolom = ['No.', 'NIY', 'Nama', 'Bidang/Unit', 'Jabatan', 'Sesi wajib', 'Hadir', 'Terlambat', 'Menit terlambat', 'Dinas luar', 'Izin', 'Sakit', 'Cuti', 'Tanpa keterangan', 'Menunggu verval', 'Pulang cepat', 'Tidak presensi pulang', 'Kehadiran (%)']
    data = tampilP.value.map((r, i) => [i + 1, r.niy || '', r.nama, r.unit || '', r.jabatan || '', r.sesi, r.hadir, r.terlambat, r.menit_terlambat, r.dinas_luar, r.izin, r.sakit, r.cuti, r.tanpa_keterangan, r.menunggu, r.pulang_cepat, r.tidak_presensi_pulang, r.persen ?? ''])
    nama = `Rekap-Presensi-${formatPendek(mulai.value).replace(/\//g, '-')}_sd_${formatPendek(akhir.value).replace(/\//g, '-')}.xlsx`
  }
  const ws = XLSX.utils.aoa_to_sheet([kolom, ...data])
  ws['!cols'] = kolom.map((k, i) => ({ wch: Math.min(40, Math.max(k.length, ...data.map((r) => String(r[i]).length)) + 2) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rekap presensi'); XLSX.writeFile(wb, nama)
}
const direktur = computed(() => lembaga.signatories.find((s) => /^direktur$/i.test(s.jabatan_tertulis)) || lembaga.signatories[0] || {})
const namaUnit = computed(() => unit.value ? org.cariUnit(unit.value)?.nama : 'Semua bidang')
</script>
<template>
  <div class="w-rekap">
    <div class="layar-saja">
      <nav v-if="!tertanam" class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="Jenis rekap presensi">
        <button v-for="t in TAB" :key="t.k" role="tab" :aria-selected="aktif.k === t.k" @click="router.replace(`/rekap/${t.k}`)"
          :class="['tab flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold', 'w-' + t.w, aktif.k === t.k ? 'aktif text-teks' : 'border-garis bg-permukaan text-teks2 hover:text-teks']">
          <span class="chip-ikon h-8 w-8 rounded-lg"><component :is="t.ikon" :size="20" weight="duotone" /></span><span class="whitespace-nowrap">{{ t.n }}</span>
        </button>
      </nav>

      <!-- Saringan -->
      <div class="kartu mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <template v-if="aktif.k === 'harian'"><InputTanggal v-model="tgl" label="Tanggal" /></template>
        <template v-else>
          <InputTanggal v-model="mulai" label="Dari tanggal" />
          <InputTanggal v-model="akhir" label="Sampai tanggal" />
        </template>
        <div><label class="label-isian" for="rk-unit">Bidang/Unit</label>
          <select id="rk-unit" v-model="unit" class="isian"><option value="">Semua bidang</option>
            <option v-for="u in org.datar" :key="u.id" :value="u.id">{{ '— '.repeat(u.tingkat) }}{{ u.nama }}</option></select></div>
        <div><label class="label-isian" for="rk-cari">Cari pegawai</label>
          <div class="relative"><PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
            <input id="rk-cari" v-model="cari" class="isian pl-10" placeholder="Nama atau NIY" /></div></div>
        <div v-if="aktif.k === 'periode'" class="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button class="tombol-garis min-h-[40px] text-sm" @click="bulan(0)">Bulan ini</button>
          <button class="tombol-garis min-h-[40px] text-sm" @click="bulan(-1)">Bulan lalu</button>
        </div>
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button class="tombol-garis" @click="pratinjau = true"><PhEye :size="20" weight="duotone" /> Pratinjau cetak</button>
        <button class="tombol-garis" @click="ekspor"><PhFileXls :size="20" weight="duotone" /> Ekspor Excel</button>
        <button class="tombol-garis" :disabled="memuat" @click="muat"><PhArrowClockwise :size="20" /> Muat ulang</button>
      </div>
      <p v-if="memuat" class="py-8 text-center text-teks3">Memuat rekap…</p>

      <!-- ===== Harian ===== -->
      <template v-else-if="aktif.k === 'harian'">
        <div class="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <div v-for="k in [['Sesi wajib', ringkasH.wajib, 'hakakses'], ['Hadir', ringkasH.hadir, 'presensi'], ['Terlambat', ringkasH.terlambat, 'tahfizh'], ['Izin/sakit/cuti', ringkasH.izin, 'klinik'], ['Terlewat/TK', ringkasH.tk, 'beranda'], ['Belum/akan datang', ringkasH.belum, 'santri']]"
            :key="k[0]" :class="['rounded-2xl border border-garis p-3', 'w-' + k[2]]" style="background: color-mix(in srgb, var(--c) 8%, rgb(var(--permukaan)))">
            <p class="text-2xl font-extrabold tabular-nums">{{ k[1] }}</p><p class="text-xs font-semibold text-teks2">{{ k[0] }}</p></div>
        </div>
        <div class="mb-3 flex flex-wrap gap-2">
          <button v-for="s in SARING_H" :key="s.k" @click="saringH = s.k" :class="['min-h-[40px] rounded-full border px-3.5 text-sm font-semibold', saringH === s.k ? 'border-transparent bg-[#C7332F] text-white' : 'border-garis bg-permukaan text-teks2']">{{ s.n }}</button>
        </div>
        <div class="kartu hidden overflow-x-auto lg:block">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-garis text-left"><th class="p-3">Nama</th><th class="p-3">Sesi</th><th class="p-3">Jadwal</th><th class="p-3">Datang</th><th class="p-3">Pulang</th><th class="p-3">Status</th><th class="p-3">Keterangan</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in tampilH" :key="i" class="border-b border-garis last:border-0">
                <td class="p-3"><p class="font-semibold">{{ r.nama }}</p><p class="text-xs text-teks3">{{ r.unit }}</p></td>
                <td class="p-3">{{ r.nama_sesi }}<p class="text-xs text-teks3">{{ r.nama_pola }}</p></td>
                <td class="p-3 tabular-nums">{{ jam(r.mulai) }}–{{ jam(r.selesai) }}</td>
                <td class="p-3 tabular-nums">{{ jam(r.datang_pada) }}</td><td class="p-3 tabular-nums">{{ jam(r.pulang_pada) }}</td>
                <td class="p-3"><span :class="['lencana', 'w-' + statusBaris(r).w]">{{ statusBaris(r).n }}{{ r.status === 'terlambat' ? ` ${r.terlambat_menit} mnt` : '' }}</span>
                  <span v-if="r.status_pulang && !['belum', 'tepat'].includes(r.status_pulang)" :class="['lencana ml-1', 'w-' + STATUS_PULANG[r.status_pulang].w]">{{ STATUS_PULANG[r.status_pulang].n }}</span></td>
                <td class="max-w-[16rem] p-3 text-xs text-teks3">{{ r.keterangan }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul class="space-y-2 lg:hidden">
          <li v-for="(r, i) in tampilH" :key="i" :class="['kartu p-3', 'w-' + statusBaris(r).w]">
            <div class="flex items-start gap-2"><p class="min-w-0 flex-1 font-semibold">{{ r.nama }}</p><span class="lencana">{{ statusBaris(r).n }}</span></div>
            <p class="text-sm text-teks2">{{ r.nama_sesi }} · {{ jam(r.mulai) }}–{{ jam(r.selesai) }}</p>
            <p class="text-xs text-teks3">Datang {{ jam(r.datang_pada) }} · Pulang {{ jam(r.pulang_pada) }}{{ r.status === 'terlambat' ? ` · terlambat ${r.terlambat_menit} menit` : '' }}</p>
          </li>
        </ul>
        <p v-if="!tampilH.length" class="py-8 text-center text-teks3">Tidak ada data yang sesuai.</p>
      </template>

      <!-- ===== Periode ===== -->
      <template v-else>
        <p class="mb-3 flex gap-2 text-sm text-teks3"><PhInfo :size="18" class="mt-0.5 shrink-0" />
          Dihitung dari sesi wajib yang tercatat. Sesi yang terlewat masuk hitungan "Tanpa keterangan" setelah penutupan otomatis diaktifkan (Penjadwalan → Aturan umum).</p>
        <div class="kartu hidden overflow-x-auto lg:block">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-garis text-center"><th class="p-3 text-left">Nama</th><th class="p-2">Sesi</th><th class="p-2">Hadir</th><th class="p-2">Terlambat</th><th class="p-2">Dinas luar</th>
              <th class="p-2">Izin</th><th class="p-2">Sakit</th><th class="p-2">Cuti</th><th class="p-2">TK</th><th class="p-2">Pulang cepat</th><th class="p-2">Tdk presensi pulang</th><th class="p-2">Kehadiran</th></tr></thead>
            <tbody>
              <tr v-for="r in tampilP" :key="r.employee_id" class="border-b border-garis text-center last:border-0">
                <td class="p-3 text-left"><p class="font-semibold">{{ r.nama }}</p><p class="text-xs text-teks3">{{ r.unit }}{{ r.jabatan ? ' · ' + r.jabatan : '' }}</p></td>
                <td class="p-2 tabular-nums">{{ r.sesi }}</td><td class="p-2 tabular-nums">{{ r.hadir }}</td>
                <td class="p-2 tabular-nums">{{ r.terlambat }}<span v-if="r.menit_terlambat" class="block text-xs text-teks3">{{ r.menit_terlambat }} mnt</span></td>
                <td class="p-2 tabular-nums">{{ r.dinas_luar }}</td><td class="p-2 tabular-nums">{{ r.izin }}</td><td class="p-2 tabular-nums">{{ r.sakit }}</td><td class="p-2 tabular-nums">{{ r.cuti }}</td>
                <td class="p-2 tabular-nums">{{ r.tanpa_keterangan }}</td><td class="p-2 tabular-nums">{{ r.pulang_cepat }}</td><td class="p-2 tabular-nums">{{ r.tidak_presensi_pulang }}</td>
                <td class="p-2"><span :class="['lencana', 'w-' + warnaPersen(r.persen)]">{{ r.persen == null ? '–' : r.persen.toString().replace('.', ',') + '%' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul class="space-y-2 lg:hidden">
          <li v-for="r in tampilP" :key="r.employee_id" :class="['kartu p-3', 'w-' + warnaPersen(r.persen)]">
            <div class="flex items-start gap-2"><p class="min-w-0 flex-1 font-semibold">{{ r.nama }}</p><span class="lencana">{{ r.persen == null ? '–' : r.persen.toString().replace('.', ',') + '%' }}</span></div>
            <p class="text-xs text-teks3">{{ r.unit }}</p>
            <p class="mt-1 text-sm text-teks2">{{ r.sesi }} sesi · hadir {{ r.hadir }} · terlambat {{ r.terlambat }} · izin {{ r.izin }} · sakit {{ r.sakit }} · TK {{ r.tanpa_keterangan }}</p>
          </li>
        </ul>
        <p v-if="!tampilP.length" class="py-8 text-center text-teks3">Tidak ada data yang sesuai.</p>
      </template>
    </div>

    <!-- Dokumen cetak -->
    <DokumenCetak v-if="aktif.k === 'harian'" v-model:pratinjau="pratinjau" mendatar judul="Rekap Presensi Harian Pegawai" :subjudul="`${formatHari(tgl)} · ${namaUnit}`" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="tabel">
        <colgroup><col style="width:4%"><col style="width:20%"><col style="width:14%"><col style="width:14%"><col style="width:10%"><col style="width:7%"><col style="width:7%"><col style="width:11%"><col style="width:13%"></colgroup>
        <thead><tr><th>No.</th><th>Nama</th><th>Bidang/Unit</th><th>Sesi</th><th>Jadwal</th><th>Datang</th><th>Pulang</th><th>Status</th><th>Keterangan</th></tr></thead>
        <tbody><tr v-for="(r, i) in tampilH" :key="i">
          <td class="tengah">{{ i + 1 }}</td><td>{{ r.nama }}</td><td>{{ r.unit }}</td><td>{{ r.nama_sesi }}</td><td class="tengah">{{ jam(r.mulai) }}–{{ jam(r.selesai) }}</td>
          <td class="tengah">{{ jam(r.datang_pada) }}</td><td class="tengah">{{ jam(r.pulang_pada) }}</td>
          <td>{{ statusBaris(r).n }}{{ r.status === 'terlambat' ? ` ${r.terlambat_menit} mnt` : '' }}{{ r.status_pulang && !['belum', 'tepat'].includes(r.status_pulang) ? '; ' + STATUS_PULANG[r.status_pulang].n : '' }}</td>
          <td>{{ r.keterangan }}</td></tr></tbody>
      </table>
      <p style="margin-top: 6pt">Ringkasan: {{ ringkasH.wajib }} sesi wajib; hadir {{ ringkasH.hadir }}; terlambat {{ ringkasH.terlambat }}; izin/sakit/cuti {{ ringkasH.izin }}; terlewat/tanpa keterangan {{ ringkasH.tk }}; belum/akan datang {{ ringkasH.belum }}.</p>
      <template #ttd>
        <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }" :kanan="{ jabatan: 'Pembuat Rekap', nama: sesi.pengguna?.nama_lengkap || '' }" />
      </template>
    </DokumenCetak>
    <DokumenCetak v-else v-model:pratinjau="pratinjau" mendatar judul="Rekap Presensi Pegawai" :subjudul="`${formatPanjang(mulai)} s.d. ${formatPanjang(akhir)} · ${namaUnit}`" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="tabel">
        <colgroup><col style="width:4%"><col style="width:22%"><col style="width:14%"><col v-for="n in 10" :key="n" style="width:5.4%"><col style="width:6%"></colgroup>
        <thead><tr><th>No.</th><th>Nama</th><th>Bidang/Unit</th><th>Sesi</th><th>Hadir</th><th>Terlambat</th><th>Dinas luar</th><th>Izin</th><th>Sakit</th><th>Cuti</th><th>TK</th><th>Pulang cepat</th><th>Tdk pres. pulang</th><th>%</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in tampilP" :key="r.employee_id">
            <td class="tengah">{{ i + 1 }}</td><td>{{ r.nama }}</td><td>{{ r.unit }}</td>
            <td v-for="k in ['sesi', 'hadir', 'terlambat', 'dinas_luar', 'izin', 'sakit', 'cuti', 'tanpa_keterangan', 'pulang_cepat', 'tidak_presensi_pulang']" :key="k" class="tengah">{{ r[k] }}</td>
            <td class="tengah">{{ r.persen == null ? '–' : String(r.persen).replace('.', ',') }}</td>
          </tr>
          <tr><td colspan="3" class="tengah">Jumlah</td>
            <td v-for="k in ['sesi', 'hadir', 'terlambat', 'dinas_luar', 'izin', 'sakit', 'cuti', 'tanpa_keterangan']" :key="k" class="tengah">{{ totalP[k] }}</td>
            <td class="tengah">–</td><td class="tengah">–</td><td class="tengah">{{ totalP.persen == null ? '–' : String(totalP.persen).replace('.', ',') }}</td></tr>
        </tbody>
      </table>
      <p style="margin-top: 6pt">Keterangan: TK = tanpa keterangan; % = (hadir + terlambat + dinas luar) ÷ sesi wajib.</p>
      <template #ttd>
        <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }" :kanan="{ jabatan: 'Pembuat Rekap', nama: sesi.pengguna?.nama_lengkap || '' }" />
      </template>
    </DokumenCetak>
  </div>
</template>
<style scoped>
.tab.aktif { border-color: color-mix(in srgb, var(--c) 35%, transparent); background: color-mix(in srgb, var(--c) 12%, rgb(var(--permukaan))); }
</style>
