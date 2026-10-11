<!-- SIMKA PRO | src/components/PanelResmi.vue | v1.0 | Fase 8 – Tahap 5 Penerbitan laporan resmi bertanda tangan elektronik | 10/10/2026 -->
<script setup>
// Bilah "Dokumen resmi" di setiap laporan:
//   • Data terkini: menampilkan status versi resmi laporan yang sama (menunggu tanda tangan, sah, ditolak) dan tombol
//     "Terbitkan resmi" (salinan beku data yang tampil + kode validasi + permintaan tanda tangan pimpinan).
//   • Versi resmi (beku): menampilkan kode dan status; penanda tangan yang diminta dapat langsung Setujui/Tolak;
//     tombol "Data terkini" kembali ke perhitungan langsung.
// Laporan induk menyediakan: kunci (identitas laporan + saringan), isi() (salinan beku), dan menerapkan salinan beku
// lewat peristiwa "buka". Cetak versi resmi memakai TtdResmi (QR dan kode validasi).
import { ref, computed, watch, onMounted } from 'vue'
import { PhSealCheck, PhSignature, PhHourglassMedium, PhXCircle, PhArrowCounterClockwise, PhEye, PhCheckCircle, PhPaperPlaneTilt, PhInfo, PhPenNib, PhTrash } from '@phosphor-icons/vue'
import { useDokumenResmi } from '@/stores/dokumenResmi'
import { useLembaga } from '@/stores/lembaga'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { STATUS_DOKUMEN } from '@/lib/dokumen'
import { formatPanjang, formatWaktu } from '@/lib/tanggal'
import LembarBawah from './LembarBawah.vue'

const props = defineProps({
  kunci: { type: String, default: '' },            // kosong = laporan belum siap diterbitkan
  jenis: { type: String, required: true },          // laporan_kehadiran_pegawai, laporan_kehadiran_santri, laporan_layanan
  jenisNama: { type: String, required: true },
  perihal: { type: String, default: '' }, periode: { type: String, default: '' }, subjek: { type: String, default: '' },
  kop: { type: String, default: 'pondok' }, tautan: { type: String, required: true },
  isi: { type: Function, required: true },          // () => salinan beku
  penandaJabatan: { type: String, default: 'Direktur' },
  kananJabatan: { type: String, default: 'Pembuat laporan' },
  beku: { type: Object, default: null },            // dokumen resmi yang sedang ditampilkan
})
const emit = defineEmits(['buka', 'tutup', 'berubah'])
const dr = useDokumenResmi(); const lembaga = useLembaga(); const sesi = useSesi(); const ui = useUI()
onMounted(() => lembaga.muat())

const terakhir = ref(null); const memeriksa = ref(false)
async function periksa() {
  if (props.beku || !props.kunci) { terakhir.value = null; return }
  memeriksa.value = true
  try { terakhir.value = await dr.cari(props.kunci) } catch { terakhir.value = null } finally { memeriksa.value = false }
}
watch(() => [props.kunci, props.beku], periksa, { immediate: true })

const kiriDok = (d) => d?.penanda?.find((x) => x.posisi === 'kiri')
const saya = computed(() => sesi.pengguna?.id)
const tugasSaya = computed(() => props.beku?.status === 'draf' && props.beku.penanda?.some((x) => x.status === 'menunggu' && x.employee_id === saya.value))
const status = (d) => STATUS_DOKUMEN[d.status] || { n: d.status === 'ditolak' ? 'Ditolak' : d.status, w: 'beranda' }

// ---------- Ajukan ----------
const lembar = ref(false); const f = ref({}); const proses = ref(false)
const pejabat = computed(() => lembaga.signatories.filter((s) => s.aktif))
function bukaAjukan() {
  const cocok = pejabat.value.find((s) => s.jabatan_tertulis.toLowerCase() === props.penandaJabatan.toLowerCase())
    || pejabat.value.find((s) => /^direktur/i.test(s.jabatan_tertulis)) || pejabat.value[0]
  f.value = { mode: cocok?.employee_id || !pejabat.value.length ? 'elektronik' : 'basah', kiri: cocok?.id || '', kanan: props.kananJabatan }
  lembar.value = true
}
const kiriPilih = computed(() => pejabat.value.find((s) => s.id === f.value.kiri))
const bisaElektronik = computed(() => !kiriPilih.value || !!kiriPilih.value.employee_id)
watch(bisaElektronik, (v) => { if (!v && lembar.value) f.value.mode = 'basah' })
async function ajukan() {
  if (!kiriPilih.value) return ui.toast('Pilih penanda tangan.', 'galat')
  proses.value = true
  try {
    const h = await dr.ajukan({ jenis: props.jenis, jenis_nama: props.jenisNama, perihal: props.perihal, periode: props.periode, subjek: props.subjek, kop_kode: props.kop,
      kunci: props.kunci, tautan: props.tautan, isi: props.isi(), mode: f.value.mode, kiri: { signatory_id: kiriPilih.value.id, nama: kiriPilih.value.nama, jabatan: kiriPilih.value.jabatan_tertulis, niy: kiriPilih.value.niy },
      kanan_jabatan: f.value.kanan })
    lembar.value = false
    ui.toast(h.status === 'sah' ? `Dokumen resmi terbit dengan kode validasi ${h.kode}.` : `Permintaan tanda tangan dikirim kepada ${kiriPilih.value.jabatan_tertulis}.`, 'info')
    await periksa(); emit('berubah')
  } catch (e) { ui.toast(e.message, 'galat') } finally { proses.value = false }
}
async function batalkan(d) {
  if (!(await ui.konfirmasi({ judul: 'Batalkan permintaan?', pesan: 'Permintaan tanda tangan dibatalkan dan kode validasinya tidak berlaku.', ya: 'Batalkan permintaan', bahaya: true }))) return
  try { await dr.batalkan(d.id); ui.toast('Permintaan dibatalkan.'); await periksa(); emit('berubah') } catch (e) { ui.toast(e.message, 'galat') }
}
async function lihat(d) {
  try { emit('buka', await dr.ambil(d.id)) } catch (e) { ui.toast(e.message, 'galat') }
}

// ---------- Keputusan penanda tangan (dari tampilan beku) ----------
const tolak = ref(null)
async function setujui() {
  if (!(await ui.konfirmasi({ judul: 'Tanda tangani dokumen ini?', pesan: `${props.beku.perihal} (${props.beku.periode || '–'}). Tanda tangan elektronik Anda dibubuhkan dan dokumen menjadi sah.`, ya: 'Tanda tangani' }))) return
  try {
    const h = await dr.tandatangani(props.beku.id, true)
    ui.toast(h.status === 'sah' ? `Dokumen sah. Kode validasi ${h.kode}.` : 'Tanda tangan Anda tersimpan.', 'info')
    emit('buka', await dr.ambil(props.beku.id))
  } catch (e) { ui.toast(e.message, 'galat') }
}
async function kirimTolak() {
  try {
    await dr.tandatangani(props.beku.id, false, tolak.value.catatan)
    tolak.value = null; ui.toast('Dokumen ditolak. Pengaju menerima pemberitahuan.')
    emit('buka', await dr.ambil(props.beku.id))
  } catch (e) { ui.toast(e.message, 'galat') }
}
</script>
<template>
  <!-- Tampilan versi resmi (beku) -->
  <section v-if="beku" class="kartu w-verifikasi flex flex-wrap items-center gap-3 border-[color:var(--c)] p-3.5" style="background: color-mix(in srgb, var(--c) 7%, rgb(var(--permukaan)))">
    <span class="chip-ikon h-11 w-11 shrink-0 rounded-xl"><PhSealCheck :size="24" weight="duotone" /></span>
    <div class="min-w-0 flex-1 basis-[12rem]">
      <p class="flex flex-wrap items-center gap-1.5 font-bold">Versi resmi <span class="tabular-nums">{{ beku.kode }}</span>
        <span :class="['lencana', 'w-' + status(beku).w]">{{ status(beku).n }}</span>
        <span v-if="beku.mode_ttd === 'basah'" class="lencana w-pengajuan">Tanda tangan basah</span></p>
      <p class="text-sm text-teks2">
        <template v-if="beku.status === 'sah'">Disahkan {{ formatPanjang(beku.diterbitkan_pada) }} · data dibekukan saat diajukan {{ formatWaktu(beku.diajukan_pada) }}</template>
        <template v-else-if="beku.status === 'draf'">Menunggu tanda tangan {{ kiriDok(beku)?.jabatan }} ({{ kiriDok(beku)?.nama }})</template>
        <template v-else-if="beku.status === 'ditolak'">Ditolak: {{ beku.catatan }}</template>
        <template v-else>{{ status(beku).ket }}</template>
      </p>
    </div>
    <div class="flex w-full flex-wrap gap-2 sm:w-auto">
      <template v-if="tugasSaya">
        <button type="button" class="tombol-utama flex-1 sm:flex-none" @click="setujui"><PhPenNib :size="20" weight="duotone" /> Tanda tangani</button>
        <button type="button" class="tombol-garis flex-1 sm:flex-none" @click="tolak = { catatan: '' }"><PhXCircle :size="18" weight="duotone" /> Tolak</button>
      </template>
      <button type="button" class="tombol-garis flex-1 sm:flex-none" @click="emit('tutup')"><PhArrowCounterClockwise :size="18" weight="bold" /> Data terkini</button>
    </div>
  </section>

  <!-- Data terkini -->
  <section v-else-if="kunci" class="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-garis px-3 py-2">
    <PhSealCheck :size="20" weight="duotone" class="w-verifikasi shrink-0" style="color: var(--c)" />
    <p class="min-w-0 flex-1 text-sm text-teks2">
      <template v-if="memeriksa">Memeriksa versi resmi…</template>
      <template v-else-if="!terakhir">Belum ada versi resmi untuk laporan dengan saringan ini.</template>
      <template v-else-if="terakhir.status === 'draf'"><PhHourglassMedium :size="16" weight="duotone" class="inline align-[-3px]" /> Menunggu tanda tangan {{ kiriDok(terakhir)?.jabatan }} · kode {{ terakhir.kode }}</template>
      <template v-else-if="terakhir.status === 'sah'"><PhCheckCircle :size="16" weight="fill" class="inline align-[-3px] text-[#1E7D4F]" /> Versi resmi sah · kode {{ terakhir.kode }} · {{ formatPanjang(terakhir.diterbitkan_pada) }}</template>
      <template v-else-if="terakhir.status === 'ditolak'"><PhXCircle :size="16" weight="duotone" class="inline align-[-3px] text-[rgb(var(--merah))]" /> Pengajuan terakhir ditolak: {{ terakhir.catatan }}</template>
      <template v-else>Versi terakhir: {{ status(terakhir).n }} ({{ terakhir.kode }})</template>
    </p>
    <button v-if="terakhir" type="button" class="tombol-garis min-h-[40px] text-sm" @click="lihat(terakhir)"><PhEye :size="18" weight="duotone" /> {{ terakhir.status === 'sah' ? 'Buka versi resmi' : 'Lihat' }}</button>
    <button v-if="terakhir && ['draf', 'ditolak'].includes(terakhir.status) && terakhir.diterbitkan_oleh === saya" type="button" class="tombol-garis min-h-[40px] text-sm" @click="batalkan(terakhir)"><PhTrash :size="18" weight="duotone" /> Batalkan</button>
    <button type="button" class="tombol-garis min-h-[40px] text-sm" @click="bukaAjukan"><PhSignature :size="18" weight="duotone" /> {{ terakhir?.status === 'sah' ? 'Terbitkan ulang' : 'Terbitkan resmi' }}</button>
  </section>

  <LembarBawah v-model="lembar" judul="Terbitkan laporan resmi">
    <div class="space-y-4 pb-2">
      <div class="rounded-xl bg-permukaan2 p-3 text-sm">
        <p class="font-bold">{{ perihal }}</p>
        <p class="text-teks2">{{ periode }}<template v-if="subjek"> · {{ subjek }}</template></p>
        <p class="mt-1.5 flex items-start gap-1.5 text-xs text-teks3"><PhInfo :size="15" class="mt-px shrink-0" /> Data yang tampil sekarang disimpan sebagai salinan beku. Perubahan data sesudahnya tidak mengubah dokumen resmi; terbitkan ulang bila perlu (versi lama otomatis berstatus Direvisi).</p>
      </div>
      <label class="block"><span class="label-isian">Penanda tangan (kiri)</span>
        <select v-model="f.kiri" class="isian"><option value="" disabled>Pilih pejabat</option>
          <option v-for="s in pejabat" :key="s.id" :value="s.id">{{ s.jabatan_tertulis }} – {{ s.nama }}</option></select></label>
      <fieldset class="space-y-2"><legend class="label-isian">Cara tanda tangan</legend>
        <label :class="['flex gap-3 rounded-xl border p-3', f.mode === 'elektronik' ? 'border-[#2F5FA8] bg-[#2F5FA8]/5' : 'border-garis', !bisaElektronik && 'opacity-60']">
          <input v-model="f.mode" type="radio" value="elektronik" class="mt-1 h-5 w-5 accent-[#2F5FA8]" :disabled="!bisaElektronik" />
          <span><span class="block font-semibold">Elektronik (QR)</span><span class="block text-sm text-teks3">Pejabat menyetujui dari akunnya; dokumen sah setelah ditandatangani, QR dan kode validasi tercetak.</span>
            <span v-if="!bisaElektronik" class="mt-1 block text-xs font-semibold text-[rgb(var(--merah))]">Pejabat ini belum terhubung akun pegawai (Setelan → Penanda tangan).</span></span></label>
        <label :class="['flex gap-3 rounded-xl border p-3', f.mode === 'basah' ? 'border-[#2F5FA8] bg-[#2F5FA8]/5' : 'border-garis']">
          <input v-model="f.mode" type="radio" value="basah" class="mt-1 h-5 w-5 accent-[#2F5FA8]" />
          <span><span class="block font-semibold">Basah (manual)</span><span class="block text-sm text-teks3">Langsung terdaftar dengan kode validasi; dicetak lalu ditandatangani dengan pena.</span></span></label>
      </fieldset>
      <label class="block"><span class="label-isian">Jabatan Anda (kolom kanan)</span><input v-model="f.kanan" class="isian" maxlength="80" /></label>
      <button type="button" class="tombol-utama w-full" :disabled="proses" @click="ajukan"><PhPaperPlaneTilt :size="20" weight="duotone" />
        {{ f.mode === 'basah' ? 'Terbitkan sekarang' : 'Kirim permintaan tanda tangan' }}</button>
    </div>
  </LembarBawah>

  <LembarBawah :model-value="!!tolak" judul="Tolak dokumen" @update:model-value="(v) => !v && (tolak = null)">
    <div v-if="tolak" class="space-y-4 pb-2">
      <label class="block"><span class="label-isian">Alasan penolakan</span>
        <textarea v-model="tolak.catatan" class="isian min-h-[6rem] py-2" placeholder="Contoh: data bulan ini belum diverval, mohon diperbaiki lalu ajukan ulang." /></label>
      <button type="button" class="tombol-utama w-full" @click="kirimTolak"><PhXCircle :size="20" weight="duotone" /> Tolak dan beri tahu pengaju</button>
    </div>
  </LembarBawah>
</template>
