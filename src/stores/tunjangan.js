// SIMKA PRO | src/stores/tunjangan.js | v1.0 | Fase 1 – Jabatan dan tunjangan | 03/10/2026
// Tarif komponen gaji (salary_rates) dengan tanggal berlaku. Hak: superadmin dan bendahara.
import { defineStore } from 'pinia'
import { supabase, MODE_DEMO } from '@/lib/supabase'
import { TARIF_DEMO } from '@/lib/demo'
import { pesanGalat } from './lembaga'

export const useTunjangan = defineStore('tunjangan', {
  state: () => ({ tarif: [], dimuat: false }),
  actions: {
    async muat() {
      if (MODE_DEMO) { if (!this.dimuat) this.tarif = TARIF_DEMO(); this.dimuat = true; return }
      const { data, error } = await supabase.from('salary_rates').select('*').order('kategori').order('berlaku_mulai', { ascending: false })
      if (error) throw new Error(pesanGalat(error))
      this.tarif = data; this.dimuat = true
    },
    /** Tarif baru atau perubahan tarif mulai tanggal tertentu (riwayat tarif lama tetap tersimpan). */
    async simpan({ kategori, kunci, nama, besaran, berlaku_mulai, keterangan }) {
      const baris = { kategori, kunci, nama, besaran: Math.round(Number(besaran)), berlaku_mulai, keterangan: keterangan || null }
      if (MODE_DEMO) {
        const i = this.tarif.findIndex((r) => r.kategori === kategori && r.kunci === kunci && r.berlaku_mulai === berlaku_mulai)
        if (i >= 0) this.tarif[i] = { ...this.tarif[i], ...baris }; else this.tarif.push({ ...baris, id: 'd' + Date.now() })
        return
      }
      const { data, error } = await supabase.from('salary_rates').upsert(baris, { onConflict: 'kategori,kunci,berlaku_mulai' }).select().single()
      if (error) throw new Error(pesanGalat(error))
      const i = this.tarif.findIndex((r) => r.id === data.id); if (i >= 0) this.tarif[i] = data; else this.tarif.push(data)
    },
    async hapus(id) {
      if (!MODE_DEMO) { const { error } = await supabase.from('salary_rates').delete().eq('id', id); if (error) throw new Error(pesanGalat(error)) }
      this.tarif = this.tarif.filter((r) => r.id !== id)
    },
  },
})
