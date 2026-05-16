create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text unique,
  name text,
  email text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint users_contact_identity_check check (phone_e164 is not null or email is not null)
);

create unique index if not exists users_email_lower_idx on users (lower(email)) where email is not null;

create table if not exists user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_id text not null,
  platform text,
  fcm_token text,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists user_roles (
  user_id uuid references users(id) on delete cascade,
  role_id uuid references roles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, role_id)
);

insert into roles (name)
values ('user'), ('reviewer'), ('admin')
on conflict (name) do nothing;

create table if not exists reviewer_role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending',
  motivation text,
  admin_note text,
  reviewed_by uuid references users(id) on delete set null,
  requested_at timestamptz default now(),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  contact_user_id uuid,
  contact_name text,
  contact_phone text,
  contact_email text,
  status text default 'pending',
  priority int default 0,
  created_at timestamptz default now()
);

create table if not exists user_trust_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  contact_id uuid references trusted_contacts(id) on delete cascade,
  can_view_location boolean default true,
  can_view_history boolean default false,
  can_sms boolean default true,
  can_call boolean default true,
  created_at timestamptz default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  status text default 'active',
  trigger_source text,
  stage text default 'high_alert',
  escalation_level int default 0,
  risk_score int default 0,
  risk_snapshot jsonb default '{}'::jsonb,
  detection_summary jsonb default '[]'::jsonb,
  cancel_expires_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists watch_sessions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references alerts(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  status text default 'active',
  escalation_level int default 0,
  started_at timestamptz default now(),
  ended_at timestamptz,
  last_location_at timestamptz
);

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

create table if not exists location_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references watch_sessions(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  source text,
  recorded_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  session_id uuid references watch_sessions(id) on delete set null,
  title text not null,
  description text,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  url text not null,
  mime_type text,
  created_at timestamptz default now()
);

create table if not exists report_flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  reason text,
  created_at timestamptz default now()
);

create table if not exists report_confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists user_credibility_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  score int not null default 50,
  rating_tier text not null default 'mid',
  restriction_level text not null default 'none',
  restriction_expires_at timestamptz,
  warning_count int not null default 0,
  total_reports_count int not null default 0,
  confirmed_true_reports_count int not null default 0,
  likely_true_reports_count int not null default 0,
  inconclusive_reports_count int not null default 0,
  false_reports_count int not null default 0,
  malicious_reports_count int not null default 0,
  corroborated_reports_count int not null default 0,
  quality_score_avg real not null default 0,
  last_reported_at timestamptz,
  last_scored_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists report_classifications (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references reports(id) on delete cascade,
  classification text not null default 'inconclusive',
  response_outcome text not null default 'pending',
  ai_confidence real not null default 0,
  quality_score real not null default 0,
  credibility_snapshot real not null default 0,
  corroboration_count int not null default 0,
  notes text,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists risk_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int default 0,
  risk_level text default 'medium',
  created_at timestamptz default now()
);

create table if not exists latency_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  metric_type text not null,
  latency_ms int not null,
  recorded_at timestamptz default now()
);

create table if not exists latency_summary (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  avg_latency_ms int,
  p95_latency_ms int,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text,
  channel text,
  status text,
  payload jsonb,
  related_session_id uuid,
  created_at timestamptz default now(),
  sent_at timestamptz
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  provider text,
  status text,
  plan_name text,
  amount_ngn int default 1000,
  started_at timestamptz default now(),
  current_period_end timestamptz,
  provider_ref text
);

create table if not exists telemetry_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  event_name text not null,
  properties jsonb,
  created_at timestamptz default now()
);

create table if not exists nearby_safety_mesh_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  area_cell text not null,
  ephemeral_device_id text not null,
  proximity_band text not null default 'medium',
  motion_state text not null default 'unknown',
  confidence real not null default 0,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint nearby_safety_mesh_motion_state_check check (
    motion_state in ('stationary', 'walking', 'running', 'driving', 'unknown')
  ),
  constraint nearby_safety_mesh_proximity_band_check check (
    proximity_band in ('near', 'medium', 'far')
  ),
  constraint nearby_safety_mesh_confidence_check check (confidence >= 0 and confidence <= 1)
);

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  phone text,
  email text,
  source text,
  created_at timestamptz default now()
);

create index if not exists idx_location_logs_session on location_logs(session_id, recorded_at desc);
create index if not exists idx_alerts_user on alerts(user_id, created_at desc);
create index if not exists idx_watch_sessions_user on watch_sessions(user_id, status);
create unique index if not exists idx_reviewer_role_requests_pending_user on reviewer_role_requests(user_id) where status = 'pending';
create index if not exists idx_alert_audit_events_alert_created on alert_audit_events(alert_id, created_at desc);
create index if not exists idx_alert_audit_events_user_created on alert_audit_events(user_id, created_at desc);
create index if not exists idx_watch_sessions_user_status_started on watch_sessions(user_id, status, started_at desc);
create index if not exists idx_watch_sessions_alert_status on watch_sessions(alert_id, status);
create index if not exists idx_alerts_user_status_created on alerts(user_id, status, created_at desc);
create index if not exists idx_reports_user_created on reports(user_id, created_at desc);
create index if not exists idx_trusted_contacts_user_priority_created on trusted_contacts(user_id, priority asc, created_at desc);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_subscriptions_user_period on subscriptions(user_id, started_at desc nulls last, current_period_end desc nulls last);
create index if not exists idx_latency_metrics_user_recorded on latency_metrics(user_id, recorded_at desc);

alter table reports add column if not exists category text;
alter table reports add column if not exists severity text default 'medium';
alter table reports add column if not exists lat double precision;
alter table reports add column if not exists lng double precision;
alter table reports add column if not exists location_accuracy_m real;
alter table reports add column if not exists visibility_scope text default 'nearby_only';
alter table reports add column if not exists distribution_status text default 'queued';
alter table reports add column if not exists distribution_reason text;
alter table reports add column if not exists requires_manual_review boolean default false;
alter table reports add column if not exists throttled_until timestamptz;
alter table reports add column if not exists restriction_applied text default 'none';

create unique index if not exists idx_report_confirmations_unique on report_confirmations(report_id, user_id);
create unique index if not exists idx_report_flags_unique on report_flags(report_id, user_id);
create index if not exists idx_reports_geocluster on reports(lat, lng, created_at desc);
create index if not exists idx_user_credibility_profiles_user on user_credibility_profiles(user_id);
create unique index if not exists idx_nearby_safety_mesh_unique_signal on nearby_safety_mesh_signals(user_id, ephemeral_device_id);
create index if not exists idx_nearby_safety_mesh_area_active on nearby_safety_mesh_signals(area_cell, expires_at desc, observed_at desc);

alter table users enable row level security;
alter table user_devices enable row level security;
alter table trusted_contacts enable row level security;
alter table user_trust_profiles enable row level security;
alter table reviewer_role_requests enable row level security;
alter table alerts enable row level security;
alter table watch_sessions enable row level security;
alter table alert_audit_events enable row level security;
alter table location_logs enable row level security;
alter table reports enable row level security;
alter table user_credibility_profiles enable row level security;
alter table report_classifications enable row level security;
alter table notifications enable row level security;
alter table subscriptions enable row level security;
alter table telemetry_events enable row level security;
alter table nearby_safety_mesh_signals enable row level security;

create policy users_read on users for select using (id = auth.uid());
create policy users_update on users for update using (id = auth.uid());

create policy devices_rw on user_devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy contacts_read on trusted_contacts for select using (user_id = auth.uid() or contact_user_id = auth.uid());
create policy contacts_write on trusted_contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy trust_profiles_rw on user_trust_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviewer_role_requests_read on reviewer_role_requests for select using (user_id = auth.uid());
create policy reviewer_role_requests_write on reviewer_role_requests for insert with check (user_id = auth.uid());

create policy alerts_rw on alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sessions_rw on watch_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy alert_audit_events_read on alert_audit_events for select using (user_id = auth.uid());
create policy locations_rw on location_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reports_rw on reports for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy credibility_profiles_read on user_credibility_profiles for select using (user_id = auth.uid());
create policy report_classifications_read on report_classifications for select using (
  exists(select 1 from reports r where r.id = report_id and r.user_id = auth.uid())
);
create policy notifications_rw on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscriptions_rw on subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy telemetry_rw on telemetry_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy nearby_safety_mesh_rw on nearby_safety_mesh_signals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
