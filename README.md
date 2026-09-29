# Situs SPMB 2027/2028

Pondok Pesantren Tahfizhul Qur'an Imam Asy-Syathiby Wahdah Islamiyah Gowa

Alamat situs: https://syathibygowa.github.io/spmb2027

## Susunan berkas

| Berkas / folder | Isi |
| --- | --- |
| `index.html` | Halaman publik (landing page lengkap menyusul di Fase 2) |
| `masuk.html` | Halaman masuk panitia dan lupa kata sandi |
| `atur-sandi.html` | Halaman membuat kata sandi baru dari tautan email |
| `dashboard.html` | Dashboard panitia (Superadmin, Admin, Penguji) |
| `assets/js/config.js` | Alamat Supabase dan publishable key |
| `assets/js/core.js` | Fungsi bersama: tema, format tanggal, cetak F4 |
| `assets/js/dashboard.js` | Seluruh menu dashboard |
| `assets/css/app.css` | Warna, tampilan desktop dan HP, cetak F4 |
| `assets/img/logo-pondok.png` | Logo pondok (unggah sendiri dengan nama ini) |
| `assets/vendor/` | Pustaka Supabase dan ikon Phosphor (tanpa CDN) |
| `supabase/functions/kelola-pengguna/` | Kode Edge Function pengelola akun (dipasang di Supabase, bukan di sini) |

## Catatan keamanan

- `config.js` hanya berisi **publishable key**, yang memang aman bersifat publik.
- **Jangan** menaruh Secret key / service_role key di repositori ini.
- Hak akses data dijaga oleh aturan Row Level Security di database Supabase.

Versi 1.0.0 · Fase 1 (Fondasi dan Desain)
