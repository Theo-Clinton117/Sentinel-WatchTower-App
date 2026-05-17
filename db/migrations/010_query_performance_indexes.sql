alter table watch_sessions add column if not exists user_id uuid references users(id) on delete cascade;
alter table watch_sessions add column if not exists alert_id uuid references alerts(id) on delete cascade;
alter table watch_sessions add column if not exists status text default 'active';
alter table watch_sessions add column if not exists started_at timestamptz default now();
alter table alerts add column if not exists user_id uuid references users(id) on delete cascade;
alter table alerts add column if not exists status text default 'active';
alter table alerts add column if not exists created_at timestamptz default now();
alter table reports add column if not exists user_id uuid references users(id) on delete cascade;
alter table reports add column if not exists created_at timestamptz default now();
alter table trusted_contacts add column if not exists user_id uuid references users(id) on delete cascade;
alter table trusted_contacts add column if not exists priority int default 0;
alter table trusted_contacts add column if not exists created_at timestamptz default now();
alter table notifications add column if not exists user_id uuid references users(id) on delete cascade;
alter table notifications add column if not exists created_at timestamptz default now();
alter table subscriptions add column if not exists user_id uuid references users(id) on delete cascade;
alter table subscriptions add column if not exists started_at timestamptz default now();
alter table subscriptions add column if not exists current_period_end timestamptz;
alter table latency_metrics add column if not exists user_id uuid references users(id) on delete cascade;
alter table latency_metrics add column if not exists recorded_at timestamptz default now();

create index if not exists idx_watch_sessions_user_status_started
  on watch_sessions(user_id, status, started_at desc);

create index if not exists idx_watch_sessions_alert_status
  on watch_sessions(alert_id, status);

create index if not exists idx_alerts_user_status_created
  on alerts(user_id, status, created_at desc);

create index if not exists idx_reports_user_created
  on reports(user_id, created_at desc);

create index if not exists idx_trusted_contacts_user_priority_created
  on trusted_contacts(user_id, priority asc, created_at desc);

create index if not exists idx_notifications_user_created
  on notifications(user_id, created_at desc);

create index if not exists idx_subscriptions_user_period
  on subscriptions(user_id, started_at desc nulls last, current_period_end desc nulls last);

create index if not exists idx_latency_metrics_user_recorded
  on latency_metrics(user_id, recorded_at desc);
