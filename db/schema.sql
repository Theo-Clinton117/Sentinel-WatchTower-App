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

create table if not exists phone_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
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

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null,
  status text not null default 'PENDING_VERIFICATION',
  official_email text,
  official_phone text,
  physical_address text,
  registration_info jsonb not null default '{}'::jsonb,
  representative_name text,
  representative_contact jsonb not null default '{}'::jsonb,
  intended_operating_jurisdiction text,
  verified_at timestamptz,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint organizations_status_check check (status in ('PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'REJECTED'))
);

create table if not exists organization_roles (
  code text primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists organization_permissions (
  code text primary key,
  description text not null,
  created_at timestamptz default now()
);

create table if not exists organization_role_permissions (
  role_code text not null references organization_roles(code) on delete cascade,
  permission_code text not null references organization_permissions(code) on delete cascade,
  created_at timestamptz default now(),
  primary key (role_code, permission_code)
);

insert into organization_roles (code, name)
values
  ('OWNER', 'Owner'),
  ('ADMIN', 'Administrator'),
  ('SAFETY_OFFICER', 'Safety Officer'),
  ('VIEWER', 'Viewer'),
  ('MEMBER', 'Member')
on conflict (code) do nothing;

insert into organization_permissions (code, description)
values
  ('manage_organization', 'Manage organization profile and settings'),
  ('manage_administrators', 'Assign and remove organization administrators'),
  ('manage_members', 'Invite, suspend, or remove members'),
  ('manage_locations', 'Create and maintain organization locations'),
  ('manage_jurisdictions', 'Manage organization jurisdictions'),
  ('manage_billing', 'Manage billing and subscription settings'),
  ('view_authorized_incidents', 'View incidents authorized for the organization'),
  ('view_incident_history', 'View historical incidents'),
  ('send_broadcasts', 'Send organization broadcasts'),
  ('access_emergency_info', 'Access emergency information relevant to assigned duties'),
  ('receive_critical_alerts', 'Receive critical organization alerts'),
  ('view_safety_info', 'View organization safety information'),
  ('receive_relevant_alerts', 'Receive alerts relevant to the member'),
  ('use_normal_sentinel', 'Use standard Sentinel functionality'),
  ('view_member_location', 'View member location data when permitted')
on conflict (code) do nothing;

insert into organization_role_permissions (role_code, permission_code)
values
  ('OWNER', 'manage_organization'),
  ('OWNER', 'manage_administrators'),
  ('OWNER', 'manage_members'),
  ('OWNER', 'manage_locations'),
  ('OWNER', 'manage_jurisdictions'),
  ('OWNER', 'manage_billing'),
  ('OWNER', 'view_authorized_incidents'),
  ('OWNER', 'view_incident_history'),
  ('OWNER', 'send_broadcasts'),
  ('OWNER', 'access_emergency_info'),
  ('OWNER', 'receive_critical_alerts'),
  ('OWNER', 'view_member_location'),
  ('ADMIN', 'manage_members'),
  ('ADMIN', 'manage_locations'),
  ('ADMIN', 'manage_jurisdictions'),
  ('ADMIN', 'view_authorized_incidents'),
  ('ADMIN', 'view_incident_history'),
  ('ADMIN', 'send_broadcasts'),
  ('ADMIN', 'access_emergency_info'),
  ('ADMIN', 'receive_critical_alerts'),
  ('ADMIN', 'view_member_location'),
  ('SAFETY_OFFICER', 'view_authorized_incidents'),
  ('SAFETY_OFFICER', 'view_incident_history'),
  ('SAFETY_OFFICER', 'access_emergency_info'),
  ('SAFETY_OFFICER', 'receive_critical_alerts'),
  ('VIEWER', 'view_safety_info'),
  ('MEMBER', 'receive_relevant_alerts'),
  ('MEMBER', 'use_normal_sentinel')
on conflict (role_code, permission_code) do nothing;

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role_code text not null references organization_roles(code) on delete restrict,
  status text not null default 'INVITED',
  invited_by_user_id uuid references users(id) on delete set null,
  invitation_channel text,
  permissions jsonb not null default '{}'::jsonb,
  joined_at timestamptz,
  suspended_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint organization_members_status_check check (status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED')),
  unique (organization_id, user_id)
);

create table if not exists organization_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  location_type text not null default 'general',
  center_lat double precision,
  center_lng double precision,
  boundary_geojson jsonb,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organization_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  jurisdiction_type text not null default 'local',
  boundary_geojson jsonb,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invited_by_user_id uuid references users(id) on delete set null,
  invitee_user_id uuid references users(id) on delete set null,
  invitee_email text,
  invitee_phone text,
  invite_token_hash text not null unique,
  invitation_channel text not null default 'email',
  status text not null default 'INVITED',
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint organization_invitations_status_check check (status in ('INVITED', 'ACCEPTED', 'EXPIRED', 'REVOKED'))
);

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  source_alert_id uuid references alerts(id) on delete set null,
  reporting_user_id uuid references users(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  alert_type text not null default 'LOCAL_EMERGENCY',
  severity text not null default 'medium',
  title text,
  description text,
  lat double precision,
  lng double precision,
  location_accuracy_m real,
  jurisdiction_name text,
  priority_score numeric(10, 4) not null default 0,
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists incident_locations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  source text not null default 'incident',
  organization_location_id uuid references organization_locations(id) on delete set null,
  organization_jurisdiction_id uuid references organization_jurisdictions(id) on delete set null,
  lat double precision,
  lng double precision,
  radius_m int,
  boundary_geojson jsonb,
  created_at timestamptz default now()
);

create table if not exists organization_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  incident_id uuid references incidents(id) on delete cascade,
  source_alert_id uuid references alerts(id) on delete set null,
  alert_type text not null default 'ORGANIZATION_INCIDENT',
  delivery_scope text not null default 'members',
  priority_score numeric(10, 4) not null default 0,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references incidents(id) on delete cascade,
  organization_alert_id uuid references organization_alerts(id) on delete cascade,
  recipient_user_id uuid references users(id) on delete cascade,
  delivery_channel text not null,
  delivery_status text not null default 'queued',
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists organization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
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

create table if not exists geopolitical_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists states (
  id uuid primary key default gen_random_uuid(),
  geopolitical_zone_id uuid not null references geopolitical_zones(id) on delete restrict,
  code text not null unique,
  name text not null unique,
  type text not null default 'state',
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists operational_zones (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id) on delete cascade,
  code text not null unique,
  name text not null,
  lgas text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz default now(),
  unique (state_id, name)
);

create table if not exists response_grids (
  id uuid primary key default gen_random_uuid(),
  operational_zone_id uuid not null references operational_zones(id) on delete cascade,
  code text not null unique,
  name text not null,
  grid_type text not null default 'neighborhood',
  center_lat double precision,
  center_lng double precision,
  boundary_geojson jsonb,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  unique (operational_zone_id, name)
);

create table if not exists risk_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int default 0,
  risk_level text default 'medium',
  operational_zone_id uuid references operational_zones(id) on delete set null,
  response_grid_id uuid references response_grids(id) on delete set null,
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
create index if not exists idx_phone_otp_challenges_lookup on phone_otp_challenges(phone_e164, created_at desc) where consumed_at is null;
create index if not exists idx_phone_otp_challenges_expiry on phone_otp_challenges(expires_at);
create index if not exists idx_alerts_user on alerts(user_id, created_at desc);
create index if not exists idx_organizations_status on organizations(status, created_at desc);
create index if not exists idx_organization_members_user on organization_members(user_id, status, organization_id);
create index if not exists idx_organization_members_org on organization_members(organization_id, status, role_code);
create index if not exists idx_organization_locations_org on organization_locations(organization_id, active, created_at desc);
create index if not exists idx_organization_jurisdictions_org on organization_jurisdictions(organization_id, active, created_at desc);
create index if not exists idx_organization_invitations_org on organization_invitations(organization_id, status, created_at desc);
create index if not exists idx_organization_alerts_org on organization_alerts(organization_id, created_at desc);
create index if not exists idx_incidents_org on incidents(organization_id, created_at desc);
create index if not exists idx_alert_deliveries_incident on alert_deliveries(incident_id, created_at desc);
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
create index if not exists idx_states_geopolitical_zone on states(geopolitical_zone_id, sort_order, name);
create index if not exists idx_operational_zones_state on operational_zones(state_id, sort_order, name);
create index if not exists idx_response_grids_operational_zone on response_grids(operational_zone_id, sort_order, name);
create index if not exists idx_risk_zones_operational_zone on risk_zones(operational_zone_id);
create index if not exists idx_risk_zones_response_grid on risk_zones(response_grid_id);

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
