-- Consolidated compatibility repair for legacy production databases.
-- Review the preflight queries in the audit report before executing this file.
-- This migration is intentionally additive. It does not drop, rename, or
-- loosen existing columns and preserves legacy users.role/requested_reviewer.

begin;

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text unique,
  name text,
  email text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint users_contact_identity_check check (phone_e164 is not null or email is not null)
);

alter table public.users add column if not exists phone_e164 text;
alter table public.users add column if not exists name text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists status text default 'active';
alter table public.users add column if not exists created_at timestamptz default now();
alter table public.users add column if not exists updated_at timestamptz default now();
alter table public.users alter column id set default gen_random_uuid();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_contact_identity_check'
  ) then
    if exists (select 1 from public.users where phone_e164 is null and email is null) then
      raise exception 'Cannot add users_contact_identity_check: users contain rows with neither phone_e164 nor email';
    end if;
    alter table public.users
      add constraint users_contact_identity_check
      check (phone_e164 is not null or email is not null);
  end if;
end $$;

do $$
begin
  if exists (
    select lower(email)
    from public.users
    where email is not null
    group by lower(email)
    having count(*) > 1
  ) then
    raise exception 'Cannot add users_email_lower_idx: duplicate case-insensitive email values exist';
  end if;
end $$;

create unique index if not exists users_email_lower_idx
  on public.users (lower(email))
  where email is not null;

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  device_id text not null,
  platform text,
  fcm_token text,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

alter table public.user_devices add column if not exists user_id uuid;
alter table public.user_devices add column if not exists device_id text;
alter table public.user_devices add column if not exists platform text;
alter table public.user_devices add column if not exists fcm_token text;
alter table public.user_devices add column if not exists last_seen_at timestamptz;
alter table public.user_devices add column if not exists created_at timestamptz default now();
alter table public.user_devices alter column id set default gen_random_uuid();

do $$
begin
  if exists (select 1 from public.user_devices where device_id is null) then
    raise exception 'Cannot make user_devices.device_id NOT NULL: existing rows have no device_id';
  end if;
  alter table public.user_devices alter column device_id set not null;
end $$;

create table if not exists public.phone_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.email_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_otp_challenges add column if not exists name text;

create index if not exists idx_phone_otp_challenges_lookup
  on public.phone_otp_challenges (phone_e164, created_at desc)
  where consumed_at is null;
create index if not exists idx_phone_otp_challenges_expiry
  on public.phone_otp_challenges (expires_at);
create index if not exists idx_email_otp_challenges_lookup
  on public.email_otp_challenges (lower(email), created_at desc)
  where consumed_at is null;
create index if not exists idx_email_otp_challenges_expiry
  on public.email_otp_challenges (expires_at);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.user_roles (
  user_id uuid references public.users(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, role_id)
);

insert into public.roles (name)
values ('user'), ('reviewer'), ('admin')
on conflict (name) do nothing;

create table if not exists public.reviewer_role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  motivation text,
  admin_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  requested_at timestamptz default now(),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if exists (
    select user_id
    from public.reviewer_role_requests
    where status = 'pending'
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add idx_reviewer_role_requests_pending_user: duplicate pending reviewer requests exist';
  end if;
end $$;

create unique index if not exists idx_reviewer_role_requests_pending_user
  on public.reviewer_role_requests(user_id)
  where status = 'pending';

create table if not exists public.user_credibility_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  score int not null default 50,
  rating_tier text not null default 'mid',
  restriction_level text not null default 'none',
  restriction_expires_at timestamptz,
  warning_count int not null default 0,
  total_reports_count int not null default 0,
  confirmed_true_reports_count int not null default 0,
  likely_true_reports_count int not null default 0,
  inconclusive_reports_count int not null default 0,
  false_reports_count int not null default 0,
  malicious_reports_count int not null default 0,
  corroborated_reports_count int not null default 0,
  quality_score_avg real not null default 0,
  last_reported_at timestamptz,
  last_scored_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.auth_refresh_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  device_id text,
  token_id text not null unique,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  replaced_by_session_id uuid references public.auth_refresh_sessions(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.auth_refresh_sessions add column if not exists device_id text;
alter table public.auth_refresh_sessions add column if not exists last_used_at timestamptz;
alter table public.auth_refresh_sessions add column if not exists revoked_at timestamptz;
alter table public.auth_refresh_sessions add column if not exists replaced_by_session_id uuid;
alter table public.auth_refresh_sessions add column if not exists updated_at timestamptz default now();
alter table public.auth_refresh_sessions alter column id set default gen_random_uuid();

create index if not exists idx_user_devices_user_created
  on public.user_devices(user_id, created_at desc);
create index if not exists idx_user_devices_device
  on public.user_devices(device_id);
create index if not exists idx_user_credibility_profiles_user
  on public.user_credibility_profiles(user_id);
create index if not exists idx_auth_refresh_sessions_user
  on public.auth_refresh_sessions(user_id, created_at desc);
create index if not exists idx_auth_refresh_sessions_token_hash
  on public.auth_refresh_sessions(token_hash);
create index if not exists idx_auth_refresh_sessions_token_id
  on public.auth_refresh_sessions(token_id);

commit;
