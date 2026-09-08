-- 018_email_otp_signup_name.sql
-- Preserve the signup name across the email OTP round trip.

alter table email_otp_challenges
  add column if not exists name text;
