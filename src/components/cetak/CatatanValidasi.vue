<!-- SIMKA PRO | src/components/cetak/CatatanValidasi.vue | v1.1 | Fase 8 – Tahap 5 catatan untuk tanda tangan basah, direvisi, dicabut | 10/10/2026 -->
<script setup>
// Catatan kaki dokumen bertanda tangan elektronik: cara memeriksa keaslian (pindai QR atau ketik kode validasi
// di halaman Cek Keabsahan Dokumen). Draf (belum disahkan) diberi tanda DRAF.
// v1.1: mode tanda tangan basah (kode validasi tetap tercantum) dan status direvisi/dicabut/ditolak.
import { computed } from 'vue'
import { alamatCek } from '@/lib/dokumen'
const props = defineProps({ kode: String, draf: Boolean, basah: Boolean, status: { type: String, default: '' } })
const alamat = computed(() => alamatCek('').replace(/#\/cek\/$/, '#/cek'))
const TIDAK_BERLAKU = { direvisi: 'sudah direvisi dengan versi baru', dicabut: 'sudah dicabut', ditolak: 'ditolak oleh penanda tangan' }
</script>
<template>
  <p v-if="TIDAK_BERLAKU[status]" class="catatan-validasi">TIDAK BERLAKU – dokumen ini {{ TIDAK_BERLAKU[status] }}{{ kode ? ` (kode ${kode})` : '' }}.</p>
  <p v-else-if="draf" class="catatan-validasi">DRAF – dokumen ini belum disahkan oleh semua penanda tangan dan belum dapat dipakai sebagai dokumen resmi.</p>
  <p v-else-if="kode && basah" class="catatan-validasi">Dokumen ini terdaftar di SIMKA PRO dan ditandatangani basah. Keaslian dapat diperiksa di halaman Cek Keabsahan Dokumen
    ({{ alamat }}) dengan kode validasi <b>{{ kode }}</b>.</p>
  <p v-else-if="kode" class="catatan-validasi">Dokumen ini ditandatangani secara elektronik melalui SIMKA PRO. Keaslian dapat diperiksa dengan memindai QR
    atau membuka halaman Cek Keabsahan Dokumen ({{ alamat }}) dan memasukkan kode validasi <b>{{ kode }}</b>.</p>
</template>
