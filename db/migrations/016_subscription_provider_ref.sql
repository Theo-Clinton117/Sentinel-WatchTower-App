-- Provider references are the idempotency key for verified payments.
alter table subscriptions
  add column if not exists provider text;

alter table subscriptions
  add column if not exists provider_ref text;

create unique index if not exists idx_subscriptions_provider_ref_unique
  on subscriptions(provider, provider_ref)
  where provider_ref is not null;
