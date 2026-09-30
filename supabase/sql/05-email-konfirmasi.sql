-- =====================================================================
--  SPMB 2027/2028 - Pondok Pesantren Tahfizhul Qur'an
--  Imam Asy-Syathiby Wahdah Islamiyah Gowa
--
--  Berkas 05: Email konfirmasi pendaftar (Fase 3 - Langkah 3)
--  Isi: fungsi yang dipanggil Apps Script setelah formulir terkirim,
--       untuk mengambil data ringkas pendaftar (berdasarkan token unggah
--       milik pendaftar itu sendiri) dan menandai email sudah terkirim.
--
--  Prasyarat: berkas 04-pendaftaran-online.sql sudah dijalankan.
--  Cara pakai: Supabase > SQL Editor > New query > tempel > Run.
--  Aman bila tidak sengaja dijalankan dua kali.
-- =====================================================================

-- Data untuk email konfirmasi dan pemindahan folder berkas.
-- Hanya pemegang token unggah (browser pendaftar) yang tahu tokennya.
create or replace function public.data_konfirmasi(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.sesi_unggah;
  p public.pendaftar;
  g public.gelombang;
begin
  select * into s from public.sesi_unggah where token = p_token;
  if s.token is null or s.pendaftar_id is null then
    return jsonb_build_object('ok', false, 'error', 'Pendaftaran untuk sesi ini tidak ditemukan.');
  end if;
  select * into p from public.pendaftar where id = s.pendaftar_id;
  select * into g from public.gelombang where id = p.gelombang_id;
  return jsonb_build_object(
    'ok', true,
    'sudah_email', p.email_terkirim_pada is not null,
    'pendaftar', jsonb_build_object(
      'no_registrasi', p.no_registrasi, 'nama_lengkap', p.nama_lengkap, 'jenjang', p.jenjang, 'bagian', p.bagian,
      'gelombang', g.nama, 'tempat_lahir', p.tempat_lahir, 'tanggal_lahir', p.tanggal_lahir, 'nisn', p.nisn,
      'asal_sekolah', p.asal_sekolah, 'nama_ayah', p.nama_ayah, 'nama_ibu', p.nama_ibu, 'email', p.email,
      'no_wa', p.no_wa, 'dibuat_pada', p.dibuat_pada, 'uji', p.uji,
      'tes_mulai', g.tes_mulai, 'tes_selesai', g.tes_selesai, 'pengumuman', g.pengumuman),
    'berkas', coalesce((select jsonb_agg(jsonb_build_object('jenis', b.jenis, 'drive_id', b.drive_id, 'nama', b.nama) order by b.id)
                        from public.berkas_pendaftar b where b.pendaftar_id = p.id), '[]'),
    'folder_draf', 'draf-' || left(p_token::text, 8)
  );
end; $$;

-- Tandai email konfirmasi sudah terkirim (dipanggil Apps Script sesudah mengirim)
create or replace function public.tandai_email_terkirim(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select pendaftar_id into pid from public.sesi_unggah where token = p_token;
  if pid is null then return false; end if;
  update public.pendaftar set email_terkirim_pada = now()
   where id = pid and email_terkirim_pada is null;
  return found;
end; $$;

-- Pembaruan dari Apps Script tidak perlu tercatat sebagai perubahan oleh panitia:
-- trigger jaga_pendaftar sudah mengizinkan (auth.uid() kosong).

revoke execute on function public.data_konfirmasi(uuid), public.tandai_email_terkirim(uuid) from public;
grant execute on function public.data_konfirmasi(uuid), public.tandai_email_terkirim(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Selesai. Bila berhasil, Supabase menampilkan
-- "Success. No rows returned".
-- ---------------------------------------------------------------------
