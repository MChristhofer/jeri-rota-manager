-- Catálogo comercial privado de hospedagens da Jeri Rota.
-- As tarifas representam condições negociadas; não confirmam disponibilidade.
create table if not exists public.hotel_partners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  city text not null default 'Jericoacoara',
  neighborhood text,
  category text,
  contact_name text,
  whatsapp text,
  phone text,
  email text,
  website text,
  status text not null default 'contato' check (status in ('contato','negociacao','ativo','inativo')),
  standard_commission_pct numeric(5,2) check (standard_commission_pct between 0 and 100),
  payment_terms text,
  cancellation_terms text,
  benefits text,
  internal_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotel_partners_owner_name_idx on public.hotel_partners (owner_id, name);
alter table public.hotel_partners enable row level security;
revoke all on public.hotel_partners from anon;
grant select,insert,update,delete on public.hotel_partners to authenticated;

create policy "hotel_partners_select_own" on public.hotel_partners
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "hotel_partners_insert_own" on public.hotel_partners
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "hotel_partners_update_own" on public.hotel_partners
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "hotel_partners_delete_own" on public.hotel_partners
  for delete to authenticated using (owner_id = (select auth.uid()));

create table if not exists public.hotel_partner_rates (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.hotel_partners(id) on delete cascade,
  room_name text not null default 'Standard',
  rate_type text not null default 'net' check (rate_type in ('net','commission')),
  valid_from date not null,
  valid_to date not null,
  net_amount numeric(12,2) check (net_amount >= 0),
  sale_amount numeric(12,2) check (sale_amount >= 0),
  commission_pct numeric(5,2) check (commission_pct between 0 and 100),
  meal_plan text,
  min_nights integer not null default 1 check (min_nights > 0),
  source text,
  last_confirmed_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_partner_rates_date_check check (valid_to >= valid_from),
  constraint hotel_partner_rates_value_check check (
    (rate_type = 'net' and net_amount is not null) or
    (rate_type = 'commission' and sale_amount is not null)
  )
);
create index if not exists hotel_partner_rates_partner_period_idx
  on public.hotel_partner_rates (partner_id, valid_from, valid_to);
alter table public.hotel_partner_rates enable row level security;
revoke all on public.hotel_partner_rates from anon;
grant select,insert,update,delete on public.hotel_partner_rates to authenticated;

create policy "hotel_rates_select_own" on public.hotel_partner_rates
  for select to authenticated using (
    exists (select 1 from public.hotel_partners p
      where p.id=partner_id and p.owner_id=(select auth.uid()))
  );
create policy "hotel_rates_insert_own" on public.hotel_partner_rates
  for insert to authenticated with check (
    exists (select 1 from public.hotel_partners p
      where p.id=partner_id and p.owner_id=(select auth.uid()))
  );
create policy "hotel_rates_update_own" on public.hotel_partner_rates
  for update to authenticated using (
    exists (select 1 from public.hotel_partners p
      where p.id=partner_id and p.owner_id=(select auth.uid()))
  ) with check (
    exists (select 1 from public.hotel_partners p
      where p.id=partner_id and p.owner_id=(select auth.uid()))
  );
create policy "hotel_rates_delete_own" on public.hotel_partner_rates
  for delete to authenticated using (
    exists (select 1 from public.hotel_partners p
      where p.id=partner_id and p.owner_id=(select auth.uid()))
  );
