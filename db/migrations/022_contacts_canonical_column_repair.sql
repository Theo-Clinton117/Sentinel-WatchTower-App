-- Recovery for a deployment where 021 was incorrectly recorded as applied or
-- was manually run in pieces. It does not modify legacy user_trust_profiles.
begin;

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

alter table public.trusted_contact_preferences add column if not exists user_id uuid;
alter table public.trusted_contact_preferences add column if not exists trusted_contact_id uuid;
alter table public.trusted_contact_preferences add column if not exists can_view_location boolean default true;
alter table public.trusted_contact_preferences add column if not exists can_view_history boolean default false;
alter table public.trusted_contact_preferences add column if not exists can_sms boolean default true;
alter table public.trusted_contact_preferences add column if not exists can_call boolean default true;
alter table public.user_devices add column if not exists fcm_token text;

create unique index if not exists idx_trusted_contact_preferences_user_contact
  on public.trusted_contact_preferences (user_id, trusted_contact_id)
  where trusted_contact_id is not null;
create index if not exists idx_user_devices_expo_token
  on public.user_devices (fcm_token) where fcm_token is not null;

commit;
