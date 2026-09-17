-- Pending contact changes keep verified contacts authoritative until the
-- recipient completes the existing OTP verification process.
create table if not exists user_contact_change_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  pending_value text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists user_contact_change_one_active
  on user_contact_change_challenges(user_id, contact_type)
  where consumed_at is null;

-- One family account owns its entitlement. Covered members never receive
-- duplicate payment rows or independent paid_until grants.
create table if not exists family_subscription_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  -- Total covered Sentinel accounts, including the primary payer.
  account_limit integer not null default 4 check (account_limit = 4),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists family_subscription_members (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references family_subscription_accounts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'active',
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  unique(family_account_id, user_id)
);
create index if not exists family_subscription_members_user_idx
  on family_subscription_members(user_id) where status = 'active';
create unique index if not exists family_subscription_member_one_active_family
  on family_subscription_members(user_id) where status = 'active';

create table if not exists family_subscription_invitations (
  id uuid primary key default gen_random_uuid(),
  family_account_id uuid not null references family_subscription_accounts(id) on delete cascade,
  invited_by_user_id uuid not null references users(id) on delete cascade,
  invite_token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by_user_id uuid references users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists family_subscription_invitations_active_idx
  on family_subscription_invitations(family_account_id, created_at desc)
  where status = 'pending';

-- Append-only billing and delivery history. Provider references make payment
-- events idempotent without retaining card data.
create table if not exists subscription_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  event_type text not null,
  provider text,
  provider_ref text,
  amount_ngn integer,
  entitlement_start_at timestamptz,
  entitlement_end_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists subscription_audit_provider_event_unique
  on subscription_audit_events(provider, provider_ref, event_type)
  where provider_ref is not null;
create index if not exists subscription_audit_user_timeline_idx
  on subscription_audit_events(user_id, created_at desc);

create table if not exists subscription_notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  event_type text not null,
  channel text not null,
  delivery_status text not null default 'pending',
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  attempted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists subscription_notification_events_user_idx
  on subscription_notification_events(user_id, created_at desc);
