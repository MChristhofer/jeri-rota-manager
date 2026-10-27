-- CPF opcional do titular da reserva. Não expor no endpoint público de validação.
alter table public.reservations add column if not exists holder_cpf text;
comment on column public.reservations.holder_cpf is 'CPF opcional do titular da reserva; dado pessoal e restrito à gestão autenticada.';
alter table public.reservations drop constraint if exists reservations_holder_cpf_check;
alter table public.reservations add constraint reservations_holder_cpf_check
 check (holder_cpf is null or holder_cpf ~ '^[0-9]{11}$');
