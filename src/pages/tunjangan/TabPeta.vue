<!-- SIMKA PRO | src/pages/tunjangan/TabPeta.vue | v1.1 | Fase 8 – Urutan kolom seragam (NIY/NIS > Nama > JK) | 10/10/2026 -->
<script setup>
// Peta jabatan per pegawai dalam bentuk tabel: jabatan yang diemban, komponen tunjangan,
// jumlah perkiraan, dan keterangan kekurangan data. Jabatan dapat diubah langsung dari baris tabel.
import { ref, computed } from 'vue'
import * as XLSX from 'xlsx'
import { PhMagnifyingGlass, PhWarningCircle, PhEye, PhFileXls, PhFloppyDisk, PhCheckCircle, PhPencilSimple, PhUsersThree, PhCoins } from '@phosphor-icons/vue'
import { useOrganisasi } from '@/stores/organisasi'
import { usePegawai } from '@/stores/pegawai'
import { useLembaga } from '@/stores/lembaga'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { formatPanjang, formatPendek, hariIniISO } from '@/lib/tanggal'
import { KATEGORI, formatRupiah } from '@/lib/tunjangan'
import { PENDIDIKAN, STATUS_PEGAWAI, LEVEL_MUHAFFIZH, KATEGORI_HONORER, masaKerja } from '@/lib/kepegawaian'
import InputTanggal from '@/components/InputTanggal.vue'
import LembarBawah from '@/components/LembarBawah.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'

const tanggal = defineModel('tanggal', { type: String })
const props = defineProps({ hasil: { type: Array, default: () => [] } })
const org = useOrganisasi(); const peg = usePegawai(); const lembaga = useLembaga(); const sesi = useSesi(); const ui = useUI()

const cari = ref(''); const bidang = ref(''); const hanyaCatatan = ref(false); const pratinjau = ref(false)
const PENDEK = { struktural: 'struktural', fungsional: 'fungsional', pendidikan: 'pendidikan', masa_kerja: 'masa kerja', kepegawaian: 'kepegawaian', kesehatan: 'kesehatan', level_muhaffizh: 'level' }
const KOLOM = ['struktural', 'fungsional', 'pendidikan', 'masa_kerja', 'kepegawaian', 'kesehatan', 'level_muhaffizh']
const bidangInduk = (id) => { let u = org.cariUnit(id); while (u && u.jenis === 'unit' && u.parent_id) u = org.cariUnit(u.parent_id); return u?.id }
const tampil = computed(() => {
  const q = cari.value.toLowerCase().trim()
  return props.hasil.filter(({ p, h }) => (!q || [p.nama_lengkap, p.niy, ...(p.jabatan_fungsional || []), p.jabatan_struktural].join(' ').toLowerCase().includes(q)) &&
    (!bidang.value || bidangInduk(p.org_unit_id) === bidang.value) && (!hanyaCatatan.value || h.catatan.length))
})
const jumlahKolom = computed(() => Object.fromEntries(KOLOM.map((k) => [k, tampil.value.reduce((a, x) => a + (x.h.per[k] || 0), 0)])))
const total = computed(() => tampil.value.reduce((a, x) => a + x.h.total, 0))
const adaCatatan = computed(() => props.hasil.filter((x) => x.h.catatan.length).length)
const fungsionalNama = (p) => (p.jabatan_fungsional || []).join(', ')
const masa = (p) => masaKerja(p.tmt_tugas)?.teks || '–'
const direktur = computed(() => lembaga.signatories.find((s) => /^direktur$/i.test(s.jabatan_tertulis)) || lembaga.signatories[0] || {})

// ---------- Ubah jabatan langsung dari tabel ----------
const ubah = ref(null); const proses = ref(false)
function buka({ p, h }) {
  ubah.value = { p, h, f: { fungsional_ids: [...(p.fungsional_ids || [])], struktural_id: p.structural_position_id || '', level_muhaffizh: p.level_muhaffizh || '',
    pendidikan_terakhir: p.pendidikan_terakhir || '', status_kepegawaian: p.status_kepegawaian || '', kategori_honorer: p.kategori_honorer || '', tanggal_berlaku: hariIniISO() } }
}
const muhaffizh = computed(() => ubah.value?.f.fungsional_ids.some((id) => org.fungsional.find((j) => j.id === id)?.kode === 'MUHAFFIZH'))
function pilih(j) {
  const ids = new Set(ubah.value.f.fungsional_ids)
  if (ids.has(j.id)) ids.delete(j.id)
  else {
    if ((j.tanpa_rangkap && ids.size) || [...ids].some((id) => org.fungsional.find((x) => x.id === id)?.tanpa_rangkap)) return ui.toast('Medis dan security tidak dapat dirangkap.', 'galat')
    ids.add(j.id)
  }
  ubah.value.f.fungsional_ids = [...ids]
}
async function simpan() {
  const { p, f } = ubah.value
  proses.value = true
  try {
    await peg.simpan({ id: p.id, nama_lengkap: p.nama_lengkap, fungsional_ids: f.fungsional_ids, struktural_id: f.struktural_id || null,
      unit_struktural_id: f.struktural_id ? (p.unit_struktural_id || p.org_unit_id || null) : null, level_muhaffizh: muhaffizh.value ? f.level_muhaffizh : '',
      pendidikan_terakhir: f.pendidikan_terakhir, status_kepegawaian: f.status_kepegawaian, kategori_honorer: f.status_kepegawaian === 'honorer' ? f.kategori_honorer : '',
      tanggal_berlaku: f.tanggal_berlaku })
    ui.toast(`Jabatan ${p.nama_lengkap} diperbarui.`); ubah.value = null
  } catch (e) { ui.toast(e.message, 'galat') } finally { proses.value = false }
}

function ekspor() {
  const judul = ['No.', 'NIY', 'Nama', 'Bidang/Unit', 'Jabatan struktural', 'Jabatan fungsional', 'Pendidikan', 'Masa kerja', 'Status', ...KOLOM.map((k) => 'T. ' + KATEGORI[k].n.toLowerCase()), 'Jumlah', 'Keterangan']
  const data = tampil.value.map(({ p, h }, i) => [i + 1, p.niy || '', p.nama_lengkap, p.nama_unit || '', p.jabatan_struktural || '', fungsionalNama(p), p.pendidikan_terakhir || '', masa(p),
    STATUS_PEGAWAI[p.status_kepegawaian] || '', ...KOLOM.map((k) => h.per[k] || 0), h.total, h.catatan.join(' ')])
  data.push(['', '', 'Jumlah', '', '', '', '', '', '', ...KOLOM.map((k) => jumlahKolom.value[k]), total.value, ''])
  const ws = XLSX.utils.aoa_to_sheet([[`Peta jabatan dan perkiraan tunjangan per ${formatPanjang(tanggal.value)}`], [], judul, ...data])
  ws['!cols'] = judul.map((j, i) => ({ wch: i === 2 ? 32 : i === judul.length - 1 ? 60 : Math.max(10, Math.min(28, j.length + 2)) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Peta jabatan')
  XLSX.writeFile(wb, `Peta-Jabatan-Tunjangan-${formatPendek(tanggal.value).replace(/\//g, '-')}.xlsx`)
}
</script>
<template>
  <div>
    <!-- Ringkasan -->
    <div class="mb-4 grid gap-3 sm:grid-cols-3">
      <div class="kartu w-pegawai flex items-center gap-3 p-4"><span class="chip-ikon h-11 w-11"><PhUsersThree :size="24" weight="duotone" /></span>
        <div><p class="text-sm text-teks3">Pegawai tampil</p><p class="text-xl font-extrabold tabular-nums">{{ tampil.length }}</p></div></div>
      <div class="kartu w-gaji flex items-center gap-3 p-4"><span class="chip-ikon h-11 w-11"><PhCoins :size="24" weight="duotone" /></span>
        <div><p class="text-sm text-teks3">Perkiraan tunjangan per bulan</p><p class="text-xl font-extrabold tabular-nums">{{ formatRupiah(total) }}</p></div></div>
      <button class="kartu w-klinik flex items-center gap-3 p-4 text-left hover:bg-permukaan2" @click="hanyaCatatan = !hanyaCatatan" :aria-pressed="hanyaCatatan">
        <span class="chip-ikon h-11 w-11"><PhWarningCircle :size="24" weight="duotone" /></span>
        <div><p class="text-sm text-teks3">Data belum lengkap</p><p class="text-xl font-extrabold tabular-nums">{{ adaCatatan }} pegawai</p>
          <p class="text-xs font-semibold" style="color: var(--c)">{{ hanyaCatatan ? 'Tampilkan semua' : 'Ketuk untuk menyaring' }}</p></div></button>
    </div>

    <!-- Saringan dan aksi -->
    <div class="mb-4 flex flex-wrap items-end gap-2">
      <div class="relative min-w-[220px] flex-1"><PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
        <input v-model="cari" type="search" class="isian pl-11" placeholder="Cari nama atau jabatan" aria-label="Cari pegawai" /></div>
      <select v-model="bidang" class="isian w-auto" aria-label="Saring bidang"><option value="">Semua bidang</option>
        <option v-for="u in org.datar.filter((x) => x.jenis !== 'unit' && x.aktif)" :key="u.id" :value="u.id">{{ u.nama }}</option></select>
      <div class="w-56"><InputTanggal v-model="tanggal" label="Tarif berlaku pada" /></div>
      <button class="tombol-garis" @click="ekspor"><PhFileXls :size="20" weight="duotone" /> Ekspor Excel</button>
      <button class="tombol-garis" @click="pratinjau = true"><PhEye :size="20" weight="duotone" /> Pratinjau cetak</button>
    </div>

    <!-- Tabel desktop -->
    <div class="kartu hidden overflow-x-auto lg:block">
      <table class="w-full min-w-[1380px] text-left text-sm">
        <thead class="border-b border-garis bg-permukaan2 text-teks2">
          <tr>
            <th class="sticky left-0 z-10 bg-permukaan2 px-3 py-3 font-bold">Pegawai dan jabatan</th>
            <th v-for="k in KOLOM" :key="k" :class="['px-2 py-3 text-right font-bold', 'w-' + KATEGORI[k].w]"><span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full" style="background: var(--c)" />{{ KATEGORI[k].n }}</span></th>
            <th class="px-3 py-3 text-right font-bold">Jumlah</th><th class="px-3 py-3 font-bold">Keterangan</th><th class="w-10" />
          </tr>
        </thead>
        <tbody class="divide-y divide-garis">
          <tr v-for="{ p, h } in tampil" :key="p.id" class="align-top hover:bg-permukaan2">
            <td class="sticky left-0 z-10 w-[260px] min-w-[240px] bg-permukaan px-3 py-2.5">
              <p class="font-semibold text-teks">{{ p.nama_lengkap }}</p>
              <p v-if="p.jabatan_struktural" class="text-xs font-semibold text-teks2">{{ p.jabatan_struktural }}</p>
              <p class="text-xs text-teks3">{{ fungsionalNama(p) || 'Belum ada jabatan fungsional' }}</p>
              <p class="text-xs text-teks3">{{ PENDIDIKAN[p.pendidikan_terakhir] || 'Pendidikan –' }}, {{ masa(p) }}, {{ STATUS_PEGAWAI[p.status_kepegawaian] || 'status –' }}</p>
            </td>
            <td v-for="k in KOLOM" :key="k" class="px-2 py-2.5 text-right tabular-nums text-teks2">{{ h.per[k] ? formatRupiah(h.per[k]) : '–' }}</td>
            <td class="px-3 py-2.5 text-right font-bold tabular-nums text-teks">{{ formatRupiah(h.total) }}</td>
            <td class="min-w-[210px] max-w-[260px] px-3 py-2.5">
              <span v-if="!h.catatan.length" class="lencana w-presensi"><PhCheckCircle :size="12" weight="fill" /> Lengkap</span>
              <ul v-else class="w-klinik space-y-0.5 text-xs font-semibold" style="color: var(--c)"><li v-for="c in h.catatan" :key="c">{{ c }}</li></ul>
            </td>
            <td class="pr-2 pt-1.5"><button class="tombol-ikon h-9 w-9" @click="buka({ p, h })" :aria-label="`Ubah jabatan ${p.nama_lengkap}`"><PhPencilSimple :size="18" /></button></td>
          </tr>
        </tbody>
        <tfoot class="border-t-2 border-garis bg-permukaan2 font-bold">
          <tr><td class="sticky left-0 bg-permukaan2 px-3 py-3">Jumlah ({{ tampil.length }} pegawai)</td>
            <td v-for="k in KOLOM" :key="k" class="px-2 py-3 text-right tabular-nums">{{ formatRupiah(jumlahKolom[k]) }}</td>
            <td class="px-3 py-3 text-right tabular-nums">{{ formatRupiah(total) }}</td><td colspan="2" /></tr>
        </tfoot>
      </table>
    </div>

    <!-- Kartu mobile -->
    <ul class="space-y-2.5 lg:hidden">
      <li v-for="{ p, h } in tampil" :key="p.id">
        <button class="kartu w-full p-4 text-left active:bg-permukaan2" @click="buka({ p, h })">
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1"><p class="font-bold">{{ p.nama_lengkap }}</p>
              <p class="text-sm text-teks3">{{ [p.jabatan_struktural, fungsionalNama(p)].filter(Boolean).join(', ') || 'Belum ada jabatan' }}</p></div>
            <p class="shrink-0 font-extrabold tabular-nums">{{ formatRupiah(h.total) }}</p>
          </div>
          <div class="mt-2 flex flex-wrap gap-1">
            <span v-for="k in KOLOM.filter((x) => h.per[x])" :key="k" :class="['lencana', 'w-' + KATEGORI[k].w]">{{ KATEGORI[k].n }} {{ formatRupiah(h.per[k]) }}</span>
          </div>
          <p v-if="h.catatan.length" class="w-klinik mt-2 text-xs font-semibold" style="color: var(--c)">{{ h.catatan.length }} catatan: {{ h.catatan[0] }}</p>
        </button>
      </li>
    </ul>

    <!-- Rincian dan ubah jabatan -->
    <LembarBawah :model-value="!!ubah" @update:model-value="(x) => !x && (ubah = null)" :judul="ubah?.p.nama_lengkap">
      <div v-if="ubah" class="space-y-4 pb-2">
        <div class="rounded-xl bg-permukaan2 p-3">
          <p class="mb-1 text-sm font-bold">Rincian perkiraan tunjangan</p>
          <ul class="space-y-1 text-sm">
            <li v-for="(r, i) in ubah.h.rincian" :key="i" :class="['flex justify-between gap-2', 'w-' + KATEGORI[r.kategori].w]">
              <span class="text-teks2"><span class="mr-1.5 inline-block h-2 w-2 rounded-full" style="background: var(--c)" />{{ KATEGORI[r.kategori].n }}: {{ r.label }}</span>
              <span class="tabular-nums">{{ formatRupiah(r.besaran) }}</span></li>
            <li class="flex justify-between border-t border-garis pt-1 font-bold"><span>Jumlah</span><span class="tabular-nums">{{ formatRupiah(ubah.h.total) }}</span></li>
          </ul>
          <ul v-if="ubah.h.catatan.length" class="w-klinik mt-2 space-y-0.5 text-sm font-semibold" style="color: var(--c)"><li v-for="c in ubah.h.catatan" :key="c">{{ c }}</li></ul>
        </div>
        <div><p class="label-isian">Jabatan fungsional</p>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="j in org.fungsional.filter((x) => x.aktif || ubah.f.fungsional_ids.includes(x.id))" :key="j.id" type="button" @click="pilih(j)" :aria-pressed="ubah.f.fungsional_ids.includes(j.id)"
              :class="['min-h-[38px] rounded-full border px-3 text-sm font-semibold', ubah.f.fungsional_ids.includes(j.id) ? 'border-transparent bg-[#1E7D4F] text-white dark:bg-[#5BD69A] dark:text-[#10261B]' : 'border-garis text-teks2']">{{ j.nama }}</button>
          </div></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label class="label-isian" for="jt-str">Jabatan struktural</label>
            <select id="jt-str" v-model="ubah.f.struktural_id" class="isian"><option value="">Tidak ada</option>
              <option v-for="j in [...org.struktural].filter((x) => x.aktif).sort((a, b) => a.tingkat - b.tingkat)" :key="j.id" :value="j.id">{{ j.nama }}</option></select></div>
          <div v-if="muhaffizh"><label class="label-isian" for="jt-lvl">Level muhaffizh</label>
            <select id="jt-lvl" v-model="ubah.f.level_muhaffizh" class="isian"><option value="">Belum diisi</option><option v-for="(n, k) in LEVEL_MUHAFFIZH" :key="k" :value="k">{{ n }}</option></select></div>
          <div><label class="label-isian" for="jt-pend">Pendidikan terakhir</label>
            <select id="jt-pend" v-model="ubah.f.pendidikan_terakhir" class="isian"><option value="">Belum diisi</option><option v-for="(n, k) in PENDIDIKAN" :key="k" :value="k">{{ n }}</option></select></div>
          <div><label class="label-isian" for="jt-stat">Status kepegawaian</label>
            <select id="jt-stat" v-model="ubah.f.status_kepegawaian" class="isian"><option value="">Belum diisi</option><option v-for="(n, k) in STATUS_PEGAWAI" :key="k" :value="k">{{ n }}</option></select></div>
          <div v-if="ubah.f.status_kepegawaian === 'honorer'"><label class="label-isian" for="jt-hon">Kategori honorer</label>
            <select id="jt-hon" v-model="ubah.f.kategori_honorer" class="isian"><option value="">Belum diisi</option><option v-for="(n, k) in KATEGORI_HONORER" :key="k" :value="k">{{ n }}</option></select></div>
          <InputTanggal v-model="ubah.f.tanggal_berlaku" label="Perubahan berlaku mulai" />
        </div>
        <p class="text-xs text-teks3">Perubahan dicatat di riwayat kepegawaian. TMT tugas dan data lain diubah melalui halaman biodata pegawai.</p>
        <button class="tombol-utama w-full" :disabled="proses" @click="simpan"><PhFloppyDisk :size="20" weight="duotone" /> {{ proses ? 'Menyimpan…' : 'Simpan perubahan jabatan' }}</button>
      </div>
    </LembarBawah>

    <!-- Dokumen cetak F4 mendatar -->
    <DokumenCetak v-model:pratinjau="pratinjau" mendatar judul="Peta Jabatan dan Perkiraan Tunjangan" :subjudul="`Tarif berlaku per ${formatPanjang(tanggal)}`" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="tabel kecil">
        <colgroup><col style="width:3%"><col style="width:11%"><col style="width:11%"><col style="width:4.5%"><col style="width:5%">
          <col v-for="k in KOLOM" :key="k" style="width:6.5%"><col style="width:6.5%"><col style="width:13.5%"></colgroup>
        <thead><tr><th>No.</th><th>Nama</th><th>Jabatan</th><th>Pend.</th><th>Masa kerja</th>
          <th v-for="k in KOLOM" :key="k">Tunj. {{ PENDEK[k] }}</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
        <tbody>
          <tr v-for="({ p, h }, i) in tampil" :key="p.id">
            <td class="tengah">{{ i + 1 }}</td><td>{{ p.nama_lengkap }}</td><td>{{ [p.jabatan_struktural, fungsionalNama(p)].filter(Boolean).join('; ') || '–' }}</td>
            <td class="tengah">{{ p.pendidikan_terakhir || '–' }}</td><td class="tengah">{{ masaKerja(p.tmt_tugas)?.tahun ?? '–' }} th</td>
            <td v-for="k in KOLOM" :key="k" class="kanan">{{ h.per[k] ? (h.per[k]).toLocaleString('id-ID') : '–' }}</td>
            <td class="kanan">{{ h.total.toLocaleString('id-ID') }}</td><td>{{ h.catatan.join(' ') || 'Lengkap' }}</td>
          </tr>
          <tr><td></td><td>Jumlah</td><td></td><td></td><td></td>
            <td v-for="k in KOLOM" :key="k" class="kanan">{{ jumlahKolom[k].toLocaleString('id-ID') }}</td><td class="kanan">{{ total.toLocaleString('id-ID') }}</td><td></td></tr>
        </tbody>
      </table>
      <p class="catatan-cetak">Nominal dalam rupiah. Perkiraan tunjangan tetap; honor per jam dan potongan berbasis kehadiran dihitung pada slip gaji.</p>
      <template #ttd>
        <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }"
          :kanan="{ jabatan: 'Pengelola Sistem', nama: sesi.pengguna?.nama_lengkap || '' }" :tanggal="tanggal" />
      </template>
    </DokumenCetak>
  </div>
</template>
