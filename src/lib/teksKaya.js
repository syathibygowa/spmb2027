// SIMKA PRO | src/lib/teksKaya.js | v1.0 | Fase 8 – Teks tebal dan miring (pengumuman, kelak persuratan) | 10/10/2026
// Format sederhana mengikuti kebiasaan WhatsApp sehingga tetap rapi saat dibagikan lewat WA:
//   *teks tebal*   _teks miring_   (boleh digabung: *_tebal miring_*)
// Teks selalu di-escape lebih dulu sebelum diubah menjadi HTML, sehingga aman ditampilkan dengan v-html.
// Penanda hanya dikenali bila menempel pada kata (tidak diawali/diakhiri spasi) dan tidak melewati baris baru,
// sehingga tanda bintang atau garis bawah biasa (mis. pada alamat surel atau tautan) tidak ikut berubah.

const escape = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const pola = (t) => new RegExp(`(^|[\\s(\\[{"'>])\\${t}([^\\s${t}](?:[^${t}\\n]*?[^\\s${t}])?)\\${t}(?=$|[\\s.,;:!?)\\]}"'<])`, 'gm')
const TEBAL = pola('*'); const MIRING = pola('_')

/** Teks berpenanda → HTML aman (tebal <strong>, miring <em>). Baris baru dipertahankan oleh CSS white-space: pre-line. */
export function teksKaya(s) {
  return escape(s).replace(TEBAL, '$1<strong>$2</strong>').replace(MIRING, '$1<em>$2</em>')
}

/** Teks berpenanda → teks polos tanpa penanda (untuk cuplikan, pencarian, dan notifikasi). */
export function teksPolos(s) {
  return String(s ?? '').replace(TEBAL, '$1$2').replace(MIRING, '$1$2')
}

/**
 * Bungkus/lepas penanda pada pilihan teks di <textarea>.
 * jenis: 'tebal' | 'miring' | 'normal' (melepas semua penanda di pilihan). Mengembalikan { nilai, awal, akhir }.
 */
export function terapkanGaya(nilai, awal, akhir, jenis) {
  let a = awal; let b = akhir
  // Pilihan kosong: ambil kata di sekitar kursor
  if (a === b) {
    while (a > 0 && !/\s/.test(nilai[a - 1])) a--
    while (b < nilai.length && !/\s/.test(nilai[b])) b++
  }
  // Abaikan spasi di tepi pilihan
  while (a < b && /\s/.test(nilai[a])) a++
  while (b > a && /\s/.test(nilai[b - 1])) b--
  const pilih = nilai.slice(a, b)
  if (jenis === 'normal') {
    const polos = pilih.replace(/[*_]/g, '')
    let kiri = a; let kanan = b
    while (kiri > 0 && /[*_]/.test(nilai[kiri - 1]) && /[*_]/.test(nilai[kanan] || '')) { kiri--; kanan++ }
    return { nilai: nilai.slice(0, kiri) + polos + nilai.slice(kanan), awal: kiri, akhir: kiri + polos.length }
  }
  const t = jenis === 'tebal' ? '*' : '_'
  if (!pilih) {
    const isi = nilai.slice(0, a) + t + t + nilai.slice(b)
    return { nilai: isi, awal: a + 1, akhir: a + 1 }
  }
  // Sudah berpenanda → lepas (tombol berfungsi sebagai sakelar)
  if (pilih.length > 2 && pilih.startsWith(t) && pilih.endsWith(t)) {
    const isi = pilih.slice(1, -1)
    return { nilai: nilai.slice(0, a) + isi + nilai.slice(b), awal: a, akhir: a + isi.length }
  }
  if (nilai[a - 1] === t && nilai[b] === t) {
    return { nilai: nilai.slice(0, a - 1) + pilih + nilai.slice(b + 1), awal: a - 1, akhir: b - 1 }
  }
  // Penanda per baris agar tidak melewati baris baru
  const isi = pilih.split('\n').map((l) => (l.trim() ? l.replace(/^(\s*)(.*?)(\s*)$/, `$1${t}$2${t}$3`) : l)).join('\n')
  return { nilai: nilai.slice(0, a) + isi + nilai.slice(b), awal: a, akhir: a + isi.length }
}
