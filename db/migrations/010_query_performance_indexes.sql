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
