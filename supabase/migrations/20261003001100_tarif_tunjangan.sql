-- SIMKA PRO | supabase/migrations/20261003001100_tarif_tunjangan.sql | v1.0 | Fase 1 – Jabatan dan tunjangan | 03/10/2026
-- Tabel tarif komponen gaji (Bagian 36 blueprint) beserta tanggal berlaku.
-- Dipakai sekarang oleh menu "Jabatan dan Tunjangan" (superadmin) untuk perkiraan tunjangan,
-- dan kelak oleh modul Gaji (Fase 11) untuk slip. Perubahan tarif = baris baru dengan tanggal berlaku,
-- sehingga perhitungan periode lama tetap memakai tarif lama.
-- Hak baca/ubah: superadmin dan pemegang jabatan struktural Bendahara. Aman dijalankan ulang.

create table if not exists public.salary_rates (
  id            uuid primary key default gen_random_uuid(),
  kategori      text not null check (kategori in ('struktural','fungsional','pendidikan','masa_kerja',
                                                   'kepegawaian','kesehatan','level_muhaffizh','honorer_jam')),
  kunci         text not null,      -- kode jabatan, jenjang pendidikan, tahun masa kerja, status, level, atau jenis honorer
  nama          text not null,      -- label yang tampil
  besaran       numeric(12,0) not null check (besaran >= 0),
  berlaku_mulai date not null default public.hari_ini(),
  keterangan    text,
  dibuat_oleh   uuid references public.employees(id),
  created_at    timestamptz not null default now(),
  unique (kategori, kunci, berlaku_mulai)
);
create index if not exists salary_rates_cari_idx on public.salary_rates (kategori, kunci, berlaku_mulai desc);
comment on table public.salary_rates is 'Tarif komponen gaji dengan tanggal berlaku (Bagian 36).';

-- Pemegang jabatan struktural Bendahara
create or replace function public.is_bendahara()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from employee_structurals es join structural_positions sp on sp.id = es.structural_position_id
                 where es.employee_id = public.saya() and sp.kode = 'BENDAHARA')
$$;

alter table public.salary_rates enable row level security;
drop policy if exists baca on public.salary_rates;
drop policy if exists kelola on public.salary_rates;
create policy baca on public.salary_rates for select to authenticated
  using (public.is_superadmin() or public.is_bendahara());
create policy kelola on public.salary_rates for all to authenticated
  using (public.is_superadmin() or public.is_bendahara())
  with check (public.is_superadmin() or public.is_bendahara());

drop trigger if exists zz_audit on public.salary_rates;
create trigger zz_audit after insert or update or delete on public.salary_rates
  for each row execute function public.tg_audit();

-- Tarif yang berlaku pada suatu tanggal (baris terbaru per kategori dan kunci)
create or replace function public.tarif_berlaku(p_tanggal date default null)
returns setof public.salary_rates language sql stable security invoker set search_path = public as $$
  select distinct on (kategori, kunci) *
  from salary_rates where berlaku_mulai <= coalesce(p_tanggal, public.hari_ini())
  order by kategori, kunci, berlaku_mulai desc
$$;

-- ---------- Isi awal dari tabel bendahara (blueprint Bagian 36) ----------
insert into public.salary_rates (kategori, kunci, nama, besaran, berlaku_mulai) values
  ('struktural','DIREKTUR','Direktur',3000000,'2026-01-01'),
  ('struktural','WAKIL_DIREKTUR','Wakil Direktur',2500000,'2026-01-01'),
  ('struktural','KEPALA_BIDANG','Kepala Bidang',2000000,'2026-01-01'),
  ('struktural','WAKIL_KEPALA_BIDANG','Wakil Kepala Bidang',1000000,'2026-01-01'),
  ('struktural','WAKIL_KEPALA_SEKOLAH','Wakil Kepala Sekolah',1200000,'2026-01-01'),
  ('struktural','KEPALA_UNIT','Kepala Unit',1000000,'2026-01-01'),
  ('struktural','BENDAHARA','Bendahara',800000,'2026-01-01'),
  ('struktural','TATA_USAHA','Tata Usaha',700000,'2026-01-01'),
  ('fungsional','MUHAFFIZH','Muhaffizh',500000,'2026-01-01'),
  ('fungsional','MUSYRIF','Musyrif',300000,'2026-01-01'),
  ('fungsional','GURU','Guru mapel',450000,'2026-01-01'),
  ('fungsional','WALI_KELAS','Wali kelas',250000,'2026-01-01'),
  ('fungsional','OPERATOR','Operator',350000,'2026-01-01'),
  ('fungsional','STAF_BIDANG','Staf bidang',300000,'2026-01-01'),
  ('fungsional','STAF_PEMBANTU','Staf pembantu',150000,'2026-01-01'),
  ('fungsional','SECURITY','Petugas keamanan',700000,'2026-01-01'),
  ('fungsional','KEBERSIHAN','Petugas kebersihan',700000,'2026-01-01'),
  ('fungsional','MEDIS','Petugas kesehatan',700000,'2026-01-01'),
  ('fungsional','LOGISTIK','Petugas logistik',700000,'2026-01-01'),
  ('fungsional','MEDIA','Petugas media',700000,'2026-01-01'),
  ('fungsional','SARPRAS','Petugas sarana prasarana',700000,'2026-01-01'),
  ('pendidikan','SD','SD',50000,'2026-01-01'),
  ('pendidikan','SMP','SMP',50000,'2026-01-01'),
  ('pendidikan','SMA','SMA',80000,'2026-01-01'),
  ('pendidikan','S1','Sarjana (S1)',130000,'2026-01-01'),
  ('pendidikan','S1-LN','Sarjana luar negeri (S1-LN)',180000,'2026-01-01'),
  ('pendidikan','S2','Magister (S2)',250000,'2026-01-01'),
  ('kepegawaian','tetap','Pegawai tetap',1000000,'2026-01-01'),
  ('kepegawaian','kontrak','Pegawai kontrak',600000,'2026-01-01'),
  ('kesehatan','tetap','Pegawai tetap',150000,'2026-01-01'),
  ('kesehatan','kontrak','Pegawai kontrak',100000,'2026-01-01'),
  ('level_muhaffizh','mahir','Mahir',300000,'2026-01-01'),
  ('level_muhaffizh','terampil','Terampil',200000,'2026-01-01'),
  ('level_muhaffizh','pemula','Pemula',100000,'2026-01-01'),
  ('honorer_jam','guru_lama','Guru lama (per jam)',20000,'2026-01-01'),
  ('honorer_jam','guru_baru','Guru baru (per jam)',15000,'2026-01-01'),
  ('honorer_jam','muhaffizh_lama','Muhaffizh lama (per jam)',25000,'2026-01-01'),
  ('honorer_jam','muhaffizh_baru','Muhaffizh baru (per jam)',20000,'2026-01-01')
on conflict (kategori, kunci, berlaku_mulai) do nothing;

insert into public.salary_rates (kategori, kunci, nama, besaran, berlaku_mulai)
select 'masa_kerja', n::text, n || ' tahun', b, '2026-01-01'
from (values (1,50000),(2,100000),(3,150000),(4,200000),(5,250000),(6,350000),(7,500000),
             (8,600000),(9,700000),(10,800000),(11,900000),(12,1000000)) v(n, b)
on conflict (kategori, kunci, berlaku_mulai) do nothing;

-- Pemeriksaan: harus tampil 8 baris kategori dengan jumlah tarif masing-masing
select kategori, count(*) as jumlah_tarif from public.salary_rates group by kategori order by kategori;
