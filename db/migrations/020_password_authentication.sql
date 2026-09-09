-- Passwords are salted scrypt hashes created by the backend; plaintext is never persisted.
begin;
alter table public.users add column if not exists password_hash text;
commit;
