-- SIMKA PRO | supabase/migrations/20261010006500_teks_kaya.sql | v1.0 | Fase 8 – Teks tebal/miring pada pengumuman | 10/10/2026
-- =====================================================================
-- Isi pengumuman kini boleh memakai penanda gaya WhatsApp: *tebal* dan _miring_.
-- Notifikasi (lonceng dan notifikasi dorong) menampilkan cuplikan teks polos, jadi penanda dilepas otomatis
-- saat notifikasi pengumuman dibuat. Fungsi _teks_polos() dipakai juga kelak oleh persuratan.
-- Jalankan SETELAH migrasi 6400. Aman dijalankan ulang.
-- =====================================================================
create or replace function public._teks_polos(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
           regexp_replace(coalesce(p, ''),
             '(^|[[:space:](\[{"''>])\*([^[:space:]*]([^*\n]*[^[:space:]*])?)\*(?=$|[[:space:].,;:!?)\]}"''<])', '\1\2', 'gn'),
           '(^|[[:space:](\[{"''>])_([^[:space:]_]([^_\n]*[^[:space:]_])?)_(?=$|[[:space:].,;:!?)\]}"''<])', '\1\2', 'gn')
$$;

create or replace function public._notifikasi_teks_polos()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tautan like '/pengumuman/%' or new.tautan like '/kelompok%' then
    new.judul := public._teks_polos(new.judul);
    new.isi := public._teks_polos(new.isi);
  end if;
  return new;
end $$;

drop trigger if exists aa_teks_polos on public.notifications;
create trigger aa_teks_polos before insert on public.notifications
  for each row execute function public._notifikasi_teks_polos();

-- PEMERIKSAAN (hasil yang benar: semua "Sesuai")
select '1. Penanda tebal/miring dilepas' as pemeriksaan,
       case when public._teks_polos('Rapat *penting* hari _Senin_, surel a_b_c@x.id') = 'Rapat penting hari Senin, surel a_b_c@x.id'
            then 'Sesuai' else 'Periksa' end as hasil
union all
select '2. Pemicu notifikasi teks polos',
       case when exists (select 1 from pg_trigger where tgname = 'aa_teks_polos') then 'Sesuai' else 'Periksa' end;
