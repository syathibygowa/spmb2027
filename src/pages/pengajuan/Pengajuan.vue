<!-- SIMKA PRO | src/pages/pengajuan/Pengajuan.vue | v1.1 | Fase 8 – Urutan kolom seragam (NIY/NIS > Nama > JK) | 10/10/2026 -->
<script setup>
// Pengajuan izin, sakit, dinas luar, dan cuti. Tab: Pengajuan saya (semua pegawai), Persetujuan (pejabat
// penyetuju dan Plt), Semua (admin ber-izin lihat_pengajuan/superadmin: rekap, Excel, cetak F4), Ketentuan (dibaca semua).
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as XLSX from 'xlsx'
import { PhPlus, PhTray, PhStamp, PhListChecks, PhBookOpen, PhMagnifyingGlass, PhFileXls, PhEye, PhWarning, PhCaretRight } from '@phosphor-icons/vue'
import { usePengajuan } from '@/stores/pengajuan'
import { useLembaga } from '@/stores/lembaga'
import { useOrganisasi } from '@/stores/organisasi'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { hariIniISO, formatPanjang, formatPendek, formatRelatif } from '@/lib/tanggal'
import { STATUS_PENGAJUAN, KELOMPOK, rentangTanggal } from '@/lib/pengajuan'
import LembarBawah from '@/components/LembarBawah.vue'
import TombolAksi from '@/components/TombolAksi.vue'
import InputTanggal from '@/components/InputTanggal.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'
import FormPengajuan from './FormPengajuan.vue'
import DetailPengajuan from './DetailPengajuan.vue'
import TabKetentuan from './TabKetentuan.vue'

const props = defineProps({ id: String })
const router = useRouter(); const route = useRoute(); const pg = usePengajuan(); const lembaga = useLembaga(); const org = useOrganisasi(); const sesi = useSesi(); const ui = useUI()
const bolehSemua = computed(() => sesi.bolehAdmin('lihat_pengajuan'))
const pejabat = computed(() => !!sesi.pengguna?.jabatan_struktural || sesi.isSuperadmin || pg.persetujuan.length > 0)
const TAB = computed(() => [
  { k: 'saya', n: 'Pengajuan saya', ikon: PhTray, w: 'pengajuan' },
  pejabat.value && { k: 'persetujuan', n: 'Persetujuan', ikon: PhStamp, w: 'verifikasi' },
  bolehSemua.value && { k: 'semua', n: 'Semua pengajuan', ikon: PhListChecks, w: 'laporan' },
  { k: 'ketentuan', n: 'Ketentuan', ikon: PhBookOpen, w: 'tahfizh' },
].filter(Boolean))
const tab = ref(route.query.tab || 'saya')
const formBuka = ref(false); const pratinjau = ref(false)
const saring = ref('semua'); const cari = ref(''); const unit = ref('')
const awalBulan = hariIniISO().slice(0, 8) + '01'
const mulai = ref(awalBulan); const akhir = ref(hariIniISO())

onMounted(async () => {
  await Promise.all([pg.muatKetentuan(), lembaga.muat(), org.muat()])
  await Promise.all([pg.muat('saya'), pg.muat('persetujuan')])
  if (props.id && pg.persetujuan.some((r) => r.id === props.id && r.menunggu_saya)) tab.value = 'persetujuan'
  if (tab.value === 'semua' && bolehSemua.value) muatSemua()
  await nextTick(); document.querySelector('[role=tab][aria-selected=true]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
})
async function muatSemua() { try { await pg.muat('semua', { mulai: mulai.value, akhir: akhir.value }) } catch (e) { ui.toast(e.message, 'galat') } }
watch(tab, (t) => { if (t === 'semua') muatSemua(); else if (t !== 'ketentuan') pg.muat(t).catch((e) => ui.toast(e.message, 'galat')) })
watch([mulai, akhir], () => tab.value === 'semua' && muatSemua())

const SARING = [{ k: 'semua', n: 'Semua' }, { k: 'menunggu', n: 'Menunggu' }, { k: 'disetujui', n: 'Disetujui' }, { k: 'ditolak', n: 'Ditolak' }, { k: 'dibatalkan', n: 'Dibatalkan' }]
const sumber = computed(() => (tab.value === 'persetujuan' ? pg.persetujuan : tab.value === 'semua' ? pg.semua : pg.saya))
const tampil = computed(() => {
  const q = cari.value.toLowerCase().trim()
  return sumber.value.filter((r) => (saring.value === 'semua' || r.status === saring.value)
    && (!q || [r.pemohon, r.niy, r.jenis, r.alasan, r.nomor_surat].join(' ').toLowerCase().includes(q))
    && (!unit.value || org.turunan(unit.value).has(org.units.find((u) => u.nama === r.unit)?.id)))
})
const kuotaTampil = computed(() => pg.kuota.filter((k) => k.kuota_tahunan_hari != null || k.batas_bulanan_hari != null || k.batas_bulanan_kali != null))
const sisa = (k) => Math.max((k.kuota_tahunan_hari ?? 0) - (k.dipakai_tahun ?? 0), 0)

const buka = (r) => router.push(`/pengajuan/${r.id}`)
const tutupDetail = () => router.replace('/pengajuan')
function terkirim(id) { formBuka.value = false; tab.value = 'saya'; router.replace(`/pengajuan/${id}`) }
async function berubah() { await Promise.all([pg.muat('saya'), pg.muat('persetujuan')]); if (tab.value === 'semua') muatSemua() }

function ekspor() {
  const kolom = ['No.', 'NIY', 'Pemohon', 'Bidang/Unit', 'Jenis', 'Mulai', 'Selesai', 'Lama (hari)', 'Alasan', 'Status', 'Nomor surat', 'Diajukan']
  const data = tampil.value.map((r, i) => [i + 1, r.niy || '', r.pemohon, r.unit || '', r.jenis, formatPendek(r.mulai), formatPendek(r.selesai), r.jumlah_hari, r.alasan,
    STATUS_PENGAJUAN[r.status].n + (r.status === 'menunggu' && r.jenjang_kini ? ` (${r.jenjang_kini})` : ''), r.nomor_surat || '', formatPendek(r.created_at)])
  const ws = XLSX.utils.aoa_to_sheet([kolom, ...data])
  ws['!cols'] = kolom.map((k, i) => ({ wch: Math.min(48, Math.max(k.length, ...data.map((r) => String(r[i]).length)) + 2) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Pengajuan')
  XLSX.writeFile(wb, `Rekap-Pengajuan-${formatPendek(mulai.value).replace(/\//g, '-')}_sd_${formatPendek(akhir.value).replace(/\//g, '-')}.xlsx`)
}
const direktur = computed(() => lembaga.signatories.find((s) => s.sumber_jabatan === 'DIREKTUR' || /^direktur/i.test(s.jabatan_tertulis)) || lembaga.signatories[0] || {})
</script>
<template>
  <div class="w-pengajuan mx-auto max-w-4xl">
    <div class="layar-saja">
      <nav class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="Bagian pengajuan">
        <button v-for="t in TAB" :key="t.k" role="tab" :aria-selected="tab === t.k" @click="tab = t.k"
          :class="['tab flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold', 'w-' + t.w, tab === t.k ? 'aktif text-teks' : 'border-garis bg-permukaan text-teks2 hover:text-teks']">
          <span class="chip-ikon h-8 w-8 rounded-lg"><component :is="t.ikon" :size="20" weight="duotone" /></span><span class="whitespace-nowrap">{{ t.n }}</span>
          <span v-if="t.k === 'persetujuan' && pg.menungguSaya" class="rounded-full bg-[#C7332F] px-1.5 text-xs text-white">{{ pg.menungguSaya }}</span>
        </button>
        <button class="tombol-utama ml-auto hidden shrink-0 lg:inline-flex" @click="formBuka = true"><PhPlus :size="20" weight="bold" /> Ajukan</button>
      </nav>

      <TabKetentuan v-if="tab === 'ketentuan'" />
      <template v-else>
        <!-- Kuota -->
        <div v-if="tab === 'saya' && kuotaTampil.length" class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div v-for="k in kuotaTampil" :key="k.kode" class="kartu-kuota w-santri rounded-2xl border border-garis p-3">
            <template v-if="k.kuota_tahunan_hari != null">
              <p class="text-2xl font-extrabold tabular-nums">{{ sisa(k) }}<span class="text-sm font-semibold text-teks3"> / {{ k.kuota_tahunan_hari }} hari</span></p>
              <p class="text-xs font-semibold text-teks2">Sisa {{ k.nama.toLowerCase() }} tahun ini</p></template>
            <template v-else>
              <p class="text-2xl font-extrabold tabular-nums">{{ k.batas_bulanan_hari != null ? k.dipakai_bulan : k.kali_bulan }}<span class="text-sm font-semibold text-teks3"> / {{ k.batas_bulanan_hari ?? k.batas_bulanan_kali }} {{ k.batas_bulanan_hari != null ? 'hari' : 'kali' }}</span></p>
              <p class="text-xs font-semibold text-teks2">{{ k.nama }} bulan ini</p></template>
          </div>
        </div>

        <!-- Saringan -->
        <div v-if="tab === 'semua'" class="kartu mb-3 grid gap-3 p-4 sm:grid-cols-3">
          <InputTanggal v-model="mulai" label="Dari tanggal" />
          <InputTanggal v-model="akhir" label="Sampai tanggal" />
          <div><label class="label-isian" for="pj-unit">Bidang/Unit</label>
            <select id="pj-unit" v-model="unit" class="isian"><option value="">Semua bidang</option>
              <option v-for="u in org.datar" :key="u.id" :value="u.id">{{ '— '.repeat(u.tingkat) }}{{ u.nama }}</option></select></div>
        </div>
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <button v-for="s in SARING" :key="s.k" @click="saring = s.k" :class="['min-h-[40px] rounded-full border px-3.5 text-sm font-semibold', saring === s.k ? 'border-transparent bg-[#C7332F] text-white' : 'border-garis bg-permukaan text-teks2']">{{ s.n }}</button>
          <div v-if="tab !== 'saya'" class="relative min-w-[12rem] flex-1"><PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
            <input v-model="cari" class="isian pl-10" placeholder="Cari nama, jenis, nomor" aria-label="Cari pengajuan" /></div>
        </div>
        <div v-if="tab === 'semua'" class="mb-3 flex flex-wrap gap-2">
          <button class="tombol-garis" @click="pratinjau = true"><PhEye :size="20" weight="duotone" /> Pratinjau cetak</button>
          <button class="tombol-garis" @click="ekspor"><PhFileXls :size="20" weight="duotone" /> Ekspor Excel</button>
        </div>

        <p v-if="pg.memuat && !sumber.length" class="py-8 text-center text-teks3">Memuat pengajuan…</p>
        <ul v-else class="space-y-2.5">
          <li v-for="r in tampil" :key="r.id">
            <button type="button" :class="['kartu kartu-pj flex w-full items-start gap-3 p-4 text-left hover:bg-permukaan2', r.menunggu_saya && 'perlu']" @click="buka(r)">
              <span :class="['chip-ikon h-10 w-10 shrink-0', 'w-' + KELOMPOK[r.kelompok].w]"><component :is="KELOMPOK[r.kelompok].ikon" :size="22" weight="duotone" /></span>
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-1.5">
                  <span :class="['lencana', 'w-' + STATUS_PENGAJUAN[r.status].w]">{{ STATUS_PENGAJUAN[r.status].n }}</span>
                  <span v-if="r.menunggu_saya" class="lencana w-beranda">Perlu keputusan Anda</span>
                  <span v-if="r.melebihi_kuota" class="lencana w-tahfizh"><PhWarning :size="12" weight="bold" /> Melebihi kuota</span>
                </span>
                <span class="mt-1 block font-bold leading-snug">{{ tab === 'saya' ? r.jenis : r.pemohon }} · {{ r.jumlah_hari }} hari</span>
                <span class="block text-sm text-teks2">{{ tab === 'saya' ? '' : r.jenis + ' · ' }}{{ rentangTanggal(r, formatPendek) }}</span>
                <span class="block truncate text-sm text-teks3">{{ r.alasan }}</span>
                <span class="mt-1 block text-xs text-teks3">{{ formatRelatif(r.created_at) }}<template v-if="r.status === 'menunggu' && r.jenjang_kini"> · menunggu {{ r.jenjang_kini }}</template><template v-if="r.nomor_surat"> · {{ r.nomor_surat }}</template></span>
              </span>
              <PhCaretRight :size="20" class="mt-2 shrink-0 text-teks3" />
            </button>
          </li>
        </ul>
        <div v-if="!pg.memuat && !tampil.length" class="flex flex-col items-center py-12 text-center">
          <span class="chip-ikon h-16 w-16 rounded-2xl"><PhTray :size="34" weight="duotone" /></span>
          <p class="mt-3 font-bold">{{ tab === 'persetujuan' ? 'Tidak ada pengajuan yang perlu Anda putuskan' : 'Belum ada pengajuan' }}</p>
          <p class="mt-1 text-sm text-teks3">{{ tab === 'saya' ? 'Tekan Ajukan untuk membuat pengajuan izin, sakit, dinas luar, atau cuti.' : 'Daftar akan muncul di sini.' }}</p>
        </div>
      </template>
      <TombolAksi label="Ajukan" :ikon="PhPlus" warna="pengajuan" @klik="formBuka = true" />
    </div>

    <LembarBawah v-model="formBuka" judul="Ajukan izin, sakit, atau cuti"><FormPengajuan v-if="formBuka" @selesai="terkirim" /></LembarBawah>
    <LembarBawah :model-value="!!id && !formBuka" @update:model-value="(v) => !v && tutupDetail()" judul="Rincian pengajuan">
      <DetailPengajuan v-if="id" :id="id" @berubah="berubah" />
    </LembarBawah>

    <DokumenCetak v-if="tab === 'semua'" v-model:pratinjau="pratinjau" mendatar judul="Rekap Pengajuan Izin, Sakit, Dinas Luar, dan Cuti Pegawai"
      :subjudul="`${formatPanjang(mulai)} s.d. ${formatPanjang(akhir)}${unit ? ' · ' + org.cariUnit(unit)?.nama : ''}`" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="tabel">
        <colgroup><col style="width:4%"><col style="width:17%"><col style="width:12%"><col style="width:11%"><col style="width:15%"><col style="width:5%"><col style="width:20%"><col style="width:9%"><col style="width:7%"></colgroup>
        <thead><tr><th>No.</th><th>Nama</th><th>Bidang/Unit</th><th>Jenis</th><th>Tanggal</th><th>Hari</th><th>Alasan</th><th>Status</th><th>Nomor</th></tr></thead>
        <tbody><tr v-for="(r, i) in tampil" :key="r.id">
          <td class="tengah">{{ i + 1 }}</td><td>{{ r.pemohon }}</td><td>{{ r.unit }}</td><td>{{ r.jenis }}</td><td>{{ rentangTanggal(r, formatPendek) }}</td>
          <td class="tengah">{{ r.jumlah_hari }}</td><td>{{ r.alasan }}</td><td>{{ STATUS_PENGAJUAN[r.status].n }}</td><td>{{ r.nomor_surat || '–' }}</td></tr></tbody>
      </table>
      <template #ttd>
        <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }" :kanan="{ jabatan: 'Pembuat Rekap', nama: sesi.pengguna?.nama_lengkap || '' }" />
      </template>
    </DokumenCetak>
  </div>
</template>
<style scoped>
.tab.aktif { border-color: color-mix(in srgb, var(--c) 35%, transparent); background: color-mix(in srgb, var(--c) 12%, rgb(var(--permukaan))); }
.kartu-pj.perlu { box-shadow: inset 4px 0 0 #C7332F; }
.kartu-kuota { background: color-mix(in srgb, var(--c) 8%, rgb(var(--permukaan))); }
</style>
