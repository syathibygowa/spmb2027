<!-- SIMKA PRO | src/pages/jadwal/TabRekapMengajar.vue | v1.1 | Fase 8 – Urutan kolom seragam (NIY/NIS > Nama > JK) | 10/10/2026 -->
<script setup>
// Rekap mengajar per guru dan penugasan: JP terjadwal (hari sekolah, di luar libur), terlaksana, tidak terlaksana,
// belum diisi. Jurnal mengajar menjadi bukti kehadiran mengajar dan dasar tunjangan guru (Fase 11).
import { ref, computed, onMounted, watch } from 'vue'
import * as XLSX from 'xlsx'
import { PhDownloadSimple, PhEye } from '@phosphor-icons/vue'
import { useJadwal } from '@/stores/jadwal'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { persen, teksPersen } from '@/lib/absensi'
import { hariIniISO, formatPanjang, formatPendek } from '@/lib/tanggal'
import { ambilPenandaTangan } from '@/lib/penandatangan'
import InputTanggal from '@/components/InputTanggal.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import TandaTangan from '@/components/cetak/TandaTangan.vue'

const jd = useJadwal(); const sesi = useSesi(); const ui = useUI()
const mulai = ref(hariIniISO().slice(0, 8) + '01'); const selesai = ref(hariIniISO()); const baris = ref([]); const pratinjau = ref(false); const cari = ref('')
const pimpinan = ref({ jabatan: 'Direktur', nama: '', niy: '' })
async function muat() { try { baris.value = await jd.rekap(mulai.value, selesai.value) } catch (e) { ui.toast(e.message, 'galat') } }
onMounted(async () => { await muat(); pimpinan.value = await ambilPenandaTangan('Direktur') })
watch([mulai, selesai], muat)
const perGuru = computed(() => {
  const peta = new Map()
  for (const r of baris.value.filter((x) => !cari.value.trim() || x.guru?.toLowerCase().includes(cari.value.toLowerCase().trim()))) {
    const g = peta.get(r.employee_id) || { employee_id: r.employee_id, guru: r.guru, niy: r.niy, rinci: [], jp_terjadwal: 0, jp_terlaksana: 0, jp_tidak: 0, jp_kosong: 0 }
    g.rinci.push(r); for (const k of ['jp_terjadwal', 'jp_terlaksana', 'jp_tidak', 'jp_kosong']) g[k] += r[k]
    peta.set(r.employee_id, g)
  }
  return [...peta.values()]
})
const teksPeriode = computed(() => `${formatPanjang(mulai.value)} s.d. ${formatPanjang(selesai.value)}`)
function ekspor() {
  const k = ['NIY', 'Guru', 'Kelas', 'Mapel', 'JP/pekan', 'JP terjadwal', 'Terlaksana', 'Tidak terlaksana', 'Belum diisi', 'Keterlaksanaan (%)']
  const isi = baris.value.map((r) => [r.niy || '', r.guru, r.kelas, r.mapel, r.jp_pekan, r.jp_terjadwal, r.jp_terlaksana, r.jp_tidak, r.jp_kosong, persen(r.jp_terlaksana, r.jp_terjadwal) ?? ''])
  const ws = XLSX.utils.aoa_to_sheet([[`Rekap mengajar ${teksPeriode.value}`], [], k, ...isi]); ws['!cols'] = k.map((x, i) => ({ wch: i === 1 ? 30 : Math.max(10, x.length + 2) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rekap mengajar')
  XLSX.writeFile(wb, `Rekap-Mengajar-${formatPendek(mulai.value).replace(/\//g, '')}-${formatPendek(selesai.value).replace(/\//g, '')}.xlsx`)
}
</script>
<template>
  <div>
    <div class="kartu mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
      <div><label class="label-isian" for="rm-c">Cari guru</label><input id="rm-c" v-model="cari" type="search" class="isian" placeholder="Nama guru" /></div>
      <div class="sm:w-44"><InputTanggal v-model="mulai" label="Dari" wajib /></div>
      <div class="sm:w-44"><InputTanggal v-model="selesai" label="Sampai" wajib /></div>
    </div>
    <div class="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
      <button class="w-santri tombol-garis shrink-0 px-4 text-sm" @click="ekspor"><PhDownloadSimple :size="20" weight="duotone" style="color: var(--c)" /> Excel</button>
      <button class="w-pengajuan tombol-garis shrink-0 px-4 text-sm" @click="pratinjau = true"><PhEye :size="20" weight="duotone" style="color: var(--c)" /> Cetak rekap</button>
    </div>
    <ul class="space-y-3">
      <li v-for="g in perGuru" :key="g.employee_id" class="kartu w-jadwal p-4">
        <div class="flex flex-wrap items-center gap-2">
          <p class="flex-1 font-bold">{{ g.guru }}</p>
          <span class="lencana">{{ teksPersen(persen(g.jp_terlaksana, g.jp_terjadwal)) }} terlaksana</span>
        </div>
        <p class="text-sm text-teks2">{{ g.jp_terlaksana }}/{{ g.jp_terjadwal }} JP terlaksana · {{ g.jp_tidak }} tidak terlaksana · <span :class="g.jp_kosong && 'font-semibold text-merah'">{{ g.jp_kosong }} belum diisi</span></p>
        <ul class="mt-2 grid gap-1 text-xs text-teks3 sm:grid-cols-2">
          <li v-for="r in g.rinci" :key="r.assignment_id">{{ r.kelas }} · {{ r.mapel }}: {{ r.jp_terlaksana }}/{{ r.jp_terjadwal }} JP</li>
        </ul>
      </li>
    </ul>
    <p v-if="!perGuru.length" class="kartu py-10 text-center text-sm text-teks3">Belum ada penugasan mengajar pada tahun ajaran aktif.</p>

    <DokumenCetak kop="pondok" judul="Rekap Keterlaksanaan Mengajar" :subjudul="teksPeriode" mendatar v-model:pratinjau="pratinjau" :pencetak="sesi.pengguna?.nama_lengkap">
      <table class="tabel kecil">
        <thead><tr><th style="width:4%">No.</th><th style="width:10%">NIY</th><th>Guru</th><th style="width:8%">Kelas</th><th style="width:18%">Mapel</th><th style="width:7%">JP/pekan</th>
          <th style="width:8%">JP terjadwal</th><th style="width:8%">Terlaksana</th><th style="width:8%">Tidak terlaksana</th><th style="width:7%">Belum diisi</th><th style="width:7%">%</th></tr></thead>
        <tbody><tr v-for="(r, i) in baris" :key="r.assignment_id"><td class="tengah">{{ i + 1 }}</td><td class="tengah">{{ r.niy || '–' }}</td><td>{{ r.guru }}</td><td class="tengah">{{ r.kelas }}</td><td>{{ r.mapel }}</td>
          <td class="tengah">{{ r.jp_pekan }}</td><td class="tengah">{{ r.jp_terjadwal }}</td><td class="tengah">{{ r.jp_terlaksana }}</td><td class="tengah">{{ r.jp_tidak }}</td><td class="tengah">{{ r.jp_kosong }}</td>
          <td class="tengah">{{ teksPersen(persen(r.jp_terlaksana, r.jp_terjadwal)) }}</td></tr></tbody>
      </table>
      <template #ttd>
        <TandaTangan :kiri="{ pengantar: 'Mengetahui,', jabatan: pimpinan.jabatan, nama: pimpinan.nama, niy: pimpinan.niy }"
          :kanan="{ jabatan: sesi.isSuperadmin ? 'Pengelola Sistem' : 'Petugas akademik', nama: sesi.pengguna?.nama_lengkap, niy: sesi.pengguna?.niy }" />
      </template>
    </DokumenCetak>
  </div>
</template>
