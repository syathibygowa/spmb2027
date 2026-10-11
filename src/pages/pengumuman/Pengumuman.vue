<!-- SIMKA PRO | src/pages/pengumuman/Pengumuman.vue | v1.4 | Fase 8 – Isi pengumuman dapat ditulis tebal dan miring | 10/10/2026 -->
<script setup>
// Pengumuman: semua pegawai membaca pengumuman yang ditujukan kepadanya (tanda dibaca/belum).
// Admin, superadmin, dan pegawai yang diberi hak fitur "pengumuman" (tingkat 2+) dapat membuat,
// mengubah, menghapus, melihat siapa yang sudah/belum membaca, dan mencetak pengumuman (F4 berkop).
// v1.4: isi dapat ditulis tebal/miring (IsianTeksKaya; penanda gaya WhatsApp *tebal* _miring_), tampil rapi di layar dan cetakan.
// v1.1: lampiran berkas (PDF/foto ke Drive) dan tautan (Drive, Google Form, Zoom, dll.); ekspor Excel pembaca dihapus.
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PhMegaphone, PhPlus, PhMagnifyingGlass, PhPushPin, PhPencilSimple, PhTrash, PhPrinter, PhUsers, PhEnvelopeSimpleOpen, PhTray, PhListChecks, PhPaperclip, PhLink, PhX, PhDownloadSimple } from '@phosphor-icons/vue'
import { usePengumuman } from '@/stores/pengumuman'
import IsianTeksKaya from '@/components/IsianTeksKaya.vue'
import { teksKaya, teksPolos } from '@/lib/teksKaya'
import { useLembaga } from '@/stores/lembaga'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { formatPanjang, formatPendek, formatRelatif, formatWaktu, hariIniISO, uraiPendek } from '@/lib/tanggal'
import { MODE_DEMO } from '@/lib/supabase'
import { ambilBerkasUrl, unggahKeDrive, kompresGambar, namaRapi } from '@/lib/penyimpanan'
import LembarBawah from '@/components/LembarBawah.vue'
import BilahTab from '@/components/BilahTab.vue'
import TombolAksi from '@/components/TombolAksi.vue'
import InputTanggal from '@/components/InputTanggal.vue'
import PilihSasaran from '@/components/PilihSasaran.vue'
import DokumenCetak from '@/components/cetak/DokumenCetak.vue'
import DaftarKirimWA from '@/components/DaftarKirimWA.vue'
import { pesanWA, halamanAplikasi } from '@/lib/wa'
import TandaTangan from '@/components/cetak/TandaTangan.vue'

const props = defineProps({ id: String })
const router = useRouter(); const pg = usePengumuman(); const lembaga = useLembaga(); const sesi = useSesi(); const ui = useUI()
const kelola = computed(() => pg.bolehKelola())
const tab = ref('saya'); const cari = ref(''); const lewat = ref(false)
const form = ref(null); const simpanan = ref(false); const ringkasSasaran = ref('Semua pegawai')
const pembaca = ref(null); const saringBaca = ref('semua'); const pratinjau = ref(false)

onMounted(async () => { await Promise.all([pg.muat(), lembaga.muat()]) })

const terpilih = computed(() => pg.daftar.find((p) => p.id === props.id) || null)
watch(terpilih, (p) => { if (p) pg.tandaiDibaca(p.id) }, { immediate: true })
const tutupDetail = () => router.replace('/pengumuman')

const masihBerlaku = (p) => !p.tampil_sampai || p.tampil_sampai >= hariIniISO()
const tampil = computed(() => {
  const q = cari.value.toLowerCase().trim()
  return pg.daftar
    .filter((p) => (tab.value === 'kelola' ? true : p.saya_penerima))
    .filter((p) => lewat.value || tab.value === 'kelola' || masihBerlaku(p))
    .filter((p) => !q || [p.judul, p.isi, p.pembuat].join(' ').toLowerCase().includes(q))
    .sort((a, b) => (tab.value === 'saya' ? Number(b.penting && masihBerlaku(b)) - Number(a.penting && masihBerlaku(a)) : 0) || b.created_at.localeCompare(a.created_at))
})
const belum = computed(() => pg.daftar.filter((p) => p.saya_penerima && !p.dibaca_pada && masihBerlaku(p)).length)

const berkas = ref(null); const membuka = ref(false)
function baru() { form.value = { judul: '', isi: '', penting: false, tampil_sampai: '', tautan: '', nama_tautan: '', sasaran: { jenis: 'semua' } }; berkas.value = null }
function ubah(p) { form.value = { id: p.id, judul: p.judul, isi: p.isi, penting: p.penting, tampil_sampai: p.tampil_sampai || '', tautan: p.tautan || '', nama_tautan: p.nama_tautan || '', nama_lampiran: p.nama_lampiran }; berkas.value = null }
function pilihBerkas(e) {
  const b = e.target.files?.[0]; e.target.value = ''
  if (!b) return
  if (!/^image\/|application\/pdf/.test(b.type)) return ui.toast('Lampiran harus PDF atau foto. Dokumen Word/Excel simpan sebagai PDF, atau bagikan lewat tautan.', 'galat')
  if (b.type === 'application/pdf' && b.size > 5 * 1024 * 1024) return ui.toast('Ukuran PDF paling besar 5 MB.', 'galat')
  berkas.value = b
}
async function bukaLampiran(p) {
  if (MODE_DEMO) return ui.toast('Mode demo: lampiran contoh tidak tersedia.', 'info')
  membuka.value = true
  try { const u = await ambilBerkasUrl(p.lampiran_id); const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.click() }
  catch (e) { ui.toast(e.message, 'galat') } finally { membuka.value = false }
}
const ukuran = (b) => (!b ? '' : b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.round(b / 1024) + ' KB')
async function simpan() {
  const f = form.value
  if (f.judul.trim().length < 3) return ui.toast('Judul minimal 3 karakter.', 'galat')
  if (f.isi.trim().length < 3) return ui.toast('Isi pengumuman belum diisi.', 'galat')
  if (f.tampil_sampai && f.tampil_sampai < hariIniISO()) return ui.toast('Tanggal "tampil sampai" tidak boleh sebelum hari ini.', 'galat')
  if (f.tautan.trim() && !/^https?:\/\//.test(f.tautan.trim())) return ui.toast('Tautan harus diawali https://', 'galat')
  if (!f.id && !(await ui.konfirmasi({ judul: 'Terbitkan pengumuman?', pesan: `Sasaran: ${ringkasSasaran.value}. Setiap penerima mendapat notifikasi.`, ya: 'Terbitkan' }))) return
  simpanan.value = true
  try {
    const isi = { ...f, ringkasan: ringkasSasaran.value }; delete isi.nama_lampiran
    if (berkas.value) {
      if (MODE_DEMO) { isi.lampiran_id = 'demo'; isi.nama_lampiran = berkas.value.name }
      else {
        const blob = berkas.value.type === 'application/pdf' ? berkas.value : await kompresGambar(berkas.value, { maks: 2000, kualitas: 0.8 })
        const t = hariIniISO()
        isi.lampiran_id = await unggahKeDrive(blob, { nama: namaRapi('Pengumuman', f.judul.slice(0, 40), t) + (blob.type === 'application/pdf' ? '.pdf' : '.jpg'), kategori: 'lampiran_pengumuman', folder: `SIMKA PRO/Pengumuman/${t.slice(0, 4)}` })
      }
    }
    const id = await pg.simpan(isi)
    ui.toast(f.id ? 'Pengumuman diperbarui.' : 'Pengumuman diterbitkan dan notifikasi terkirim.', 'info')
    form.value = null
    if (!f.id) router.replace(`/pengumuman/${id}`)
  } catch (e) { ui.toast(e.message, 'galat') } finally { simpanan.value = false }
}
async function hapus(p) {
  if (!(await ui.konfirmasi({ judul: 'Hapus pengumuman?', pesan: `"${p.judul}" dan notifikasinya akan dihapus dari semua penerima.`, ya: 'Hapus', bahaya: true }))) return
  try { await pg.hapus(p.id); tutupDetail(); ui.toast('Pengumuman dihapus.', 'info') } catch (e) { ui.toast(e.message, 'galat') }
}
async function lihatPembaca(p) {
  try { pembaca.value = { p, daftar: await pg.pembaca(p.id) }; saringBaca.value = 'semua' } catch (e) { ui.toast(e.message, 'galat') }
}
const pesanPengumuman = (r) => pesanWA('pengumuman', { nama: r.nama, unit: r.unit, judul: pembaca.value.p.judul, isi_singkat: pembaca.value.p.isi.length > 280 ? pembaca.value.p.isi.slice(0, 277) + '…' : pembaca.value.p.isi, tautan: halamanAplikasi(`/pengumuman/${pembaca.value.p.id}`) })
const persen = (p) => (p.penerima ? Math.round((100 * (p.sudah_dibaca || 0)) / p.penerima) : 0)
const direktur = computed(() => lembaga.signatories.find((s) => /^direktur$/i.test(s.jabatan_tertulis)) || lembaga.signatories[0] || {})
</script>
<template>
  <div class="w-pengumuman mx-auto max-w-3xl">
    <div class="layar-saja">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <BilahTab v-if="kelola" :tepi="false" v-model="tab" label="Tampilan pengumuman" :tab="[{ k: 'saya', n: 'Untuk saya', ikon: PhTray, w: 'pengumuman', lencana: belum || null }, { k: 'kelola', n: 'Kelola', ikon: PhListChecks, w: 'hakakses' }]" />
        <button v-if="kelola" class="tombol-utama ml-auto hidden lg:inline-flex" @click="baru"><PhPlus :size="20" weight="bold" /> Buat pengumuman</button>
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="relative min-w-[14rem] flex-1"><PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" class="isian pl-10" placeholder="Cari judul atau isi" aria-label="Cari pengumuman" /></div>
        <label v-if="tab === 'saya'" class="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-teks2"><input v-model="lewat" type="checkbox" class="h-5 w-5 accent-[#A13A86]" /> Termasuk yang sudah lewat</label>
      </div>

      <p v-if="pg.memuat && !pg.daftar.length" class="py-10 text-center text-teks3">Memuat pengumuman…</p>
      <p v-else-if="pg.galat" class="py-10 text-center text-teks3">{{ pg.galat }}</p>
      <ul v-else class="space-y-2.5">
        <li v-for="p in tampil" :key="p.id">
          <router-link :to="`/pengumuman/${p.id}`" :class="['kartu kartu-p relative block p-4 hover:bg-permukaan2', p.saya_penerima && !p.dibaca_pada && 'belum', p.penting && 'penting']">
            <div class="flex items-start gap-3">
              <span class="chip-ikon h-10 w-10 shrink-0"><component :is="p.penting ? PhPushPin : PhMegaphone" :size="22" weight="duotone" /></span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span v-if="p.penting" class="lencana w-beranda">Penting</span>
                  <span v-if="!masihBerlaku(p)" class="lencana w-hakakses">Sudah lewat</span>
                  <span v-if="p.saya_penerima && !p.dibaca_pada" class="lencana w-notifikasi">Belum dibaca</span>
                </div>
                <h3 :class="['mt-1 leading-snug', p.saya_penerima && !p.dibaca_pada ? 'font-extrabold' : 'font-bold']">{{ p.judul }}</h3>
                <p class="mt-0.5 line-clamp-2 text-sm text-teks2">{{ teksPolos(p.isi) }}</p>
                <p class="mt-1.5 text-xs text-teks3">{{ formatRelatif(p.created_at) }} · {{ p.pembuat || 'Pengelola' }}</p>
                <div v-if="tab === 'kelola'" class="mt-2">
                  <p class="text-xs text-teks3">Sasaran: {{ p.ringkasan_sasaran }}</p>
                  <div class="mt-1.5 flex items-center gap-2 text-xs font-semibold text-teks2">
                    <div class="h-2 flex-1 overflow-hidden rounded-full bg-permukaan2" role="progressbar" :aria-valuenow="persen(p)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${persen(p)}% sudah membaca`">
                      <div class="h-full rounded-full" :style="{ width: persen(p) + '%', background: 'var(--c)' }" /></div>
                    {{ p.sudah_dibaca || 0 }}/{{ p.penerima || 0 }} dibaca
                  </div>
                </div>
              </div>
            </div>
          </router-link>
        </li>
      </ul>
      <div v-if="!pg.memuat && !tampil.length && !pg.galat" class="flex flex-col items-center py-14 text-center">
        <span class="chip-ikon h-16 w-16 rounded-2xl"><PhMegaphone :size="34" weight="duotone" /></span>
        <p class="mt-3 font-bold">{{ cari ? 'Tidak ada pengumuman yang cocok' : 'Belum ada pengumuman' }}</p>
        <p class="mt-1 text-sm text-teks3">Pengumuman baru akan muncul di sini dan di lonceng notifikasi.</p>
      </div>
      <TombolAksi v-if="kelola" label="Buat" :ikon="PhPlus" warna="pengumuman" @klik="baru" />
    </div>

    <!-- Detail -->
    <LembarBawah :model-value="!!terpilih && !form && !pembaca" @update:model-value="(v) => !v && tutupDetail()" :judul="terpilih?.penting ? 'Pengumuman penting' : 'Pengumuman'">
      <article v-if="terpilih" class="pb-2">
        <h3 class="text-xl font-extrabold leading-snug">{{ terpilih.judul }}</h3>
        <p class="mt-1 text-sm text-teks3">{{ formatPanjang(terpilih.created_at) }} · {{ terpilih.pembuat || 'Pengelola' }}<template v-if="terpilih.tampil_sampai"> · tampil sampai {{ formatPanjang(terpilih.tampil_sampai) }}</template></p>
        <!-- eslint-disable-next-line vue/no-v-html -- teks sudah di-escape oleh teksKaya() -->
        <p class="mt-4 whitespace-pre-line leading-relaxed text-teks" v-html="teksKaya(terpilih.isi)" />
        <div v-if="terpilih.lampiran_id || terpilih.tautan" class="mt-4 space-y-2">
          <button v-if="terpilih.lampiran_id" class="flex w-full items-center gap-3 rounded-xl border border-garis p-3 text-left hover:bg-permukaan2" :disabled="membuka" @click="bukaLampiran(terpilih)">
            <span class="chip-ikon h-10 w-10 shrink-0"><PhPaperclip :size="20" weight="duotone" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ terpilih.nama_lampiran || 'Lampiran' }}</span><span class="block text-xs text-teks3">{{ membuka ? 'Mengambil berkas…' : 'Ketuk untuk membuka' }}{{ terpilih.ukuran_lampiran ? ' · ' + ukuran(terpilih.ukuran_lampiran) : '' }}</span></span>
            <PhDownloadSimple :size="20" class="text-teks3" /></button>
          <a v-if="terpilih.tautan" :href="terpilih.tautan" target="_blank" rel="noopener" class="flex items-center gap-3 rounded-xl border border-garis p-3 hover:bg-permukaan2">
            <span class="chip-ikon h-10 w-10 shrink-0"><PhLink :size="20" weight="duotone" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ terpilih.nama_tautan || 'Buka tautan' }}</span><span class="block truncate text-xs text-teks3">{{ terpilih.tautan }}</span></span></a>
        </div>
        <p v-if="kelola" class="mt-4 rounded-xl bg-permukaan2 p-3 text-sm text-teks2">Sasaran: {{ terpilih.ringkasan_sasaran }}
          <template v-if="terpilih.penerima != null"> · {{ terpilih.sudah_dibaca || 0 }} dari {{ terpilih.penerima }} sudah membaca</template></p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="tombol-garis" @click="pratinjau = true"><PhPrinter :size="20" weight="duotone" /> Cetak</button>
          <template v-if="kelola">
            <button class="tombol-garis" @click="lihatPembaca(terpilih)"><PhUsers :size="20" weight="duotone" /> Pembaca dan WA</button>
            <button class="tombol-garis" @click="ubah(terpilih)"><PhPencilSimple :size="20" weight="duotone" /> Ubah</button>
            <button class="tombol-garis w-beranda" style="color: var(--c)" @click="hapus(terpilih)"><PhTrash :size="20" weight="duotone" /> Hapus</button>
          </template>
        </div>
      </article>
    </LembarBawah>

    <!-- Formulir -->
    <LembarBawah :model-value="!!form" @update:model-value="(v) => !v && (form = null)" :judul="form?.id ? 'Ubah pengumuman' : 'Buat pengumuman'">
      <form v-if="form" class="space-y-3 pb-2" @submit.prevent="simpan">
        <div><label class="label-isian" for="pg-judul">Judul</label>
          <input id="pg-judul" v-model="form.judul" class="isian" maxlength="150" required placeholder="Contoh: Rapat pekanan seluruh pegawai" /></div>
        <IsianTeksKaya id="pg-isi" v-model="form.isi" label="Isi pengumuman" wajib placeholder="Tuliskan isi pengumuman dengan jelas: waktu, tempat, dan hal yang perlu disiapkan." />
        <div class="grid gap-3 sm:grid-cols-2">
          <InputTanggal v-model="form.tampil_sampai" label="Tampil sampai (opsional)" bawaan-kosong />
          <label class="flex min-h-[48px] items-center gap-3 self-end rounded-xl border border-garis px-3 text-sm font-semibold">
            <input v-model="form.penting" type="checkbox" class="h-5 w-5 accent-[#C7332F]" /> Tandai penting (disematkan di atas)</label>
        </div>
        <div>
          <p class="label-isian">Lampiran berkas (opsional, PDF atau foto maks. 5 MB)</p>
          <div v-if="berkas || form.nama_lampiran" class="flex items-center gap-3 rounded-xl border border-garis p-3"><PhPaperclip :size="22" class="text-teks2" />
            <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ berkas ? berkas.name : form.nama_lampiran }}</span>
            <label class="tombol-teks cursor-pointer text-sm">Ganti<input type="file" accept="application/pdf,image/*" class="sr-only" @change="pilihBerkas" /></label>
            <button v-if="berkas" type="button" class="tombol-ikon" aria-label="Batalkan lampiran" @click="berkas = null"><PhX :size="20" /></button></div>
          <label v-else class="tombol-garis w-full cursor-pointer justify-center"><PhPaperclip :size="20" weight="duotone" /> Pilih berkas<input type="file" accept="application/pdf,image/*" class="sr-only" @change="pilihBerkas" /></label>
        </div>
        <div class="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div><label class="label-isian" for="pg-tautan">Tautan (opsional)</label><input id="pg-tautan" v-model="form.tautan" class="isian" inputmode="url" placeholder="https://drive.google.com/…" /></div>
          <div><label class="label-isian" for="pg-ntautan">Nama tautan</label><input id="pg-ntautan" v-model="form.nama_tautan" class="isian" placeholder="Contoh: Daftar hadir" /></div>
        </div>
        <div v-if="!form.id"><p class="label-isian">Sasaran</p>
          <PilihSasaran v-model="form.sasaran" :hitung="pg.hitungSasaran" @ringkasan="ringkasSasaran = $event" /></div>
        <p v-else class="text-sm text-teks3">Sasaran tidak dapat diubah setelah diterbitkan. Bila perlu, hapus lalu buat pengumuman baru.</p>
        <button class="tombol-utama w-full" :disabled="simpanan">{{ simpanan ? 'Menyimpan…' : form.id ? 'Simpan perubahan' : 'Terbitkan pengumuman' }}</button>
      </form>
    </LembarBawah>

    <!-- Pembaca dan WA -->
    <LembarBawah :model-value="!!pembaca" @update:model-value="(v) => !v && (pembaca = null)" judul="Pembaca pengumuman">
      <div v-if="pembaca" class="pb-2">
        <p class="mb-3 text-sm text-teks2">{{ pembaca.p.judul }} · {{ pembaca.daftar.filter((r) => r.dibaca_pada).length }} dari {{ pembaca.daftar.length }} sudah membaca</p>
        <DaftarKirimWA :penerima="pembaca.daftar.map((r) => ({ ...r, keterangan: r.dibaca_pada ? `dibaca ${formatWaktu(r.dibaca_pada)}` : 'belum dibaca' }))" :pesan="pesanPengumuman" :kunci="'pengumuman-' + pembaca.p.id"
          :saringan="[{ k: 'belum', n: 'Belum dibaca', f: (r) => !r.dibaca_pada }, { k: 'sudah', n: 'Sudah dibaca', f: (r) => !!r.dibaca_pada }, { k: 'semua', n: 'Semua', f: () => true }]" />
      </div>
    </LembarBawah>

    <!-- Cetak -->
    <DokumenCetak v-if="terpilih" v-model:pratinjau="pratinjau" judul="Pengumuman" :subjudul="terpilih.judul" :pencetak="sesi.pengguna?.nama_lengkap">
      <!-- eslint-disable-next-line vue/no-v-html -- teks sudah di-escape oleh teksKaya() -->
      <p style="white-space: pre-line; text-align: justify; line-height: 1.6" v-html="teksKaya(terpilih.isi)" />
      <p style="margin-top: 8pt">Ditujukan kepada: {{ terpilih.ringkasan_sasaran || 'Seluruh pegawai' }}.</p>
      <p v-if="terpilih.lampiran_id || terpilih.tautan" style="margin-top: 4pt">Lampiran: {{ [terpilih.nama_lampiran, terpilih.tautan && `${terpilih.nama_tautan || 'tautan'} (${terpilih.tautan})`].filter(Boolean).join('; ') }}.</p>
      <template #ttd>
        <TandaTangan :tanggal="uraiPendek(formatPendek(terpilih.created_at))" :kiri="{ pengantar: 'Mengetahui,', jabatan: direktur.jabatan_tertulis || 'Direktur', nama: direktur.nama || '', niy: direktur.niy }"
          :kanan="{ jabatan: 'Pembuat Pengumuman', nama: terpilih.pembuat || '' }" />
      </template>
    </DokumenCetak>
  </div>
</template>
<style scoped>
.kartu-p.belum { background: color-mix(in srgb, var(--c) 8%, rgb(var(--permukaan))); }
.kartu-p.penting { box-shadow: inset 4px 0 0 #C7332F; }
</style>
