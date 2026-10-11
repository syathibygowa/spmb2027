<!-- SIMKA PRO | src/pages/kelompok/KelompokPegawai.vue | v1.1 | Fase 8 – Urutan kolom seragam (NIY/NIS > Nama > JK) | 10/10/2026 -->
<script setup>
// Kelompok pegawai di luar jabatan fungsional/struktural: Pengurus Harian (PH), Pengurus Inti (PI), panitia, tim, dll.
// Superadmin dan admin ber-izin kelola_kelompok membuat kelompok, memilih anggota (dengan peran opsional),
// lalu kelompok muncul sebagai pilihan sasaran satu klik di pengumuman, berkas, dan agenda.
import { ref, computed, onMounted } from 'vue'
import { PhUsersFour, PhPlus, PhPencilSimple, PhTrash, PhMagnifyingGlass, PhX, PhFloppyDisk, PhArrowUp, PhPrinter } from '@phosphor-icons/vue'
import { useKelompok } from '@/stores/kelompok'
import { usePegawai } from '@/stores/pegawai'
import { useLembaga } from '@/stores/lembaga'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import LembarBawah from '@/components/LembarBawah.vue'
import TombolAksi from '@/components/TombolAksi.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'

const kl = useKelompok(); const peg = usePegawai(); const lembaga = useLembaga(); const sesi = useSesi(); const ui = useUI()
const WARNA = ['beranda', 'pegawai', 'presensi', 'pengajuan', 'tahfizh', 'santri', 'klinik', 'agenda', 'berkas', 'laporan', 'security', 'pengumuman']
const pilih = ref(null); const form = ref(null); const anggota = ref([]); const cari = ref(''); const ubahAnggota = ref(false); const pratinjau = ref(false)
onMounted(async () => { await Promise.all([kl.muat(true), peg.daftar.length ? null : peg.muat(), lembaga.muat()]); pilih.value = kl.daftar[0]?.id || null })

const k = computed(() => kl.cari(pilih.value))
const namaPeg = (id) => peg.cari(id)?.nama_lengkap || 'Pegawai'
const unitPeg = (id) => peg.cari(id)?.nama_unit || ''
const calon = computed(() => {
  const q = cari.value.toLowerCase().trim(); if (q.length < 2) return []
  const ada = new Set(anggota.value.map((a) => a.employee_id))
  return peg.daftar.filter((p) => p.status_keaktifan === 'aktif' && !ada.has(p.id) && [p.nama_lengkap, p.niy].join(' ').toLowerCase().includes(q)).slice(0, 8)
})

function baru() { form.value = { nama: '', singkatan: '', keterangan: '', warna: 'pegawai', aktif: true, urutan: kl.daftar.length + 1 } }
async function simpan() {
  if (form.value.nama.trim().length < 2) return ui.toast('Nama kelompok minimal 2 karakter.', 'galat')
  try { const id = await kl.simpan(form.value); pilih.value = id; form.value = null; ui.toast('Kelompok disimpan.', 'info') } catch (e) { ui.toast(e.message, 'galat') }
}
async function hapus() {
  if (!(await ui.konfirmasi({ judul: 'Hapus kelompok?', pesan: `${k.value.nama}. Pengumuman dan agenda yang sudah terkirim tidak terpengaruh.`, ya: 'Hapus', bahaya: true }))) return
  try { await kl.hapus(k.value.id); pilih.value = kl.daftar[0]?.id || null; ui.toast('Kelompok dihapus.', 'info') } catch (e) { ui.toast(e.message, 'galat') }
}
function mulaiAnggota() { anggota.value = (k.value.anggota || []).map((a) => ({ employee_id: a.employee_id, peran: a.peran || '' })); cari.value = ''; ubahAnggota.value = true }
function tambah(p) { anggota.value.push({ employee_id: p.id, peran: '' }); cari.value = '' }
function naik(i) { if (i > 0) anggota.value.splice(i - 1, 0, anggota.value.splice(i, 1)[0]) }
async function simpanAnggota() {
  try { await kl.aturAnggota(k.value.id, anggota.value); ubahAnggota.value = false; ui.toast(`${anggota.value.length} anggota disimpan.`, 'info') } catch (e) { ui.toast(e.message, 'galat') }
}
const direktur = computed(() => lembaga.signatories.find((s) => s.sumber_jabatan === 'DIREKTUR' || /^direktur/i.test(s.jabatan_tertulis)) || {})
</script>
<template>
  <div class="mx-auto max-w-5xl">
    <div class="layar-saja">
      <p class="mb-3 text-sm text-teks2">Kelompok pegawai di luar jabatan, misalnya Pengurus Harian (PH), Pengurus Inti (PI), panitia, atau tim kerja. Kelompok aktif muncul sebagai pilihan sasaran satu klik di Pengumuman, Berkas Saya, dan Agenda.</p>
      <div class="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside class="space-y-2">
          <button v-for="g in kl.daftar" :key="g.id" type="button" @click="pilih = g.id"
            :class="['kartu flex w-full items-center gap-3 p-3 text-left', 'w-' + g.warna, pilih === g.id ? 'terpilih' : 'hover:bg-permukaan2', !g.aktif && 'opacity-60']">
            <span class="chip-ikon h-10 w-10 shrink-0 text-sm font-extrabold">{{ (g.singkatan || g.nama).slice(0, 3) }}</span>
            <span class="min-w-0 flex-1"><span class="block truncate font-bold">{{ g.nama }}</span><span class="block text-xs text-teks3">{{ g.anggota.length }} anggota{{ g.aktif ? '' : ' · nonaktif' }}</span></span>
          </button>
          <p v-if="!kl.daftar.length && !kl.memuat" class="rounded-xl bg-permukaan2 p-4 text-sm text-teks2">Belum ada kelompok. Tekan "Kelompok baru".</p>
          <button class="tombol-garis hidden w-full lg:inline-flex" @click="baru"><PhPlus :size="18" weight="bold" /> Kelompok baru</button>
        </aside>

        <section v-if="k" :class="['kartu p-5', 'w-' + k.warna]">
          <div class="flex flex-wrap items-start gap-3">
            <span class="chip-ikon h-12 w-12"><PhUsersFour :size="26" weight="duotone" /></span>
            <div class="min-w-0 flex-1"><h2 class="text-xl font-extrabold">{{ k.nama }}<span v-if="k.singkatan" class="ml-2 text-base text-teks3">({{ k.singkatan }})</span></h2>
              <p v-if="k.keterangan" class="text-sm text-teks2">{{ k.keterangan }}</p></div>
            <div class="flex gap-1">
              <button class="tombol-ikon" aria-label="Cetak daftar anggota" @click="pratinjau = true"><PhPrinter :size="20" /></button>
              <button class="tombol-ikon" aria-label="Ubah kelompok" @click="form = { ...k }"><PhPencilSimple :size="20" /></button>
              <button class="tombol-ikon" aria-label="Hapus kelompok" @click="hapus"><PhTrash :size="20" /></button>
            </div>
          </div>
          <div class="mb-2 mt-4 flex items-center justify-between"><h3 class="judul-bagian">Anggota ({{ k.anggota.length }})</h3>
            <button class="tombol-utama min-h-[40px] px-4 text-sm" @click="mulaiAnggota"><PhPencilSimple :size="18" /> Atur anggota</button></div>
          <ol class="divide-y divide-garis">
            <li v-for="(a, i) in k.anggota" :key="a.employee_id" class="flex items-center gap-3 py-2.5">
              <span class="w-6 text-center text-sm font-bold text-teks3">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1"><span class="block font-semibold">{{ namaPeg(a.employee_id) }}</span><span class="block text-xs text-teks3">{{ unitPeg(a.employee_id) }}</span></span>
              <span v-if="a.peran" class="lencana">{{ a.peran }}</span>
            </li>
            <li v-if="!k.anggota.length" class="py-4 text-sm text-teks3">Belum ada anggota.</li>
          </ol>
        </section>
      </div>
      <TombolAksi label="Kelompok" :ikon="PhPlus" warna="pegawai" @klik="baru" />
    </div>

    <LembarBawah :model-value="!!form" @update:model-value="(v) => !v && (form = null)" :judul="form?.id ? 'Ubah kelompok' : 'Kelompok baru'">
      <form v-if="form" class="space-y-3 pb-2" @submit.prevent="simpan">
        <div class="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div><label class="label-isian" for="kl-nama">Nama kelompok</label><input id="kl-nama" v-model="form.nama" class="isian" placeholder="Contoh: Pengurus Harian" /></div>
          <div><label class="label-isian" for="kl-singkat">Singkatan</label><input id="kl-singkat" v-model="form.singkatan" class="isian" maxlength="20" placeholder="PH" /></div>
        </div>
        <div><label class="label-isian" for="kl-ket">Keterangan</label><input id="kl-ket" v-model="form.keterangan" class="isian" /></div>
        <fieldset><legend class="label-isian">Warna</legend>
          <div class="flex flex-wrap gap-2"><button v-for="w in WARNA" :key="w" type="button" :class="['h-9 w-9 rounded-full', 'w-' + w, form.warna === w && 'ring-4 ring-offset-2 ring-[var(--c)] ring-offset-[rgb(var(--permukaan))]']" style="background: var(--c)" :aria-label="`Warna ${w}`" :aria-pressed="form.warna === w" @click="form.warna = w" /></div></fieldset>
        <label class="flex min-h-[44px] items-center gap-3 font-semibold"><input v-model="form.aktif" type="checkbox" class="h-5 w-5 accent-[#2F5FA8]" /> Aktif (muncul sebagai pilihan sasaran)</label>
        <button class="tombol-utama w-full"><PhFloppyDisk :size="20" weight="duotone" /> Simpan</button>
      </form>
    </LembarBawah>

    <LembarBawah v-model="ubahAnggota" :judul="`Anggota ${k?.nama || ''}`">
      <div v-if="ubahAnggota" class="space-y-3 pb-2">
        <div class="relative"><PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" class="isian pl-10" placeholder="Tambah anggota: ketik nama atau NIY" aria-label="Cari pegawai" /></div>
        <ul v-if="calon.length" class="overflow-hidden rounded-xl border border-garis">
          <li v-for="p in calon" :key="p.id"><button type="button" class="flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm hover:bg-permukaan2" @click="tambah(p)">
            <PhPlus :size="16" weight="bold" /><span class="flex-1 font-semibold">{{ p.nama_lengkap }}</span><span class="text-xs text-teks3">{{ p.nama_unit }}</span></button></li>
        </ul>
        <ol class="divide-y divide-garis rounded-xl border border-garis">
          <li v-for="(a, i) in anggota" :key="a.employee_id" class="flex flex-wrap items-center gap-2 p-2.5">
            <span class="min-w-0 flex-1 text-sm font-semibold">{{ namaPeg(a.employee_id) }}</span>
            <input v-model="a.peran" class="isian h-10 min-h-0 w-36 py-1 text-sm" placeholder="Peran (opsional)" :aria-label="`Peran ${namaPeg(a.employee_id)}`" />
            <button class="tombol-ikon" :aria-label="`Naikkan ${namaPeg(a.employee_id)}`" :disabled="i === 0" @click="naik(i)"><PhArrowUp :size="18" /></button>
            <button class="tombol-ikon" :aria-label="`Keluarkan ${namaPeg(a.employee_id)}`" @click="anggota.splice(i, 1)"><PhX :size="18" /></button>
          </li>
          <li v-if="!anggota.length" class="p-3 text-sm text-teks3">Belum ada anggota.</li>
        </ol>
        <button class="tombol-utama w-full" @click="simpanAnggota"><PhFloppyDisk :size="20" weight="duotone" /> Simpan anggota ({{ anggota.length }})</button>
      </div>
    </LembarBawah>

    <DokumenCetak v-if="k" v-model:pratinjau="pratinjau" judul="Daftar Anggota Kelompok" :subjudul="k.nama + (k.singkatan ? ` (${k.singkatan})` : '')" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="tabel">
        <colgroup><col style="width:7%"><col style="width:20%"><col style="width:40%"><col style="width:33%"></colgroup>
        <thead><tr><th>No.</th><th>NIY</th><th>Nama</th><th>Peran / Bidang</th></tr></thead>
        <tbody><tr v-for="(a, i) in k.anggota" :key="a.employee_id"><td class="tengah">{{ i + 1 }}</td><td>{{ peg.cari(a.employee_id)?.niy || '–' }}</td>
          <td>{{ namaPeg(a.employee_id) }}</td><td>{{ [a.peran, unitPeg(a.employee_id)].filter(Boolean).join(' · ') }}</td></tr></tbody>
      </table>
      <template #ttd><TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }" :kanan="{ jabatan: 'Pembuat', nama: sesi.pengguna?.nama_lengkap || '' }" /></template>
    </DokumenCetak>
  </div>
</template>
<style scoped>.terpilih { box-shadow: inset 0 0 0 2px var(--c); background: color-mix(in srgb, var(--c) 10%, rgb(var(--permukaan))); }</style>
