<!-- SIMKA PRO | src/components/cetak/TtdResmi.vue | v1.0 | Fase 8 – Tahap 5 Tanda tangan laporan resmi | 10/10/2026 -->
<script setup>
// Kolom tanda tangan laporan: bila sedang menampilkan versi resmi (dok), nama/jabatan/waktu diambil dari daftar
// penanda tangan dokumen, QR muncul pada sisi yang sudah menandatangani secara elektronik setelah dokumen sah,
// dan catatan kaki memuat kode validasi (atau tanda DRAF/TIDAK BERLAKU). Tanpa dok: tanda tangan biasa.
import { computed } from 'vue'
import TandaTangan from './TandaTangan.vue'
import CatatanValidasi from './CatatanValidasi.vue'
const props = defineProps({ dok: { type: Object, default: null }, kiri: { type: Object, required: true }, kanan: { type: Object, required: true }, tanggal: String })
function sisi(pos, cadangan) {
  const d = props.dok; const r = d?.penanda?.find((x) => x.posisi === pos)
  if (!r) return cadangan
  const el = d.status === 'sah' && d.mode_ttd === 'elektronik' && r.status === 'ditandatangani'
  return { pengantar: cadangan.pengantar, jabatan: r.jabatan, nama: r.nama, niy: r.niy, kode: el ? d.kode : null, waktu: el ? r.waktu : null }
}
const kiriR = computed(() => sisi('kiri', props.kiri))
const kananR = computed(() => sisi('kanan', props.kanan))
const tgl = computed(() => props.tanggal || (props.dok ? (props.dok.status === 'sah' ? props.dok.diterbitkan_pada : props.dok.diajukan_pada) || undefined : undefined))
</script>
<template>
  <TandaTangan :kiri="kiriR" :kanan="kananR" :tanggal="tgl" />
  <CatatanValidasi v-if="dok" :kode="dok.kode" :draf="dok.status === 'draf'" :basah="dok.mode_ttd === 'basah'" :status="dok.status" />
</template>
