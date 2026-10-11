// SIMKA PRO | src/stores/dokumen.js | v1.1 | Fase 8 – Tahap 5 tautan versi resmi laporan | 10/10/2026
// Registri dokumen resmi (surat pengajuan, surat keterangan sakit, laporan resmi) dan pemeriksaan keabsahan publik.
import { defineStore } from 'pinia'
import { supabase, MODE_DEMO } from '@/lib/supabase'
import { pesanGalat } from './lembaga'
import { DOKUMEN_DEMO } from '@/lib/demoDokumen'

const rpc = async (nama, arg) => { const { data, error } = await supabase.rpc(nama, arg); if (error) throw new Error(pesanGalat(error)); return data }

export const useDokumen = defineStore('dokumen', {
  state: () => ({ daftar: [], memuat: false }),
  actions: {
    /** Pemeriksaan keabsahan (publik, tanpa masuk). */
    async cek(kode) {
      if (MODE_DEMO) {
        const k = String(kode || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const d = DOKUMEN_DEMO.find((x) => x.kode.replace('-', '') === k)
        return d ? { ditemukan: true, ...d, penanda: d.penanda.filter((p) => p.status === 'ditandatangani'), sidik: '8f3a91c2d47e0b65', lembaga: "Pondok Pesantren Tahfizhul Qur'an Imam Asy-Syathiby Wahdah Islamiyah Gowa" }
          : { ditemukan: false, kode }
      }
      return await rpc('cek_dokumen', { p_kode: kode })
    },
    /** Daftar dokumen terbit (admin/superadmin: semua; pegawai: yang diterbitkan atau ditandatanganinya). */
    async muat({ mulai, selesai, jenis, status } = {}) {
      this.memuat = true
      try {
        if (MODE_DEMO) { this.daftar = DOKUMEN_DEMO.map((d) => ({ ...d })); return }
        let q = supabase.from('document_registry')
          .select('id, kode, jenis, jenis_nama, nomor, perihal, subjek, periode, status, diterbitkan_pada, dicabut_pada, alasan_cabut, ref_tabel, tautan, mode_ttd, catatan, jumlah_cek, terakhir_dicek, document_signatures(nama, jabatan, status, waktu, posisi, urutan)')
          .order('diterbitkan_pada', { ascending: false }).limit(1000)
        if (mulai) q = q.gte('diterbitkan_pada', mulai + 'T00:00:00+08:00')
        if (selesai) q = q.lte('diterbitkan_pada', selesai + 'T23:59:59+08:00')
        if (jenis) q = q.eq('jenis', jenis)
        if (status) q = q.eq('status', status)
        const { data, error } = await q
        if (error) throw new Error(pesanGalat(error))
        this.daftar = (data || []).map((d) => ({ ...d, penanda: (d.document_signatures || []).sort((a, b) => (a.posisi === b.posisi ? a.urutan - b.urutan : a.posisi === 'kiri' ? -1 : 1)) }))
      } finally { this.memuat = false }
    },
    async cabut(id, alasan) {
      if (MODE_DEMO) { const d = this.daftar.find((x) => x.id === id); if (d) Object.assign(d, { status: 'dicabut', alasan_cabut: alasan, dicabut_pada: new Date().toISOString() }); return }
      await rpc('cabut_dokumen', { p_id: id, p_alasan: alasan })
      const d = this.daftar.find((x) => x.id === id); if (d) Object.assign(d, { status: 'dicabut', alasan_cabut: alasan, dicabut_pada: new Date().toISOString() })
    },
  },
})
