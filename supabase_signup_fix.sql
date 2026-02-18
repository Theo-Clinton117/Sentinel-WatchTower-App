-- Run this in Supabase SQL Editor for project: Sentinel WatchTower
-- Fixes "Database error saving new user" caused by failing auth trigger/profile insert.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'user' check (role in ('user', 'reviewer', 'admin')),
  requested_reviewer boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('user', 'reviewer', 'admin'));

alter table public.users enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'users_select_own'
  ) then
    create policy users_select_own on public.users
      for select using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'users_insert_own'
  ) then
    create policy users_insert_own on public.users
      for insert with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'users' and policyname = 'users_update_own'
  ) then
    create policy users_update_own on public.users
      for update using (auth.uid() = id);
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role, requested_reviewer)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    'user',
    coalesce((new.raw_user_meta_data ->> 'requested_reviewer')::boolean, false)
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      requested_reviewer = excluded.requested_reviewer;

  return new;
exception
  when others then
    -- Never block auth signup because of profile-row issues.
    raise log 'handle_new_user failed for auth.users.id=%: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
