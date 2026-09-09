-- Additive compatibility repair. `create table if not exists` does not repair
-- an already-existing legacy table, so every canonical API column is added
-- explicitly below. No legacy contact/profile data is deleted or rewritten.
begin;

create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  contact_user_id uuid references public.users(id) on delete set null,
  contact_name text,
  contact_phone text,
  contact_email text,
  status text default 'pending',
  priority int default 0,
  created_at timestamptz default now()
);

alter table public.trusted_contacts add column if not exists user_id uuid;
alter table public.trusted_contacts add column if not exists contact_user_id uuid;
alter table public.trusted_contacts add column if not exists contact_name text;
alter table public.trusted_contacts add column if not exists contact_phone text;
alter table public.trusted_contacts add column if not exists contact_email text;
alter table public.trusted_contacts add column if not exists status text default 'pending';
alter table public.trusted_contacts add column if not exists priority int default 0;
alter table public.trusted_contacts add column if not exists created_at timestamptz default now();

create table if not exists public.trusted_contact_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  trusted_contact_id uuid references public.trusted_contacts(id) on delete cascade,
  can_view_location boolean default true,
  can_view_history boolean default false,
  can_sms boolean default true,
  can_call boolean default true,
  created_at timestamptz default now()
);

-- `user_trust_profiles` is a legacy user-level trust aggregate in production,
-- not a contact relation. Keep it untouched; contact delivery settings belong
-- in this dedicated table.
alter table public.trusted_contact_preferences add column if not exists user_id uuid;
alter table public.trusted_contact_preferences add column if not exists trusted_contact_id uuid;
alter table public.trusted_contact_preferences add column if not exists can_view_location boolean default true;
alter table public.trusted_contact_preferences add column if not exists can_view_history boolean default false;
alter table public.trusted_contact_preferences add column if not exists can_sms boolean default true;
alter table public.trusted_contact_preferences add column if not exists can_call boolean default true;
alter table public.trusted_contact_preferences add column if not exists created_at timestamptz default now();

-- 019 creates user_devices; repeat this additive column repair so token
-- registration remains compatible with a partially repaired legacy schema.
alter table public.user_devices add column if not exists fcm_token text;

create index if not exists idx_trusted_contacts_user_priority_created
  on public.trusted_contacts (user_id, priority asc, created_at desc);
create unique index if not exists idx_trusted_contact_preferences_user_contact
  on public.trusted_contact_preferences (user_id, trusted_contact_id)
  where trusted_contact_id is not null;
create index if not exists idx_user_devices_expo_token
  on public.user_devices (fcm_token) where fcm_token is not null;

commit;
