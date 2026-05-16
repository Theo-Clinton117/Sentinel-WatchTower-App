create table if not exists alert_audit_events (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  session_id uuid references watch_sessions(id) on delete set null,
  user_id uuid references users(id) on delete cascade,
  event_type text not null,
  source text not null default 'system',
  from_stage text,
  to_stage text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_alert_audit_events_alert_created
  on alert_audit_events(alert_id, created_at desc);

create index if not exists idx_alert_audit_events_user_created
  on alert_audit_events(user_id, created_at desc);

alter table alert_audit_events enable row level security;

create policy alert_audit_events_read on alert_audit_events
  for select using (user_id = auth.uid());
