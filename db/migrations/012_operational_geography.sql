-- 012_operational_geography.sql
-- Add Sentinel's national operating geography hierarchy.

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

alter table risk_zones add column if not exists operational_zone_id uuid references operational_zones(id) on delete set null;
alter table risk_zones add column if not exists response_grid_id uuid references response_grids(id) on delete set null;

create index if not exists idx_states_geopolitical_zone on states(geopolitical_zone_id, sort_order, name);
create index if not exists idx_operational_zones_state on operational_zones(state_id, sort_order, name);
create index if not exists idx_response_grids_operational_zone on response_grids(operational_zone_id, sort_order, name);
create index if not exists idx_risk_zones_operational_zone on risk_zones(operational_zone_id);
create index if not exists idx_risk_zones_response_grid on risk_zones(response_grid_id);

insert into geopolitical_zones (code, name, sort_order)
values
  ('north_central', 'North Central', 1),
  ('north_east', 'North East', 2),
  ('north_west', 'North West', 3),
  ('south_east', 'South East', 4),
  ('south_south', 'South South', 5),
  ('south_west', 'South West', 6)
on conflict (code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into states (geopolitical_zone_id, code, name, type, sort_order)
select gz.id, s.code, s.name, s.type, s.sort_order
from (
  values
    ('north_central', 'benue', 'Benue', 'state', 1),
    ('north_central', 'kogi', 'Kogi', 'state', 2),
    ('north_central', 'kwara', 'Kwara', 'state', 3),
    ('north_central', 'nasarawa', 'Nasarawa', 'state', 4),
    ('north_central', 'niger', 'Niger', 'state', 5),
    ('north_central', 'plateau', 'Plateau', 'state', 6),
    ('north_central', 'fct', 'FCT', 'territory', 7),
    ('north_east', 'adamawa', 'Adamawa', 'state', 1),
    ('north_east', 'bauchi', 'Bauchi', 'state', 2),
    ('north_east', 'borno', 'Borno', 'state', 3),
    ('north_east', 'gombe', 'Gombe', 'state', 4),
    ('north_east', 'taraba', 'Taraba', 'state', 5),
    ('north_east', 'yobe', 'Yobe', 'state', 6),
    ('north_west', 'jigawa', 'Jigawa', 'state', 1),
    ('north_west', 'kaduna', 'Kaduna', 'state', 2),
    ('north_west', 'kano', 'Kano', 'state', 3),
    ('north_west', 'katsina', 'Katsina', 'state', 4),
    ('north_west', 'kebbi', 'Kebbi', 'state', 5),
    ('north_west', 'sokoto', 'Sokoto', 'state', 6),
    ('north_west', 'zamfara', 'Zamfara', 'state', 7),
    ('south_east', 'abia', 'Abia', 'state', 1),
    ('south_east', 'anambra', 'Anambra', 'state', 2),
    ('south_east', 'ebonyi', 'Ebonyi', 'state', 3),
    ('south_east', 'enugu', 'Enugu', 'state', 4),
    ('south_east', 'imo', 'Imo', 'state', 5),
    ('south_south', 'akwa_ibom', 'Akwa Ibom', 'state', 1),
    ('south_south', 'bayelsa', 'Bayelsa', 'state', 2),
    ('south_south', 'cross_river', 'Cross River', 'state', 3),
    ('south_south', 'delta', 'Delta', 'state', 4),
    ('south_south', 'edo', 'Edo', 'state', 5),
    ('south_south', 'rivers', 'Rivers', 'state', 6),
    ('south_west', 'ekiti', 'Ekiti', 'state', 1),
    ('south_west', 'lagos', 'Lagos', 'state', 2),
    ('south_west', 'ogun', 'Ogun', 'state', 3),
    ('south_west', 'ondo', 'Ondo', 'state', 4),
    ('south_west', 'osun', 'Osun', 'state', 5),
    ('south_west', 'oyo', 'Oyo', 'state', 6)
) as s(zone_code, code, name, type, sort_order)
join geopolitical_zones gz on gz.code = s.zone_code
on conflict (code) do update set
  geopolitical_zone_id = excluded.geopolitical_zone_id,
  name = excluded.name,
  type = excluded.type,
  sort_order = excluded.sort_order;

insert into operational_zones (state_id, code, name, lgas, sort_order)
select st.id, oz.code, oz.name, oz.lgas, oz.sort_order
from (
  values
    ('rivers', 'rivers_port_harcourt_metro', 'Port Harcourt Metro', array['Port Harcourt', 'Obio-Akpor'], 1),
    ('rivers', 'rivers_western', 'Western Rivers', array['Degema', 'Asari-Toru', 'Akuku-Toru'], 2),
    ('rivers', 'rivers_northern', 'Northern Rivers', array['Ikwerre', 'Emohua', 'Etche'], 3),
    ('rivers', 'rivers_eastern', 'Eastern Rivers', array['Ogu/Bolo', 'Okrika', 'Eleme', 'Tai'], 4),
    ('rivers', 'rivers_ogoni_axis', 'Ogoni Axis', array['Khana', 'Gokana'], 5),
    ('rivers', 'rivers_south_east', 'South-East Rivers', array['Andoni', 'Opobo/Nkoro', 'Oyigbo'], 6),
    ('lagos', 'lagos_island', 'Lagos Island', array['Lagos Island', 'Lagos Mainland'], 1),
    ('lagos', 'lagos_ikeja_metro', 'Ikeja Metro', array['Ikeja', 'Oshodi-Isolo', 'Mushin'], 2),
    ('lagos', 'lagos_lekki_corridor', 'Lekki Corridor', array['Eti-Osa', 'Ibeju-Lekki'], 3),
    ('lagos', 'lagos_badagry_axis', 'Badagry Axis', array['Badagry', 'Ojo'], 4),
    ('lagos', 'lagos_ikorodu_axis', 'Ikorodu Axis', array['Ikorodu'], 5),
    ('lagos', 'lagos_agege_axis', 'Agege Axis', array['Agege', 'Ifako-Ijaiye'], 6),
    ('lagos', 'lagos_alimosho_axis', 'Alimosho Axis', array['Alimosho'], 7),
    ('kano', 'kano_metro', 'Kano Metro', array['Kano Municipal', 'Fagge', 'Tarauni', 'Dala', 'Gwale'], 1),
    ('kano', 'kano_north', 'North Kano', array['Kunchi', 'Makoda', 'Dawakin Tofa'], 2),
    ('kano', 'kano_south', 'South Kano', array['Bebeji', 'Rano', 'Kibiya'], 3),
    ('kano', 'kano_east', 'East Kano', array['Gaya', 'Ajingi', 'Albasu'], 4),
    ('kano', 'kano_west', 'West Kano', array['Karaye', 'Rogo'], 5)
) as oz(state_code, code, name, lgas, sort_order)
join states st on st.code = oz.state_code
on conflict (code) do update set
  state_id = excluded.state_id,
  name = excluded.name,
  lgas = excluded.lgas,
  sort_order = excluded.sort_order;

insert into response_grids (operational_zone_id, code, name, grid_type, sort_order)
select oz.id, rg.code, rg.name, 'neighborhood', rg.sort_order
from (
  values
    ('rivers_port_harcourt_metro', 'ph_metro_gra', 'GRA', 1),
    ('rivers_port_harcourt_metro', 'ph_metro_d_line', 'D-Line', 2),
    ('rivers_port_harcourt_metro', 'ph_metro_rumuola', 'Rumuola', 3),
    ('rivers_port_harcourt_metro', 'ph_metro_rumuokoro', 'Rumuokoro', 4),
    ('rivers_port_harcourt_metro', 'ph_metro_woji', 'Woji', 5),
    ('rivers_port_harcourt_metro', 'ph_metro_old_gra', 'Old GRA', 6),
    ('rivers_port_harcourt_metro', 'ph_metro_trans_amadi', 'Trans Amadi', 7),
    ('rivers_port_harcourt_metro', 'ph_metro_borokiri', 'Borokiri', 8),
    ('rivers_port_harcourt_metro', 'ph_metro_mile_1', 'Mile 1', 9),
    ('rivers_port_harcourt_metro', 'ph_metro_mile_3', 'Mile 3', 10)
) as rg(operational_zone_code, code, name, sort_order)
join operational_zones oz on oz.code = rg.operational_zone_code
on conflict (code) do update set
  operational_zone_id = excluded.operational_zone_id,
  name = excluded.name,
  grid_type = excluded.grid_type,
  sort_order = excluded.sort_order;
