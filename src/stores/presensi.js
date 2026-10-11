// SIMKA PRO | src/stores/presensi.js | v1.3 | Fase 8 – Sesi hari ini hanya tanggal hari ini | 10/10/2026
// v1.3: getter sesiHariIni; hitungan dan sesi berikutnya hanya untuk tanggal hari ini (sesi kemarin tampil di Riwayat 14 hari).
// Presensi pegawai: sesi hari ini, periksa lokasi (waktu dan jarak dari server), kirim selfie
// ke Edge Function "presensi", dan riwayat. Server adalah penentu; tampilan hanya pratinjau.
import { defineStore } from 'pinia'
import { supabase, MODE_DEMO, kirimFormulir } from '@/lib/supabase'
import { pesanGalat } from './lembaga'
import { useAturPresensi } from './aturPresensi'
import { useSesi } from './sesi'
import { hariIniISO, sekarang, jamSekarang } from '@/lib/tanggal'
import { jendela, idPerangkat, titikTerdekat } from '@/lib/presensi'

async function rpc(nama, isi) {
  const { data, error } = await supabase.rpc(nama, isi)
  if (error) { const e = new Error(error.hint && error.message ? error.message : pesanGalat(error)); e.kode = error.hint; throw e }
  return data
}

// ---------- Mode demo: jadwal contoh pegawai (halaqah tahfizh + guru) dihitung di peramban ----------
function waktuDemo(tanggal, menit) { return new Date(new Date(`${tanggal}T00:00:00+08:00`).getTime() + menit * 60000).toISOString() }
function harianDemo(catatan) {
  const atur = useAturPresensi(); const t = hariIniISO(); const kini = sekarang()
  const sesi = atur.sesi.filter((s) => ['pl-MUHAFFIZH', 'pl-GURU'].includes(s.pattern_id) && s.aktif)
  return sesi.map((s) => {
    const j = jendela(s); const p = atur.cariPola(s.pattern_id); const c = catatan[s.id] || {}
    const w = (m) => new Date(waktuDemo(t, m))
    let keadaan
    if (c.status) keadaan = c.datang_pada && s.wajib_pulang && !c.pulang_pada && kini <= w(j.batasPulang) ? 'menunggu_pulang' : 'selesai'
    else keadaan = kini < w(j.buka) ? 'akan_datang' : kini <= w(j.tutup) ? 'terbuka' : 'terlewat'
    return { tanggal: t, session_id: s.id, nama_pola: p.nama, nama_sesi: s.nama, jenis_pola: p.jenis, warna: p.warna,
      label_datang: s.label_datang, label_pulang: s.label_pulang, mulai: waktuDemo(t, j.mulai), selesai: waktuDemo(t, j.selesai),
      buka: waktuDemo(t, j.buka), tutup: waktuDemo(t, j.tutup), pulang_buka: s.wajib_pulang ? waktuDemo(t, j.pulangBuka) : null,
      batas_pulang: s.wajib_pulang ? waktuDemo(t, j.batasPulang) : null, wajib_pulang: s.wajib_pulang, opsional: s.opsional,
      status: c.status || null, sumber: c.sumber || (c.status ? 'gps' : null), attendance_id: c.status ? 'demo-' + s.id : null, datang_pada: c.datang_pada || null, pulang_pada: c.pulang_pada || null,
      status_pulang: c.status_pulang || (c.status && s.wajib_pulang ? 'belum' : null), terlambat_menit: c.terlambat_menit || 0,
      cepat_pulang_menit: 0, keadaan }
  }).sort((a, b) => a.mulai.localeCompare(b.mulai))
}

export const useDataPresensi = defineStore('dataPresensi', {
  state: () => ({ harian: null, titik: [], riwayat: [], bulanIni: null, memuat: false, galat: '', demo: {}, demoCek: null }),
  getters: {
    sesi: (s) => s.harian?.sesi || [],
    /** Sesi wajib yang sedang terbuka dan belum dipresensi (dipakai juga oleh absensi santri di Fase 4) */
    terbuka: (s) => (s.harian?.sesi || []).filter((x) => x.keadaan === 'terbuka' && !x.opsional),
    /** Hanya sesi bertanggal hari ini (sesi lintas tengah malam dari kemarin tidak ditampilkan di daftar hari ini) */
    sesiHariIni: (s) => (s.harian?.sesi || []).filter((x) => !x.tanggal || x.tanggal === hariIniISO()),
    selesaiWajib() { return this.sesiHariIni.filter((x) => !x.opsional && x.status).length },
    jumlahWajib() { return this.sesiHariIni.filter((x) => !x.opsional).length },
    berikut() { return this.sesiHariIni.find((x) => x.keadaan === 'akan_datang') || null },
  },
  actions: {
    async muatHarian() {
      this.memuat = true; this.galat = ''
      try {
        if (MODE_DEMO) {
          const atur = useAturPresensi(); await atur.muat()
          this.titik = atur.titik
          this.harian = { tanggal: hariIniISO(), sesi: harianDemo(this.demo) }
          return
        }
        const [h, t] = await Promise.all([rpc('presensi_harian', {}), this.titik.length ? null : supabase.from('gps_points').select('id, nama, lat, lng, radius_m, aktif').eq('aktif', true)])
        this.harian = h
        if (t?.data) this.titik = t.data
      } catch (e) { this.galat = e.message } finally { this.memuat = false }
    },

    /** Cek lokasi di server: menghasilkan cek_id, waktu server, titik, jarak, dan rencana presensi. */
    async periksa(lat, lng, akurasi) {
      if (!MODE_DEMO) return await rpc('periksa_presensi', { p_lat: lat, p_lng: lng, p_akurasi: akurasi })
      const kini = sekarang(); const tt = titikTerdekat(this.titik, lat, lng)
      const sesi = harianDemo(this.demo)
      const rencana = sesi.flatMap((s) => {
        if (s.keadaan === 'terbuka') return [{ aksi: 'datang', session_id: s.session_id, nama_pola: s.nama_pola, nama_sesi: s.nama_sesi, label: s.label_datang,
          status: kini <= new Date(new Date(s.mulai).getTime() + 10 * 60000) ? 'hadir' : 'terlambat', menit: 0, perlu_konfirmasi: false }]
        if (s.keadaan === 'menunggu_pulang' && kini >= new Date(s.pulang_buka)) {
          const cepat = !s.opsional && kini < new Date(new Date(s.selesai).getTime() - 10 * 60000)
          return [{ aksi: 'pulang', session_id: s.session_id, nama_pola: s.nama_pola, nama_sesi: s.nama_sesi, label: s.label_pulang,
            status: cepat ? 'cepat' : 'tepat', menit: cepat ? Math.round((new Date(s.selesai) - kini) / 60000) : 0, perlu_konfirmasi: cepat }]
        }
        return []
      })
      // Mode demo: bila tidak ada sesi terbuka, sediakan sesi uji agar alur dapat dicoba
      if (!rencana.length) rencana.push({ aksi: 'datang', session_id: 'demo-uji', nama_pola: 'Mode demo', nama_sesi: 'Sesi uji', label: 'Hadir', status: 'hadir', menit: 0, perlu_konfirmasi: false })
      this.demoCek = { id: 'cek-' + Date.now(), rencana, di_area: tt?.diArea ?? true }
      return { cek_id: this.demoCek.id, waktu: kini.toISOString(), tanggal: hariIniISO(), jam: jamSekarang(true),
        ada_titik: !!tt, titik: tt?.nama || 'Masjid', jarak_m: tt?.jarak ?? 12, radius_m: tt?.radius_m ?? 100, di_area: tt ? tt.diArea : true,
        akurasi_m: akurasi, rencana, perlu_konfirmasi: rencana.some((r) => r.perlu_konfirmasi), sesi_berikut: null, berlaku_detik: 180 }
    },

    /** Kirim selfie + cek_id ke Edge Function. Permintaan yang sama boleh dikirim ulang (tidak membuat data dobel). */
    async kirim({ cekId, selfie, pilihan, alasan, konfirmasiCepat, permintaanId }) {
      if (MODE_DEMO) {
        await new Promise((r) => setTimeout(r, 700))
        const kini = sekarang()
        const hasil = this.demoCek.rencana.filter((r) => !r.perlu_konfirmasi || konfirmasiCepat).map((r) => ({ ...r, status: this.demoCek.di_area ? r.status : 'menunggu_verval' }))
        hasil.forEach((r) => {
          const c = this.demo[r.session_id] || (this.demo[r.session_id] = {})
          if (r.aksi === 'datang') Object.assign(c, { status: r.status, datang_pada: kini.toISOString() })
          else Object.assign(c, { pulang_pada: kini.toISOString(), status_pulang: r.status })
        })
        return { ok: true, waktu: kini.toISOString(), jam: jamSekarang(true), di_area: this.demoCek.di_area, menunggu_verval: !this.demoCek.di_area, hasil }
      }
      const f = new FormData()
      f.append('cek_id', cekId); f.append('permintaan_id', permintaanId)
      if (pilihan) f.append('pilihan', pilihan)
      if (alasan) f.append('alasan', alasan)
      f.append('konfirmasi_cepat', konfirmasiCepat ? '1' : '0')
      const perangkat = idPerangkat(); if (perangkat) f.append('perangkat_id', perangkat)
      f.append('perangkat_info', navigator.userAgent.slice(0, 280))
      f.append('selfie', selfie, 'selfie.jpg')
      return await kirimFormulir('presensi', f)
    },

    /** Izin untuk satu sesi saja (diverval admin; gugur bila pegawai tetap presensi). */
    async ajukanIzin(tanggal, sessionId, jenis, alasan) {
      if (MODE_DEMO) { this.demo[sessionId] = { status: 'menunggu_verval', sumber: 'izin_sesi' }; return }
      await rpc('ajukan_izin_sesi', { p_tanggal: tanggal, p_session: sessionId, p_jenis: jenis, p_alasan: alasan })
    },
    async batalkanIzin(attendanceId, sessionId) {
      if (MODE_DEMO) { delete this.demo[sessionId]; return }
      await rpc('batalkan_izin_sesi', { p_id: attendanceId })
    },

    /** Ringkasan kehadiran pribadi bulan berjalan (rekap_presensi; baris milik sendiri). */
    async muatBulanIni() {
      if (MODE_DEMO) { this.bulanIni = { sesi: 42, hadir: 37, terlambat: 3, izin: 1, sakit: 0, tanpa_keterangan: 1, persen: 95.2 }; return }
      const id = useSesi().pengguna?.id; const t = hariIniISO()
      try { const d = await rpc('rekap_presensi', { p_mulai: t.slice(0, 8) + '01', p_akhir: t }); this.bulanIni = (d || []).find((r) => r.employee_id === id) || null } catch { this.bulanIni = null }
    },

    async muatRiwayat(hari = 14) {
      if (MODE_DEMO) { this.riwayat = []; return }
      const id = useSesi().pengguna?.id; if (!id) return
      const dari = new Date(Date.now() - hari * 86400000).toISOString().slice(0, 10)
      const { data, error } = await supabase.from('attendances')
        .select('id, tanggal, nama_pola, nama_sesi, jadwal_mulai, status, terlambat_menit, status_pulang, cepat_pulang_menit, datang_pada, pulang_pada, opsional, keterangan')
        .eq('employee_id', id).gte('tanggal', dari).order('tanggal', { ascending: false }).order('jadwal_mulai')
      if (!error) this.riwayat = data
    },
  },
})
