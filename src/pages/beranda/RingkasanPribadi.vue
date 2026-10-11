<!-- SIMKA PRO | src/pages/beranda/RingkasanPribadi.vue | v1.2 | Fase 8 – Kartu dokumen menunggu tanda tangan | 11/10/2026 -->
<script setup>
// Kartu beranda pribadi (semua pegawai): jurnal hari ini, pengajuan, agenda terdekat, pengumuman dan berkas baru.
// v1.2: kartu menonjol "Dokumen menunggu tanda tangan Anda" (laporan resmi) bila ada.
import { computed, onMounted } from 'vue'
import { PhSignature } from '@phosphor-icons/vue'
import { useDokumenResmi } from '@/stores/dokumenResmi'
import { PhNotebook, PhFileText, PhCalendarCheck, PhMegaphone, PhFolderOpen, PhCaretRight, PhWarningCircle, PhUmbrella, PhPushPin } from '@phosphor-icons/vue'
import { formatHari, formatPendek } from '@/lib/tanggal'

const props = defineProps({ d: { type: Object, default: () => ({}) } })
const j = computed(() => props.d.jurnal || {})
const persen = computed(() => (j.value.butir_total ? Math.round((100 * j.value.butir_selesai) / j.value.butir_total) : 0))
const jam = (v) => (v ? String(v).slice(0, 5).replace(':', '.') : '')
const STATUS = { menunggu: 'menunggu', disetujui: 'disetujui' }
const dr = useDokumenResmi()
onMounted(() => dr.muatMasuk().catch(() => {}))
</script>
<template>
  <router-link v-if="dr.menunggu.length" to="/rekap/tandatangan" class="kartu w-pengajuan mb-3 flex items-center gap-3 border-l-4 border-l-[color:var(--c)] p-4 hover:-translate-y-0.5 hover:shadow-apung">
    <span class="chip-ikon h-11 w-11 shrink-0"><PhSignature :size="24" weight="duotone" /></span>
    <span class="min-w-0 flex-1"><span class="block font-bold">{{ dr.menunggu.length }} dokumen menunggu tanda tangan Anda</span>
      <span class="block truncate text-sm text-teks2">{{ dr.menunggu.slice(0, 2).map((x) => x.dok.perihal + (x.dok.periode ? ' (' + x.dok.periode + ')' : '')).join(' · ') }}</span></span>
    <PhCaretRight :size="18" class="text-teks3" />
  </router-link>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <!-- Jurnal -->
    <router-link to="/jurnal" class="kartu w-tatausaha flex flex-col p-4 hover:-translate-y-0.5 hover:shadow-apung">
      <div class="flex items-center gap-2"><span class="chip-ikon h-10 w-10"><PhNotebook :size="22" weight="duotone" /></span><p class="flex-1 font-bold">Jurnal hari ini</p><PhCaretRight :size="18" class="text-teks3" /></div>
      <template v-if="j.wajib || j.butir_total">
        <p class="mt-3 text-2xl font-extrabold tabular-nums">{{ j.butir_selesai || 0 }}<span class="text-sm font-semibold text-teks3"> / {{ j.butir_total || 0 }} butir</span></p>
        <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-permukaan2"><div class="h-full rounded-full" :style="{ width: persen + '%', background: 'var(--c)' }" /></div>
        <p class="mt-1.5 text-xs text-teks2">{{ j.kegiatan || 0 }} kegiatan tambahan</p>
      </template>
      <p v-else class="mt-3 text-sm text-teks2">Bukan hari wajib jurnal.</p>
      <p v-if="j.dikembalikan" class="mt-2 flex items-center gap-1 text-xs font-bold text-[rgb(var(--merah))]"><PhWarningCircle :size="16" weight="fill" /> {{ j.dikembalikan }} kegiatan perlu diperbaiki</p>
      <p v-else-if="j.kemarin_kosong" class="mt-2 flex items-center gap-1 text-xs font-bold text-[rgb(var(--merah))]"><PhWarningCircle :size="16" weight="fill" /> Jurnal kemarin belum diisi (batas hari ini)</p>
    </router-link>

    <!-- Pengajuan -->
    <router-link :to="d.pengajuan_terakhir ? `/pengajuan/${d.pengajuan_terakhir.id}` : '/pengajuan'" class="kartu w-pengajuan flex flex-col p-4 hover:-translate-y-0.5 hover:shadow-apung">
      <div class="flex items-center gap-2"><span class="chip-ikon h-10 w-10"><PhFileText :size="22" weight="duotone" /></span><p class="flex-1 font-bold">Pengajuan</p><PhCaretRight :size="18" class="text-teks3" /></div>
      <p v-if="d.sedang_cuti" class="mt-3 flex items-center gap-1.5 text-sm font-bold"><PhUmbrella :size="18" weight="duotone" style="color: var(--c)" /> Sedang {{ d.sedang_cuti }}</p>
      <template v-else-if="d.pengajuan_terakhir">
        <p class="mt-3 font-bold">{{ d.pengajuan_terakhir.jenis }} · {{ STATUS[d.pengajuan_terakhir.status] }}</p>
        <p class="text-sm text-teks2">{{ formatPendek(d.pengajuan_terakhir.mulai) }}{{ d.pengajuan_terakhir.selesai > d.pengajuan_terakhir.mulai ? ' s.d. ' + formatPendek(d.pengajuan_terakhir.selesai) : '' }}</p>
        <p v-if="d.pengajuan_terakhir.status === 'menunggu'" class="text-xs text-teks3">Menunggu {{ d.pengajuan_terakhir.jenjang }}</p>
      </template>
      <p v-else class="mt-3 text-sm text-teks2">Tidak ada pengajuan aktif.</p>
      <p v-if="d.cuti_sisa" class="mt-auto pt-2 text-xs font-semibold text-teks2">Sisa {{ d.cuti_sisa.nama.toLowerCase() }}: {{ d.cuti_sisa.sisa }} dari {{ d.cuti_sisa.kuota }} hari</p>
    </router-link>

    <!-- Agenda -->
    <router-link :to="d.agenda?.[0] ? { path: `/agenda/${d.agenda[0].id}`, query: { tanggal: d.agenda[0].mulai } } : '/agenda'" class="kartu w-agenda flex flex-col p-4 hover:-translate-y-0.5 hover:shadow-apung">
      <div class="flex items-center gap-2"><span class="chip-ikon h-10 w-10"><PhCalendarCheck :size="22" weight="duotone" /></span><p class="flex-1 font-bold">Agenda terdekat</p><PhCaretRight :size="18" class="text-teks3" /></div>
      <ul v-if="d.agenda?.length" class="mt-2 space-y-1.5">
        <li v-for="a in d.agenda.slice(0, 2)" :key="a.id" class="text-sm"><span class="block truncate font-semibold">{{ a.judul }}</span>
          <span class="block text-xs text-teks3">{{ formatHari(a.mulai) }}{{ a.jam_mulai ? ' · ' + jam(a.jam_mulai) : '' }}</span></li>
      </ul>
      <p v-else class="mt-3 text-sm text-teks2">Belum ada agenda.</p>
      <p v-if="d.libur_berikut" class="mt-auto pt-2 text-xs font-semibold text-[rgb(var(--merah))]">Libur: {{ d.libur_berikut.nama }} ({{ formatPendek(d.libur_berikut.mulai) }})</p>
    </router-link>

    <!-- Pengumuman & berkas -->
    <div class="kartu flex flex-col gap-2 p-4">
      <router-link :to="d.pengumuman_terbaru ? `/pengumuman/${d.pengumuman_terbaru.id}` : '/pengumuman'" class="w-pengumuman flex items-center gap-2 rounded-xl p-1 hover:bg-permukaan2">
        <span class="chip-ikon h-10 w-10 shrink-0"><component :is="d.pengumuman_terbaru?.penting ? PhPushPin : PhMegaphone" :size="22" weight="duotone" /></span>
        <span class="min-w-0 flex-1"><span class="block font-bold">Pengumuman <span v-if="d.pengumuman_belum" class="lencana ml-1">{{ d.pengumuman_belum }} baru</span></span>
          <span class="block truncate text-xs text-teks3">{{ d.pengumuman_terbaru?.judul || 'Tidak ada pengumuman aktif' }}</span></span>
      </router-link>
      <router-link to="/berkas" class="w-berkas flex items-center gap-2 rounded-xl p-1 hover:bg-permukaan2">
        <span class="chip-ikon h-10 w-10 shrink-0"><PhFolderOpen :size="22" weight="duotone" /></span>
        <span class="min-w-0 flex-1"><span class="block font-bold">Berkas Saya <span v-if="d.berkas_baru" class="lencana ml-1">{{ d.berkas_baru }} baru</span></span>
          <span class="block text-xs text-teks3">{{ d.berkas_baru ? 'Ada berkas yang belum dibuka' : 'Semua berkas sudah dibuka' }}</span></span>
      </router-link>
    </div>
  </div>
</template>
