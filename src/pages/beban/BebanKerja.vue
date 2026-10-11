<!-- SIMKA PRO | src/pages/beban/BebanKerja.vue | v1.2 | Fase 8 – Urutan kolom seragam (NIY/NIS > Nama > JK) | 10/10/2026 -->
<script setup>
// Ekuivalensi jam beban kerja per pekan.
//   Beban saya   : rincian jam pegawai yang masuk, total, jam wajib, kelebihan/kekurangan.
//   Rekap        : semua pegawai (admin, superadmin; pimpinan untuk anggota unitnya) seperti tabel pondok:
//                  kolom Jabatan Struktural, Guru Mapel, Takhassus, Guru Tahfizh, Guru Walas, Musyrif, Fungsional Lainnya,
//                  Tugas Tambahan Lainnya; Excel, cetak F4 mendatar, kunci rekap bulanan (dasar gaji Fase 11).
//   Komponen jam : admin ber-izin atur_beban_kerja mengubah jam per tupoksi, menambah tugas tambahan, dan jam wajib per status.
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { PhHourglassMedium, PhTable, PhSlidersHorizontal, PhLockKey, PhPencilSimple, PhPlus, PhTrash, PhFloppyDisk, PhMagnifyingGlass, PhFileXls, PhEye, PhArrowCounterClockwise, PhInfo } from '@phosphor-icons/vue'
import { useBebanKerja, KOLOM_BEBAN } from '@/stores/bebanKerja'
import { useOrganisasi } from '@/stores/organisasi'
import { useLembaga } from '@/stores/lembaga'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { hariIniISO, formatPanjang } from '@/lib/tanggal'
import LembarBawah from '@/components/LembarBawah.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'

const props = defineProps({ tab: String })
const router = useRouter(); const bk = useBebanKerja(); const org = useOrganisasi(); const lembaga = useLembaga(); const sesi = useSesi(); const ui = useUI()
const bolehRekap = computed(() => sesi.isAdmin || !!sesi.pengguna?.jabatan_struktural)
const TAB = computed(() => [
  { k: 'saya', n: 'Beban saya', i: PhHourglassMedium, w: 'gaji' },
  bolehRekap.value && { k: 'rekap', n: 'Rekap pegawai', i: PhTable, w: 'rekap' },
  bk.bolehAtur && { k: 'komponen', n: 'Komponen jam', i: PhSlidersHorizontal, w: 'pengaturan' },
].filter(Boolean))
const aktif = computed(() => TAB.value.find((t) => t.k === props.tab) || TAB.value[0])
const jam = (v) => (v == null ? '–' : String(Number(v)).replace('.', ','))
const STATUS = { tetap: 'Tetap', kontrak: 'Kontrak', honorer: 'Honorer' }
const SINGKAT = { 'Jabatan Struktural': 'Struk-tural', 'Guru Mapel': 'Mapel', 'Guru Tahfizh': 'Tahfizh', 'Guru Walas': 'Walas', 'Fungsional Lainnya': 'Fungsi lain', 'Tugas Tambahan Lainnya': 'Tugas tambahan' }
const warnaSelisih = (s) => (s == null ? 'hakakses' : s < 0 ? 'beranda' : s > 0 ? 'pegawai' : 'presensi')
const teksSelisih = (s) => (s == null ? 'Tidak terikat' : s === 0 ? 'Pas' : s > 0 ? `Lebih ${jam(s)} jam` : `Kurang ${jam(-s)} jam`)

onMounted(async () => { await Promise.all([bk.muatKomponen(), org.muat(), lembaga.muat()]); muat() })
watch(aktif, () => muat())

// ---------- Beban saya / rekap ----------
const data = ref([]); const memuat = ref(false); const unit = ref(''); const status = ref(''); const cari = ref('')
async function muat() {
  if (aktif.value.k === 'komponen') return
  memuat.value = true
  try { data.value = await bk.rekap(null) } catch (e) { ui.toast(e.message, 'galat') } finally { memuat.value = false }
}
const saya = computed(() => data.value.find((r) => r.employee_id === sesi.pengguna?.id))
const perKolom = (r, k) => r.rincian.filter((x) => x.kolom === k).reduce((a, b) => a + Number(b.jam), 0)
const tampil = computed(() => data.value.filter((r) => (!unit.value || org.turunan(unit.value).has(r.org_unit_id))
  && (!status.value || r.status === status.value) && (!cari.value.trim() || [r.nama, r.niy].join(' ').toLowerCase().includes(cari.value.toLowerCase().trim()))))
const ringkas = computed(() => {
  const t = tampil.value.filter((r) => r.selisih != null)
  return { kurang: t.filter((r) => r.selisih < 0).length, pas: t.filter((r) => r.selisih === 0).length, lebih: t.filter((r) => r.selisih > 0).length, honorer: tampil.value.length - t.length }
})

function ekspor() {
  const kolom = ['No.', 'NIY', 'Nama Lengkap Pegawai', 'Status', 'Bidang/Unit', 'Jabatan, Tugas Utama, & Tambahan', 'Jumlah Beban Kerja', ...KOLOM_BEBAN, 'Jam Wajib', 'Kelebihan/Kekurangan']
  const isi = tampil.value.map((r, i) => [i + 1, r.niy || '', r.nama, STATUS[r.status] || '', r.unit || '', r.rincian.map((x) => x.nama).join(', '), Number(r.total),
    ...KOLOM_BEBAN.map((k) => perKolom(r, k) || ''), r.jam_wajib ?? '', r.selisih ?? ''])
  const ws = XLSX.utils.aoa_to_sheet([kolom, ...isi]); ws['!cols'] = kolom.map((k, i) => ({ wch: i === 2 || i === 5 ? 36 : Math.max(8, Math.min(18, k.length)) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Ekuivalensi Jam')
  XLSX.writeFile(wb, `Ekuivalensi-Jam-Pegawai-${hariIniISO()}.xlsx`)
}
const pratinjau = ref(false)
const direktur = computed(() => lembaga.signatories.find((s) => s.sumber_jabatan === 'DIREKTUR' || /^direktur/i.test(s.jabatan_tertulis)) || {})
async function kunci() {
  const bln = new Date(hariIniISO()).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  if (!(await ui.konfirmasi({ judul: `Kunci rekap ${bln}?`, pesan: 'Salinan jam semua pegawai bulan ini disimpan sebagai dasar perhitungan gaji. Mengunci ulang menimpa salinan bulan ini.', ya: 'Kunci rekap' }))) return
  try { const n = await bk.kunci(hariIniISO()); ui.toast(`Rekap ${bln} dikunci untuk ${n} pegawai.`, 'info') } catch (e) { ui.toast(e.message, 'galat') }
}

// ---------- Ubah jam seorang pegawai ----------
const ed = ref(null)
async function ubah(r) {
  if (!bk.bolehAtur) return
  try { ed.value = { r, baris: (await bk.rincian(r.employee_id)).map((b) => ({ ...b, jam: Number(b.jam) })), tambah: '' } } catch (e) { ui.toast(e.message, 'galat') }
}
const totalEd = computed(() => (ed.value?.baris || []).reduce((a, b) => a + (Number(b.jam) || 0), 0))
function tambahTugas() {
  const c = bk.komponen.find((k) => k.id === ed.value.tambah); if (!c) return
  if (ed.value.baris.some((b) => b.component_id === c.id)) return ui.toast('Tugas itu sudah ada.', 'galat')
  ed.value.baris.push({ component_id: c.id, nama: c.nama, kolom: c.kolom, sumber: c.sumber, jam: Number(c.jam_bawaan) || 0, jam_bawaan: c.jam_bawaan, otomatis: false, catatan: '' }); ed.value.tambah = ''
}
async function simpanEd() {
  // komponen otomatis bersumber "tetap" hanya disimpan bila jamnya berbeda dari bawaan (penimpa)
  const kirim = ed.value.baris.filter((b) => !b.otomatis || b.sumber === 'per_orang' || Number(b.jam) !== Number(b.jam_bawaan) || b.catatan)
  if (kirim.some((b) => !(Number(b.jam) >= 0 && Number(b.jam) <= 99))) return ui.toast('Jam harus 0–99.', 'galat')
  try { await bk.simpanPegawai(ed.value.r.employee_id, kirim); ed.value = null; ui.toast('Jam beban kerja disimpan.', 'info'); muat() } catch (e) { ui.toast(e.message, 'galat') }
}

// ---------- Komponen ----------
const fk = ref(null); const fw = ref(null)
const daftarKolom = computed(() => [...new Set([...KOLOM_BEBAN, ...bk.komponen.map((k) => k.kolom)])])
function baruKomponen() { fk.value = { kode: '', nama: '', kolom: 'Tugas Tambahan Lainnya', kelompok: 'tambahan', sumber: 'tetap', jam_bawaan: 6, keterangan: '', aktif: true, urutan: 250 } }
async function simpanKomponen() {
  const k = { ...fk.value }
  if (k.nama.trim().length < 3) return ui.toast('Nama komponen minimal 3 karakter.', 'galat')
  if (!k.id) k.kode = 'T_' + k.nama.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36)
  try { await bk.simpanKomponen(k); fk.value = null; ui.toast('Komponen jam disimpan.', 'info') } catch (e) { ui.toast(e.message, 'galat') }
}
async function simpanWajib() { try { await bk.aturWajib(fw.value); fw.value = null; ui.toast('Jam wajib disimpan.', 'info') } catch (e) { ui.toast(e.message, 'galat') } }
const KELOMPOK = { struktural: 'Jabatan struktural', fungsional: 'Jabatan fungsional', tambahan: 'Tugas tambahan' }
</script>
<template>
  <div class="w-gaji mx-auto max-w-6xl">
    <div class="layar-saja">
      <nav class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="Bagian beban kerja">
        <button v-for="t in TAB" :key="t.k" role="tab" :aria-selected="aktif.k === t.k" @click="router.replace(`/beban-kerja/${t.k}`)"
          :class="['tab flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold', 'w-' + t.w, aktif.k === t.k ? 'aktif text-teks' : 'border-garis bg-permukaan text-teks2']">
          <span class="chip-ikon h-8 w-8 rounded-lg"><component :is="t.i" :size="20" weight="duotone" /></span><span class="whitespace-nowrap">{{ t.n }}</span></button>
      </nav>

      <!-- ===== Beban saya ===== -->
      <template v-if="aktif.k === 'saya'">
        <p v-if="memuat" class="py-8 text-center text-teks3">Menghitung…</p>
        <div v-else-if="saya" class="mx-auto max-w-2xl space-y-4">
          <section :class="['kartu p-5', 'w-' + warnaSelisih(saya.selisih)]" style="background: color-mix(in srgb, var(--c) 9%, rgb(var(--permukaan)))">
            <p class="text-sm font-semibold text-teks2">Jumlah beban kerja per pekan</p>
            <p class="mt-1 text-4xl font-extrabold tabular-nums" style="color: var(--c)">{{ jam(saya.total) }} <span class="text-lg text-teks2">jam</span></p>
            <p class="mt-1 text-sm text-teks2">Jam wajib {{ saya.jam_wajib == null ? 'tidak berlaku (honorer, dibayar sesuai jam)' : jam(saya.jam_wajib) + ' jam' }} · status {{ STATUS[saya.status] || '–' }}</p>
            <div v-if="saya.jam_wajib" class="mt-3 h-3 overflow-hidden rounded-full bg-permukaan2" role="progressbar" :aria-valuenow="saya.total" aria-valuemin="0" :aria-valuemax="saya.jam_wajib" aria-label="Pemenuhan jam wajib">
              <div class="h-full rounded-full" :style="{ width: Math.min(100, (100 * saya.total) / saya.jam_wajib) + '%', background: 'var(--c)' }" /></div>
            <span class="lencana mt-3">{{ teksSelisih(saya.selisih) }}</span>
          </section>
          <section class="kartu p-5">
            <h3 class="judul-bagian mb-2">Rincian tupoksi</h3>
            <ul class="divide-y divide-garis">
              <li v-for="x in saya.rincian" :key="x.nama" class="flex items-center gap-3 py-2.5">
                <span class="min-w-0 flex-1"><span class="block font-semibold">{{ x.nama }}</span><span class="block text-xs text-teks3">{{ x.kolom }}</span></span>
                <span class="font-bold tabular-nums">{{ jam(x.jam) }} jam</span></li>
              <li v-if="!saya.rincian.length" class="py-3 text-sm text-teks3">Belum ada tupoksi berjam. Hubungi admin kepegawaian.</li>
            </ul>
            <p class="mt-3 flex gap-2 text-xs text-teks3"><PhInfo :size="16" class="mt-0.5 shrink-0" />Jam mengikuti jabatan di Data Pegawai dan penugasan admin. Jam Guru Mapel kelak diambil dari jadwal pelajaran.</p>
          </section>
        </div>
        <p v-else class="py-8 text-center text-teks3">Data beban kerja Anda belum tersedia.</p>
      </template>

      <!-- ===== Rekap ===== -->
      <template v-else-if="aktif.k === 'rekap'">
        <div class="kartu mb-3 grid gap-3 p-4 sm:grid-cols-3">
          <div><label class="label-isian" for="bk-unit">Bidang/Unit</label><select id="bk-unit" v-model="unit" class="isian"><option value="">Semua bidang</option>
            <option v-for="u in org.datar" :key="u.id" :value="u.id">{{ '— '.repeat(u.tingkat) }}{{ u.nama }}</option></select></div>
          <div><label class="label-isian" for="bk-status">Status</label><select id="bk-status" v-model="status" class="isian"><option value="">Semua status</option>
            <option v-for="(n, k) in STATUS" :key="k" :value="k">{{ n }}</option></select></div>
          <div><label class="label-isian" for="bk-cari">Cari</label><div class="relative"><PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
            <input id="bk-cari" v-model="cari" class="isian pl-10" placeholder="Nama atau NIY" /></div></div>
        </div>
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <span class="lencana w-beranda">{{ ringkas.kurang }} kurang</span><span class="lencana w-presensi">{{ ringkas.pas }} pas</span>
          <span class="lencana w-pegawai">{{ ringkas.lebih }} lebih</span><span class="lencana w-hakakses">{{ ringkas.honorer }} tidak terikat</span>
          <span class="flex-1" />
          <button class="tombol-garis min-h-[40px] text-sm" @click="pratinjau = true"><PhEye :size="18" weight="duotone" /> Pratinjau cetak</button>
          <button class="tombol-garis min-h-[40px] text-sm" @click="ekspor"><PhFileXls :size="18" weight="duotone" /> Excel</button>
          <button v-if="bk.bolehAtur" class="tombol-utama min-h-[40px] text-sm" @click="kunci"><PhLockKey :size="18" weight="duotone" /> Kunci rekap bulan ini</button>
        </div>
        <p v-if="memuat" class="py-8 text-center text-teks3">Menghitung rekap…</p>
        <template v-else>
          <div class="kartu hidden overflow-x-auto lg:block">
            <table class="w-full text-sm">
              <thead><tr class="border-b border-garis text-center text-xs">
                <th class="p-2 text-left">Nama</th><th class="p-2">Jumlah</th><th v-for="k in KOLOM_BEBAN" :key="k" class="p-2">{{ k }}</th><th class="p-2">Wajib</th><th class="p-2">Selisih</th></tr></thead>
              <tbody>
                <tr v-for="r in tampil" :key="r.employee_id" :class="['border-b border-garis text-center last:border-0', bk.bolehAtur && 'cursor-pointer hover:bg-permukaan2']" @click="ubah(r)">
                  <td class="p-2 text-left"><p class="font-semibold">{{ r.nama }}</p><p class="text-xs text-teks3">{{ STATUS[r.status] }} · {{ r.unit }}</p></td>
                  <td class="p-2 font-bold tabular-nums">{{ jam(r.total) }}</td>
                  <td v-for="k in KOLOM_BEBAN" :key="k" class="p-2 tabular-nums">{{ perKolom(r, k) ? jam(perKolom(r, k)) : '' }}</td>
                  <td class="p-2 tabular-nums">{{ jam(r.jam_wajib) }}</td>
                  <td class="p-2"><span :class="['lencana whitespace-nowrap', 'w-' + warnaSelisih(r.selisih)]">{{ teksSelisih(r.selisih) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="space-y-2 lg:hidden">
            <li v-for="r in tampil" :key="r.employee_id"><button type="button" class="kartu w-full p-3.5 text-left" @click="ubah(r)">
              <div class="flex items-start gap-2"><p class="min-w-0 flex-1 font-semibold">{{ r.nama }}</p><span :class="['lencana', 'w-' + warnaSelisih(r.selisih)]">{{ teksSelisih(r.selisih) }}</span></div>
              <p class="text-xs text-teks3">{{ STATUS[r.status] }} · {{ r.unit }}</p>
              <p class="mt-1 text-sm"><b class="tabular-nums">{{ jam(r.total) }}</b> dari {{ jam(r.jam_wajib) }} jam · {{ r.rincian.map((x) => `${x.nama} ${jam(x.jam)}`).join(', ') }}</p>
            </button></li>
          </ul>
          <p v-if="bk.bolehAtur" class="mt-2 text-xs text-teks3">Ketuk baris pegawai untuk mengubah jam tupoksi atau menambah tugas tambahan.</p>
        </template>
      </template>

      <!-- ===== Komponen ===== -->
      <template v-else>
        <section class="kartu mb-4 flex flex-wrap items-center gap-3 p-4">
          <div class="flex-1"><h3 class="judul-bagian">Jam wajib per pekan</h3>
            <p class="text-sm text-teks2">Tetap {{ jam(bk.wajib.tetap) }} jam · Kontrak {{ jam(bk.wajib.kontrak) }} jam · Honorer {{ bk.wajib.honorer == null ? 'tidak terikat' : jam(bk.wajib.honorer) + ' jam' }}</p></div>
          <button class="tombol-garis" @click="fw = { tetap: bk.wajib.tetap ?? '', kontrak: bk.wajib.kontrak ?? '', honorer: bk.wajib.honorer ?? '' }"><PhPencilSimple :size="18" /> Ubah</button>
        </section>
        <div class="mb-3 flex justify-end"><button class="tombol-utama" @click="baruKomponen"><PhPlus :size="18" weight="bold" /> Tugas tambahan baru</button></div>
        <section v-for="(n, g) in KELOMPOK" :key="g" class="kartu mb-4 p-4">
          <h3 class="judul-bagian mb-2">{{ n }}</h3>
          <ul class="divide-y divide-garis">
            <li v-for="k in bk.komponen.filter((x) => x.kelompok === g)" :key="k.id" :class="['flex items-center gap-3 py-2.5', !k.aktif && 'opacity-55']">
              <span class="min-w-0 flex-1"><span class="block font-semibold">{{ k.nama }}</span>
                <span class="block text-xs text-teks3">Kolom: {{ k.kolom }} · {{ k.sumber === 'per_orang' ? 'jam diisi per orang' : 'jam tetap' }}{{ k.keterangan ? ' · ' + k.keterangan : '' }}</span></span>
              <span class="font-bold tabular-nums">{{ k.sumber === 'per_orang' ? 'per orang' : jam(k.jam_bawaan) + ' jam' }}</span>
              <button class="tombol-ikon" :aria-label="`Ubah ${k.nama}`" @click="fk = { ...k }"><PhPencilSimple :size="18" /></button>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <!-- Lembar ubah jam pegawai -->
    <LembarBawah :model-value="!!ed" @update:model-value="(v) => !v && (ed = null)" :judul="ed ? `Jam tupoksi – ${ed.r.nama}` : ''">
      <div v-if="ed" class="space-y-3 pb-2">
        <p class="text-sm text-teks2">Status {{ STATUS[ed.r.status] }} · jam wajib {{ ed.r.jam_wajib == null ? 'tidak terikat' : jam(ed.r.jam_wajib) + ' jam' }}</p>
        <ul class="divide-y divide-garis rounded-xl border border-garis">
          <li v-for="(b, i) in ed.baris" :key="b.component_id" class="flex flex-wrap items-center gap-2 p-2.5">
            <span class="min-w-0 flex-1"><span class="block text-sm font-semibold">{{ b.nama }}</span>
              <span class="block text-xs text-teks3">{{ b.kolom }} · {{ b.otomatis ? 'dari jabatan' : 'tugas tambahan' }}{{ b.otomatis && b.sumber === 'tetap' ? ` · bawaan ${jam(b.jam_bawaan)} jam` : '' }}</span></span>
            <input v-model.number="b.jam" type="number" min="0" max="99" step="0.5" class="isian h-10 min-h-0 w-20 py-1 text-right" :aria-label="`Jam ${b.nama}`" />
            <span class="text-sm text-teks3">jam</span>
            <button v-if="b.otomatis && b.sumber === 'tetap' && Number(b.jam) !== Number(b.jam_bawaan)" class="tombol-ikon" :aria-label="`Kembalikan jam bawaan ${b.nama}`" @click="b.jam = Number(b.jam_bawaan)"><PhArrowCounterClockwise :size="18" /></button>
            <button v-if="!b.otomatis" class="tombol-ikon" :aria-label="`Hapus ${b.nama}`" @click="ed.baris.splice(i, 1)"><PhTrash :size="18" /></button>
          </li>
        </ul>
        <div class="flex gap-2">
          <select v-model="ed.tambah" class="isian flex-1" aria-label="Pilih tugas tambahan"><option value="">Tambah tugas tambahan…</option>
            <option v-for="c in bk.tambahan" :key="c.id" :value="c.id">{{ c.nama }} ({{ c.sumber === 'per_orang' ? 'per orang' : jam(c.jam_bawaan) + ' jam' }})</option></select>
          <button class="tombol-garis shrink-0" :disabled="!ed.tambah" @click="tambahTugas"><PhPlus :size="18" weight="bold" /> Tambah</button>
        </div>
        <p class="rounded-xl bg-permukaan2 p-3 text-sm">Jumlah: <b>{{ jam(totalEd) }} jam</b><template v-if="ed.r.jam_wajib != null"> · {{ teksSelisih(totalEd - ed.r.jam_wajib) }}</template></p>
        <p class="text-xs text-teks3">Komponen "dari jabatan" mengikuti jabatan di Data Pegawai. Bila tupoksi belum mencukupi jam wajib, tambahkan tugas tambahan; tugas yang belum ada dibuat di tab Komponen jam.</p>
        <button class="tombol-utama w-full" @click="simpanEd"><PhFloppyDisk :size="20" weight="duotone" /> Simpan</button>
      </div>
    </LembarBawah>

    <!-- Lembar komponen -->
    <LembarBawah :model-value="!!fk" @update:model-value="(v) => !v && (fk = null)" :judul="fk?.id ? 'Ubah komponen jam' : 'Tugas tambahan baru'">
      <form v-if="fk" class="space-y-3 pb-2" @submit.prevent="simpanKomponen">
        <div><label class="label-isian" for="kj-nama">Nama</label><input id="kj-nama" v-model="fk.nama" class="isian" :readonly="!!(fk.structural_position_id || fk.functional_position_id || fk.tautan)" /></div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div><label class="label-isian" for="kj-kolom">Kolom rekap</label><select id="kj-kolom" v-model="fk.kolom" class="isian"><option v-for="k in daftarKolom" :key="k" :value="k">{{ k }}</option></select></div>
          <div><label class="label-isian" for="kj-sumber">Cara pengisian jam</label><select id="kj-sumber" v-model="fk.sumber" class="isian"><option value="tetap">Jam tetap (sama untuk semua)</option><option value="per_orang">Diisi per orang</option></select></div>
        </div>
        <div v-if="fk.sumber === 'tetap'"><label class="label-isian" for="kj-jam">Jam per pekan</label><input id="kj-jam" v-model.number="fk.jam_bawaan" type="number" min="0" max="99" step="0.5" class="isian" /></div>
        <div><label class="label-isian" for="kj-ket">Keterangan</label><input id="kj-ket" v-model="fk.keterangan" class="isian" /></div>
        <label class="flex min-h-[44px] items-center gap-3 font-semibold"><input v-model="fk.aktif" type="checkbox" class="h-5 w-5" /> Aktif (dihitung)</label>
        <p class="text-xs text-teks3">Mengubah jam tetap berlaku untuk semua pegawai pemegang tupoksi ini, kecuali yang jamnya sudah diatur khusus per orang.</p>
        <button class="tombol-utama w-full"><PhFloppyDisk :size="20" weight="duotone" /> Simpan</button>
      </form>
    </LembarBawah>

    <LembarBawah :model-value="!!fw" @update:model-value="(v) => !v && (fw = null)" judul="Jam wajib per pekan">
      <form v-if="fw" class="space-y-3 pb-2" @submit.prevent="simpanWajib">
        <div class="grid grid-cols-3 gap-3">
          <div><label class="label-isian" for="jw-t">Tetap</label><input id="jw-t" v-model="fw.tetap" type="number" min="0" max="99" class="isian" /></div>
          <div><label class="label-isian" for="jw-k">Kontrak</label><input id="jw-k" v-model="fw.kontrak" type="number" min="0" max="99" class="isian" /></div>
          <div><label class="label-isian" for="jw-h">Honorer</label><input id="jw-h" v-model="fw.honorer" type="number" min="0" max="99" class="isian" placeholder="Kosong" /></div>
        </div>
        <p class="text-xs text-teks3">Kosongkan bila status tersebut tidak terikat jam wajib (honorer dibayar sesuai jam masuk).</p>
        <button class="tombol-utama w-full"><PhFloppyDisk :size="20" weight="duotone" /> Simpan</button>
      </form>
    </LembarBawah>

    <DokumenCetak v-if="aktif.k === 'rekap'" v-model:pratinjau="pratinjau" mendatar judul="Ekuivalensi Jam Beban Kerja Pegawai"
      :subjudul="`Per pekan · keadaan ${formatPanjang(hariIniISO())}${unit ? ' · ' + org.cariUnit(unit)?.nama : ''}`" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="tabel" style="font-size: 8pt">
        <colgroup><col style="width:3.5%"><col style="width:6%"><col style="width:14%"><col style="width:17.5%"><col style="width:5%"><col v-for="k in KOLOM_BEBAN" :key="k" style="width:5.4%"><col style="width:5%"><col style="width:5.8%"></colgroup>
        <thead><tr><th>No.</th><th>Status</th><th>Nama Lengkap Pegawai</th><th>Jabatan, Tugas Utama, &amp; Tambahan</th><th>Jumlah</th><th v-for="k in KOLOM_BEBAN" :key="k">{{ SINGKAT[k] || k }}</th><th>Wajib</th><th>Selisih</th></tr></thead>
        <tbody><tr v-for="(r, i) in tampil" :key="r.employee_id">
          <td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ STATUS[r.status] }}</td><td>{{ r.nama }}</td><td>{{ r.rincian.map((x) => x.nama).join(', ') }}</td>
          <td class="tengah">{{ jam(r.total) }}</td><td v-for="k in KOLOM_BEBAN" :key="k" class="tengah">{{ perKolom(r, k) ? jam(perKolom(r, k)) : '' }}</td>
          <td class="tengah">{{ jam(r.jam_wajib) }}</td><td class="tengah">{{ r.selisih == null ? '–' : (r.selisih > 0 ? '+' : '') + jam(r.selisih) }}</td></tr></tbody>
      </table>
      <p style="margin-top: 6pt">Jam wajib: tetap {{ jam(bk.wajib.tetap) }} jam, kontrak {{ jam(bk.wajib.kontrak) }} jam per pekan; honorer tidak terikat. Selisih negatif = kekurangan jam.</p>
      <template #ttd><TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }" :kanan="{ jabatan: 'Pembuat', nama: sesi.pengguna?.nama_lengkap || '' }" /></template>
    </DokumenCetak>
  </div>
</template>
<style scoped>.tab.aktif { border-color: color-mix(in srgb, var(--c) 35%, transparent); background: color-mix(in srgb, var(--c) 12%, rgb(var(--permukaan))); }</style>
