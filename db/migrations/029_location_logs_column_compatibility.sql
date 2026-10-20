-- The production location_logs table uses the coordinate names below. Earlier
-- fresh-install SQL used legacy aliases, so upgrade only when the authoritative
-- columns are absent. Existing production schemas are intentionally untouched.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'location_logs' and column_name = 'lat'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'location_logs' and column_name = 'latitude'
  ) then
    alter table public.location_logs rename column lat to latitude;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'location_logs' and column_name = 'lng'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'location_logs' and column_name = 'longitude'
  ) then
    alter table public.location_logs rename column lng to longitude;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'location_logs' and column_name = 'accuracy_m'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'location_logs' and column_name = 'accuracy'
  ) then
    alter table public.location_logs rename column accuracy_m to accuracy;
  end if;
end $$;
