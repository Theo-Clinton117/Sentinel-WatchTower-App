create table if not exists auth_refresh_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  device_id text,
  token_id text not null unique,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  replaced_by_session_id uuid references auth_refresh_sessions(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_auth_refresh_sessions_user on auth_refresh_sessions(user_id, created_at desc);
create index if not exists idx_auth_refresh_sessions_token_hash on auth_refresh_sessions(token_hash);
create index if not exists idx_auth_refresh_sessions_token_id on auth_refresh_sessions(token_id);
