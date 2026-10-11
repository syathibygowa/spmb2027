<!-- SIMKA PRO | src/pages/beranda/DasborPegawai.vue | v1.15 | Fase 8 – Ringkasan presensi hanya sesi hari ini | 10/10/2026 -->
<script setup>
import KartuSantriBeranda from '@/components/KartuSantriBeranda.vue'
import KartuTahfizhBeranda from '@/components/KartuTahfizhBeranda.vue'
import KartuLayananBeranda from '@/components/KartuLayananBeranda.vue'
import KartuSecurityBeranda from '@/components/KartuSecurityBeranda.vue'
import { computed, onMounted } from 'vue'
import { PhFingerprint, PhCaretRight, PhSquaresFour } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'
import { useNotifikasi } from '@/stores/notifikasi'
import { useSesi } from '@/stores/sesi'
import { menuUntuk } from '@/lib/menu'
import { useDataPresensi } from '@/stores/presensi'
import { formatJam } from '@/lib/tanggal'
import { lencanaSesi } from '@/lib/presensi'
import Sapaan from './Sapaan.vue'
import TombolPantauan from '@/components/TombolPantauan.vue'
import { PhSparkle } from '@phosphor-icons/vue'
import SliderStatistik from '@/components/SliderStatistik.vue'
import { panelBeranda } from '@/lib/panelBeranda'
import RingkasanPribadi from './RingkasanPribadi.vue'
import RingkasanPimpinan from './RingkasanPimpinan.vue'
import IndikatorLangsung from './IndikatorLangsung.vue'
import { useBeranda } from '@/stores/beranda'
import ItemNotifikasi from '@/components/ItemNotifikasi.vue'

const PANEL = panelBeranda(['pimpinan', 'santri', 'tahfizh', 'layanan', 'security'])
const notif = useNotifikasi(); const sesi = useSesi(); const router = useRouter(); const dp = useDataPresensi(); const br = useBeranda()
onMounted(() => dp.muatHarian())
// Ringkasan presensi hari ini pada kartu sapaan
const ringkas = computed(() => {
  if (!dp.harian) return 'Memuat sesi hari ini…'
  if (!dp.sesiHariIni.length) return 'Tidak ada sesi presensi hari ini'
  if (dp.terbuka.length) return `Sesi terbuka: ${dp.terbuka.map((s) => s.nama_sesi).join(', ')} – presensi sekarang`
  const b = dp.berikut
  return `${dp.selesaiWajib} dari ${dp.jumlahWajib} sesi tercatat${b ? ` · berikutnya ${b.nama_sesi} ${formatJam(b.mulai)}` : ''}`
})
const menu = computed(() => menuUntuk(sesi.peran, sesi.ciriMenu).filter((m) => !['beranda', 'notifikasi', 'profil'].includes(m.kode)).slice(0, 8))
</script>
<template>
  <div class="space-y-5 lg:space-y-6">
    <Sapaan>
      <router-link to="/presensi" class="mt-5 flex items-center gap-4 rounded-2xl bg-white p-3.5 pr-4 text-[#1F1416] shadow-apung">
        <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#E2F1E8] text-[#1E7D4F]"><PhFingerprint :size="32" weight="duotone" /></span>
        <span class="flex-1">
          <span class="block text-lg font-extrabold leading-tight">Presensi hari ini</span>
          <span class="block text-sm text-[#544245]">{{ ringkas }}</span>
        </span>
        <PhCaretRight :size="22" class="text-[#705E61]" />
      </router-link>
    </Sapaan>
    <TombolPantauan />

    <!-- Untuk Anda: tetap tersusun di atas (akses cepat), tidak masuk slider -->
    <section v-if="br.data?.pribadi" class="space-y-3" aria-labelledby="judul-untuk-anda">
      <h2 id="judul-untuk-anda" class="judul-bagian flex items-center gap-2 px-1"><PhSparkle :size="20" weight="duotone" class="text-[rgb(var(--merah))]" /> Untuk Anda</h2>
      <RingkasanPribadi :d="br.data.pribadi" />
    </section>

    <SliderStatistik :panel="PANEL" simpan="simka.beranda.pimpinan">
      <template #pimpinan>
        <template v-if="br.data?.pimpinan">
          <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="judul-bagian">Unit yang Anda pimpin</h2><IndikatorLangsung :waktu="br.diperbarui" /></div>
          <RingkasanPimpinan :d="br.data.pimpinan" />
        </template>
      </template>
      <!-- Pimpinan pemegang hak data santri: kartu statistik santri langsung -->
      <template #santri><KartuSantriBeranda v-if="sesi.tingkat('data_santri') >= 1" /></template>
      <template #tahfizh><KartuTahfizhBeranda v-if="sesi.kelompokSaya.some((k) => k.jenis === 'halaqah') || sesi.tingkat('tahfizh') >= 1 || sesi.tingkat('data_santri') >= 1" /></template>
      <template #layanan><KartuLayananBeranda /></template>
      <template #security><KartuSecurityBeranda /></template>
    </SliderStatistik>

    <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
      <section class="kartu p-3 sm:p-4">
        <div class="mb-1 flex items-center justify-between px-2">
          <h2 class="judul-bagian">Notifikasi terbaru</h2>
          <router-link to="/notifikasi" class="tombol-teks h-9 min-h-0 text-sm">Lihat semua</router-link>
        </div>
        <ul class="space-y-1">
          <ItemNotifikasi v-for="n in notif.terbaru" :key="n.id" :n="n" ringkas />
          <li v-if="!notif.daftar.length" class="py-8 text-center text-sm text-teks3">Belum ada notifikasi.</li>
        </ul>
      </section>
      <section v-if="dp.sesiHariIni.length" class="kartu order-first p-4 lg:col-span-2">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="judul-bagian">Sesi hari ini</h2>
          <router-link to="/presensi" class="tombol-teks h-9 min-h-0 text-sm">Buka presensi</router-link>
        </div>
        <ul class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <li v-for="s in dp.sesiHariIni" :key="s.session_id + s.tanggal" :class="['min-w-[9.5rem] shrink-0 rounded-2xl border border-garis p-3', 'w-' + lencanaSesi(s).w]">
            <p class="text-sm font-extrabold tabular-nums">{{ formatJam(s.mulai) }}–{{ formatJam(s.selesai) }}</p>
            <p class="truncate text-sm font-semibold">{{ s.nama_sesi }}</p>
            <span class="lencana mt-1">{{ lencanaSesi(s).n }}</span>
          </li>
        </ul>
      </section>
      <section class="kartu p-5">
        <h2 class="judul-bagian mb-3">Menu kerja</h2>
        <ul class="grid grid-cols-4 gap-y-4">
          <li v-for="m in menu" :key="m.kode" :class="'w-' + m.warna">
            <router-link :to="m.ke" class="flex flex-col items-center gap-1.5 text-center">
              <span class="chip-ikon h-12 w-12 rounded-2xl"><component :is="m.ikon" :size="26" weight="duotone" /></span>
              <span class="text-xs font-semibold leading-tight text-teks2">{{ m.nama }}</span>
            </router-link>
          </li>
        </ul>
      </section>
    </div>
    <!-- Tombol Presensi kini di tengah navigasi bawah (HP) dan di menu samping (desktop) -->
  </div>
</template>
