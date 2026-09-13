-- Verified contact state and single-use password recovery challenges.
-- Existing email accounts predate verified-email tracking, so they remain
-- unverified until they complete a verification flow.
alter table if exists users
  add column if not exists email_verified boolean not null default false;

create table if not exists password_reset_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_challenges_lookup
  on password_reset_challenges (user_id, created_at desc)
  where consumed_at is null;
