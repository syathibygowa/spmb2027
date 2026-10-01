-- =====================================================================
-- SPMB · SQL 16 · PUSAT UNDUHAN (Fase 5)
-- Jalankan sesudah 15-tahun-ajaran-uji-lengkap.sql. Aman dijalankan dua kali.
--
-- A. Tabel unduhan: berkas (brosur, panduan, formulir, surat) atau tautan
--    yang dapat diunduh calon santri di halaman Unduhan situs.
--    Dikelola Admin dan Superadmin dari dashboard. Berkas tersimpan di
--    Google Drive folder "Unduhan" (Jembatan Unggah versi 3.4).
-- B. catat_unduhan(): penghitung jumlah unduhan (pengunjung tanpa akun)
-- C. Indeks log aktivitas untuk saringan petugas dan aktivitas
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. TABEL
-- ---------------------------------------------------------------------
create table if not exists public.unduhan (
  id              bigint generated always as identity primary key,
  judul           text not null check (length(trim(judul)) between 3 and 120),
  keterangan      text not null default '' check (length(keterangan) <= 500),
  kategori        text not null default 'Umum' check (length(trim(kategori)) between 2 and 40),
  sumber          text not null default 'berkas' check (sumber in ('berkas', 'tautan')),
  url             text not null check (url ~ '^https://'),
  drive_id        text,
  nama_berkas     text,
  mime            text,
  ukuran          bigint check (ukuran is null or ukuran >= 0),
  urutan          integer not null default 0,
  tampil          boolean not null default true,
  unggulan        boolean not null default false,
  diunduh         integer not null default 0,
  dibuat_oleh     uuid references auth.users (id) on delete set null,
  nama_pengunggah text,
  dibuat_pada     timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),
  diperbarui_oleh uuid references auth.users (id) on delete set null
);
create index if not exists unduhan_urut_idx on public.unduhan (tampil, urutan, id);
comment on table public.unduhan is 'Pusat unduhan situs: brosur, panduan, formulir, dan dokumen lain untuk calon santri.';

-- Pengunggah tercatat otomatis
create or replace function public.isi_pengunggah_unduhan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.dibuat_oleh := coalesce(new.dibuat_oleh, auth.uid());
  new.nama_pengunggah := coalesce(new.nama_pengunggah, (select nama_lengkap from public.profil_pengguna where id = auth.uid()));
  new.diunduh := 0;
  return new;
end; $$;
drop trigger if exists isi_pengunggah_unduhan on public.unduhan;
create trigger isi_pengunggah_unduhan before insert on public.unduhan
  for each row execute function public.isi_pengunggah_unduhan();
drop trigger if exists sebelum_ubah_unduhan on public.unduhan;
create trigger sebelum_ubah_unduhan before update on public.unduhan
  for each row when (new.diunduh is not distinct from old.diunduh) execute function public.stempel_ubah();
drop trigger if exists log_unduhan on public.unduhan;
create trigger log_unduhan after insert or delete on public.unduhan
  for each row execute function public.log_perubahan();
drop trigger if exists log_unduhan_ubah on public.unduhan;
create trigger log_unduhan_ubah after update on public.unduhan
  for each row when (new.diunduh is not distinct from old.diunduh) execute function public.log_perubahan();

alter table public.unduhan enable row level security;
drop policy if exists "unduhan: lihat" on public.unduhan;
create policy "unduhan: lihat" on public.unduhan for select to anon, authenticated
  using (tampil or public.is_admin());
drop policy if exists "unduhan: tulis" on public.unduhan;
create policy "unduhan: tulis" on public.unduhan for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.unduhan from anon, authenticated;
grant select on public.unduhan to anon, authenticated;
grant insert, update, delete on public.unduhan to authenticated;

-- ---------------------------------------------------------------------
-- B. PENGHITUNG UNDUHAN
-- ---------------------------------------------------------------------
create or replace function public.catat_unduhan(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.unduhan set diunduh = diunduh + 1 where id = p_id and tampil
$$;
revoke all on function public.catat_unduhan(bigint) from public;
grant execute on function public.catat_unduhan(bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- C. INDEKS LOG AKTIVITAS (saringan petugas dan aktivitas)
-- ---------------------------------------------------------------------
create index if not exists log_aktivitas_pengguna_idx on public.log_aktivitas (pengguna_id, dibuat_pada desc);
create index if not exists log_aktivitas_aksi_idx on public.log_aktivitas (aksi, dibuat_pada desc);

notify pgrst, 'reload schema';
-- Selesai. Bila berhasil, Supabase menampilkan "Success. No rows returned".
