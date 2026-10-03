<!-- SIMKA PRO | src/pages/pegawai/RekapPegawai.vue | v1.1 | Fase 1 – Perbaikan | 03/10/2026 -->
<script setup>
// Rekap kepegawaian: per status, pendidikan, masa kerja, dan bidang, dirinci menurut jenis kelamin.
import { ref, computed, onMounted } from 'vue'
import * as XLSX from 'xlsx'
import { PhEye, PhFileXls, PhChartBar } from '@phosphor-icons/vue'
import { usePegawai } from '@/stores/pegawai'
import { useOrganisasi } from '@/stores/organisasi'
import { useLembaga } from '@/stores/lembaga'
import { useSesi } from '@/stores/sesi'
import { formatPanjang, formatPendek } from '@/lib/tanggal'
import { STATUS_PEGAWAI, PENDIDIKAN, masaKerja } from '@/lib/kepegawaian'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'
import TombolCetak from '@/components/TombolCetak.vue'

const peg = usePegawai(); const org = useOrganisasi(); const lembaga = useLembaga(); const sesi = useSesi()
const pratinjau = ref(false)
onMounted(() => Promise.all([org.muat(), lembaga.muat(), peg.daftar.length ? null : peg.muat()]))
const aktif = computed(() => peg.daftar.filter((p) => (p.status_keaktifan || 'aktif') === 'aktif'))

/** Susun baris rekap: [{ label, L, P, total }] dari fungsi pengelompok. */
function rekap(urutan, kelompok) {
  const peta = new Map(urutan.map((l) => [l, { label: l, L: 0, P: 0, total: 0 }]))
  for (const p of aktif.value) {
    const l = kelompok(p) || 'Belum diisi'
    if (!peta.has(l)) peta.set(l, { label: l, L: 0, P: 0, total: 0 })
    const r = peta.get(l); r.total++; if (p.jenis_kelamin === 'L') r.L++; else if (p.jenis_kelamin === 'P') r.P++
  }
  return [...peta.values()].filter((r) => r.total || urutan.includes(r.label))
}
const bidangInduk = (p) => {
  let u = org.cariUnit(p.org_unit_id)
  while (u && u.jenis === 'unit' && u.parent_id) u = org.cariUnit(u.parent_id)
  return u?.nama
}
const MASA = ['Kurang dari 1 tahun', '1–5 tahun', '6–10 tahun', '11–15 tahun', 'Lebih dari 15 tahun']
const kelompokMasa = (p) => { const m = masaKerja(p.tmt_tugas); if (!m) return null; const t = m.tahun; return t < 1 ? MASA[0] : t <= 5 ? MASA[1] : t <= 10 ? MASA[2] : t <= 15 ? MASA[3] : MASA[4] }

const TABEL = computed(() => [
  { judul: 'Menurut status kepegawaian', w: 'gaji', baris: rekap(Object.values(STATUS_PEGAWAI), (p) => STATUS_PEGAWAI[p.status_kepegawaian]) },
  { judul: 'Menurut pendidikan terakhir', w: 'pengajuan', baris: rekap(Object.values(PENDIDIKAN), (p) => PENDIDIKAN[p.pendidikan_terakhir]) },
  { judul: 'Menurut masa kerja', w: 'tahfizh', baris: rekap(MASA, kelompokMasa) },
  { judul: 'Menurut bidang', w: 'santri', baris: rekap(org.datar.filter((u) => u.jenis !== 'unit' && u.aktif).map((u) => u.nama), bidangInduk) },
])
const jumlah = computed(() => ({ L: aktif.value.filter((p) => p.jenis_kelamin === 'L').length, P: aktif.value.filter((p) => p.jenis_kelamin === 'P').length, total: aktif.value.length }))
const direktur = computed(() => lembaga.signatories.find((s) => /^direktur$/i.test(s.jabatan_tertulis)) || lembaga.signatories[0] || {})

function ekspor() {
  const wb = XLSX.utils.book_new()
  for (const t of TABEL.value) {
    const ws = XLSX.utils.aoa_to_sheet([[t.judul], [], ['No.', 'Uraian', 'Laki-laki', 'Perempuan', 'Jumlah'],
      ...t.baris.map((r, i) => [i + 1, r.label, r.L, r.P, r.total]), ['', 'Jumlah', jumlah.value.L, jumlah.value.P, jumlah.value.total]])
    ws['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 11 }, { wch: 11 }, { wch: 9 }]
    XLSX.utils.book_append_sheet(wb, ws, t.judul.replace('Menurut ', '').slice(0, 31))
  }
  XLSX.writeFile(wb, `Rekap-Kepegawaian-${formatPendek(new Date()).replace(/\//g, '-')}.xlsx`)
}
</script>
<template>
  <div>
    <div class="layar-saja">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <span class="w-laporan chip-ikon h-12 w-12"><PhChartBar :size="28" weight="duotone" /></span>
        <div class="min-w-[200px] flex-1">
          <h2 class="text-lg font-bold">{{ jumlah.total }} pegawai aktif</h2>
          <p class="text-sm text-teks3">{{ jumlah.L }} laki-laki dan {{ jumlah.P }} perempuan. Pegawai cuti panjang, nonaktif, dan keluar tidak dihitung.</p>
        </div>
        <button class="tombol-garis" @click="pratinjau = true"><PhEye :size="20" weight="duotone" /> Pratinjau cetak</button>
        <button class="tombol-garis" @click="ekspor"><PhFileXls :size="20" weight="duotone" /> Ekspor Excel</button>
        <TombolCetak class="hidden lg:inline-flex" />
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <section v-for="t in TABEL" :key="t.judul" :class="['kartu p-5', 'w-' + t.w]">
          <h3 class="judul-bagian mb-3">{{ t.judul }}</h3>
          <ul class="space-y-2.5">
            <li v-for="r in t.baris" :key="r.label">
              <div class="mb-1 flex justify-between gap-2 text-sm"><span class="font-semibold text-teks2">{{ r.label.replace('Bidang ', '') }}</span>
                <span class="tabular-nums text-teks3">L {{ r.L }} – P {{ r.P }} – <b class="font-bold text-teks">{{ r.total }}</b></span></div>
              <div class="h-2 overflow-hidden rounded-full bg-permukaan2"><div class="h-full rounded-full" :style="{ width: (jumlah.total ? (r.total / jumlah.total) * 100 : 0) + '%', background: 'var(--c)' }" /></div>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <div>
      <DokumenCetak judul="Rekap Kepegawaian" :subjudul="`Pegawai aktif keadaan per ${formatPanjang(new Date())}`"  v-model:pratinjau="pratinjau" :pencetak="sesi.pengguna?.nama_lengkap">
        <template v-for="(t, ti) in TABEL" :key="t.judul">
          <p :style="{ margin: ti ? '10pt 0 4pt' : '4pt 0 4pt' }">{{ String.fromCharCode(65 + ti) }}. {{ t.judul.replace('Menurut', 'Rekap menurut') }}</p>
          <table class="tabel">
            <colgroup><col style="width:8%"><col style="width:47%"><col style="width:15%"><col style="width:15%"><col style="width:15%"></colgroup>
            <thead><tr><th>No.</th><th>Uraian</th><th>Laki-laki</th><th>Perempuan</th><th>Jumlah</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in t.baris" :key="r.label"><td class="tengah">{{ i + 1 }}</td><td>{{ r.label }}</td><td class="tengah">{{ r.L }}</td><td class="tengah">{{ r.P }}</td><td class="tengah">{{ r.total }}</td></tr>
              <tr><td></td><td>Jumlah</td><td class="tengah">{{ jumlah.L }}</td><td class="tengah">{{ jumlah.P }}</td><td class="tengah">{{ jumlah.total }}</td></tr>
            </tbody>
          </table>
        </template>
        <template #ttd>
          <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }"
            :kanan="{ jabatan: sesi.isSuperadmin ? 'Pengelola Sistem' : 'Admin Kepegawaian', nama: sesi.pengguna?.nama_lengkap || '', niy: sesi.pengguna?.niy }" />
        </template>
      </DokumenCetak>
    </div>
  </div>
</template>

