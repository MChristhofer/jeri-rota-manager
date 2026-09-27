create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_path text,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

grant select, insert, update on public.user_profiles to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_select_own'
  ) then
    create policy user_profiles_select_own
      on public.user_profiles for select
      to authenticated
      using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_insert_own'
  ) then
    create policy user_profiles_insert_own
      on public.user_profiles for insert
      to authenticated
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_update_own'
  ) then
    create policy user_profiles_update_own
      on public.user_profiles for update
      to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='profile_avatars_select_own'
  ) then
    create policy profile_avatars_select_own
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='profile_avatars_insert_own'
  ) then
    create policy profile_avatars_insert_own
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='profile_avatars_update_own'
  ) then
    create policy profile_avatars_update_own
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      )
      with check (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects' and policyname='profile_avatars_delete_own'
  ) then
    create policy profile_avatars_delete_own
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;
end $$;
