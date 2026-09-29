/* =====================================================================
   KONFIGURASI SITUS SPMB
   Berkas ini aman bersifat publik. Publishable key memang dirancang
   untuk dipasang di situs; keamanan data dijaga oleh aturan akses
   (Row Level Security) di database.
   JANGAN pernah menaruh Secret key / service_role key di berkas ini.
   ===================================================================== */
window.SPMB_CONFIG = {
  supabaseUrl: 'https://fhnkjzjrdxwbzdjkdopa.supabase.co',
  supabaseKey: 'sb_publishable_F5RxacaK3vxRFsxykAHE8Q_1--iFxxv',

  // Alamat situs setelah tayang (dipakai untuk tautan atur ulang kata sandi)
  alamatSitus: 'https://syathibygowa.github.io/spmb2027',

  // Nama Edge Function pengelola akun (dipasang di Langkah 3)
  fungsiPengguna: 'kelola-pengguna',

  versi: '1.0.0 (Fase 1)'
};
