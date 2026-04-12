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

alter table user_credibility_profiles enable row level security;
alter table report_classifications enable row level security;

create policy credibility_profiles_read on user_credibility_profiles for select using (user_id = auth.uid());
create policy report_classifications_read on report_classifications for select using (
  exists(select 1 from reports r where r.id = report_id and r.user_id = auth.uid())
);
