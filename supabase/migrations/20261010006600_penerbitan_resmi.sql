-- SIMKA PRO | supabase/migrations/20261010006600_penerbitan_resmi.sql | v1.0 | Fase 8 – Tahap 5 Penerbitan laporan resmi bertanda tangan elektronik | 10/10/2026
-- =====================================================================
-- Alur:
--   1. Pembuat laporan menekan "Terbitkan resmi" → ajukan_dokumen_resmi(): salinan beku laporan (isi) disimpan,
--      kode validasi dibuat, penanda tangan kanan (pembuat) langsung bertanda tangan, penanda tangan kiri
--      (pimpinan dari daftar Penanda Tangan) menerima notifikasi "Permintaan tanda tangan".
--   2. Pimpinan membuka Dokumen → Tanda tangan, memeriksa salinan beku, lalu Setujui atau Tolak
--      (tandatangani_dokumen). Setelah semua menandatangani, status menjadi "Sah", QR berlaku,
--      dan versi resmi sebelumnya untuk laporan yang sama otomatis berstatus "Direvisi".
--   3. Mode basah: dokumen langsung terdaftar sah dengan kode validasi; tanda tangan dibubuhkan manual
--      setelah dicetak (halaman Cek Keabsahan menyebut "tanda tangan basah").
--   * Pengaju dapat membatalkan selama masih menunggu (batalkan_dokumen_resmi). Penolakan diberi catatan.
--   * Isi salinan beku paling besar 3 MB, hanya dibaca pengaju, penanda tangan, dan admin (RLS lama).
-- Jalankan SETELAH migrasi 6500. Aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. KOLOM TAMBAHAN
-- ---------------------------------------------------------------------
alter table public.document_registry add column if not exists isi jsonb;
alter table public.document_registry add column if not exists kunci text;
alter table public.document_registry add column if not exists tautan text;
alter table public.document_registry add column if not exists mode_ttd text not null default 'elektronik';
alter table public.document_registry add column if not exists diajukan_pada timestamptz;
alter table public.document_registry add column if not exists catatan text;
alter table public.document_registry drop constraint if exists document_registry_status_check;
alter table public.document_registry add constraint document_registry_status_check check (status in ('draf','sah','direvisi','dicabut','ditolak'));
alter table public.document_registry drop constraint if exists document_registry_mode_ttd_check;
alter table public.document_registry add constraint document_registry_mode_ttd_check check (mode_ttd in ('elektronik','basah'));
create index if not exists document_registry_kunci_idx on public.document_registry (kunci, created_at desc) where kunci is not null;

-- ---------------------------------------------------------------------
-- 2. AJUKAN PENERBITAN RESMI
--    p = { jenis, jenis_nama, perihal, subjek, periode, kop_kode, kunci, tautan, isi, mode ('elektronik'|'basah'),
--          kiri: { signatory_id } , kanan_jabatan }
-- ---------------------------------------------------------------------
create or replace function public.ajukan_dokumen_resmi(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_saya uuid := public.saya(); v_mode text := coalesce(p->>'mode', 'elektronik'); v_doc uuid; v_kode text;
  st signatories; v_kiri_emp uuid; v_saya_r employees; v_status text; v_kunci text := nullif(trim(p->>'kunci'), '');
begin
  if v_saya is null then raise exception 'Akun Anda belum aktif.'; end if;
  if v_mode not in ('elektronik','basah') then raise exception 'Mode tanda tangan tidak dikenal.'; end if;
  if coalesce(p->>'jenis', '') !~ '^laporan_[a-z_]+$' then raise exception 'Jenis dokumen tidak dikenal.'; end if;
  if length(coalesce(p->>'perihal', '')) < 3 then raise exception 'Judul dokumen belum diisi.'; end if;
  if p->'isi' is null or jsonb_typeof(p->'isi') <> 'object' then raise exception 'Isi dokumen kosong.'; end if;
  if pg_column_size(p->'isi') > 3 * 1024 * 1024 then raise exception 'Isi dokumen terlalu besar. Persempit periode atau cakupan laporan.'; end if;
  select * into st from signatories where id = nullif(p->'kiri'->>'signatory_id', '')::uuid and aktif;
  if not found then raise exception 'Pilih penanda tangan (pimpinan) yang aktif.'; end if;
  st := public._isi_penanda_tangan(st);   -- pemegang jabatan terkini
  v_kiri_emp := st.employee_id;
  if v_mode = 'elektronik' and v_kiri_emp is null then
    raise exception 'Penanda tangan % belum terhubung dengan akun pegawai. Hubungkan di Setelan → Penanda tangan, atau pilih tanda tangan basah.', st.jabatan_tertulis;
  end if;
  select * into v_saya_r from employees where id = v_saya;

  -- Pengajuan lama untuk laporan yang sama yang masih menunggu: digantikan
  if v_kunci is not null then
    update document_registry set status = 'dicabut', dicabut_pada = now(), dicabut_oleh = v_saya, alasan_cabut = 'Digantikan pengajuan baru'
     where kunci = v_kunci and status = 'draf' and diterbitkan_oleh = v_saya;
  end if;

  v_kode := public._kode_dokumen();
  v_status := case when v_mode = 'basah' or v_kiri_emp = v_saya then 'sah' else 'draf' end;
  insert into document_registry (kode, jenis, jenis_nama, perihal, subjek, periode, kop_kode, status, sidik, diterbitkan_pada, diterbitkan_oleh,
                                 isi, kunci, tautan, mode_ttd, diajukan_pada)
  values (v_kode, p->>'jenis', coalesce(nullif(p->>'jenis_nama', ''), 'Laporan resmi'), left(p->>'perihal', 300), left(p->>'subjek', 300), left(p->>'periode', 200),
          coalesce(nullif(p->>'kop_kode', ''), 'pondok'), v_status, public._sidik(p->'isi'), now(), v_saya,
          p->'isi', v_kunci, left(p->>'tautan', 500), v_mode, now())
  returning id into v_doc;

  insert into document_signatures (document_id, urutan, posisi, employee_id, nama, jabatan, niy, status, waktu, catatan)
  values (v_doc, 1, 'kiri', v_kiri_emp, st.nama, st.jabatan_tertulis, st.niy,
          case when v_status = 'sah' then 'ditandatangani' else 'menunggu' end,
          case when v_mode = 'elektronik' and v_status = 'sah' then now() end,
          case when v_mode = 'basah' then 'basah' end),
         (v_doc, 2, 'kanan', v_saya, v_saya_r.nama_lengkap, coalesce(nullif(trim(p->>'kanan_jabatan'), ''), 'Pembuat laporan'), v_saya_r.niy,
          'ditandatangani', case when v_mode = 'elektronik' then now() end, case when v_mode = 'basah' then 'basah' end);

  if v_status = 'sah' then
    perform public._sahkan_revisi(v_doc);
  else
    insert into notifications (employee_id, judul, isi, tautan, ikon, warna)
    values (v_kiri_emp, 'Permintaan tanda tangan dokumen',
            v_saya_r.nama_lengkap || ' meminta tanda tangan elektronik untuk ' || left(p->>'perihal', 120) || coalesce(' (' || (p->>'periode') || ')', '') || '.',
            '/rekap/tandatangan', 'Signature', 'ungu');
  end if;
  return jsonb_build_object('id', v_doc, 'kode', v_kode, 'status', v_status);
end $$;

-- Versi resmi sebelumnya (laporan yang sama) menjadi "Direvisi" saat versi baru sah
create or replace function public._sahkan_revisi(p_doc uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare d document_registry;
begin
  select * into d from document_registry where id = p_doc;
  if d.kunci is null then return; end if;
  update document_registry set status = 'direvisi', pengganti_id = p_doc
   where kunci = d.kunci and id <> p_doc and status = 'sah';
end $$;

-- ---------------------------------------------------------------------
-- 3. TANDA TANGANI / TOLAK (penanda tangan yang diminta)
-- ---------------------------------------------------------------------
create or replace function public.tandatangani_dokumen(p_id uuid, p_setuju boolean, p_catatan text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_saya uuid := public.saya(); d document_registry; s document_signatures; v_sisa int;
begin
  if v_saya is null then raise exception 'Akun Anda belum aktif.'; end if;
  select * into d from document_registry where id = p_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  if d.status <> 'draf' then raise exception 'Dokumen ini tidak lagi menunggu tanda tangan (status: %).', d.status; end if;
  select * into s from document_signatures where document_id = p_id and employee_id = v_saya and status = 'menunggu' order by urutan limit 1;
  if not found then raise exception 'Anda tidak diminta menandatangani dokumen ini.' using errcode = '42501'; end if;
  if not p_setuju and length(trim(coalesce(p_catatan, ''))) < 5 then raise exception 'Tuliskan alasan penolakan (paling sedikit 5 karakter).'; end if;

  update document_signatures set status = case when p_setuju then 'ditandatangani' else 'ditolak' end, waktu = now(),
         catatan = nullif(trim(coalesce(p_catatan, '')), '') where id = s.id;
  if not p_setuju then
    update document_registry set status = 'ditolak', catatan = trim(p_catatan) where id = p_id;
    insert into notifications (employee_id, judul, isi, tautan, ikon, warna)
    values (d.diterbitkan_oleh, 'Dokumen ditolak', s.nama || ' menolak menandatangani ' || d.perihal || ': ' || left(trim(p_catatan), 140),
            coalesce(d.tautan || '?resmi=' || d.id, '/rekap/dokumen'), 'XCircle', 'merah');
    return jsonb_build_object('status', 'ditolak');
  end if;
  select count(*) into v_sisa from document_signatures where document_id = p_id and status <> 'ditandatangani';
  if v_sisa = 0 then
    update document_registry set status = 'sah', diterbitkan_pada = now() where id = p_id;
    perform public._sahkan_revisi(p_id);
    insert into notifications (employee_id, judul, isi, tautan, ikon, warna)
    values (d.diterbitkan_oleh, 'Dokumen telah sah', d.perihal || ' telah ditandatangani ' || s.nama || '. Kode validasi ' || d.kode || '.',
            coalesce(d.tautan || '?resmi=' || d.id, '/rekap/dokumen'), 'SealCheck', 'hijau');
    return jsonb_build_object('status', 'sah', 'kode', d.kode);
  end if;
  return jsonb_build_object('status', 'draf');
end $$;

-- ---------------------------------------------------------------------
-- 4. BATALKAN PENGAJUAN (pengaju atau admin, selama menunggu)
-- ---------------------------------------------------------------------
create or replace function public.batalkan_dokumen_resmi(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare d document_registry;
begin
  select * into d from document_registry where id = p_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan.'; end if;
  if not (d.diterbitkan_oleh = public.saya() or public.is_admin()) then raise exception 'Hanya pengaju yang dapat membatalkan.' using errcode = '42501'; end if;
  if d.status not in ('draf','ditolak') then raise exception 'Hanya pengajuan yang masih menunggu atau ditolak yang dapat dibatalkan. Dokumen sah dicabut oleh superadmin.'; end if;
  update document_registry set status = 'dicabut', dicabut_pada = now(), dicabut_oleh = public.saya(), alasan_cabut = 'Dibatalkan pengaju' where id = p_id;
  update notifications set dibaca_pada = coalesce(dibaca_pada, now())
   where tautan = '/rekap/tandatangan' and employee_id in (select employee_id from document_signatures where document_id = p_id and status = 'menunggu')
     and created_at >= d.created_at and isi like '%' || d.perihal || '%';
end $$;

do $$ declare f text; begin
  foreach f in array array['ajukan_dokumen_resmi(jsonb)','tandatangani_dokumen(uuid, boolean, text)','batalkan_dokumen_resmi(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke execute on function public._sahkan_revisi(uuid) from public, anon, authenticated';
end $$;

-- ---------------------------------------------------------------------
-- 5. CEK KEABSAHAN: sertakan mode tanda tangan; draf/ditolak tidak dinyatakan sah
-- ---------------------------------------------------------------------
create or replace function public.cek_dokumen(p_kode text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare k text := upper(regexp_replace(coalesce(p_kode, ''), '[^A-Za-z0-9]', '', 'g')); d document_registry; v_lembaga text;
begin
  if length(k) <> 8 then return jsonb_build_object('ditemukan', false, 'kode', p_kode); end if;
  k := substr(k, 1, 4) || '-' || substr(k, 5, 4);
  select * into d from document_registry where kode = k;
  select coalesce(nilai->>'nama_lengkap', nilai->>'nama') into v_lembaga from institution_settings where kunci = 'identitas';
  if d.id is null then return jsonb_build_object('ditemukan', false, 'kode', k, 'lembaga', v_lembaga); end if;
  update document_registry set jumlah_cek = jumlah_cek + 1, terakhir_dicek = now() where id = d.id;
  return jsonb_build_object(
    'ditemukan', true, 'kode', d.kode, 'jenis', d.jenis, 'jenis_nama', d.jenis_nama, 'nomor', d.nomor, 'perihal', d.perihal,
    'subjek', d.subjek, 'periode', d.periode, 'status', d.status, 'mode_ttd', d.mode_ttd, 'diterbitkan_pada', d.diterbitkan_pada,
    'dicabut_pada', d.dicabut_pada, 'alasan_cabut', d.alasan_cabut,
    'pengganti', (select x.kode from document_registry x where x.id = d.pengganti_id),
    'sidik', substr(d.sidik, 1, 16), 'lembaga', v_lembaga,
    'penanda', coalesce((select jsonb_agg(jsonb_build_object('nama', s.nama, 'jabatan', s.jabatan, 'status', s.status, 'waktu', s.waktu)
                                          order by case s.posisi when 'kiri' then 0 else 1 end, s.urutan)
                           from document_signatures s where s.document_id = d.id and s.status = 'ditandatangani'), '[]'::jsonb));
end $$;
revoke execute on function public.cek_dokumen(text) from public;
grant execute on function public.cek_dokumen(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. PEMERIKSAAN (hasil yang benar: semua "Sesuai")
-- ---------------------------------------------------------------------
select '1. Kolom salinan beku dan mode tanda tangan' as pemeriksaan,
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'document_registry'
                   and column_name in ('isi','kunci','tautan','mode_ttd','diajukan_pada','catatan')) = 6 then 'Sesuai' else 'Periksa' end as hasil
union all
select '2. Fungsi ajukan, tanda tangani, batalkan',
       case when (select count(*) from pg_proc where proname in ('ajukan_dokumen_resmi','tandatangani_dokumen','batalkan_dokumen_resmi')) = 3 then 'Sesuai' else 'Periksa' end
union all
select '3. Penanda tangan terhubung akun pegawai',
       (select count(*) filter (where employee_id is not null)::text || ' dari ' || count(*)::text || ' penanda tangan aktif' from signatories where aktif);
