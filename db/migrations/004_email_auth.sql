alter table users
  alter column phone_e164 drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_contact_identity_check'
  ) then
    alter table users
      add constraint users_contact_identity_check
      check (phone_e164 is not null or email is not null);
  end if;
end $$;

create unique index if not exists users_email_lower_idx
  on users (lower(email))
  where email is not null;
