// SIMKA PRO | src/stores/dokumenResmi.js | v1.0 | Fase 8 – Tahap 5 Penerbitan laporan resmi bertanda tangan elektronik | 10/10/2026
// Penerbitan laporan resmi: ajukan (salinan beku + kode validasi), tanda tangani/tolak oleh pimpinan, batalkan,
// cari versi resmi suatu laporan (berdasarkan kunci laporan), ambil salinan beku, dan kotak masuk tanda tangan.
// Semua hak diperiksa server (fungsi security definer + RLS registri dokumen).
import { defineStore } from 'pinia'
import { supabase, MODE_DEMO } from '@/lib/supabase'
import { pesanGalat } from './lembaga'
import { useSesi } from './sesi'

const rpc = async (nama, arg) => { const { data, error } = await supabase.rpc(nama, arg); if (error) throw new Error(pesanGalat(error)); return data }
const KOLOM = 'id, kode, jenis, jenis_nama, perihal, subjek, periode, kop_kode, status, mode_ttd, kunci, tautan, catatan, diajukan_pada, diterbitkan_pada, diterbitkan_oleh, document_signatures(id, posisi, urutan, employee_id, nama, jabatan, niy, status, waktu, catatan)'
const urutPenanda = (d) => ({ ...d, penanda: [...(d.document_signatures || d.penanda || [])].sort((a, b) => (a.posisi === b.posisi ? a.urutan - b.urutan : a.posisi === 'kiri' ? -1 : 1)) })

// ---------- Mode demo (tersimpan di memori selama halaman terbuka) ----------
const DEMO = []
const salin = (d) => JSON.parse(JSON.stringify(d))
const kodeDemo = () => { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s.slice(0, 4) + '-' + s.slice(4) }

export const useDokumenResmi = defineStore('dokumenResmi', {
  state: () => ({ masuk: [], memuatMasuk: false }),
  getters: {
    /** Permintaan tanda tangan yang masih menunggu keputusan akun ini. */
    menunggu: (s) => s.masuk.filter((x) => x.status === 'menunggu' && x.dok?.status === 'draf'),
  },
  actions: {
    /** Versi terakhir (selain yang dibatalkan) dari laporan dengan kunci tertentu yang dapat dilihat akun ini. */
    async cari(kunci) {
      if (!kunci) return null
      if (MODE_DEMO) { const d = [...DEMO].reverse().find((x) => x.kunci === kunci && x.status !== 'dicabut'); return d ? salin(d) : null }
      const { data, error } = await supabase.from('document_registry').select(KOLOM).eq('kunci', kunci).neq('status', 'dicabut')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw new Error(pesanGalat(error))
      return data ? urutPenanda(data) : null
    },
    /** Dokumen lengkap beserta salinan beku isinya. */
    async ambil(id) {
      if (MODE_DEMO) { const d = DEMO.find((x) => x.id === id); if (!d) throw new Error('Dokumen tidak ditemukan.'); return salin(d) }
      const { data, error } = await supabase.from('document_registry').select(KOLOM + ', isi').eq('id', id).maybeSingle()
      if (error) throw new Error(pesanGalat(error))
      if (!data) throw new Error('Dokumen tidak ditemukan atau Anda tidak berwenang membukanya.')
      return urutPenanda(data)
    },
    async ajukan(p) {
      if (MODE_DEMO) {
        const sesi = useSesi(); const basah = p.mode === 'basah'
        const d = urutPenanda({ id: 'demo-' + Date.now(), kode: kodeDemo(), ...p, status: basah ? 'sah' : 'draf', mode_ttd: p.mode, diajukan_pada: new Date().toISOString(),
          diterbitkan_pada: new Date().toISOString(), penanda: [
            { id: 'k1', posisi: 'kiri', urutan: 1, employee_id: sesi.pengguna?.id, nama: p.kiri.nama, jabatan: p.kiri.jabatan, niy: p.kiri.niy, status: basah ? 'ditandatangani' : 'menunggu', waktu: null, catatan: basah ? 'basah' : null },
            { id: 'k2', posisi: 'kanan', urutan: 2, employee_id: sesi.pengguna?.id, nama: sesi.pengguna?.nama_lengkap, jabatan: p.kanan_jabatan || 'Pembuat laporan', niy: sesi.pengguna?.niy, status: 'ditandatangani', waktu: basah ? null : new Date().toISOString(), catatan: basah ? 'basah' : null },
          ] })
        DEMO.filter((x) => x.kunci === p.kunci && x.status === 'draf').forEach((x) => { x.status = 'dicabut' })
        if (basah) DEMO.filter((x) => x.kunci === p.kunci && x.status === 'sah').forEach((x) => { x.status = 'direvisi' })
        DEMO.push(d); return { id: d.id, kode: d.kode, status: d.status }
      }
      return await rpc('ajukan_dokumen_resmi', { p })
    },
    async tandatangani(id, setuju, catatan = null) {
      if (MODE_DEMO) {
        const d = DEMO.find((x) => x.id === id); const k = d?.penanda.find((x) => x.status === 'menunggu'); if (!k) throw new Error('Anda tidak diminta menandatangani dokumen ini.')
        if (!setuju && (catatan || '').trim().length < 5) throw new Error('Tuliskan alasan penolakan (paling sedikit 5 karakter).')
        Object.assign(k, { status: setuju ? 'ditandatangani' : 'ditolak', waktu: new Date().toISOString(), catatan })
        if (setuju) { DEMO.filter((x) => x.kunci === d.kunci && x.status === 'sah').forEach((x) => { x.status = 'direvisi' }); Object.assign(d, { status: 'sah', diterbitkan_pada: new Date().toISOString() }) }
        else Object.assign(d, { status: 'ditolak', catatan })
        await this.muatMasuk(); return { status: d.status, kode: d.kode }
      }
      const h = await rpc('tandatangani_dokumen', { p_id: id, p_setuju: setuju, p_catatan: catatan })
      await this.muatMasuk(); return h
    },
    async batalkan(id) {
      if (MODE_DEMO) { const d = DEMO.find((x) => x.id === id); if (d) d.status = 'dicabut'; return }
      await rpc('batalkan_dokumen_resmi', { p_id: id })
    },
    /** Kotak masuk tanda tangan: permintaan untuk akun ini (menunggu dan riwayat 100 terakhir). */
    async muatMasuk() {
      this.memuatMasuk = true
      try {
        if (MODE_DEMO) {
          this.masuk = DEMO.flatMap((d) => d.penanda.filter((k) => k.posisi === 'kiri' && k.catatan !== 'basah').map((k) => ({ ...k, dok: d, pengaju: d.penanda.find((x) => x.posisi === 'kanan')?.nama })))
            .reverse(); return
        }
        const id = useSesi().pengguna?.id; if (!id) return
        const { data, error } = await supabase.from('document_signatures')
          .select('id, posisi, status, waktu, catatan, created_at, dok:document_registry!inner(id, kode, jenis_nama, perihal, periode, status, mode_ttd, tautan, diajukan_pada, diterbitkan_oleh, document_signatures(posisi, nama))')
          .eq('employee_id', id).neq('posisi', 'kanan').order('created_at', { ascending: false }).limit(100)
        if (error) throw new Error(pesanGalat(error))
        this.masuk = (data || []).filter((x) => x.dok?.diterbitkan_oleh !== id || x.status === 'menunggu')
          .map((x) => ({ ...x, pengaju: (x.dok.document_signatures || []).find((s) => s.posisi === 'kanan')?.nama }))
      } finally { this.memuatMasuk = false }
    },
  },
})
