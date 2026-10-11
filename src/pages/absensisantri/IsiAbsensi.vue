<!-- SIMKA PRO | src/pages/absensisantri/IsiAbsensi.vue | v1.5 | Fase 8 – Perbaikan: musyrif mengabsen tanpa presensi diri lebih dulu | 10/10/2026 -->
<script setup>
// Pengisian absensi satu sesi: semua santri bawaan Hadir, ketuk kode HISBAT bagi yang tidak.
// Pengampu halaqah/ekskul diminta presensi sekali bila sesi ini ada di jadwal presensinya dan belum presensi (asrama tidak).
// Admin ber-izin absensi_atas_nama dapat mengisi atas nama pengampu (tercatat di riwayat).
// Halaqah: tab Absensi | Setoran (setoran terbuka setelah absensi tersimpan; ?tab=setoran membuka tab Setoran).
// v1.4: santri yang sedang sakit (Klinik) atau izin (Perizinan) otomatis S/I dan terkunci dengan labelnya.
//       Santri yang ditandai Sakit wajib diberi keluhan singkat; saat disimpan otomatis dirujuk ke klinik.
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhFingerprint, PhCheckCircle, PhFloppyDisk, PhClockCounterClockwise, PhWarningCircle, PhCrown, PhUserSwitch, PhWhatsappLogo, PhArrowCounterClockwise, PhMagnifyingGlass, PhNotebook, PhCamera, PhMapPin, PhListChecks, PhBookOpenText, PhFirstAidKit, PhSignOut, PhLockSimple } from '@phosphor-icons/vue'
import { useAbsensiSantri } from '@/stores/absensiSantri'
import { useSantri } from '@/stores/santri'
import { useSesi } from '@/stores/sesi'
import { useUI } from '@/stores/ui'
import { KODE, URUT_KODE, JENIS_ABSENSI, jam } from '@/lib/absensi'
import { inisial, kontakUtama, labelRombel, judulKelompok } from '@/lib/santri'
import { formatHari, formatWaktu, formatPanjang, formatJam } from '@/lib/tanggal'
import { pesanWA } from '@/lib/wa'
import { MODE_DEMO } from '@/lib/supabase'
import { unggahKeDrive, kompresGambar, namaRapi } from '@/lib/penyimpanan'
import FotoBerkas from '@/components/FotoBerkas.vue'
import LembarBawah from '@/components/LembarBawah.vue'
import DaftarKirimWA from '@/components/DaftarKirimWA.vue'
import FormSetoran from '@/pages/tahfizh/FormSetoran.vue'
import BilahTab from '@/components/BilahTab.vue'

const route = useRoute(); const router = useRouter()
const abs = useAbsensiSantri(); const san = useSantri(); const sesi = useSesi(); const ui = useUI()
const d = ref(null); const galat = ref(''); const isian = ref({}); const ket = ref({}); const catatan = ref(''); const proses = ref(false)
const atasNama = ref(''); const cari = ref(''); const lembarWA = ref(false); const awal = ref('')
const periksa = ref({}) // santri Sakit → waktu periksa klinik (hari_ini/besok)
// Ekskul: jurnal materi per pertemuan (topik wajib, uraian, foto opsional)
const jurnal = ref({ topik: '', uraian: '', foto_id: null }); const fotoBaru = ref(null); const pratinjauFoto = ref('')
const ekskul = computed(() => d.value?.jenis === 'ekskul')
const halaqah = computed(() => d.value?.jenis === 'halaqah')
const tab = ref(route.query.tab === 'setoran' ? 'setoran' : 'absensi')
function gantiTab(t) { if (t === 'setoran' && berubah.value) { ui.toast('Simpan absensi lebih dulu sebelum mengisi setoran.', 'galat'); return } tab.value = t; router.replace({ query: { ...route.query, tab: t === 'setoran' ? 'setoran' : undefined } }) }
function pilihFoto(e) { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (!/^image\//.test(f.type)) return ui.toast('Pilih berkas foto.', 'galat'); fotoBaru.value = f; pratinjauFoto.value = URL.createObjectURL(f) }

async function muat() {
  galat.value = ''
  try {
    const [x] = await Promise.all([abs.detail(route.params.group, route.params.tanggal, route.params.sesi), san.muat()])
    d.value = x
    isian.value = Object.fromEntries(x.anggota.map((a) => [a.id, 'H'])); ket.value = {}
    for (const p of x.pengecualian) { isian.value[p.student_id] = p.kode; if (p.keterangan) ket.value[p.student_id] = p.keterangan }
    periksa.value = {}
    for (const o of x.otomatis || []) { if (o.student_id in isian.value) { isian.value[o.student_id] = o.kode; ket.value[o.student_id] = o.keterangan } }
    catatan.value = x.sesi_tercatat?.catatan || ''
    jurnal.value = { topik: x.jurnal?.topik || '', uraian: x.jurnal?.uraian || '', foto_id: x.jurnal?.foto_id || null }; fotoBaru.value = null; pratinjauFoto.value = ''
    atasNama.value = x.pengasuh.find((p) => p.peran === 'utama')?.employee_id || x.pengasuh[0]?.employee_id || ''
    awal.value = JSON.stringify([isian.value, ket.value, catatan.value, jurnal.value])
  } catch (e) { galat.value = e.message }
}
onMounted(muat)

const jenis = computed(() => JENIS_ABSENSI[d.value?.jenis] || JENIS_ABSENSI.kelas)
/** Status otomatis per santri: { kode, sumber: klinik|izin, keterangan } — terkunci, tidak dapat diubah pengasuh. */
const oto = computed(() => Object.fromEntries((d.value?.otomatis || []).map((o) => [o.student_id, o])))
const perluKeluhan = (id) => isian.value[id] === 'S' && !oto.value[id]
const modeAtasNama = computed(() => d.value && !d.value.pengasuh_saya && d.value.boleh_atas_nama)
const bolehIsi = computed(() => d.value && (d.value.pengasuh_saya || d.value.boleh_atas_nama))
const kini = computed(() => new Date(d.value?.sekarang || Date.now()))
const belumBuka = computed(() => d.value && kini.value < new Date(d.value.buka))
const lewatBatas = computed(() => d.value && d.value.pengasuh_saya && !modeAtasNama.value && kini.value > new Date(d.value.batas))
const lewatJendela = computed(() => d.value && kini.value > new Date(d.value.tutup))
// v1.5: musyrif (absensi asrama) tidak lagi diminta presensi diri lebih dulu, agar fleksibel mengabsen santri.
const perluPresensi = computed(() => d.value?.perlu_presensi && d.value.pengasuh_saya && d.value.jenis !== 'asrama')
const tampil = computed(() => { const q = cari.value.toLowerCase().trim(); return (d.value?.anggota || []).filter((a) => !q || `${a.nama} ${a.nis}`.toLowerCase().includes(q)) })
const hitung = computed(() => Object.fromEntries(URUT_KODE.map((k) => [k, Object.values(isian.value).filter((v) => v === k).length])))
const hadirDihitung = computed(() => (d.value?.anggota.length || 0) - hitung.value.I - hitung.value.S - hitung.value.A)
const berubah = computed(() => JSON.stringify([isian.value, ket.value, catatan.value, jurnal.value]) !== awal.value || !!fotoBaru.value)

function setel(id, k) { if (oto.value[id]) return; isian.value[id] = k; if (k === 'H') delete ket.value[id]; if (k === 'S' && !periksa.value[id]) periksa.value[id] = 'hari_ini' }
function semuaHadir() { for (const k of Object.keys(isian.value)) if (!oto.value[k]) { isian.value[k] = 'H'; delete ket.value[k] } }
function presensiDulu() { router.push({ path: '/presensi', query: { lanjut: route.fullPath } }) }

async function simpan() {
  if (!bolehIsi.value) return
  if (ekskul.value && jurnal.value.topik.trim().length < 3) return ui.toast('Isi topik/materi pertemuan ekskul (minimal 3 huruf).', 'galat')
  const tanpaKeluhan = (d.value?.anggota || []).find((a) => perluKeluhan(a.id) && (ket.value[a.id] || '').trim().length < 3)
  if (tanpaKeluhan) return ui.toast(`Tuliskan keluhan singkat untuk ${tanpaKeluhan.nama} (Sakit) agar dirujuk ke klinik.`, 'galat')
  proses.value = true
  try {
    let fotoId = jurnal.value.foto_id
    if (ekskul.value && fotoBaru.value && !MODE_DEMO) {
      const blob = await kompresGambar(fotoBaru.value, { maks: 1280, kualitas: 0.65 }); const t = route.params.tanggal
      fotoId = await unggahKeDrive(blob, { nama: namaRapi('Ekskul', d.value.kelompok.nama, t, Date.now()) + '.jpg', kategori: 'jurnal_ekskul', folder: `SIMKA PRO/Ekskul/${t.slice(0, 4)}/${t.slice(5, 7)}`, retensiHari: 365 })
    }
    const pengecualian = Object.entries(isian.value).filter(([, k]) => k !== 'H')
      .map(([student_id, kode]) => ({ student_id, kode, keterangan: ket.value[student_id] || null, periksa: kode === 'S' ? periksa.value[student_id] || 'hari_ini' : undefined }))
    const dirujuk = (d.value?.anggota || []).filter((a) => perluKeluhan(a.id)).length
    await abs.simpan({ group_id: route.params.group, tanggal: route.params.tanggal, sesi: route.params.sesi, pengecualian, catatan: catatan.value.trim() || null,
      atas_nama_id: modeAtasNama.value ? atasNama.value || null : null,
      jurnal: ekskul.value ? { topik: jurnal.value.topik.trim(), uraian: jurnal.value.uraian.trim() || null, foto_id: fotoId || null } : undefined })
    ui.toast(`Absensi ${d.value.nama_sesi.toLowerCase()} ${judulKelompok(d.value.kelompok)} tersimpan: ${hadirDihitung.value}/${d.value.anggota.length} hadir.${dirujuk ? ` ${dirujuk} santri sakit dirujuk ke klinik.` : ''}`)
    await muat()
    if (penerimaWA.value.length) lembarWA.value = true
    else if (halaqah.value) gantiTab('setoran')   // halaqah: langsung lanjut ke setoran
  } catch (e) { ui.toast(e.message, 'galat') } finally { proses.value = false }
}

// WA ke wali santri yang tidak hadir (Izin, Sakit, Bolos, Absen, Terlambat)
const penerimaWA = computed(() => (d.value?.anggota || []).filter((a) => (isian.value[a.id] || 'H') !== 'H').map((a) => {
  const s = san.cari(a.id); const k = kontakUtama(s)
  return { employee_id: a.id, nama: a.nama, no_hp: k?.no_hp || null, unit: `${KODE[isian.value[a.id]].n}${ket.value[a.id] ? ' · ' + ket.value[a.id] : ''}`,
    keterangan: k ? `wali: ${k.nama || '–'}` : 'kontak wali belum ada', santri: s, kontak: k, kode: isian.value[a.id] }
}))
const pesanKe = (p) => pesanWA('absen_santri', { nama_wali: p.kontak?.nama, nama_santri: p.nama, kelas: p.santri ? labelRombel(p.santri) : '', status: KODE[p.kode].n.toUpperCase(),
  kegiatan: `${d.value.nama_sesi.toLowerCase()} (${judulKelompok(d.value.kelompok)})`, tanggal: formatHari(d.value.tanggal), keterangan: ket.value[p.employee_id] ? `Keterangan: ${ket.value[p.employee_id]}` : '' })
</script>
<template>
  <div class="mx-auto max-w-3xl pb-28">
    <p v-if="galat" class="kartu w-klinik flex gap-3 p-5 font-semibold" style="color: var(--c)"><PhWarningCircle :size="24" class="shrink-0" /> {{ galat }}</p>
    <template v-else-if="d">
      <!-- Kepala sesi -->
      <section :class="['kartu overflow-hidden', 'w-' + jenis.warna]">
        <div class="kepala p-5 text-white">
          <p class="text-sm font-semibold text-white/90">{{ jenis.n }} · {{ formatHari(d.tanggal) }}</p>
          <h2 class="mt-1 text-2xl font-extrabold text-white">{{ judulKelompok(d.kelompok) }}</h2>
          <p class="text-sm text-white/90">{{ d.nama_sesi }} · {{ jam(d.jam_mulai) }}–{{ jam(d.jam_selesai) }} WITA<span v-if="d.tempat" class="inline-flex items-center gap-1"> · <PhMapPin :size="14" /> {{ d.tempat }}</span></p>
        </div>
        <div class="grid grid-cols-3 divide-x divide-garis text-center sm:grid-cols-6">
          <div v-for="k in URUT_KODE" :key="k" :class="['p-2.5', 'w-' + KODE[k].w]">
            <p class="text-xl font-extrabold tabular-nums" style="color: var(--c)">{{ hitung[k] }}</p><p class="text-xs text-teks3">{{ KODE[k].n }}</p></div>
        </div>
        <p v-if="d.sesi_tercatat" class="border-t border-garis px-5 py-2.5 text-xs text-teks3">Terakhir diisi {{ formatWaktu(d.sesi_tercatat.diisi_pada) }} WITA oleh {{ d.sesi_tercatat.diinput_oleh }}{{ d.sesi_tercatat.atas_nama ? ` atas nama ${d.sesi_tercatat.pengampu}` : '' }}{{ d.sesi_tercatat.diisi_terlambat ? ' · diisi setelah jendela sesi' : '' }}.</p>
      </section>

      <!-- Tab halaqah: Absensi | Setoran -->
      <BilahTab v-if="halaqah" class="mt-4" :tepi="false" :model-value="tab" label="Isi halaqah" @update:model-value="gantiTab"
        :tab="[{ k: 'absensi', n: 'Absensi', ikon: PhListChecks, w: 'absensi' }, { k: 'setoran', n: 'Setoran hafalan', ikon: PhBookOpenText, w: 'tahfizh', ket: d.sesi_tercatat ? '' : '(setelah absensi)' }]" />
      <FormSetoran v-if="halaqah && tab === 'setoran' && !perluPresensi" class="mt-4" :group="route.params.group" :tanggal="route.params.tanggal" :sesi="route.params.sesi"
        :absensi="d" :atas-nama-id="modeAtasNama ? atasNama : ''" :tertutup="lewatBatas || belumBuka" />
      <template v-if="!(halaqah && tab === 'setoran')">
      <!-- Pemberitahuan -->
      <div v-if="perluPresensi" class="kartu w-presensi mt-4 flex flex-wrap items-center gap-3 p-4">
        <span class="chip-ikon h-11 w-11"><PhFingerprint :size="24" weight="duotone" /></span>
        <div class="min-w-[200px] flex-1"><p class="font-bold">Presensi dulu sebelum mengabsen</p>
          <p class="text-sm text-teks2">Anda belum presensi untuk {{ d.nama_sesi.toLowerCase() }}. Presensi cukup sekali; setelah itu Anda kembali ke halaman ini.</p></div>
        <button class="tombol-utama" @click="presensiDulu"><PhFingerprint :size="20" weight="duotone" /> Presensi sekarang</button>
      </div>
      <p v-else-if="!bolehIsi" class="mt-4 rounded-xl bg-permukaan2 p-3 text-sm text-teks2">Anda melihat absensi ini tanpa hak mengisi.</p>
      <p v-else-if="belumBuka" class="mt-4 rounded-xl bg-permukaan2 p-3 text-sm font-semibold text-teks2">Absensi belum dibuka. Dibuka pukul {{ formatJam(d.buka) }} WITA.</p>
      <p v-else-if="lewatBatas" class="mt-4 rounded-xl bg-[#C7332F]/10 p-3 text-sm font-semibold text-merah">Batas pengisian dan koreksi sudah lewat. Hubungi admin untuk input atas nama.</p>
      <p v-else-if="lewatJendela" class="mt-4 rounded-xl bg-permukaan2 p-3 text-sm text-teks2">Jendela sesi sudah lewat; pengisian/koreksi masih diterima sampai {{ formatPanjang(d.tanggal) }} pukul 23.59 dan ditandai "diisi setelah jendela sesi".</p>

      <div v-if="modeAtasNama" class="kartu w-verval mt-4 p-4">
        <p class="flex items-center gap-2 font-bold"><PhUserSwitch :size="20" weight="duotone" style="color: var(--c)" /> Input atas nama pengampu</p>
        <select v-model="atasNama" class="isian mt-2" aria-label="Pengampu">
          <option v-for="p in d.pengasuh" :key="p.employee_id" :value="p.employee_id">{{ p.nama }}</option>
          <option v-if="!d.pengasuh.length" value="">Belum ada pengasuh</option>
        </select>
        <p class="mt-1 text-xs text-teks3">Tercatat "diinput oleh {{ sesi.pengguna?.nama_lengkap }} atas nama …".</p>
      </div>

      <!-- Jurnal materi ekskul -->
      <section v-if="ekskul && !perluPresensi" class="kartu w-ekskul mt-4 p-4">
        <p class="mb-3 flex items-center gap-2 font-bold"><PhNotebook :size="20" weight="duotone" style="color: var(--c)" /> Jurnal materi pertemuan</p>
        <div class="space-y-3">
          <div><label class="label-isian" for="jr-topik">Topik/materi <span class="text-merah">*</span></label>
            <input id="jr-topik" v-model="jurnal.topik" :disabled="!bolehIsi || lewatBatas" class="isian" placeholder="Contoh: Teknik menarik busur dan membidik" /></div>
          <div><label class="label-isian" for="jr-uraian">Uraian materi</label>
            <textarea id="jr-uraian" v-model="jurnal.uraian" :disabled="!bolehIsi || lewatBatas" class="isian min-h-[80px]" rows="3" placeholder="Ringkasan kegiatan dan capaian pertemuan" /></div>
          <div class="flex flex-wrap items-center gap-3">
            <img v-if="pratinjauFoto" :src="pratinjauFoto" alt="Foto kegiatan baru" class="h-24 w-32 rounded-xl object-cover" />
            <FotoBerkas v-else-if="jurnal.foto_id" :id="jurnal.foto_id" alt="Foto kegiatan ekskul" ukuran="h-24 w-32" />
            <label v-if="bolehIsi && !lewatBatas" class="tombol-garis cursor-pointer"><PhCamera :size="20" weight="duotone" /> {{ jurnal.foto_id || pratinjauFoto ? 'Ganti foto' : 'Foto kegiatan (opsional)' }}
              <input type="file" accept="image/*" capture="environment" class="sr-only" @change="pilihFoto" /></label>
          </div>
        </div>
      </section>

      <!-- Daftar santri -->
      <section v-if="!perluPresensi" class="kartu mt-4 p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <p class="flex-1 text-sm text-teks2"><b>{{ d.anggota.length }}</b> santri · semua <b>Hadir</b> kecuali yang diketuk.</p>
          <button v-if="bolehIsi && !lewatBatas" class="tombol-garis min-h-[40px] px-3 text-sm" @click="semuaHadir"><PhArrowCounterClockwise :size="18" /> Semua hadir</button>
        </div>
        <div v-if="d.anggota.length > 10" class="relative mb-2">
          <PhMagnifyingGlass :size="20" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-teks3" />
          <input v-model="cari" type="search" class="isian pl-11" placeholder="Cari nama atau NIS" aria-label="Cari santri" />
        </div>
        <ul class="divide-y divide-garis">
          <li v-for="(a, i) in tampil" :key="a.id" :class="['py-2.5', 'w-' + KODE[isian[a.id] || 'H'].w]">
            <div class="flex items-center gap-3">
              <span class="w-6 shrink-0 text-right text-xs tabular-nums text-teks3">{{ i + 1 }}</span>
              <span :class="['chip-ikon h-9 w-9 shrink-0 text-xs font-extrabold', (isian[a.id] || 'H') === 'H' ? '' : 'ring-2']" :style="(isian[a.id] || 'H') !== 'H' ? 'box-shadow: 0 0 0 2px var(--c)' : ''">{{ inisial(a.nama) }}</span>
              <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ a.nama }}<PhCrown v-if="d.kelompok.naqib_id === a.id" :size="14" weight="fill" class="ml-1 inline text-[#8C6200] dark:text-[#F2C24B]" /></span>
                <span class="block text-xs text-teks3">{{ a.nis }} · <b style="color: var(--c)">{{ KODE[isian[a.id] || 'H'].n }}</b></span></span>
              <span v-if="oto[a.id]" class="lencana shrink-0" :class="oto[a.id].sumber === 'klinik' ? 'w-klinik' : 'w-pengajuan'">
                <component :is="oto[a.id].sumber === 'klinik' ? PhFirstAidKit : PhSignOut" :size="13" weight="fill" /> {{ oto[a.id].sumber === 'klinik' ? 'Klinik' : 'Izin' }}</span>
            </div>
            <p v-if="oto[a.id]" class="mt-1.5 flex items-center gap-1.5 pl-9 text-xs text-teks2"><PhLockSimple :size="14" class="shrink-0" /> {{ oto[a.id].keterangan }} · otomatis, tidak perlu diisi</p>
            <div v-if="!oto[a.id]" class="mt-2 grid grid-cols-6 gap-1 pl-9" role="radiogroup" :aria-label="`Kehadiran ${a.nama}`">
              <button v-for="k in URUT_KODE" :key="k" type="button" role="radio" :aria-checked="(isian[a.id] || 'H') === k" :disabled="!bolehIsi || lewatBatas || belumBuka"
                :title="KODE[k].n" :aria-label="KODE[k].n" @click="setel(a.id, k)"
                :class="['min-h-[40px] rounded-xl border-2 text-sm font-extrabold transition disabled:opacity-60', 'w-' + KODE[k].w, (isian[a.id] || 'H') === k ? 'text-teks' : 'border-garis text-teks3']"
                :style="(isian[a.id] || 'H') === k ? 'border-color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c)' : ''">{{ k }}</button>
            </div>
            <input v-if="(isian[a.id] || 'H') !== 'H' && !oto[a.id]" v-model="ket[a.id]" :disabled="!bolehIsi || lewatBatas" class="isian mt-2 min-h-[40px] pl-3 text-sm" style="margin-left: 2.25rem; width: calc(100% - 2.25rem)"
              :placeholder="perluKeluhan(a.id) ? 'Keluhan singkat (wajib), mis. demam dan pusing' : `Keterangan ${KODE[isian[a.id]].n.toLowerCase()} (opsional)`" :aria-label="`Keterangan ${a.nama}`" />
            <div v-if="perluKeluhan(a.id) && bolehIsi && !lewatBatas" class="mt-1.5 flex flex-wrap items-center gap-2 pl-9 text-xs">
              <span class="flex items-center gap-1 text-teks2"><PhFirstAidKit :size="14" /> Dirujuk ke klinik, periksa:</span>
              <button v-for="w in [{ k: 'hari_ini', n: 'Hari ini' }, { k: 'besok', n: 'Besok' }]" :key="w.k" type="button" :aria-pressed="(periksa[a.id] || 'hari_ini') === w.k" @click="periksa[a.id] = w.k"
                :class="['min-h-[32px] rounded-full border px-3 font-semibold', (periksa[a.id] || 'hari_ini') === w.k ? 'border-transparent bg-[#B42A5E] text-white' : 'border-garis text-teks2']">{{ w.n }}</button>
            </div>
          </li>
        </ul>
        <p v-if="!d.anggota.length" class="py-8 text-center text-sm text-teks3">Kelompok ini belum memiliki anggota.</p>
        <div class="mt-3"><label class="label-isian" for="ab-cat">Catatan sesi (opsional)</label>
          <input id="ab-cat" v-model="catatan" :disabled="!bolehIsi || lewatBatas" class="isian" placeholder="Contoh: kegiatan dipindah ke masjid" /></div>
        <p class="mt-3 text-xs text-teks3">H Hadir · I Izin · S Sakit · B Bolos (ada di pondok tetapi tidak ikut) · A Absen (tanpa keterangan) · T Terlambat. Terlambat dan Bolos dihitung hadir.
          Santri berlabel Klinik/Izin terisi otomatis. Santri yang ditandai Sakit otomatis dirujuk ke klinik saat disimpan.</p>
      </section>

      <!-- Riwayat pengisian -->
      <details v-if="d.log.length" class="kartu w-pengajuan mt-4 p-4">
        <summary class="flex cursor-pointer items-center gap-2 font-bold"><PhClockCounterClockwise :size="20" weight="duotone" style="color: var(--c)" /> Riwayat pengisian ({{ d.log.length }})</summary>
        <ul class="mt-2 space-y-2 text-sm">
          <li v-for="(l, i) in d.log" :key="i"><b>{{ l.aksi === 'isi' ? 'Diisi' : 'Dikoreksi' }}</b> {{ formatWaktu(l.waktu) }} WITA oleh {{ l.oleh }}{{ l.atas_nama ? ` atas nama ${l.atas_nama}` : '' }}
            <span v-if="l.perubahan?.length" class="block text-teks3">{{ l.perubahan.map((p) => `${p.nama}: ${KODE[p.lama]?.n} → ${KODE[p.baru]?.n}`).join('; ') }}</span></li>
        </ul>
      </details>

      <!-- Bilah simpan -->
      <div v-if="bolehIsi && !perluPresensi && !lewatBatas && !belumBuka" class="bilah-simpan layar-saja fixed inset-x-0 z-30 border-t border-garis bg-permukaan/95 px-4 py-3 backdrop-blur lg:left-auto lg:right-6 lg:w-[30rem] lg:rounded-2xl lg:border">
        <div class="mx-auto flex max-w-3xl items-center gap-3">
          <p class="flex-1 text-sm"><b class="tabular-nums">{{ hadirDihitung }}/{{ d.anggota.length }}</b> hadir<span class="text-teks3"> · {{ d.anggota.length - hitung.H }} pengecualian</span></p>
          <button v-if="d.sesi_tercatat && penerimaWA.length && !berubah" class="tombol-garis w-presensi min-h-[44px] px-3" @click="lembarWA = true"><PhWhatsappLogo :size="20" weight="duotone" style="color: var(--c)" /> Wali</button>
          <button class="tombol-utama min-h-[44px]" :disabled="proses || (d.sesi_tercatat && !berubah)" @click="simpan">
            <component :is="d.sesi_tercatat && !berubah ? PhCheckCircle : PhFloppyDisk" :size="20" weight="duotone" />
            {{ proses ? 'Menyimpan…' : d.sesi_tercatat ? (berubah ? 'Simpan koreksi' : 'Tersimpan') : 'Simpan absensi' }}</button>
        </div>
      </div>

      </template>

      <LembarBawah v-model="lembarWA" judul="Kabari wali santri">
        <div class="pb-2">
          <p class="mb-3 text-sm text-teks2">{{ penerimaWA.length }} santri tidak hadir penuh pada sesi ini. Kirim kabar ke orang tua/wali utama (opsional).</p>
          <DaftarKirimWA :penerima="penerimaWA" :pesan="pesanKe" :kunci="`absen-${route.params.group}-${route.params.tanggal}-${route.params.sesi}`" />
          <button v-if="halaqah" class="tombol-utama mt-4 w-full" @click="lembarWA = false; gantiTab('setoran')"><PhBookOpenText :size="20" weight="duotone" /> Lanjut isi setoran</button>
        </div>
      </LembarBawah>
    </template>
    <p v-else class="py-16 text-center text-teks3">Memuat absensi…</p>
  </div>
</template>
<style scoped>
.kepala { background: linear-gradient(135deg, color-mix(in srgb, var(--c) 70%, #000) 0%, color-mix(in srgb, var(--c) 92%, #000) 60%, color-mix(in srgb, var(--c2) 80%, #000) 100%); }
:global(html.dark) .kepala { background: linear-gradient(135deg, color-mix(in srgb, var(--c) 30%, #000) 0%, color-mix(in srgb, var(--c) 42%, #000) 60%, color-mix(in srgb, var(--c2) 36%, #000) 100%); }
.bilah-simpan { bottom: calc(68px + env(safe-area-inset-bottom)); }
@media (min-width: 1024px) { .bilah-simpan { bottom: 1.5rem; } }
</style>
