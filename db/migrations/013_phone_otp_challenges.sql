-- 013_phone_otp_challenges.sql
-- Store backend-owned phone OTP challenges for Amazon SNS delivery.

create table if not exists phone_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_otp_challenges_lookup
  on phone_otp_challenges (phone_e164, created_at desc)
  where consumed_at is null;

create index if not exists idx_phone_otp_challenges_expiry
  on phone_otp_challenges (expires_at);
