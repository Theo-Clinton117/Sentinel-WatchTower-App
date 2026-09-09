-- Additive repair for production databases created before phone verification
-- and prepaid service entitlements were introduced. No existing data is removed.
create extension if not exists pgcrypto;

alter table if exists users
  add column if not exists phone_verified boolean not null default false;

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  provider text,
  status text,
  plan_name text,
  amount_ngn integer default 1000,
  started_at timestamptz default now(),
  current_period_end timestamptz,
  provider_ref text
);

alter table if exists subscriptions
  add column if not exists paid_until timestamptz;
alter table if exists subscriptions
  add column if not exists entitlement_status text not null default 'active';
alter table if exists subscriptions
  add column if not exists duration_days integer not null default 30;
alter table if exists subscriptions
  add column if not exists payment_amount_ngn integer;
alter table if exists subscriptions
  add column if not exists payment_currency text;
alter table if exists subscriptions
  add column if not exists payment_at timestamptz;
alter table if exists subscriptions
  add column if not exists paystack_metadata jsonb not null default '{}'::jsonb;

update subscriptions
set paid_until = coalesce(paid_until, current_period_end),
    payment_at = coalesce(payment_at, started_at)
where paid_until is null or payment_at is null;

create unique index if not exists idx_subscriptions_provider_ref_unique
  on subscriptions(provider, provider_ref)
  where provider_ref is not null;
create index if not exists subscriptions_paid_until_idx on subscriptions(user_id, paid_until desc);

create table if not exists entitlement_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  paid_until timestamptz not null,
  reminder_key text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, paid_until, reminder_key)
);
