-- ================================================
-- 007_create_waitlist.sql
-- Randevu bekleme listesi tablosu
-- ================================================

create table if not exists public.waitlist_entries (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  customer_id          uuid references public.customers(id) on delete set null,
  customer_name        text not null,
  customer_phone       text not null,
  service_id           uuid references public.services(id) on delete set null,
  staff_id             uuid references public.staff_members(id) on delete set null,
  preferred_date       date,
  preferred_time_start time,
  preferred_time_end   time,
  notes                text,
  is_notified          boolean not null default false,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);

-- İndeksler
create index if not exists waitlist_business_active_idx
  on public.waitlist_entries(business_id, is_active);
create index if not exists waitlist_date_idx
  on public.waitlist_entries(preferred_date)
  where is_active = true and is_notified = false;

-- RLS
alter table public.waitlist_entries enable row level security;

-- Public INSERT (randevu sayfasından kayıt)
create policy "waitlist_public_insert" on public.waitlist_entries
  for insert with check (true);

-- Authenticated staff okuma/güncelleme
create policy "waitlist_staff_select" on public.waitlist_entries
  for select using (
    exists (
      select 1 from public.staff_members sm
      where sm.business_id = waitlist_entries.business_id
        and sm.user_id = auth.uid()
    )
  );

create policy "waitlist_staff_update" on public.waitlist_entries
  for update using (
    exists (
      select 1 from public.staff_members sm
      where sm.business_id = waitlist_entries.business_id
        and sm.user_id = auth.uid()
    )
  );

-- Admin client her şeyi okuyabilir/yazabilir (cron için)
create policy "waitlist_service_role" on public.waitlist_entries
  for all using (auth.role() = 'service_role');
