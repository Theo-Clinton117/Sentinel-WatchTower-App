-- 017_email_otp_challenges.sql
-- Store backend-owned email OTP challenges for direct Resend delivery.

create table if not exists email_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_otp_challenges_lookup
  on email_otp_challenges (lower(email), created_at desc)
  where consumed_at is null;

create index if not exists idx_email_otp_challenges_expiry
  on email_otp_challenges (expires_at);
