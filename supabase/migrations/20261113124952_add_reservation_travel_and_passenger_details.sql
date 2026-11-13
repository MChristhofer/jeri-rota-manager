alter table public.reservations
  add column if not exists travel_language text not null default 'Português',
  add column if not exists check_in_date date,
  add column if not exists check_out_date date;

create table if not exists public.reservation_passengers (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  sort_order integer not null default 0,
  passenger_type text not null default 'Pagante',
  name text not null,
  document_type text,
  document_number text,
  birth_date date,
  nationality text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservation_passengers_reservation_id_idx
  on public.reservation_passengers(reservation_id, sort_order);

alter table public.reservation_passengers enable row level security;

drop policy if exists "authenticated_manage_reservation_passengers" on public.reservation_passengers;
create policy "authenticated_manage_reservation_passengers"
on public.reservation_passengers
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on table public.reservation_passengers to authenticated;
