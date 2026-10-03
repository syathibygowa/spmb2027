// SIMKA PRO | src/stores/lembaga.js | v1.1 | Fase 1 – Perbaikan | 03/10/2026
// Pengaturan lembaga: identitas, kalender, kop surat, penanda tangan, penomoran, integrasi.
// Dibaca semua pengguna masuk (kop dan penanda tangan dipakai saat mencetak);
// diubah hanya oleh superadmin (dijaga RLS di server).
import { defineStore } from 'pinia'
import { supabase, MODE_DEMO, panggilFungsi } from '@/lib/supabase'
import { LEMBAGA_DEMO } from '@/lib/demo'
import { unggahSupabase } from '@/lib/penyimpanan'

/** Pesan galat database dalam bahasa Indonesia. */
export function pesanGalat(e) {
  const k = e?.code
  if (k === '23505') return 'Data dengan kode atau nama yang sama sudah ada.'
  if (k === '42501' || /row-level security|permission/i.test(e?.message || '')) return 'Anda tidak berwenang mengubah data ini.'
  if (k === '23503') return 'Data ini masih dipakai di bagian lain sehingga tidak dapat dihapus.'
  if (k === '23514') return 'Isian tidak sesuai ketentuan. Periksa kembali format isian.'
  return e?.message || 'Terjadi kesalahan. Silakan coba lagi.'
}

const TABEL = ['letterheads', 'signatories', 'signer_rules', 'academic_years', 'holiday_calendars', 'holidays', 'doc_number_formats', 'letter_subject_codes']
const URUT = { letterheads: 'urutan', signatories: 'urutan', signer_rules: 'urutan', academic_years: 'mulai', holiday_calendars: 'jenis_tugas', holidays: 'tanggal_mulai', doc_number_formats: 'kode', letter_subject_codes: 'urutan' }

export const useLembaga = defineStore('lembaga', {
  state: () => ({
    identitas: {}, hijriah: { koreksi_hari: 0 }, integrasi: {},
    letterheads: [], signatories: [], signer_rules: [], academic_years: [], holiday_calendars: [],
    holidays: [], doc_number_formats: [], letter_subject_codes: [],
    dimuat: false, memuat: false,
  }),
  getters: {
    kop: (s) => (kode) => s.letterheads.find((k) => k.kode === kode),
    penandaTangan: (s) => (id) => s.signatories.find((x) => x.id === id),
    tahunAktif: (s) => s.academic_years.find((t) => t.aktif),
  },
  actions: {
    async muat(paksa = false) {
      if (this.dimuat && !paksa) return
      this.memuat = true
      try {
        if (MODE_DEMO) { if (!this.dimuat) this.$patch(LEMBAGA_DEMO()); return }
        const { data: set } = await supabase.from('institution_settings').select('kunci, nilai')
        for (const r of set || []) if (['identitas', 'hijriah', 'integrasi'].includes(r.kunci)) this[r.kunci] = r.nilai || {}
        const hasil = await Promise.all(TABEL.map((t) => supabase.from(t).select('*').order(URUT[t])))
        TABEL.forEach((t, i) => { if (!hasil[i].error) this[t] = hasil[i].data || [] })
      } finally { this.memuat = false; this.dimuat = true }
    },

    /** Identitas lembaga saja (publik, dipakai juga di halaman masuk untuk logo aplikasi). */
    async muatIdentitas() {
      if (this.identitas?.nama_lengkap) return
      if (MODE_DEMO) { this.identitas = LEMBAGA_DEMO().identitas; return }
      const { data } = await supabase.from('institution_settings').select('nilai').eq('kunci', 'identitas').maybeSingle()
      if (data?.nilai) this.identitas = data.nilai
    },

    /** Simpan satu kelompok pengaturan (identitas / hijriah / integrasi). */
    async simpanPengaturan(kunci, nilai) {
      if (!MODE_DEMO) {
        const { error } = await supabase.from('institution_settings').update({ nilai }).eq('kunci', kunci)
        if (error) throw new Error(pesanGalat(error))
      }
      this[kunci] = { ...nilai }
    },

    /** Tambah atau ubah satu baris. pk = nama kolom kunci; baru = true untuk baris baru. */
    async simpanBaris(tabel, baris, { pk = 'id', baru = false } = {}) {
      const isi = { ...baris }
      delete isi._baru
      let tersimpan = isi
      if (!MODE_DEMO) {
        if (baru && pk === 'id') delete isi.id
        const q = baru ? supabase.from(tabel).insert(isi) : supabase.from(tabel).update(isi).eq(pk, baris[pk])
        const { data, error } = await q.select().single()
        if (error) throw new Error(pesanGalat(error))
        tersimpan = data
      } else if (baru && pk === 'id') tersimpan = { ...isi, id: 'd' + Date.now() }
      const daftar = this[tabel]
      const i = daftar.findIndex((x) => x[pk] === tersimpan[pk])
      if (i >= 0) daftar[i] = { ...daftar[i], ...tersimpan }; else daftar.push(tersimpan)
      return tersimpan
    },

    async hapusBaris(tabel, nilai, pk = 'id') {
      if (!MODE_DEMO) {
        const { error } = await supabase.from(tabel).delete().eq(pk, nilai)
        if (error) throw new Error(pesanGalat(error))
      }
      this[tabel] = this[tabel].filter((x) => x[pk] !== nilai)
    },

    /** Hanya satu tahun ajaran aktif: nonaktifkan yang lama lebih dulu. */
    async aktifkanTahun(id) {
      if (!MODE_DEMO) {
        const lama = this.academic_years.filter((t) => t.aktif && t.id !== id)
        for (const t of lama) {
          const { error } = await supabase.from('academic_years').update({ aktif: false }).eq('id', t.id)
          if (error) throw new Error(pesanGalat(error))
        }
        const { error } = await supabase.from('academic_years').update({ aktif: true }).eq('id', id)
        if (error) throw new Error(pesanGalat(error))
      }
      this.academic_years.forEach((t) => { t.aktif = t.id === id })
    },

    /** Contoh nomor berikutnya tanpa menaikkan urutan. */
    async pratinjauNomor(format, { dk = 'D', perihal = 'NZ', kop = 'pondok' } = {}) {
      if (MODE_DEMO) {
        const f = this.doc_number_formats.find((x) => x.kode === format); if (!f) return ''
        const unit = this.kop(kop)?.kode_unit || ''
        const d = new Date(); const rom = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
        return f.pola.replace('{DK}', dk).replace('{URUT3}', '001').replace('{URUT}', '1').replace('{PERIHAL}', perihal)
          .replace('{UNIT}', unit).replace('{BLN_H_ROMAWI}', 'IV').replace('{THN_H}', '1448')
          .replace('{BLN_ROMAWI}', rom[d.getMonth()]).replace('{BLN}', String(d.getMonth() + 1).padStart(2, '0')).replace('{THN}', String(d.getFullYear()))
      }
      const { data, error } = await supabase.rpc('pratinjau_nomor', { p_format: format, p_dk: dk, p_perihal: perihal, p_kop: kop })
      if (error) throw new Error(pesanGalat(error))
      return data || ''
    },

    /** Tanggal Hijriah versi server (memakai koreksi hari yang tersimpan). */
    async hijriahServer(tanggal) {
      if (MODE_DEMO) return null
      const { data } = await supabase.rpc('hijriah', { p: tanggal })
      return data?.[0]?.teks || null
    },

    /** Unggah gambar kop/logo (≤ 1 MB) ke bucket publik; kembalikan URL publik. */
    async unggahGambar(berkas, nama) {
      if (berkas.size > 1024 * 1024) throw new Error('Ukuran gambar melebihi 1 MB. Perkecil gambar lalu coba lagi.')
      if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(berkas.type)) throw new Error('Pilih gambar berformat PNG, JPG, WEBP, atau SVG.')
      if (MODE_DEMO) return URL.createObjectURL(berkas)
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[berkas.type]
      const r = await unggahSupabase(berkas, { bucket: 'publik', path: `kop/${nama}-${Date.now()}.${ext}`, kategori: 'kop', publik: true })
      return r.url
    },

    /** Salin logo dari tautan internet ke penyimpanan sistem (Edge Function salin-logo). */
    async salinLogo(url, nama) {
      if (MODE_DEMO) return url
      const r = await panggilFungsi('salin-logo', { url, nama })
      if (!r.ok) throw new Error(r.galat || 'Logo gagal disalin.')
      return r.url
    },

    async statusLayanan() {
      if (MODE_DEMO) return { heartbeat_terakhir: new Date(Date.now() - 5 * 3600e3).toISOString(), berkas_antri: 0, berkas_gagal: 0 }
      const { data } = await supabase.rpc('statistik_beranda')
      return data || {}
    },
  },
})
