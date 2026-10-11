<!-- SIMKA PRO | src/pages/cek/CekDokumen.vue | v1.1 | Fase 8 – Status ditolak dan tanda tangan basah | 11/10/2026 -->
<script setup>
// Halaman publik Cek Keabsahan Dokumen (tanpa masuk). Dibuka dengan memindai QR pada dokumen atau mengetik
// kode validasi 8 karakter. Menampilkan data asli dari database (jenis, nomor, perihal, nama yang bersangkutan,
// penanda tangan, waktu, status) agar pembaca dapat mencocokkannya dengan dokumen yang dipegang.
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PhSealCheck, PhSealWarning, PhXCircle, PhMagnifyingGlass, PhSignature, PhFingerprintSimple, PhClockCounterClockwise } from '@phosphor-icons/vue'
import { useDokumen } from '@/stores/dokumen'
import { rapikanKode, STATUS_DOKUMEN } from '@/lib/dokumen'
import { formatPanjang, formatJam, formatWaktu, sekarang } from '@/lib/tanggal'
import TataLetakAuth from '@/components/TataLetakAuth.vue'

const props = defineProps({ kode: String })
const router = useRouter(); const dok = useDokumen()
const hasil = ref(null); const memuat = ref(false); const kodeIsi = ref(rapikanKode(props.kode)); const waktu = ref('')
const st = computed(() => STATUS_DOKUMEN[hasil.value?.status] || STATUS_DOKUMEN.sah)
const ikon = computed(() => (hasil.value?.status === 'sah' ? PhSealCheck : PhSealWarning))
const judul = computed(() => ({ sah: 'Dokumen sah', draf: 'Dokumen belum disahkan', direvisi: 'Dokumen sudah direvisi', dicabut: 'Dokumen sudah dicabut', ditolak: 'Dokumen ditolak penanda tangan' })[hasil.value?.status] || 'Dokumen sah')
const tgl = (v) => (v ? `${formatPanjang(v)} pukul ${formatJam(v)} WITA` : '–')

async function periksa(k) {
  const kode = rapikanKode(k)
  if (kode.replace('-', '').length !== 8) { hasil.value = { ditemukan: false, kurang: true }; return }
  memuat.value = true
  try { hasil.value = await dok.cek(kode); waktu.value = formatWaktu(sekarang()) } catch { hasil.value = { galat: true } } finally { memuat.value = false }
}
function kirim() {
  const k = rapikanKode(kodeIsi.value).replace('-', '')
  if (k !== (props.kode || '').toUpperCase().replace(/[^A-Z0-9]/g, '')) router.replace(`/cek/${k}`)
  else periksa(k)
}
watch(() => props.kode, (k) => { if (k) { kodeIsi.value = rapikanKode(k); periksa(k) } })
onMounted(() => props.kode && periksa(props.kode))
</script>
<template>
  <TataLetakAuth judul="Cek Keabsahan Dokumen" keterangan="Periksa keaslian surat dan laporan bertanda tangan elektronik SIMKA PRO.">
    <form class="flex gap-2" @submit.prevent="kirim">
      <label class="sr-only" for="ck-kode">Kode validasi</label>
      <input id="ck-kode" :value="kodeIsi" @input="kodeIsi = rapikanKode($event.target.value)" class="isian flex-1 font-mono text-lg uppercase tracking-[0.2em]"
             placeholder="XXXX-XXXX" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" />
      <button class="tombol-utama shrink-0" :disabled="memuat"><PhMagnifyingGlass :size="20" weight="bold" /> Periksa</button>
    </form>
    <p class="mt-2 text-xs text-teks3">Kode validasi 8 karakter tercetak di bagian bawah dokumen, di dekat kode QR.</p>

    <p v-if="memuat" class="py-8 text-center text-teks3">Memeriksa dokumen…</p>
    <template v-else-if="hasil">
      <section v-if="hasil.ditemukan" :class="['mt-5 rounded-2xl p-4', 'w-' + st.w]" style="background: color-mix(in srgb, var(--c) 10%, rgb(var(--permukaan)))" aria-live="polite">
        <p class="flex items-center gap-2 text-lg font-extrabold" style="color: var(--c)"><component :is="ikon" :size="30" weight="duotone" /> {{ judul }}</p>
        <p class="mt-1 text-sm text-teks2">{{ st.ket }}.</p>
        <p v-if="hasil.status === 'dicabut'" class="mt-2 text-sm font-semibold text-teks">Dicabut {{ tgl(hasil.dicabut_pada) }}{{ hasil.alasan_cabut ? ': ' + hasil.alasan_cabut : '' }}.</p>
        <p v-if="hasil.pengganti" class="mt-2 text-sm font-semibold text-teks">Versi terbaru: kode <router-link :to="`/cek/${hasil.pengganti.replace('-', '')}`" class="underline">{{ hasil.pengganti }}</router-link>.</p>

        <dl class="mt-4 grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt class="text-teks3">Jenis dokumen</dt><dd class="font-bold">{{ hasil.jenis_nama }}</dd>
          <dt class="text-teks3">Nomor</dt><dd>{{ hasil.nomor || '–' }}</dd>
          <dt class="text-teks3">Perihal</dt><dd>{{ hasil.perihal || '–' }}</dd>
          <template v-if="hasil.periode"><dt class="text-teks3">Periode</dt><dd>{{ hasil.periode }}</dd></template>
          <dt class="text-teks3">Atas nama</dt><dd class="font-semibold">{{ hasil.subjek || '–' }}</dd>
          <dt class="text-teks3">Diterbitkan</dt><dd>{{ tgl(hasil.diterbitkan_pada) }}</dd>
          <dt class="text-teks3">Lembaga</dt><dd>{{ hasil.lembaga }}</dd>
        </dl>

        <h3 class="mt-4 flex items-center gap-1.5 text-sm font-bold"><PhSignature :size="18" weight="duotone" style="color: var(--c)" /> Penanda tangan</h3>
        <ul class="mt-1.5 space-y-1.5">
          <li v-for="(p, i) in hasil.penanda" :key="i" class="rounded-xl bg-permukaan px-3 py-2 text-sm">
            <span class="block font-semibold">{{ p.nama }}</span>
            <span class="block text-xs text-teks3">{{ p.jabatan }} · {{ hasil.mode_ttd === 'basah' ? 'tanda tangan basah (manual)' : 'elektronik, ' + tgl(p.waktu) }}</span>
          </li>
          <li v-if="!hasil.penanda?.length" class="text-sm text-teks3">Belum ada tanda tangan.</li>
        </ul>
        <p class="mt-3 flex items-center gap-1.5 text-xs text-teks3"><PhFingerprintSimple :size="16" /> Sidik digital {{ hasil.sidik }}</p>
      </section>

      <section v-else class="w-beranda mt-5 rounded-2xl p-4" style="background: color-mix(in srgb, var(--c) 10%, rgb(var(--permukaan)))" aria-live="polite">
        <p class="flex items-center gap-2 text-lg font-extrabold" style="color: var(--c)"><PhXCircle :size="30" weight="duotone" />
          {{ hasil.galat ? 'Pemeriksaan gagal' : hasil.kurang ? 'Kode belum lengkap' : 'Dokumen tidak dikenal' }}</p>
        <p class="mt-2 text-sm text-teks2">{{ hasil.galat ? 'Periksa koneksi internet lalu coba lagi.' : hasil.kurang ? 'Kode validasi terdiri atas 8 huruf dan angka, misalnya 7KQ2-M9XA.'
          : 'Kode validasi tidak terdaftar di SIMKA PRO. Dokumen dengan kode ini tidak dapat dinyatakan sah. Periksa kembali ketikan kode.' }}</p>
      </section>

      <p v-if="waktu && !hasil.kurang" class="mt-3 flex items-center gap-1.5 text-xs text-teks3"><PhClockCounterClockwise :size="15" /> Diperiksa {{ waktu }} WITA</p>
      <p v-if="hasil.ditemukan" class="mt-3 text-xs leading-relaxed text-teks2">Cocokkan nomor, perihal, nama, dan penanda tangan di atas dengan dokumen yang Anda pegang.
        Bila ada perbedaan, dokumen tersebut tidak sah.</p>
    </template>
  </TataLetakAuth>
</template>
