alter table safety_journeys
  add column if not exists check_in_requested_at timestamptz,
  add column if not exists last_check_in_at timestamptz;

create index if not exists safety_journeys_expiry_sweep_idx
  on safety_journeys (status, expires_at)
  where status in ('active', 'paused', 'location_unavailable');
