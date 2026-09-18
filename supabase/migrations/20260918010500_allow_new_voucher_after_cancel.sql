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

  select * into v_current
  from public.vouchers
  where reservation_id = p_reservation_id
    and status = 'issued'
  order by issued_at desc, version desc
  limit 1
  for update;

  if v_current.id is null then
    insert into public.voucher_sequences(year, last_number)
      values (v_year, 1)
      on conflict (year) do update
        set last_number = public.voucher_sequences.last_number + 1,
            updated_at = now()
      returning last_number into v_sequence;

    v_number := 'JR-' || v_year || '-' || lpad(v_sequence::text, 6, '0');
    v_version := 1;
  else
    v_number := v_current.voucher_number;
    v_version := v_current.version + 1;

    update public.vouchers
      set status = 'superseded',
          updated_at = now()
      where id = v_current.id;
  end if;

  insert into public.vouchers(
    reservation_id,
    voucher_number,
    year,
    sequence_number,
    version,
    status,
    snapshot_data,
    show_value,
    issued_by
  )
  values (
    p_reservation_id,
    v_number,
    split_part(v_number, '-', 2)::integer,
    split_part(v_number, '-', 3)::integer,
    v_version,
    'issued',
    p_snapshot,
    coalesce(p_show_value, false),
    v_user
  )
  returning * into v_result;

  insert into public.voucher_audit_log(voucher_id, action, actor_id, details)
  values (
    v_result.id,
    case when v_current.id is null then 'VOUCHER_ISSUED' else 'VOUCHER_REISSUED' end,
    v_user,
    jsonb_build_object(
      'version', v_version,
      'voucher_number', v_number,
      'new_number', v_current.id is null
    )
  );

  return v_result;
end;
$$;

revoke all on function public.issue_voucher(uuid,jsonb,boolean) from public;
grant execute on function public.issue_voucher(uuid,jsonb,boolean) to authenticated;
