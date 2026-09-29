// =====================================================================
//  Edge Function: kelola-pengguna
//  Dipakai dashboard untuk membuat akun panitia dan mengatur ulang
//  kata sandi. Hanya Superadmin aktif yang boleh memanggilnya.
//  Kunci rahasia (service role) tersedia otomatis di server Supabase,
//  tidak pernah dikirim ke browser.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jawab = (isi: unknown, status = 200) =>
  new Response(JSON.stringify(isi), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PERAN = ['superadmin', 'admin', 'penguji'];
const BIDANG = ['tahfizh', 'tertulis', 'wawancara'];
const BAGIAN = ['umum', 'putra', 'putri'];
const sandiKuat = (s: string) => typeof s === 'string' && s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jawab({ error: 'Metode tidak diizinkan.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const kunciRahasia = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, kunciRahasia, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Pastikan pemanggil adalah Superadmin aktif
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return jawab({ error: 'Anda belum masuk.' }, 401);
  const { data: u, error: eUser } = await admin.auth.getUser(token);
  if (eUser || !u?.user) return jawab({ error: 'Sesi tidak valid. Silakan masuk kembali.' }, 401);
  const { data: pemanggil } = await admin.from('profil_pengguna').select('peran,aktif,nama_lengkap').eq('id', u.user.id).maybeSingle();
  if (!pemanggil || !pemanggil.aktif || pemanggil.peran !== 'superadmin')
    return jawab({ error: 'Hanya Superadmin yang dapat mengelola akun.' }, 403);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return jawab({ error: 'Data tidak valid.' }, 400); }

  const catat = (aksi: string, objek_id: string, rincian: unknown) =>
    admin.from('log_aktivitas').insert({ pengguna_id: u.user!.id, nama_pengguna: pemanggil.nama_lengkap, aksi, objek: 'akun', objek_id, rincian });

  // 2. Buat akun baru
  if (b.aksi === 'buat') {
    const email = String(b.email || '').trim().toLowerCase();
    const nama = String(b.nama_lengkap || '').trim();
    const peran = String(b.peran || 'admin');
    const bagian = String(b.bagian || 'umum');
    const bidang = Array.isArray(b.bidang_penguji) ? (b.bidang_penguji as string[]).filter((x) => BIDANG.includes(x)) : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return jawab({ error: 'Format email belum benar.' }, 400);
    if (nama.length < 3) return jawab({ error: 'Nama lengkap minimal 3 karakter.' }, 400);
    if (!PERAN.includes(peran)) return jawab({ error: 'Peran tidak dikenal.' }, 400);
    if (!BAGIAN.includes(bagian)) return jawab({ error: 'Bagian tidak dikenal.' }, 400);
    if (peran === 'penguji' && !bidang.length) return jawab({ error: 'Pilih minimal satu bidang tes untuk Penguji.' }, 400);
    if (!sandiKuat(String(b.sandi || ''))) return jawab({ error: 'Kata sandi awal minimal 8 karakter, berisi huruf dan angka.' }, 400);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: String(b.sandi),
      email_confirm: true,
      app_metadata: { peran, aktif: true, nama_lengkap: nama, bagian, bidang_penguji: peran === 'penguji' ? bidang : [] },
    });
    if (error) {
      const m = /already|registered|exists/i.test(error.message) ? 'Email tersebut sudah terdaftar.' : error.message;
      return jawab({ error: m }, 400);
    }
    const id = data.user.id;
    // Lengkapi profil (dibuat otomatis oleh trigger database)
    await admin.from('profil_pengguna').update({
      no_wa: b.no_wa || null, niy: b.niy || null,
    }).eq('id', id);
    // Notifikasi selamat datang
    await admin.from('notifikasi').insert({
      penerima_id: id, judul: 'Selamat datang di Dashboard SPMB',
      pesan: 'Segera ganti kata sandi awal Anda di menu Profil Saya.', jenis: 'penting', tautan: '#/profil',
    });
    await catat('buat_akun', id, { email, nama, peran });
    return jawab({ ok: true, id });
  }

  // 3. Atur ulang kata sandi
  if (b.aksi === 'ubah_sandi') {
    const id = String(b.id || '');
    if (!sandiKuat(String(b.sandi || ''))) return jawab({ error: 'Kata sandi minimal 8 karakter, berisi huruf dan angka.' }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { password: String(b.sandi) });
    if (error) return jawab({ error: error.message }, 400);
    await admin.from('notifikasi').insert({
      penerima_id: id, judul: 'Kata sandi Anda diatur ulang', pesan: 'Superadmin mengatur ulang kata sandi Anda. Segera ganti di menu Profil Saya.',
      jenis: 'peringatan', tautan: '#/profil',
    });
    await catat('atur_ulang_sandi', id, null);
    return jawab({ ok: true });
  }

  return jawab({ error: 'Aksi tidak dikenal.' }, 400);
});
