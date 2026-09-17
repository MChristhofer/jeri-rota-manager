create extension if not exists pgcrypto;

create table if not exists public.voucher_sequences (
  year integer primary key,
  last_number integer not null default 0 check (last_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  voucher_number text not null,
  year integer not null,
  sequence_number integer not null check (sequence_number > 0),
  version integer not null default 1 check (version > 0),
  status text not null check (status in ('issued', 'superseded', 'cancelled')),
  snapshot_data jsonb not null,
  validation_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  pdf_path text,
  show_value boolean not null default false,
  issued_at timestamptz not null default now(),
  issued_by uuid not null references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (voucher_number, version)
);

create table if not exists public.voucher_audit_log (
  id bigint generated always as identity primary key,
  voucher_id uuid not null references public.vouchers(id) on delete restrict,
  action text not null check (action in ('VOUCHER_ISSUED','VOUCHER_REISSUED','VOUCHER_CANCELLED')),
  actor_id uuid not null references auth.users(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists vouchers_one_current_per_reservation
  on public.vouchers (reservation_id) where status = 'issued';
create index if not exists vouchers_reservation_id_idx on public.vouchers (reservation_id);
create index if not exists vouchers_number_idx on public.vouchers (voucher_number);
create index if not exists vouchers_status_idx on public.vouchers (status);
create index if not exists vouchers_issued_at_idx on public.vouchers (issued_at desc);

alter table public.vouchers enable row level security;
alter table public.voucher_sequences enable row level security;
alter table public.voucher_audit_log enable row level security;
revoke all on public.vouchers, public.voucher_sequences, public.voucher_audit_log from anon, authenticated;
grant select on public.vouchers to authenticated;
grant update (pdf_path) on public.vouchers to authenticated;
grant select on public.voucher_audit_log to authenticated;

create policy "Authenticated users can read vouchers"
  on public.vouchers for select to authenticated using ((select auth.uid()) is not null);
create policy "Authenticated users can update voucher files"
  on public.vouchers for update to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);
create policy "Authenticated users can read voucher audit"
  on public.voucher_audit_log for select to authenticated using ((select auth.uid()) is not null);

create or replace function public.issue_voucher(
  p_reservation_id uuid,
  p_snapshot jsonb,
  p_show_value boolean default false
) returns public.vouchers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_year integer := extract(year from now())::integer;
  v_sequence integer;
  v_number text;
  v_version integer;
  v_current public.vouchers;
  v_result public.vouchers;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.reservations where id = p_reservation_id) then
    raise exception 'Reservation not found';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Invalid voucher snapshot';
  end if;

  select * into v_current from public.vouchers
   where reservation_id = p_reservation_id
   order by version desc limit 1 for update;

  if v_current.id is null then
    insert into public.voucher_sequences(year, last_number)
      values (v_year, 1)
      on conflict (year) do update set last_number = public.voucher_sequences.last_number + 1, updated_at = now()
      returning last_number into v_sequence;
    v_number := 'JR-' || v_year || '-' || lpad(v_sequence::text, 6, '0');
    v_version := 1;
  elsif v_current.status = 'cancelled' then
    raise exception 'Cancelled vouchers cannot be reissued';
  else
    v_number := v_current.voucher_number;
    v_version := v_current.version + 1;
    update public.vouchers set status = 'superseded', updated_at=now() where id = v_current.id;
  end if;

  insert into public.vouchers(reservation_id, voucher_number, year, sequence_number, version, status, snapshot_data, show_value, issued_by)
  values (p_reservation_id, v_number, split_part(v_number, '-', 2)::integer, split_part(v_number, '-', 3)::integer, v_version, 'issued', p_snapshot, coalesce(p_show_value, false), v_user)
  returning * into v_result;
  insert into public.voucher_audit_log(voucher_id, action, actor_id, details)
  values (v_result.id, case when v_version=1 then 'VOUCHER_ISSUED' else 'VOUCHER_REISSUED' end, v_user, jsonb_build_object('version',v_version));
  return v_result;
end;
$$;

create or replace function public.cancel_voucher(p_voucher_id uuid, p_reason text)
returns public.vouchers
language plpgsql
security definer
set search_path = ''
as $$
declare v_result public.vouchers;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Cancellation reason required'; end if;
  update public.vouchers set status='cancelled', cancelled_at=now(), cancelled_by=auth.uid(), cancellation_reason=trim(p_reason), updated_at=now()
   where id=p_voucher_id and status='issued' returning * into v_result;
  if v_result.id is null then raise exception 'Issued voucher not found'; end if;
  insert into public.voucher_audit_log(voucher_id, action, actor_id, details)
  values (v_result.id, 'VOUCHER_CANCELLED', auth.uid(), jsonb_build_object('reason',trim(p_reason)));
  return v_result;
end;
$$;

create or replace function public.validate_voucher(p_token text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'voucher_number', v.voucher_number, 'version', v.version, 'status', v.status,
    'issued_at', v.issued_at,
    'is_latest', not exists(select 1 from public.vouchers newer where newer.voucher_number=v.voucher_number and newer.version>v.version),
    'snapshot', jsonb_build_object(
      'client', v.snapshot_data->'client', 'period', v.snapshot_data->'period',
      'people', v.snapshot_data->'people', 'passengers', v.snapshot_data->'passengers',
      'services', v.snapshot_data->'services', 'boarding', v.snapshot_data->'boarding',
      'lodging', v.snapshot_data->'lodging', 'customer_notes', v.snapshot_data->'customer_notes',
      'payment_status', v.snapshot_data->'payment_status',
      'amount', case when v.show_value then v.snapshot_data->'amount' else null end
    )
  ) from public.vouchers v where v.validation_token=p_token limit 1;
$$;

revoke all on function public.issue_voucher(uuid,jsonb,boolean) from public;
revoke all on function public.cancel_voucher(uuid,text) from public;
revoke all on function public.validate_voucher(text) from public;
grant execute on function public.issue_voucher(uuid,jsonb,boolean) to authenticated;
grant execute on function public.cancel_voucher(uuid,text) to authenticated;
grant execute on function public.validate_voucher(text) to anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('vouchers', 'vouchers', false, 5242880, array['application/pdf'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy "Authenticated users can read voucher PDFs" on storage.objects for select to authenticated
  using (bucket_id='vouchers' and (select auth.uid()) is not null);
create policy "Authenticated users can upload voucher PDFs" on storage.objects for insert to authenticated
  with check (bucket_id='vouchers' and (select auth.uid()) is not null);
create policy "Authenticated users can update voucher PDFs" on storage.objects for update to authenticated
  using (bucket_id='vouchers' and (select auth.uid()) is not null)
  with check (bucket_id='vouchers' and (select auth.uid()) is not null);
