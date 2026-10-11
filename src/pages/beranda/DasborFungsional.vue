<!-- SIMKA PRO | src/pages/beranda/DasborFungsional.vue | v1.1 | Fase 8 – Ringkasan presensi hanya sesi hari ini | 10/10/2026 -->
<script setup>
// Beranda pegawai fungsional (wali kelas, guru mapel, musyrif, muhaffizh, pembina, medis, security, staf, dll.),
// yaitu semua pegawai di luar pimpinan tinggi, admin, dan superadmin. Tanpa kartu statistik (hasil evaluasi pondok):
// 1) sapaan + presensi hari ini, 2) menu cepat 4 kolom sesuai tupoksi, 3) "Untuk Anda" (jurnal, pengajuan, agenda,
// pengumuman, berkas).
import { computed, onMounted } from 'vue'
import { PhFingerprint, PhCaretRight, PhLightning, PhSparkle } from '@phosphor-icons/vue'
import { useSesi } from '@/stores/sesi'
import { useBeranda } from '@/stores/beranda'
import { useDataPresensi } from '@/stores/presensi'
import { formatJam } from '@/lib/tanggal'
import { menuCepat } from '@/lib/menuCepat'
import Sapaan from './Sapaan.vue'
import RingkasanPribadi from './RingkasanPribadi.vue'

const sesi = useSesi(); const br = useBeranda(); const dp = useDataPresensi()
onMounted(() => dp.muatHarian())
const ringkas = computed(() => {
  if (!dp.harian) return 'Memuat sesi hari ini…'
  if (!dp.sesiHariIni.length) return 'Tidak ada sesi presensi hari ini'
  if (dp.terbuka.length) return `Sesi terbuka: ${dp.terbuka.map((s) => s.nama_sesi).join(', ')} – presensi sekarang`
  const b = dp.berikut
  return `${dp.selesaiWajib} dari ${dp.jumlahWajib} sesi tercatat${b ? ` · berikutnya ${b.nama_sesi} ${formatJam(b.mulai)}` : ''}`
})
const menu = computed(() => menuCepat(sesi.tugas, { shift: sesi.punyaShift }))
</script>
<template>
  <div class="space-y-5 lg:space-y-6">
    <Sapaan>
      <router-link to="/presensi" class="mt-5 flex items-center gap-4 rounded-2xl bg-white p-3.5 pr-4 text-[#1F1416] shadow-apung">
        <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#E2F1E8] text-[#1E7D4F]"><PhFingerprint :size="32" weight="duotone" /></span>
        <span class="min-w-0 flex-1">
          <span class="block text-lg font-extrabold leading-tight">Presensi hari ini</span>
          <span class="block text-sm text-[#544245]">{{ ringkas }}</span>
        </span>
        <PhCaretRight :size="22" class="text-[#705E61]" />
      </router-link>
    </Sapaan>

    <!-- Menu cepat sesuai tupoksi -->
    <section class="kartu p-4 sm:p-5" aria-labelledby="judul-menu-cepat">
      <h2 id="judul-menu-cepat" class="judul-bagian mb-3 flex items-center gap-2"><PhLightning :size="20" weight="duotone" class="text-[rgb(var(--merah))]" /> Menu cepat</h2>
      <ul class="grid grid-cols-4 gap-x-1.5 gap-y-4 sm:gap-3">
        <li v-for="m in menu" :key="m.kode" :class="'w-' + m.warna">
          <router-link :to="m.ke" class="group flex h-full flex-col items-center gap-1.5 rounded-2xl px-0.5 py-1.5 text-center transition hover:bg-permukaan2 active:scale-95 sm:flex-row sm:items-center sm:gap-3 sm:border sm:border-garis sm:p-3 sm:text-left">
            <span class="chip-ikon h-12 w-12 shrink-0 rounded-2xl"><component :is="m.ikon" :size="26" weight="duotone" /></span>
            <span class="min-w-0">
              <span class="line-clamp-2 block text-[11.5px] font-bold leading-tight text-teks sm:text-sm">{{ m.label }}</span>
              <span class="hidden truncate text-xs text-teks3 sm:block">{{ m.ket }}</span>
            </span>
          </router-link>
        </li>
      </ul>
    </section>

    <!-- Untuk Anda -->
    <section class="space-y-3" aria-labelledby="judul-untuk-anda">
      <h2 id="judul-untuk-anda" class="judul-bagian flex items-center gap-2 px-1"><PhSparkle :size="20" weight="duotone" class="text-[rgb(var(--merah))]" /> Untuk Anda</h2>
      <RingkasanPribadi v-if="br.data?.pribadi" :d="br.data.pribadi" />
      <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="kartu h-36 animate-pulse bg-permukaan2" />
      </div>
    </section>
  </div>
</template>
