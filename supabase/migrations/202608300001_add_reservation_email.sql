alter table if exists public.reservations
  add column if not exists email text;

comment on column public.reservations.email is
  'E-mail opcional do cliente informado na reserva.';
