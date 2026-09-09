-- Passwords are salted scrypt hashes created by the backend; plaintext is never persisted.
begin;
alter table public.users add column if not exists password_hash text;
create unique index if not exists idx_user_devices_user_device
  on public.user_devices (user_id, device_id);
commit;
