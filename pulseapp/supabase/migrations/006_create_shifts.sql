-- ================================================
-- 006_create_shifts.sql
-- Vardiye (shift) yönetim tablosu
-- ================================================

create table if not exists public.shifts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  staff_id      uuid not null references public.staff_members(id) on delete cascade,
  shift_date    date not null,
  start_time    time,                          -- null ise izin günü
  end_time      time,                          -- null ise izin günü
  shift_type    text not null default 'regular' check (shift_type in ('regular', 'off')),
  notes         text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, staff_id, shift_date)   -- bir gün için bir kayıt
);

-- updated_at otomatik güncelle
create trigger shifts_updated_at
  before update on public.shifts
  for each row execute function moddatetime(updated_at);

-- İndeksler
create index if not exists shifts_business_date_idx on public.shifts(business_id, shift_date);
create index if not exists shifts_staff_idx on public.shifts(staff_id);

-- RLS
alter table public.shifts enable row level security;

create policy "shifts_select" on public.shifts
  for select using (
    exists (
      select 1 from public.staff_members sm
      where sm.business_id = shifts.business_id
        and sm.user_id = auth.uid()
    )
  );

create policy "shifts_insert" on public.shifts
  for insert with check (
    exists (
      select 1 from public.staff_members sm
      where sm.business_id = shifts.business_id
        and sm.user_id = auth.uid()
    )
  );

create policy "shifts_update" on public.shifts
  for update using (
    exists (
      select 1 from public.staff_members sm
      where sm.business_id = shifts.business_id
        and sm.user_id = auth.uid()
    )
  );

create policy "shifts_delete" on public.shifts
  for delete using (
    exists (
      select 1 from public.staff_members sm
      where sm.business_id = shifts.business_id
        and sm.user_id = auth.uid()
    )
  );
