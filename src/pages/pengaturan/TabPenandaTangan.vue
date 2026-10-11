<!-- SIMKA PRO | src/pages/pengaturan/TabPenandaTangan.vue | v1.2 | Fase 8 – Akun pegawai penanda tangan (tanda tangan elektronik) | 10/10/2026 -->
<script setup>
import { ref, onMounted } from 'vue'
import { PhPlus, PhPencilSimple, PhFloppyDisk, PhTrash, PhLink } from '@phosphor-icons/vue'
import { useLembaga } from '@/stores/lembaga'
import { useOrganisasi } from '@/stores/organisasi'
import { usePegawai } from '@/stores/pegawai'
import { useUI } from '@/stores/ui'
import LembarBawah from '@/components/LembarBawah.vue'

// v1.2: pejabat yang diisi manual dapat ditautkan ke akun pegawai agar dapat menandatangani laporan resmi secara elektronik.
const lembaga = useLembaga(); const ui = useUI(); const org = useOrganisasi(); const peg = usePegawai()
onMounted(() => { org.muat(); if (!peg.daftar.length) peg.muat() })
function pilihAkun(id) { const p = peg.cari(id); f.value.employee_id = id || null; if (p) { f.value.nama = p.nama_lengkap; f.value.niy = p.niy || '' } }
const namaJabatan = (kode) => org.struktural.find((x) => x.kode === kode)?.nama || kode
const galat = (e) => ui.toast(e.message, 'galat')

// ---------- Daftar pejabat penanda tangan ----------
const lembar = ref(false); const f = ref({})
function buka(s = null) { f.value = s ? { ...s } : { _baru: true, jabatan_tertulis: '', nama: '', niy: '', aktif: true, urutan: lembaga.signatories.length + 1, sumber_jabatan: '', sumber_unit_id: '', employee_id: null }; lembar.value = true }
async function simpan() {
  const s = f.value
  if (!s.jabatan_tertulis?.trim() || (!s.sumber_jabatan && !s.nama?.trim())) return ui.toast('Jabatan dan nama lengkap wajib diisi.', 'galat')
  try {
    await lembaga.simpanBaris('signatories', { id: s.id, jabatan_tertulis: s.jabatan_tertulis.trim(), nama: s.nama?.trim() || '-', niy: s.niy?.trim() || null, aktif: s.aktif, urutan: s.urutan,
      sumber_jabatan: s.sumber_jabatan || null, sumber_unit_id: s.sumber_unit_id || null, employee_id: s.employee_id || null }, { baru: !!s._baru })
    lembar.value = false; ui.toast('Penanda tangan disimpan.')
  } catch (e) { galat(e) }
}
async function hapus(s) {
  const dipakai = lembaga.signer_rules.some((r) => r.kiri === s.id || r.kanan === s.id)
  if (dipakai) return ui.toast('Pejabat ini masih dipakai pada aturan dokumen di bawah. Ganti dulu aturannya, atau nonaktifkan saja.', 'galat')
  if (!(await ui.konfirmasi({ judul: 'Hapus penanda tangan?', pesan: `${s.jabatan_tertulis}: ${s.nama}. Dokumen lama tetap mencetak nama pejabat saat itu.`, ya: 'Hapus', bahaya: true }))) return
  try { await lembaga.hapusBaris('signatories', s.id); ui.toast('Penanda tangan dihapus.') } catch (e) { galat(e) }
}

// ---------- Aturan per jenis dokumen ----------
const PERAN = {
  '': 'Tidak ada', atasan_terakhir: 'Atasan terakhir yang menyetujui', pemohon: 'Pemohon', pencetak: 'Pencetak dokumen',
  kepala_bidang: 'Kepala bidang', pengusul: 'Pengusul', kepala_jenjang: 'Kepala sesuai jenjang', pengasuh: 'Pengasuh kelompok',
  bendahara: 'Bendahara', pegawai: 'Pegawai bersangkutan', sesuai_template: 'Sesuai template surat',
}
async function ubahAturan(r, kolom, nilai) {
  try { await lembaga.simpanBaris('signer_rules', { jenis_dokumen: r.jenis_dokumen, [kolom]: nilai || null }, { pk: 'jenis_dokumen' }); ui.toast(`Aturan ${r.nama_dokumen} diperbarui.`) }
  catch (e) { galat(e) }
}
</script>
<template>
  <div class="space-y-5">
    <section class="kartu p-5">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 class="judul-bagian">Pejabat penanda tangan</h3><p class="text-sm text-teks3">Pejabat yang ditautkan ke jabatan struktural mengikuti Data Pegawai secara otomatis; yang lain diubah manual di sini.</p></div>
        <button class="tombol-garis" @click="buka()"><PhPlus :size="18" weight="bold" /> Tambah pejabat</button>
      </div>
      <ul class="divide-y divide-garis">
        <li v-for="s in lembaga.signatories" :key="s.id" class="flex items-center gap-3 py-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm text-teks3">{{ s.jabatan_tertulis }}</p>
            <p :class="['font-semibold', !s.aktif && 'text-teks3 line-through']">{{ s.nama }}</p>
            <p class="text-sm text-teks3">NIY {{ s.niy || '–' }}<template v-if="!s.aktif"> – nonaktif</template></p>
            <p v-if="!s.employee_id" class="mt-0.5 text-xs font-semibold text-[rgb(var(--merah))]">Belum terhubung akun pegawai – hanya untuk tanda tangan basah</p>
            <p v-if="s.sumber_jabatan" class="w-pegawai mt-0.5 flex items-center gap-1 text-xs font-semibold" style="color: var(--c)"><PhLink :size="14" weight="bold" /> Mengikuti jabatan {{ namaJabatan(s.sumber_jabatan) }}{{ s.sumber_unit_id ? ' – ' + (org.cariUnit(s.sumber_unit_id)?.nama || '') : '' }}</p>
          </div>
          <button class="tombol-ikon" @click="buka(s)" :aria-label="`Ubah ${s.nama}`"><PhPencilSimple :size="20" /></button>
          <button class="tombol-ikon" @click="hapus(s)" :aria-label="`Hapus ${s.nama}`"><PhTrash :size="20" /></button>
        </li>
      </ul>
    </section>

    <section class="kartu p-5">
      <h3 class="judul-bagian">Penanda tangan per jenis dokumen</h3>
      <p class="mb-3 text-sm text-teks3">Kolom kiri untuk pimpinan atau atasan, kolom kanan untuk pegawai terkait. Perubahan langsung tersimpan.</p>
      <div class="space-y-3">
        <div v-for="r in lembaga.signer_rules" :key="r.jenis_dokumen" class="rounded-xl border border-garis p-3">
          <p class="mb-2 font-semibold">{{ r.nama_dokumen }}</p>
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label class="text-xs font-semibold text-teks3">Kolom kiri
              <select class="isian mt-1 text-sm font-normal text-teks" :value="r.kiri || ''" @change="ubahAturan(r, 'kiri', $event.target.value)">
                <optgroup label="Pejabat"><option v-for="s in lembaga.signatories.filter((x) => x.aktif)" :key="s.id" :value="s.id">{{ s.jabatan_tertulis }}</option></optgroup>
                <optgroup label="Sesuai dokumen"><option v-for="(n, k) in PERAN" :key="k" :value="k">{{ n }}</option></optgroup>
              </select></label>
            <label class="text-xs font-semibold text-teks3">Kolom kanan
              <select class="isian mt-1 text-sm font-normal text-teks" :value="r.kanan || ''" @change="ubahAturan(r, 'kanan', $event.target.value)">
                <optgroup label="Pejabat"><option v-for="s in lembaga.signatories.filter((x) => x.aktif)" :key="s.id" :value="s.id">{{ s.jabatan_tertulis }}</option></optgroup>
                <optgroup label="Sesuai dokumen"><option v-for="(n, k) in PERAN" :key="k" :value="k">{{ n }}</option></optgroup>
              </select></label>
            <label class="text-xs font-semibold text-teks3">Mode tanda tangan
              <select class="isian mt-1 text-sm font-normal text-teks" :value="r.mode" @change="ubahAturan(r, 'mode', $event.target.value)">
                <option value="elektronik">Elektronik (kode validasi)</option><option value="basah">Basah</option>
              </select></label>
            <label class="text-xs font-semibold text-teks3">Kop surat
              <select class="isian mt-1 text-sm font-normal text-teks" :value="r.kop_kode" @change="ubahAturan(r, 'kop_kode', $event.target.value)">
                <option v-for="k in lembaga.letterheads" :key="k.kode" :value="k.kode">{{ k.nama }}</option>
              </select></label>
          </div>
        </div>
      </div>
    </section>

    <LembarBawah v-model="lembar" :judul="f._baru ? 'Tambah pejabat' : 'Ubah pejabat'">
      <div class="space-y-4 pb-2">
        <div><label class="label-isian" for="pt-jab">Jabatan (seperti tertulis di dokumen)</label><input id="pt-jab" v-model="f.jabatan_tertulis" class="isian" placeholder="Contoh: Wakil Direktur" /></div>
        <div><label class="label-isian" for="pt-sumber">Ambil nama dari jabatan struktural</label>
          <select id="pt-sumber" v-model="f.sumber_jabatan" class="isian"><option value="">Tidak – isi nama manual</option>
            <option v-for="j in org.struktural" :key="j.id" :value="j.kode">{{ j.nama }}</option></select>
          <p class="mt-1 text-xs text-teks3">Nama dan NIY otomatis mengikuti pegawai yang memegang jabatan ini di Data Pegawai.</p></div>
        <div v-if="f.sumber_jabatan"><label class="label-isian" for="pt-unit">Untuk bidang/unit (opsional)</label>
          <select id="pt-unit" v-model="f.sumber_unit_id" class="isian"><option value="">Bidang/unit mana saja</option>
            <option v-for="u in org.datar" :key="u.id" :value="u.id">{{ '— '.repeat(u.tingkat) }}{{ u.nama }}</option></select></div>
        <template v-if="!f.sumber_jabatan">
          <div><label class="label-isian" for="pt-akun">Akun pegawai (untuk tanda tangan elektronik)</label>
            <select id="pt-akun" class="isian" :value="f.employee_id || ''" @change="pilihAkun($event.target.value)"><option value="">Tidak ditautkan</option>
              <option v-for="p in peg.daftar.filter((x) => x.status_akun === 'aktif')" :key="p.id" :value="p.id">{{ p.niy ? p.niy + ' – ' : '' }}{{ p.nama_lengkap }}</option></select>
            <p class="mt-1 text-xs text-teks3">Pejabat yang tertaut dapat menyetujui laporan resmi dari akunnya sendiri.</p></div>
          <div><label class="label-isian" for="pt-nama">Nama lengkap bergelar</label><input id="pt-nama" v-model="f.nama" class="isian" /></div>
          <div><label class="label-isian" for="pt-niy">NIY/NIP</label><input id="pt-niy" v-model="f.niy" class="isian" inputmode="numeric" /></div>
        </template>
        <p v-else class="rounded-xl bg-permukaan2 p-3 text-sm text-teks2">Saat ini: {{ f.nama || '–' }} (NIY {{ f.niy || '–' }}). Bila belum ada pemegang jabatan, nama terakhir tetap dipakai.</p>
        <label class="flex min-h-[44px] items-center gap-3 font-semibold"><input v-model="f.aktif" type="checkbox" class="h-5 w-5 accent-[#C7332F]" /> Aktif sebagai penanda tangan</label>
        <button class="tombol-utama w-full" @click="simpan"><PhFloppyDisk :size="20" weight="duotone" /> Simpan</button>
      </div>
    </LembarBawah>
  </div>
</template>
