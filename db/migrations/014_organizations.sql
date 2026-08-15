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

create index if not exists idx_organizations_status on organizations(status, created_at desc);
create index if not exists idx_organization_members_user on organization_members(user_id, status, organization_id);
create index if not exists idx_organization_members_org on organization_members(organization_id, status, role_code);
create index if not exists idx_organization_locations_org on organization_locations(organization_id, active, created_at desc);
create index if not exists idx_organization_jurisdictions_org on organization_jurisdictions(organization_id, active, created_at desc);
create index if not exists idx_organization_invitations_org on organization_invitations(organization_id, status, created_at desc);
create index if not exists idx_organization_alerts_org on organization_alerts(organization_id, created_at desc);
create index if not exists idx_incidents_org on incidents(organization_id, created_at desc);
create index if not exists idx_alert_deliveries_incident on alert_deliveries(incident_id, created_at desc);
