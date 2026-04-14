alter table alerts add column if not exists stage text default 'high_alert';
alter table alerts add column if not exists risk_score int default 0;
alter table alerts add column if not exists risk_snapshot jsonb default '{}'::jsonb;
alter table alerts add column if not exists detection_summary jsonb default '[]'::jsonb;
alter table alerts add column if not exists cancel_expires_at timestamptz;
alter table alerts add column if not exists escalated_at timestamptz;

update alerts
set stage = coalesce(stage, 'high_alert')
where stage is null;
