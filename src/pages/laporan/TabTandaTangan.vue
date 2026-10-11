<!-- SIMKA PRO | src/pages/laporan/TabTandaTangan.vue | v1.0 | Fase 8 – Tahap 5 Kotak masuk tanda tangan dokumen | 10/10/2026 -->
<script setup>
// Kotak masuk tanda tangan (menu Dokumen → Tanda tangan): permintaan tanda tangan elektronik laporan resmi untuk
// akun ini. "Periksa" membuka salinan beku laporan (sama persis dengan yang diajukan) dan dari sana pejabat dapat
// menandatangani atau menolak. Setujui cepat juga tersedia di sini. Riwayat menampilkan keputusan sebelumnya.
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PhSignature, PhEye, PhPenNib, PhXCircle, PhCheckCircle, PhClockCounterClockwise, PhTray } from '@phosphor-icons/vue'
import { useDokumenResmi } from '@/stores/dokumenResmi'
import { useUI } from '@/stores/ui'
import { STATUS_DOKUMEN } from '@/lib/dokumen'
import { formatWaktu, formatRelatif } from '@/lib/tanggal'
import LembarBawah from '@/components/LembarBawah.vue'

const dr = useDokumenResmi(); const ui = useUI(); const router = useRouter()
onMounted(() => dr.muatMasuk().catch((e) => ui.toast(e.message, 'galat')))
const riwayat = computed(() => dr.masuk.filter((x) => !(x.status === 'menunggu' && x.dok?.status === 'draf')))
const periksa = (x) => router.push(`${x.dok.tautan || '/rekap/dokumen'}?resmi=${x.dok.id}`)
async function setujui(x) {
  if (!(await ui.konfirmasi({ judul: 'Tanda tangani dokumen ini?', pesan: `${x.dok.perihal} (${x.dok.periode || '–'}) dari ${x.pengaju || 'pengaju'}. Sebaiknya periksa isi dokumen lebih dulu.`, ya: 'Tanda tangani' }))) return
  try { const h = await dr.tandatangani(x.dok.id, true); ui.toast(h.status === 'sah' ? `Dokumen sah. Kode validasi ${h.kode}.` : 'Tanda tangan Anda tersimpan.', 'info') } catch (e) { ui.toast(e.message, 'galat') }
}
const tolak = ref(null)
async function kirimTolak() {
  try { await dr.tandatangani(tolak.value.x.dok.id, false, tolak.value.catatan); tolak.value = null; ui.toast('Dokumen ditolak. Pengaju menerima pemberitahuan.') } catch (e) { ui.toast(e.message, 'galat') }
}
const KEPUTUSAN = { ditandatangani: { n: 'Ditandatangani', w: 'presensi', ikon: PhCheckCircle }, ditolak: { n: 'Ditolak', w: 'beranda', ikon: PhXCircle }, menunggu: { n: 'Dibatalkan pengaju', w: 'hakakses', ikon: PhClockCounterClockwise } }
</script>
<template>
  <div class="space-y-4">
    <section class="space-y-2">
      <h3 class="judul-bagian flex items-center gap-2"><PhSignature :size="20" weight="duotone" class="w-verifikasi" style="color: var(--c)" /> Menunggu tanda tangan Anda
        <span v-if="dr.menunggu.length" class="lencana w-notifikasi">{{ dr.menunggu.length }}</span></h3>
      <p v-if="dr.memuatMasuk && !dr.masuk.length" class="py-8 text-center text-teks3">Memuat…</p>
      <div v-else-if="!dr.menunggu.length" class="kartu flex flex-col items-center py-10 text-center">
        <span class="chip-ikon w-verifikasi h-14 w-14 rounded-2xl"><PhTray :size="30" weight="duotone" /></span>
        <p class="mt-3 font-bold">Tidak ada permintaan tanda tangan</p>
        <p class="mt-1 text-sm text-teks3">Permintaan baru muncul di sini dan di lonceng notifikasi.</p>
      </div>
      <ul v-else class="grid gap-3 lg:grid-cols-2">
        <li v-for="x in dr.menunggu" :key="x.id" class="kartu w-verifikasi border-l-4 border-l-[color:var(--c)] p-4">
          <p class="text-xs font-semibold text-teks3">{{ x.dok.jenis_nama }} · kode {{ x.dok.kode }}</p>
          <p class="mt-0.5 text-lg font-bold leading-snug">{{ x.dok.perihal }}</p>
          <p class="text-sm text-teks2">{{ x.dok.periode || '–' }}</p>
          <p class="mt-1 text-xs text-teks3">Diajukan {{ x.pengaju || '–' }} · {{ formatRelatif(x.dok.diajukan_pada) }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="tombol-garis" @click="periksa(x)"><PhEye :size="18" weight="duotone" /> Periksa</button>
            <button type="button" class="tombol-utama" @click="setujui(x)"><PhPenNib :size="18" weight="duotone" /> Tanda tangani</button>
            <button type="button" class="tombol-garis" @click="tolak = { x, catatan: '' }"><PhXCircle :size="18" weight="duotone" /> Tolak</button>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="riwayat.length" class="space-y-2">
      <h3 class="judul-bagian">Riwayat</h3>
      <ul class="kartu divide-y divide-garis">
        <li v-for="x in riwayat" :key="x.id">
          <button type="button" class="flex w-full items-center gap-3 p-3 text-left hover:bg-permukaan2" @click="periksa(x)">
            <span :class="['chip-ikon h-10 w-10 shrink-0', 'w-' + KEPUTUSAN[x.status].w]"><component :is="KEPUTUSAN[x.status].ikon" :size="22" weight="duotone" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ x.dok.perihal }}</span>
              <span class="block truncate text-xs text-teks3">{{ x.dok.periode || '–' }} · {{ x.pengaju || '–' }} · {{ x.waktu ? formatWaktu(x.waktu) + ' WITA' : '–' }}</span></span>
            <span :class="['lencana shrink-0', 'w-' + (STATUS_DOKUMEN[x.dok.status]?.w || 'laporan')]">{{ STATUS_DOKUMEN[x.dok.status]?.n || x.dok.status }}</span>
          </button>
        </li>
      </ul>
    </section>

    <LembarBawah :model-value="!!tolak" judul="Tolak dokumen" @update:model-value="(v) => !v && (tolak = null)">
      <div v-if="tolak" class="space-y-4 pb-2">
        <p class="text-sm text-teks2">{{ tolak.x.dok.perihal }} · {{ tolak.x.dok.periode }}</p>
        <label class="block"><span class="label-isian">Alasan penolakan</span>
          <textarea v-model="tolak.catatan" class="isian min-h-[6rem] py-2" placeholder="Contoh: data bulan ini belum diverval, mohon diperbaiki lalu ajukan ulang." /></label>
        <button type="button" class="tombol-utama w-full" @click="kirimTolak"><PhXCircle :size="20" weight="duotone" /> Tolak dan beri tahu pengaju</button>
      </div>
    </LembarBawah>
  </div>
</template>
