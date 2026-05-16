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

create unique index if not exists idx_nearby_safety_mesh_unique_signal
  on nearby_safety_mesh_signals(user_id, ephemeral_device_id);

create index if not exists idx_nearby_safety_mesh_area_active
  on nearby_safety_mesh_signals(area_cell, expires_at desc, observed_at desc);

alter table nearby_safety_mesh_signals enable row level security;

create policy nearby_safety_mesh_rw on nearby_safety_mesh_signals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
