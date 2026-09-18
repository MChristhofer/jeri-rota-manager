alter table public.service_catalog
  add column if not exists voucher_image_path text;

comment on column public.service_catalog.voucher_image_path is
  'Caminho da imagem principal do serviço usada nos vouchers.';

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-images',
  'service-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Authenticated users can upload service images'
  ) then
    create policy "Authenticated users can upload service images"
      on storage.objects for insert to authenticated
      with check (bucket_id='service-images' and (select auth.uid()) is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Authenticated users can update service images'
  ) then
    create policy "Authenticated users can update service images"
      on storage.objects for update to authenticated
      using (bucket_id='service-images' and (select auth.uid()) is not null)
      with check (bucket_id='service-images' and (select auth.uid()) is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Authenticated users can delete service images'
  ) then
    create policy "Authenticated users can delete service images"
      on storage.objects for delete to authenticated
      using (bucket_id='service-images' and (select auth.uid()) is not null);
  end if;
end $$;