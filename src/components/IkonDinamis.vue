<!-- SIMKA PRO | src/components/IkonDinamis.vue | v1.5 | Fase 8 – Ikon permintaan tanda tangan | 10/10/2026 -->
<script setup>
// Ikon berdasarkan nama (dipakai notifikasi dari database, kolom "ikon").
import {
  PhBell, PhUserPlus, PhCheckCircle, PhWarningCircle, PhPrinter, PhCloudArrowUp, PhFingerprint,
  PhListChecks, PhInfo, PhFileText, PhMegaphone, PhKey, PhCalendarCheck, PhShieldCheck, PhArrowsLeftRight, PhMapPin, PhClock,
  PhPushPin, PhCalendarStar, PhNotebook, PhFolderOpen, PhIdentificationCard, PhSealCheck, PhXCircle,
  PhClipboardText, PhEnvelopeSimple, PhStamp, PhFile, PhCertificate, PhFolder, PhBooks, PhReceipt, PhScroll, PhGraduationCap, PhImage, PhHandshake,
  PhSignOut, PhSignIn, PhSiren, PhFirstAidKit, PhPackage, PhUsers, PhDoorOpen, PhProhibit, PhBuildings, PhChatCircleText, PhTray, PhNotePencil, PhSignature,
} from '@phosphor-icons/vue'
const PETA = {
  Bell: PhBell, UserPlus: PhUserPlus, CheckCircle: PhCheckCircle, WarningCircle: PhWarningCircle,
  Printer: PhPrinter, CloudArrowUp: PhCloudArrowUp, Fingerprint: PhFingerprint, ListChecks: PhListChecks,
  Info: PhInfo, FileText: PhFileText, Megaphone: PhMegaphone, Key: PhKey, CalendarCheck: PhCalendarCheck,
  ShieldCheck: PhShieldCheck, ArrowsLeftRight: PhArrowsLeftRight, MapPin: PhMapPin, Clock: PhClock,
  PushPin: PhPushPin, CalendarStar: PhCalendarStar, Notebook: PhNotebook, FolderOpen: PhFolderOpen,
  IdentificationCard: PhIdentificationCard, SealCheck: PhSealCheck, XCircle: PhXCircle,
  ClipboardText: PhClipboardText, EnvelopeSimple: PhEnvelopeSimple, Stamp: PhStamp, File: PhFile, Certificate: PhCertificate, Folder: PhFolder,
  Books: PhBooks, Receipt: PhReceipt, Scroll: PhScroll, GraduationCap: PhGraduationCap, Image: PhImage, Handshake: PhHandshake,
  SignOut: PhSignOut, SignIn: PhSignIn, Siren: PhSiren, FirstAidKit: PhFirstAidKit, Package: PhPackage, Users: PhUsers, DoorOpen: PhDoorOpen,
  NotePencil: PhNotePencil, Prohibit: PhProhibit, Buildings: PhBuildings, ChatCircleText: PhChatCircleText, Tray: PhTray, Signature: PhSignature,
}
defineProps({ nama: { type: String, default: 'Bell' }, size: { type: Number, default: 22 } })
</script>
<script>
// Ikon yang dapat dipilih untuk kategori berkas
export const IKON_KATEGORI = ['Info', 'ClipboardText', 'EnvelopeSimple', 'Stamp', 'File', 'Certificate', 'Folder', 'Books', 'Receipt', 'Scroll', 'GraduationCap', 'Image', 'Handshake', 'Megaphone']
</script>
<template>
  <component :is="PETA[nama] || PhBell" :size="size" weight="duotone" aria-hidden="true" />
</template>
