<!-- SIMKA PRO | src/pages/tunjangan/TabTarif.vue | v1.0 | Fase 1 – Jabatan dan tunjangan | 03/10/2026 -->
<script setup>
// Tarif komponen gaji. Perubahan tarif dibuat sebagai tarif baru dengan tanggal berlaku,
// sehingga perhitungan periode lama tetap memakai tarif lama.
import { ref, computed } from 'vue'
import { PhPencilSimple, PhFloppyDisk, PhTrash, PhClockCounterClockwise } from '@phosphor-icons/vue'
import { useTunjangan } from '@/stores/tunjangan'
import { useOrganisasi } from '@/stores/organisasi'
import { useUI } from '@/stores/ui'
import { hariIniISO, formatPendek, formatPanjang } from '@/lib/tanggal'
import { KATEGORI, formatRupiah, petaTarif } from '@/lib/tunjangan'
import { PENDIDIKAN, STATUS_PEGAWAI, LEVEL_MUHAFFIZH } from '@/lib/kepegawaian'
import LembarBawah from '@/components/LembarBawah.vue'
import InputTanggal from '@/components/InputTanggal.vue'

const tunj = useTunjangan(); const org = useOrganisasi(); const ui = useUI()
const kini = computed(() => petaTarif(tunj.tarif, hariIniISO()))
const HONORER = { guru_lama: 'Guru lama (per jam)', guru_baru: 'Guru baru (per jam)', muhaffizh_lama: 'Muhaffizh lama (per jam)', muhaffizh_baru: 'Muhaffizh baru (per jam)' }
// Daftar kunci setiap kategori (termasuk yang belum punya tarif agar dapat diisi)
const KUNCI = computed(() => ({
  struktural: [...org.struktural].filter((j) => j.aktif).sort((a, b) => a.tingkat - b.tingkat).map((j) => [j.kode, j.nama]),
  fungsional: org.fungsional.filter((j) => j.aktif).map((j) => [j.kode, j.nama]),
  pendidikan: Object.entries(PENDIDIKAN),
  masa_kerja: Array.from({ length: 12 }, (_, i) => [String(i + 1), `${i + 1} tahun`]),
  kepegawaian: Object.entries(STATUS_PEGAWAI).filter(([k]) => k !== 'honorer'),
  kesehatan: Object.entries(STATUS_PEGAWAI).filter(([k]) => k !== 'honorer'),
  level_muhaffizh: Object.entries(LEVEL_MUHAFFIZH),
  honorer_jam: Object.entries(HONORER),
}))
const riwayat = (kat, kunci) => tunj.tarif.filter((r) => r.kategori === kat && r.kunci === kunci).sort((a, b) => b.berlaku_mulai.localeCompare(a.berlaku_mulai))
const akanDatang = (kat, kunci) => riwayat(kat, kunci).find((r) => r.berlaku_mulai > hariIniISO())

const f = ref(null); const proses = ref(false)
function ubah(kategori, kunci, nama) {
  const r = kini.value[kategori]?.[kunci]
  f.value = { kategori, kunci, nama: r?.nama || nama, besaran: r ? String(Number(r.besaran)) : '', berlaku_mulai: hariIniISO(), keterangan: '' }
}
const angka = (v) => Number(String(v).replace(/[^0-9]/g, ''))
async function simpan() {
  const d = f.value
  if (String(d.besaran).trim() === '' || isNaN(angka(d.besaran))) return ui.toast('Isi besaran tarif dalam rupiah.', 'galat')
  proses.value = true
  try { await tunj.simpan({ ...d, besaran: angka(d.besaran) }); ui.toast(`Tarif ${d.nama} berlaku mulai ${formatPanjang(d.berlaku_mulai)}.`); f.value = null }
  catch (e) { ui.toast(e.message, 'galat') } finally { proses.value = false }
}
async function hapus(r) {
  if (!(await ui.konfirmasi({ judul: 'Hapus tarif ini?', pesan: `${r.nama} ${formatRupiah(r.besaran)} berlaku mulai ${formatPanjang(r.berlaku_mulai)}. Hapus hanya bila tarif ini salah input.`, ya: 'Hapus', bahaya: true }))) return
  try { await tunj.hapus(r.id); ui.toast('Tarif dihapus.') } catch (e) { ui.toast(e.message, 'galat') }
}
</script>
<template>
  <div class="grid gap-4 xl:grid-cols-2">
    <section v-for="(info, kat) in KATEGORI" :key="kat" :class="['kartu p-4 sm:p-5', 'w-' + info.w]">
      <h3 class="judul-bagian flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full" style="background: var(--c)" />{{ info.n }}</h3>
      <p class="mb-2 text-sm text-teks3">{{ info.ket }}</p>
      <ul class="divide-y divide-garis">
        <li v-for="[kunci, nama] in KUNCI[kat]" :key="kunci" class="flex items-center gap-2 py-2">
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{{ nama }}</p>
            <p class="text-xs text-teks3">
              <template v-if="kini[kat]?.[kunci]">Berlaku sejak {{ formatPendek(kini[kat][kunci].berlaku_mulai) }}</template>
              <template v-else>Belum ada tarif</template>
              <template v-if="akanDatang(kat, kunci)"> – berubah menjadi {{ formatRupiah(akanDatang(kat, kunci).besaran) }} mulai {{ formatPendek(akanDatang(kat, kunci).berlaku_mulai) }}</template>
            </p>
          </div>
          <span :class="['font-bold tabular-nums', !kini[kat]?.[kunci] && 'text-teks3']">{{ kini[kat]?.[kunci] ? formatRupiah(kini[kat][kunci].besaran) : '–' }}</span>
          <button class="tombol-ikon h-10 w-10" @click="ubah(kat, kunci, nama)" :aria-label="`Ubah tarif ${nama}`"><PhPencilSimple :size="18" /></button>
        </li>
      </ul>
    </section>

    <LembarBawah :model-value="!!f" @update:model-value="(x) => !x && (f = null)" :judul="f ? `Tarif ${f.nama}` : ''">
      <div v-if="f" class="space-y-4 pb-2">
        <div><label class="label-isian" for="tr-bsr">Besaran (rupiah)</label>
          <div class="relative"><span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-teks3">Rp</span>
            <input id="tr-bsr" v-model="f.besaran" inputmode="numeric" class="isian pl-11 tabular-nums" placeholder="0" /></div>
          <p class="mt-1 text-xs text-teks3">{{ f.besaran ? formatRupiah(angka(f.besaran)) : 'Tulis angka saja, contoh 450000' }}</p></div>
        <div><InputTanggal v-model="f.berlaku_mulai" label="Berlaku mulai" wajib />
          <p class="mt-1 text-xs text-teks3">Tarif lama tetap dipakai untuk periode sebelum tanggal ini.</p></div>
        <div><label class="label-isian" for="tr-ket">Keterangan (tidak wajib)</label><input id="tr-ket" v-model="f.keterangan" class="isian" placeholder="Contoh: Keputusan rapat yayasan" /></div>
        <button class="tombol-utama w-full" :disabled="proses" @click="simpan"><PhFloppyDisk :size="20" weight="duotone" /> {{ proses ? 'Menyimpan…' : 'Simpan tarif' }}</button>
        <div v-if="riwayat(f.kategori, f.kunci).length">
          <p class="label-isian flex items-center gap-1.5"><PhClockCounterClockwise :size="16" /> Riwayat tarif</p>
          <ul class="divide-y divide-garis rounded-xl border border-garis">
            <li v-for="r in riwayat(f.kategori, f.kunci)" :key="r.id" class="flex items-center gap-2 px-3 py-2 text-sm">
              <span class="flex-1">Mulai {{ formatPendek(r.berlaku_mulai) }}<span v-if="r.keterangan" class="text-teks3"> – {{ r.keterangan }}</span></span>
              <span class="font-semibold tabular-nums">{{ formatRupiah(r.besaran) }}</span>
              <button class="tombol-ikon h-9 w-9" @click="hapus(r)" :aria-label="`Hapus tarif mulai ${formatPendek(r.berlaku_mulai)}`"><PhTrash :size="16" /></button>
            </li>
          </ul>
        </div>
      </div>
    </LembarBawah>
  </div>
</template>
