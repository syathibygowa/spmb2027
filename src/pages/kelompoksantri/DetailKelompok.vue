<!-- SIMKA PRO | src/pages/kelompoksantri/DetailKelompok.vue | v1.2 | Fase 8 – Urutan kolom seragam (NIY/NIS > Nama > JK) | 10/10/2026 -->
<script setup>
// Satu kelompok santri: identitas, pengasuh (utama, pendamping, pengganti bertanggal), grup WA, anggota beserta
// riwayat pindah, tambah/pindah/keluarkan anggota, naqib halaqah, ekspor Excel, dan cetak daftar F4.
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import {
  PhPencilSimple, PhUserCirclePlus, PhUsersThree, PhWhatsappLogo, PhEye, PhDownloadSimple, PhTrash, PhCrown, PhSignOut,
  PhMagnifyingGlass, PhPlus, PhX, PhClockCounterClockwise, PhCaretRight, PhArrowsLeftRight, PhLink,
} from '@phosphor-icons/vue'
import { useKelompokSantri } from '@/stores/kelompokSantri'
import { useSantri } from '@/stores/santri'
import { usePegawai } from '@/stores/pegawai'
import { useOrganisasi } from '@/stores/organisasi'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { JENIS_KELOMPOK, PERAN_PENGASUH, JABATAN_PENGASUH, JENJANG_PENDEK, subjudulKelompok, judulKelompok, kelompokDari, kontakUtama, inisial, penandaKelompok, labelRombel } from '@/lib/santri'
import { formatPendek, hariIniISO } from '@/lib/tanggal'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'
import LembarBawah from '@/components/LembarBawah.vue'
import InputTanggal from '@/components/InputTanggal.vue'
import TombolWA from '@/components/TombolWA.vue'
import TombolAksi from '@/components/TombolAksi.vue'
import LembarKelompok from './LembarKelompok.vue'

const route = useRoute(); const router = useRouter()
const kel = useKelompokSantri(); const san = useSantri(); const peg = usePegawai(); const org = useOrganisasi(); const sesi = useSesi(); const ui = useUI()
const id = computed(() => route.params.id)
const g = computed(() => kel.cari(id.value))
const bolehAtur = computed(() => (sesi.bolehAdmin('kelompok_santri') || sesi.tingkat('kelompok_santri') >= 2) && !g.value?.ta_terkunci)
const jk = computed(() => JENIS_KELOMPOK[g.value?.jenis] || JENIS_KELOMPOK.lainnya)

async function muat() {
  await Promise.all([kel.daftar.length ? null : kel.muat(), san.muat()])
  try { await kel.muatAnggota(id.value) } catch (e) { ui.toast(e.message, 'galat') }
  if (g.value) penanda.value = await penandaKelompok(g.value)
}
onMounted(muat)
watch(id, muat)

const data = computed(() => kel.anggota[id.value] || { aktif: [], riwayat: [] })
const anggota = computed(() => data.value.aktif.map((a) => ({ ...a, s: san.cari(a.student_id) })).filter((a) => a.s)
  .sort((a, b) => a.s.nama_lengkap.localeCompare(b.s.nama_lengkap, 'id')))
const riwayat = computed(() => data.value.riwayat.map((a) => ({ ...a, s: san.cari(a.student_id) })))
const cari = ref('')
const tampil = computed(() => { const q = cari.value.toLowerCase().trim(); return anggota.value.filter((a) => !q || `${a.s.nama_lengkap} ${a.s.nis}`.toLowerCase().includes(q)) })

// ---------- Pilih anggota (untuk keluarkan) ----------
const pilihan = ref(new Set())
const pilihSemua = computed({ get: () => tampil.value.length > 0 && tampil.value.every((a) => pilihan.value.has(a.student_id)),
  set: (v) => { pilihan.value = new Set(v ? tampil.value.map((a) => a.student_id) : []) } })
function togel(sid) { const s = new Set(pilihan.value); s.has(sid) ? s.delete(sid) : s.add(sid); pilihan.value = s }

// ---------- Tambah anggota ----------
const lembarTambah = ref(false); const cariCalon = ref(''); const calonDipilih = ref(new Set()); const tglMasuk = ref(hariIniISO()); const alasanMasuk = ref(''); const proses = ref(false)
const hanyaBelum = ref(true)
const calon = computed(() => {
  if (!g.value) return []
  const q = cariCalon.value.toLowerCase().trim()
  const sudah = new Set(data.value.aktif.map((a) => a.student_id))
  return san.daftar.filter((s) => ['aktif', 'nonaktif'].includes(s.status) && !sudah.has(s.id)
    && (!g.value.jenis_kelamin || s.jenis_kelamin === g.value.jenis_kelamin)
    && (g.value.jenis !== 'kelas' || (s.tingkat === g.value.tingkat && s.jenjang === g.value.jenjang))
    && (!hanyaBelum.value || !['kelas', 'kamar', 'halaqah'].includes(g.value.jenis) || !kelompokDari(s, g.value.jenis))
    && (!q || `${s.nama_lengkap} ${s.nis}`.toLowerCase().includes(q)))
})
function bukaTambah() { calonDipilih.value = new Set(); cariCalon.value = ''; tglMasuk.value = hariIniISO(); alasanMasuk.value = ''; lembarTambah.value = true }
function togelCalon(sid) { const s = new Set(calonDipilih.value); s.has(sid) ? s.delete(sid) : s.add(sid); calonDipilih.value = s }
const akanPindah = computed(() => ['kelas', 'kamar', 'halaqah'].includes(g.value?.jenis)
  ? [...calonDipilih.value].filter((sid) => kelompokDari(san.cari(sid), g.value.jenis)).length : 0)
async function simpanTambah() {
  if (!calonDipilih.value.size) return ui.toast('Pilih sedikitnya satu santri.', 'galat')
  proses.value = true
  try {
    const h = await kel.tambahAnggota(id.value, [...calonDipilih.value], tglMasuk.value, alasanMasuk.value.trim())
    const bagian = [h.ditambah && `${h.ditambah} ditambahkan`, h.dipindah && `${h.dipindah} dipindahkan`, h.sudah && `${h.sudah} sudah anggota`].filter(Boolean)
    ui.toast(`${bagian.join(', ') || 'Tidak ada perubahan'}.${h.dilewati?.length ? ` ${h.dilewati.length} dilewati: ${h.dilewati[0].pesan}` : ''}`, h.dilewati?.length ? 'galat' : 'info')
    lembarTambah.value = false
  } catch (e) { ui.toast(e.message, 'galat') } finally { proses.value = false }
}

// ---------- Keluarkan anggota ----------
const lembarKeluar = ref(false); const tglKeluar = ref(hariIniISO()); const alasanKeluar = ref('')
async function simpanKeluar() {
  proses.value = true
  try {
    const n = await kel.keluarkan(id.value, [...pilihan.value], tglKeluar.value, alasanKeluar.value.trim())
    ui.toast(`${n} santri dikeluarkan dari ${judulKelompok(g.value)}.`); pilihan.value = new Set(); lembarKeluar.value = false
  } catch (e) { ui.toast(e.message, 'galat') } finally { proses.value = false }
}

// ---------- Naqib (halaqah) ----------
async function jadikanNaqib(sid) {
  try {
    await kel.simpan({ id: g.value.id, jenis: g.value.jenis, nama: g.value.nama, tingkat: g.value.tingkat, jenis_kelamin: g.value.jenis_kelamin || '', keterangan: g.value.keterangan || '',
      wa_wali: g.value.wa_wali || '', wa_internal: g.value.wa_internal || '', urutan: g.value.urutan, aktif: g.value.aktif, naqib_id: g.value.naqib_id === sid ? '' : sid })
    ui.toast(g.value.naqib_id ? 'Naqib halaqah ditetapkan.' : 'Naqib halaqah dikosongkan.')
  } catch (e) { ui.toast(e.message, 'galat') }
}

// ---------- Pengasuh ----------
const lembarPengasuh = ref(false); const daftarPengasuh = ref([]); const cariPegawai = ref('')
async function bukaPengasuh() {
  await Promise.all([peg.daftar.length ? null : peg.muat(), org.muat()])
  daftarPengasuh.value = (g.value.pengasuh || []).map((p) => ({ employee_id: p.employee_id, nama: p.nama, peran: p.peran, mulai: p.mulai || '', sampai: p.sampai || '', catatan: p.catatan || '' }))
  cariPegawai.value = ''; lembarPengasuh.value = true
}
// Kelas, kamar, halaqah: hanya pegawai yang memegang jabatan fungsional tupoksi terkait (diperiksa juga di server).
// Ekskul dan kelompok lainnya tidak terikat jabatan.
const kodeJabatan = computed(() => JABATAN_PENGASUH[g.value?.jenis])
const jabatanWajib = computed(() => (kodeJabatan.value ? org.fungsional.find((f) => f.kode === kodeJabatan.value) : null))
const calonPengasuh = computed(() => {
  const q = cariPegawai.value.toLowerCase().trim(); const ada = new Set(daftarPengasuh.value.map((p) => p.employee_id))
  return peg.daftar.filter((p) => (p.status_keaktifan || 'aktif') === 'aktif' && !ada.has(p.id)
      && (!jabatanWajib.value || (p.fungsional_ids || []).includes(jabatanWajib.value.id))
      && (!q || p.nama_lengkap.toLowerCase().includes(q)))
    .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, 'id')).slice(0, q ? 40 : 12)
})
function tambahPengasuh(p) { daftarPengasuh.value.push({ employee_id: p.id, nama: p.nama_lengkap, peran: daftarPengasuh.value.some((x) => x.peran === 'utama') ? 'pendamping' : 'utama', mulai: '', sampai: '', catatan: '' }); cariPegawai.value = '' }
async function simpanPengasuh() {
  for (const p of daftarPengasuh.value) {
    if (p.peran === 'pengganti' && !p.sampai) return ui.toast(`Isi tanggal berakhir untuk pengganti sementara (${p.nama}).`, 'galat')
    if (p.mulai && p.sampai && p.sampai < p.mulai) return ui.toast(`Tanggal berakhir ${p.nama} sebelum tanggal mulai.`, 'galat')
  }
  proses.value = true
  try {
    await kel.aturPengasuh(id.value, daftarPengasuh.value.map(({ nama, ...p }) => p), Object.fromEntries(daftarPengasuh.value.map((p) => [p.employee_id, p.nama])))
    ui.toast('Pengasuh kelompok disimpan. Pengasuh baru menerima notifikasi.'); lembarPengasuh.value = false
  } catch (e) { ui.toast(e.message, 'galat') } finally { proses.value = false }
}

// ---------- Ubah, hapus ----------
const lembarUbah = ref(false)
async function hapus() {
  const adaAnggota = data.value.aktif.length + data.value.riwayat.length > 0
  if (!(await ui.konfirmasi({ judul: adaAnggota ? 'Nonaktifkan kelompok?' : 'Hapus kelompok?', bahaya: true,
    pesan: adaAnggota ? `${judulKelompok(g.value)} sudah memiliki riwayat anggota, sehingga dinonaktifkan (bukan dihapus) dan anggota aktif dikeluarkan hari ini.` : `${judulKelompok(g.value)} akan dihapus permanen.`,
    ya: adaAnggota ? 'Nonaktifkan' : 'Hapus' }))) return
  try { const h = await kel.hapus(id.value); ui.toast(h === 'dihapus' ? 'Kelompok dihapus.' : 'Kelompok dinonaktifkan.'); router.replace(`/kelompok-santri/${g.value?.jenis || 'kelas'}`) }
  catch (e) { ui.toast(e.message, 'galat') }
}

// ---------- Ekspor dan cetak ----------
const penanda = ref({ jabatan: '', nama: '', niy: '' }); const pratinjau = ref(false)
const pengasuhUtama = computed(() => (g.value?.pengasuh || []).find((p) => p.peran === 'utama') || (g.value?.pengasuh || [])[0] || null)
const kopCetak = computed(() => (g.value?.jenis === 'kelas' ? g.value.jenjang : 'pondok'))
function ekspor() {
  const kolom = ['No.', 'NIS', 'Nama', 'L/P', 'Kelas', 'Orang tua/wali utama', 'Nomor HP', 'Anggota sejak']
  const baris = anggota.value.map((a, i) => [i + 1, a.s.nis || a.s.nisn || '', a.s.nama_lengkap, a.s.jenis_kelamin, kelompokDari(a.s, 'kelas')?.nama || `${a.s.tingkat} ${JENJANG_PENDEK[a.s.jenjang]}`,
    kontakUtama(a.s)?.nama || '', kontakUtama(a.s)?.no_hp || '', formatPendek(a.mulai)])
  const ws = XLSX.utils.aoa_to_sheet([[`${judulKelompok(g.value)} – Tahun ajaran ${g.value.tahun_ajaran}`], [], kolom, ...baris])
  ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 5 }, { wch: 10 }, { wch: 26 }, { wch: 15 }, { wch: 13 }]
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Anggota')
  XLSX.writeFile(wb, `Anggota-${judulKelompok(g.value).replace(/[^\w.-]+/g, '-')}.xlsx`)
}
const IKON_PERAN = { utama: 'tahfizh', pendamping: 'pegawai', pengganti: 'pengajuan' }
</script>
<template>
  <div v-if="g" class="mx-auto max-w-5xl">
    <div class="layar-saja">
      <!-- Identitas kelompok -->
      <section :class="['kartu overflow-hidden', 'w-' + jk.warna]">
        <div class="kepala p-5">
          <p class="text-sm font-semibold text-white/90">{{ jk.jamak }} · Tahun ajaran {{ g.tahun_ajaran }}</p>
          <h2 class="mt-1 text-2xl font-extrabold text-white">{{ judulKelompok(g) }}</h2>
          <p class="text-sm text-white/90">{{ subjudulKelompok(g) }}{{ g.keterangan ? ' · ' + g.keterangan : '' }}</p>
        </div>
        <div class="grid grid-cols-3 divide-x divide-garis border-b border-garis text-center">
          <div class="p-3"><p class="text-2xl font-extrabold tabular-nums" style="color: var(--c)">{{ anggota.length }}</p><p class="text-xs text-teks3">anggota</p></div>
          <div class="p-3"><p class="text-2xl font-extrabold tabular-nums text-teks">{{ anggota.filter((a) => a.s.jenis_kelamin === 'L').length }}</p><p class="text-xs text-teks3">putra</p></div>
          <div class="p-3"><p class="text-2xl font-extrabold tabular-nums text-teks">{{ anggota.filter((a) => a.s.jenis_kelamin === 'P').length }}</p><p class="text-xs text-teks3">putri</p></div>
        </div>
        <div class="flex flex-wrap gap-2 p-4">
          <a v-if="g.wa_wali" :href="g.wa_wali" target="_blank" rel="noopener" class="tombol-garis w-presensi min-h-[40px] px-3 text-sm"><PhWhatsappLogo :size="18" weight="duotone" style="color: var(--c)" /> Grup WA wali</a>
          <a v-if="g.wa_internal" :href="g.wa_internal" target="_blank" rel="noopener" class="tombol-garis w-presensi min-h-[40px] px-3 text-sm"><PhLink :size="18" weight="duotone" style="color: var(--c)" /> Grup internal</a>
          <button v-if="bolehAtur" class="tombol-garis min-h-[40px] px-3 text-sm" @click="lembarUbah = true"><PhPencilSimple :size="18" weight="duotone" /> Ubah</button>
          <button class="tombol-garis min-h-[40px] px-3 text-sm" @click="ekspor"><PhDownloadSimple :size="18" weight="duotone" /> Excel</button>
          <button class="tombol-garis min-h-[40px] px-3 text-sm" @click="pratinjau = true"><PhEye :size="18" weight="duotone" /> Cetak daftar</button>
          <button v-if="bolehAtur" class="tombol-garis min-h-[40px] px-3 text-sm" @click="hapus"><PhTrash :size="18" weight="duotone" /> {{ data.aktif.length + data.riwayat.length ? 'Nonaktifkan' : 'Hapus' }}</button>
        </div>
        <p v-if="!g.aktif" class="mx-4 mb-4 rounded-xl bg-permukaan2 p-3 text-sm text-teks2">Kelompok ini nonaktif. Aktifkan lagi lewat Ubah bila diperlukan.</p>
      </section>

      <!-- Pengasuh -->
      <section class="kartu w-pegawai mt-4 p-5">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <span class="chip-ikon h-10 w-10"><PhUsersThree :size="22" weight="duotone" /></span>
          <div class="flex-1"><h3 class="judul-bagian">{{ jk.pengasuh }}</h3><p class="text-sm text-teks3">Pengasuh hanya melihat dan mengabsen santri kelompoknya. Pengganti berakses sampai tanggal berakhir.</p></div>
          <button v-if="bolehAtur" class="tombol-garis min-h-[40px] px-3 text-sm" @click="bukaPengasuh"><PhUserCirclePlus :size="18" weight="duotone" /> Atur pengasuh</button>
        </div>
        <ul v-if="g.pengasuh?.length" class="grid gap-2 sm:grid-cols-2">
          <li v-for="p in g.pengasuh" :key="p.employee_id" :class="['flex items-center gap-3 rounded-2xl border border-garis p-3', 'w-' + IKON_PERAN[p.peran], p.berlaku === false && 'opacity-60']">
            <span class="chip-ikon h-10 w-10 text-sm font-extrabold">{{ inisial(p.nama?.replace(/^(Ust\.|Ustzh\.)\s*/, '')) }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ p.nama }}</p>
              <p class="text-xs font-semibold" style="color: var(--c)">{{ PERAN_PENGASUH[p.peran] }}<span class="font-normal text-teks3">{{ p.mulai || p.sampai ? ` · ${p.mulai ? formatPendek(p.mulai) : '…'} s.d. ${p.sampai ? formatPendek(p.sampai) : '…'}` : '' }}{{ p.berlaku === false ? ' · tidak berlaku hari ini' : '' }}</span></p>
            </div>
            <TombolWA v-if="sesi.isAdmin" kecil :hp="p.no_hp" :pesan="`Assalamu'alaikum warahmatullahi wabarakatuh, ${p.nama}.`" label="WA" />
          </li>
        </ul>
        <p v-else class="rounded-xl bg-permukaan2 p-3 text-sm font-semibold text-merah">{{ jk.pengasuh }} belum ditetapkan.</p>
      </section>

      <!-- Anggota -->
      <section :class="['kartu mt-4 p-5', 'w-' + jk.warna]">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <h3 class="judul-bagian flex-1">Anggota ({{ anggota.length }})</h3>
          <button v-if="bolehAtur && pilihan.size" class="tombol-garis w-klinik min-h-[40px] px-3 text-sm" @click="tglKeluar = hariIniISO(); alasanKeluar = ''; lembarKeluar = true">
            <PhSignOut :size="18" weight="duotone" style="color: var(--c)" /> Keluarkan {{ pilihan.size }}</button>
          <button v-if="bolehAtur && g.aktif" class="tombol-utama hidden min-h-[40px] px-4 text-sm lg:inline-flex" @click="bukaTambah"><PhPlus :size="18" weight="bold" /> Tambah anggota</button>
        </div>
        <div v-if="anggota.length > 8" class="relative mb-3">
          <PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" type="search" class="isian pl-11" placeholder="Cari nama atau NIS" aria-label="Cari anggota" />
        </div>
        <label v-if="bolehAtur && tampil.length" class="mb-1 flex min-h-[40px] items-center gap-2 px-1 text-sm font-semibold text-teks2">
          <input v-model="pilihSemua" type="checkbox" class="h-5 w-5 accent-[#0B7F81]" /> Pilih semua</label>
        <ul class="divide-y divide-garis">
          <li v-for="(a, i) in tampil" :key="a.id" class="flex items-center gap-3 py-2.5">
            <input v-if="bolehAtur" type="checkbox" class="h-5 w-5 shrink-0 accent-[#0B7F81]" :checked="pilihan.has(a.student_id)" :aria-label="`Pilih ${a.s.nama_lengkap}`" @change="togel(a.student_id)" />
            <span v-else class="w-6 shrink-0 text-right text-sm tabular-nums text-teks3">{{ i + 1 }}</span>
            <router-link :to="`/santri/${a.student_id}`" class="flex min-w-0 flex-1 items-center gap-3">
              <span :class="['chip-ikon h-10 w-10 text-sm font-extrabold', a.s.jenis_kelamin === 'P' ? 'w-klinik' : 'w-santri']">{{ inisial(a.s.nama_lengkap) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ a.s.nama_lengkap }}
                  <span v-if="g.naqib_id === a.student_id" class="lencana w-tahfizh ml-1"><PhCrown :size="12" weight="fill" /> Naqib</span>
                  <span v-if="a.s.status !== 'aktif'" class="lencana w-hakakses ml-1">Nonaktif</span></span>
                <span class="block truncate text-sm text-teks3">{{ a.s.nis }}{{ g.jenis !== 'kelas' ? ' · ' + labelRombel(a.s) : '' }} · sejak {{ formatPendek(a.mulai) }}</span>
              </span>
            </router-link>
            <button v-if="bolehAtur && g.jenis === 'halaqah'" class="tombol-ikon h-10 w-10 shrink-0" :aria-label="g.naqib_id === a.student_id ? 'Batalkan naqib' : 'Jadikan naqib'" :title="g.naqib_id === a.student_id ? 'Batalkan naqib' : 'Jadikan naqib'" @click="jadikanNaqib(a.student_id)">
              <PhCrown :size="20" :weight="g.naqib_id === a.student_id ? 'fill' : 'regular'" :class="g.naqib_id === a.student_id ? 'text-[#8C6200] dark:text-[#F2C24B]' : 'text-teks3'" /></button>
            <TombolWA kecil :hp="kontakUtama(a.s)?.no_hp" :pesan="`Assalamu'alaikum warahmatullahi wabarakatuh, Bapak/Ibu ${kontakUtama(a.s)?.nama || ''}.`" label="WA" class="hidden sm:inline-flex" />
          </li>
        </ul>
        <p v-if="!anggota.length" class="py-8 text-center text-sm text-teks3">Belum ada anggota.{{ bolehAtur ? ' Ketuk Tambah anggota.' : '' }}</p>
      </section>

      <!-- Riwayat keluar/pindah -->
      <details v-if="riwayat.length" class="kartu w-pengajuan mt-4 p-5">
        <summary class="flex cursor-pointer items-center gap-3"><span class="chip-ikon h-10 w-10"><PhClockCounterClockwise :size="22" weight="duotone" /></span>
          <span class="flex-1 font-bold">Riwayat keluar dan pindah ({{ riwayat.length }})</span><PhCaretRight :size="18" class="text-teks3" /></summary>
        <ul class="mt-3 divide-y divide-garis text-sm">
          <li v-for="r in riwayat" :key="r.id" class="flex flex-wrap gap-x-3 py-2">
            <span class="font-semibold">{{ r.s?.nama_lengkap || 'Santri di luar cakupan Anda' }}</span>
            <span class="text-teks3">{{ formatPendek(r.mulai) }} – {{ formatPendek(r.selesai) }}</span>
            <span class="w-full text-teks2">{{ r.alasan_keluar }}</span>
          </li>
        </ul>
      </details>
    </div>

    <!-- Daftar anggota F4 -->
    <DokumenCetak :kop="kopCetak" :judul="`Daftar Santri ${judulKelompok(g)}`" :subjudul="`Tahun Ajaran ${g.tahun_ajaran} · ${subjudulKelompok(g)}`"
      v-model:pratinjau="pratinjau" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="data" style="margin-bottom: 6pt">
        <tbody>
          <tr><td style="width: 40mm">{{ jk.pengasuh }}</td><td style="width: 4mm">:</td><td>{{ (g.pengasuh || []).filter((p) => p.peran !== 'pengganti').map((p) => p.nama).join(', ') || '–' }}</td></tr>
          <tr v-if="g.jenis === 'halaqah'"><td>Naqib</td><td>:</td><td>{{ g.nama_naqib || '–' }}</td></tr>
          <tr><td>Jumlah santri</td><td>:</td><td>{{ anggota.length }} orang (putra {{ anggota.filter((a) => a.s.jenis_kelamin === 'L').length }}, putri {{ anggota.filter((a) => a.s.jenis_kelamin === 'P').length }})</td></tr>
        </tbody>
      </table>
      <table class="tabel">
        <colgroup><col style="width:6%"><col style="width:14%"><col style="width:36%"><col style="width:6%"><col style="width:22%"><col style="width:16%"></colgroup>
        <thead><tr><th>No.</th><th>NIS</th><th>Nama</th><th>L/P</th><th>Orang tua/wali</th><th>Nomor HP</th></tr></thead>
        <tbody>
          <tr v-for="(a, i) in anggota" :key="a.id">
            <td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ a.s.nis || a.s.nisn || '–' }}</td><td>{{ a.s.nama_lengkap }}</td>
            <td class="tengah">{{ a.s.jenis_kelamin }}</td><td>{{ kontakUtama(a.s)?.nama || '–' }}</td><td class="tengah">{{ kontakUtama(a.s)?.no_hp || '–' }}</td>
          </tr>
        </tbody>
      </table>
      <template #ttd>
        <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: penanda.jabatan, nama: penanda.nama, niy: penanda.niy }"
          :kanan="{ jabatan: jk.pengasuh, nama: pengasuhUtama?.nama || '', niy: pengasuhUtama?.niy }" />
      </template>
    </DokumenCetak>

    <TombolAksi v-if="bolehAtur && g.aktif" label="Anggota" :ikon="PhPlus" warna="kelompoksantri" @klik="bukaTambah" />
    <LembarKelompok v-model="lembarUbah" :kelompok="g" />

    <!-- Lembar tambah anggota -->
    <LembarBawah v-model="lembarTambah" :judul="`Tambah anggota ${judulKelompok(g)}`">
      <div class="space-y-3 pb-2">
        <p class="text-sm text-teks2">Hanya santri yang sesuai ({{ subjudulKelompok(g) }}) yang ditampilkan.
          <template v-if="['kelas', 'kamar', 'halaqah'].includes(g.jenis)"> Santri yang sudah memiliki {{ jk.n.toLowerCase() }} lain akan <b>dipindahkan</b> dan riwayatnya tersimpan.</template></p>
        <div class="relative"><PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cariCalon" type="search" class="isian pl-11" placeholder="Cari nama atau NIS" aria-label="Cari santri" /></div>
        <label v-if="['kelas', 'kamar', 'halaqah'].includes(g.jenis)" class="flex min-h-[40px] items-center gap-2 text-sm font-semibold">
          <input v-model="hanyaBelum" type="checkbox" class="h-5 w-5 accent-[#0B7F81]" /> Hanya yang belum memiliki {{ jk.n.toLowerCase() }}</label>
        <ul class="max-h-[42dvh] divide-y divide-garis overflow-y-auto rounded-xl border border-garis">
          <li v-for="s in calon" :key="s.id">
            <label class="flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-2">
              <input type="checkbox" class="h-5 w-5 accent-[#0B7F81]" :checked="calonDipilih.has(s.id)" @change="togelCalon(s.id)" />
              <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ s.nama_lengkap }}</span>
                <span class="block truncate text-xs text-teks3">{{ s.nis }} · Kelas {{ s.tingkat }} {{ JENJANG_PENDEK[s.jenjang] }}{{ kelompokDari(s, g.jenis) && ['kelas', 'kamar', 'halaqah'].includes(g.jenis) ? ` · saat ini di ${kelompokDari(s, g.jenis).nama}` : '' }}</span></span>
            </label>
          </li>
          <li v-if="!calon.length" class="p-4 text-center text-sm text-teks3">Tidak ada santri yang sesuai.</li>
        </ul>
        <button v-if="calon.length" type="button" class="text-sm font-semibold text-merah" @click="calonDipilih = new Set(calon.map((s) => s.id))">Pilih semua yang tampil ({{ calon.length }})</button>
        <div class="grid gap-3 sm:grid-cols-2">
          <InputTanggal v-model="tglMasuk" label="Berlaku mulai" wajib />
          <div><label class="label-isian" for="ag-alasan">Keterangan (opsional)</label><input id="ag-alasan" v-model="alasanMasuk" class="isian" placeholder="Contoh: penyesuaian level" /></div>
        </div>
        <p v-if="akanPindah" class="flex items-center gap-1.5 text-sm font-semibold text-teks2"><PhArrowsLeftRight :size="16" /> {{ akanPindah }} santri akan dipindahkan dari {{ jk.n.toLowerCase() }} sebelumnya.</p>
        <button class="tombol-utama w-full" :disabled="proses || !calonDipilih.size" @click="simpanTambah">{{ proses ? 'Menyimpan…' : `Simpan ${calonDipilih.size} santri` }}</button>
      </div>
    </LembarBawah>

    <!-- Lembar keluarkan -->
    <LembarBawah v-model="lembarKeluar" judul="Keluarkan dari kelompok">
      <div class="space-y-4 pb-2">
        <p class="text-sm text-teks2">{{ pilihan.size }} santri dikeluarkan dari {{ judulKelompok(g) }}. Data santri tidak terhapus; riwayat keanggotaan tetap tersimpan.</p>
        <InputTanggal v-model="tglKeluar" label="Tanggal keluar" wajib />
        <div><label class="label-isian" for="kl-alasan">Alasan</label><input id="kl-alasan" v-model="alasanKeluar" class="isian" placeholder="Contoh: berhenti mengikuti ekskul" /></div>
        <button class="tombol-utama w-full" :disabled="proses" @click="simpanKeluar">{{ proses ? 'Menyimpan…' : 'Keluarkan' }}</button>
      </div>
    </LembarBawah>

    <!-- Lembar pengasuh -->
    <LembarBawah v-model="lembarPengasuh" :judul="`Atur ${jk.pengasuh.toLowerCase()}`">
      <div class="space-y-3 pb-2">
        <ul class="space-y-2">
          <li v-for="(p, i) in daftarPengasuh" :key="p.employee_id" class="rounded-2xl border border-garis p-3">
            <div class="flex items-center gap-2"><p class="flex-1 font-semibold">{{ p.nama }}
                <span v-if="jabatanWajib && !(peg.cari(p.employee_id)?.fungsional_ids || []).includes(jabatanWajib.id)" class="block text-xs font-semibold text-merah">Belum berjabatan {{ jabatanWajib.nama.toLowerCase() }}: hapus atau lengkapi jabatannya di Data Pegawai.</span></p>
              <button class="tombol-ikon h-9 w-9" :aria-label="`Hapus ${p.nama}`" @click="daftarPengasuh.splice(i, 1)"><PhX :size="18" /></button></div>
            <div class="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-permukaan2 p-1" role="radiogroup" :aria-label="`Peran ${p.nama}`">
              <button v-for="(n, k) in PERAN_PENGASUH" :key="k" type="button" role="radio" :aria-checked="p.peran === k" @click="p.peran = k"
                :class="['min-h-[40px] rounded-xl text-xs font-semibold', p.peran === k ? 'bg-permukaan text-teks shadow-kartu' : 'text-teks2']">{{ n.replace(' sementara', '') }}</button>
            </div>
            <div v-if="p.peran === 'pengganti' || p.mulai || p.sampai" class="mt-2 grid grid-cols-2 gap-2">
              <InputTanggal v-model="p.mulai" label="Mulai" bawaan-kosong />
              <InputTanggal v-model="p.sampai" label="Sampai" bawaan-kosong :wajib="p.peran === 'pengganti'" />
            </div>
          </li>
          <li v-if="!daftarPengasuh.length" class="rounded-xl bg-permukaan2 p-3 text-sm text-teks3">Belum ada pengasuh. Cari pegawai di bawah.</li>
        </ul>
        <p class="text-sm text-teks2">{{ jabatanWajib ? `Hanya pegawai yang ditugaskan sebagai ${jabatanWajib.nama.toLowerCase()} yang dapat dipilih.` : 'Pembina dapat dipilih dari semua pegawai aktif, termasuk pelatih dari luar.' }}</p>
        <div class="relative"><PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cariPegawai" type="search" class="isian pl-11" placeholder="Cari nama pegawai" aria-label="Cari pegawai" /></div>
        <ul class="max-h-[30dvh] divide-y divide-garis overflow-y-auto rounded-xl border border-garis">
          <li v-for="p in calonPengasuh" :key="p.id">
            <button type="button" class="flex min-h-[48px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-permukaan2" @click="tambahPengasuh(p)">
              <PhPlus :size="18" class="shrink-0 text-teks3" />
              <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ p.nama_lengkap }}</span>
                <span class="block truncate text-xs text-teks3">{{ (p.jabatan_fungsional || []).join(', ') || 'Jabatan belum diisi' }}</span></span>
            </button>
          </li>
          <li v-if="!calonPengasuh.length" class="p-3 text-center text-sm text-teks3">{{ !peg.daftar.length ? 'Daftar pegawai hanya tersedia untuk admin.' : jabatanWajib ? `Tidak ada pegawai berjabatan ${jabatanWajib.nama.toLowerCase()} yang cocok. Tetapkan jabatannya di Data Pegawai.` : 'Tidak ada pegawai yang cocok.' }}</li>
        </ul>
        <p class="text-xs text-teks3">Pengganti bersifat saling membantu: tidak ada honor tambahan dan tidak ada potongan bagi yang digantikan. Aksesnya berakhir otomatis setelah tanggal "Sampai".</p>
        <button class="tombol-utama w-full" :disabled="proses" @click="simpanPengasuh">{{ proses ? 'Menyimpan…' : 'Simpan pengasuh' }}</button>
      </div>
    </LembarBawah>
  </div>
  <p v-else-if="!kel.memuat" class="py-16 text-center text-teks3">Kelompok tidak ditemukan atau di luar cakupan Anda.</p>
  <p v-else class="py-16 text-center text-teks3">Memuat kelompok…</p>
</template>
<style scoped>
.kepala { background: linear-gradient(135deg, color-mix(in srgb, var(--c) 70%, #000) 0%, color-mix(in srgb, var(--c) 92%, #000) 60%, color-mix(in srgb, var(--c2) 80%, #000) 100%); }
:global(html.dark) .kepala { background: linear-gradient(135deg, color-mix(in srgb, var(--c) 30%, #000) 0%, color-mix(in srgb, var(--c) 42%, #000) 60%, color-mix(in srgb, var(--c2) 36%, #000) 100%); }
</style>
