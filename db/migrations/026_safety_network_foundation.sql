-- Safety-network foundation. Circle membership is deliberately separate from
-- location visibility; no membership row grants access to coordinates.
create table if not exists safety_circles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  kind text not null default 'custom' check (kind in ('family', 'partner', 'friends', 'work', 'children', 'custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists safety_circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references safety_circles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  emergency_recipient boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(circle_id, user_id)
);

create table if not exists safety_circle_invitations (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references safety_circles(id) on delete cascade,
  invited_by_user_id uuid not null references users(id) on delete cascade,
  invited_user_id uuid references users(id) on delete cascade,
  invited_email text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists safety_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  destination_label text not null,
  destination_lat double precision,
  destination_lng double precision,
  status text not null default 'active' check (status in ('not_started', 'active', 'paused', 'arrived', 'cancelled', 'expired', 'location_unavailable')),
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz,
  last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists safety_journey_recipients (
  journey_id uuid not null references safety_journeys(id) on delete cascade,
  recipient_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (journey_id, recipient_user_id)
);

create table if not exists location_access_grants (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references users(id) on delete cascade,
  grantee_user_id uuid not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('journey', 'emergency', 'live_share')),
  journey_id uuid references safety_journeys(id) on delete cascade,
  alert_id uuid references alerts(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (subject_user_id <> grantee_user_id)
);

create table if not exists location_access_audit_events (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references users(id) on delete cascade,
  requester_user_id uuid references users(id) on delete set null,
  grant_id uuid references location_access_grants(id) on delete set null,
  action text not null,
  outcome text not null check (outcome in ('allowed', 'denied')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists safety_circle_members_user_active_idx on safety_circle_members(user_id, status);
create index if not exists safety_journeys_user_active_idx on safety_journeys(user_id, status, created_at desc);
create index if not exists location_access_grants_lookup_idx on location_access_grants(subject_user_id, grantee_user_id, status, expires_at desc);
create index if not exists location_access_audit_subject_idx on location_access_audit_events(subject_user_id, created_at desc);
