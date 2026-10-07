-- Safe Arrival retains only confirmation state, not a journey location trail.
alter table safety_journeys
  add column if not exists arrival_confirmation_count integer not null default 0,
  add column if not exists arrival_confirmation_started_at timestamptz;
