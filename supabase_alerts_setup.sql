-- Run in Supabase SQL editor for Sentinel WatchTower.
-- Step 1 scope: richer verification states + nearby confirmations + trust profiles.

create extension if not exists pgcrypto;

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('user', 'reviewer', 'admin'));

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  type text not null,
  severity text not null check (severity in ('Low', 'Medium', 'High')),
  description text not null default '',
  report_source text not null default 'authenticated' check (report_source in ('authenticated', 'anonymous')),
  reporter_alias text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'likely', 'unverified', 'false', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('Low', 'Medium', 'High')),
  message text not null,
  lat double precision,
  lng double precision,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_zones (
  zone_key text primary key,
  center_lat double precision not null default 0,
  center_lng double precision not null default 0,
  risk_level integer not null default 0 check (risk_level between 0 and 5),
  status text not null default 'active' check (status in ('active', 'resolved')),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.report_confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verdict text not null check (verdict in ('present', 'absent', 'unsure')),
  confidence integer not null default 3 check (confidence between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create table if not exists public.user_trust_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trust_score numeric(5,2) not null default 50.00 check (trust_score between 0 and 100),
  confirmations_total integer not null default 0,
  accurate_confirmations integer not null default 0,
  false_confirmations integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Live Safety Watch',
  current_lat double precision,
  current_lng double precision,
  is_active boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.reports add column if not exists status text not null default 'pending';
alter table public.reports add column if not exists report_source text not null default 'authenticated';
alter table public.reports add column if not exists reporter_alias text;
alter table public.reports add column if not exists reviewed_by uuid references auth.users(id);
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists review_note text;
alter table public.reports alter column user_id drop not null;
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('pending', 'confirmed', 'likely', 'unverified', 'false', 'rejected'));
alter table public.reports drop constraint if exists reports_report_source_check;
alter table public.reports add constraint reports_report_source_check
  check (report_source in ('authenticated', 'anonymous'));
update public.reports
set report_source = case when user_id is null then 'anonymous' else 'authenticated' end
where report_source is null or report_source not in ('authenticated', 'anonymous');
alter table public.reports drop constraint if exists reports_source_user_check;
alter table public.reports add constraint reports_source_user_check
  check (
    (report_source = 'authenticated' and user_id is not null)
    or (report_source = 'anonymous' and user_id is null)
  );

alter table public.reports enable row level security;
alter table public.alerts enable row level security;
alter table public.risk_zones enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.user_trust_profiles enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.watch_sessions enable row level security;

create or replace function public.is_reviewer(p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_is_reviewer boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  select (u.role in ('reviewer', 'admin'))
  into v_is_reviewer
  from public.users u
  where u.id = p_user_id
  limit 1;

  return coalesce(v_is_reviewer, false);
end;
$$;

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  select (u.role = 'admin')
  into v_is_admin
  from public.users u
  where u.id = p_user_id
  limit 1;

  return coalesce(v_is_admin, false);
end;
$$;

create or replace function public.has_accepted_contact(p_user_a uuid, p_user_b uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if p_user_a is null or p_user_b is null then
    return false;
  end if;

  return exists (
    select 1
    from public.trusted_contacts tc
    where tc.status = 'accepted'
      and (
        (tc.requester_id = p_user_a and tc.addressee_id = p_user_b)
        or (tc.requester_id = p_user_b and tc.addressee_id = p_user_a)
      )
  );
end;
$$;

create or replace function public.request_contact_by_email(p_email text)
returns public.trusted_contacts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid;
  v_target uuid;
  v_existing public.trusted_contacts;
  v_row public.trusted_contacts;
begin
  v_requester := auth.uid();
  if v_requester is null then
    raise exception 'Not authenticated';
  end if;

  select u.id
  into v_target
  from public.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_target is null then
    raise exception 'User not found';
  end if;
  if v_target = v_requester then
    raise exception 'You cannot add yourself';
  end if;

  select *
  into v_existing
  from public.trusted_contacts tc
  where (tc.requester_id = v_requester and tc.addressee_id = v_target)
     or (tc.requester_id = v_target and tc.addressee_id = v_requester)
  limit 1;

  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      return v_existing;
    end if;
    if v_existing.requester_id = v_target and v_existing.addressee_id = v_requester and v_existing.status in ('pending', 'rejected') then
      update public.trusted_contacts
      set requester_id = v_requester,
          addressee_id = v_target,
          status = 'pending',
          responded_at = null,
          created_at = now()
      where id = v_existing.id
      returning * into v_row;
      return v_row;
    end if;
    return v_existing;
  end if;

  insert into public.trusted_contacts (requester_id, addressee_id, status)
  values (v_requester, v_target, 'pending')
  returning * into v_row;

  return v_row;
end;
$$;

drop policy if exists reports_select_authenticated on public.reports;
drop policy if exists reports_insert_own on public.reports;
drop policy if exists reports_insert_anonymous on public.reports;
drop policy if exists reports_update_reviewer on public.reports;
drop policy if exists alerts_select_own on public.alerts;
drop policy if exists alerts_update_own on public.alerts;
drop policy if exists alerts_insert_reviewer on public.alerts;
drop policy if exists risk_zones_select_authenticated on public.risk_zones;
drop policy if exists risk_zones_insert_reviewer on public.risk_zones;
drop policy if exists risk_zones_update_reviewer on public.risk_zones;
drop policy if exists users_select_reviewer_all on public.users;
drop policy if exists users_update_admin_manage on public.users;
drop policy if exists report_confirmations_select_authenticated on public.report_confirmations;
drop policy if exists report_confirmations_insert_own on public.report_confirmations;
drop policy if exists trust_profiles_select_own_or_reviewer on public.user_trust_profiles;
drop policy if exists trust_profiles_insert_reviewer on public.user_trust_profiles;
drop policy if exists trust_profiles_update_reviewer on public.user_trust_profiles;
drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
drop policy if exists admin_audit_logs_insert_admin on public.admin_audit_logs;
drop policy if exists users_select_contacts on public.users;
drop policy if exists trusted_contacts_select_participants on public.trusted_contacts;
drop policy if exists trusted_contacts_insert_requester on public.trusted_contacts;
drop policy if exists trusted_contacts_update_participants on public.trusted_contacts;
drop policy if exists watch_sessions_select_contacts on public.watch_sessions;
drop policy if exists watch_sessions_insert_owner on public.watch_sessions;
drop policy if exists watch_sessions_update_owner on public.watch_sessions;

create policy reports_select_authenticated
  on public.reports
  for select
  using (auth.uid() is not null);

create policy reports_insert_own
  on public.reports
  for insert
  with check (auth.uid() = user_id and report_source = 'authenticated');

create policy reports_insert_anonymous
  on public.reports
  for insert
  with check (report_source = 'anonymous' and user_id is null);

create policy reports_update_reviewer
  on public.reports
  for update
  using (public.is_reviewer(auth.uid()))
  with check (public.is_reviewer(auth.uid()));

create policy alerts_select_own
  on public.alerts
  for select
  using (auth.uid() = user_id);

create policy alerts_update_own
  on public.alerts
  for update
  using (auth.uid() = user_id);

create policy alerts_insert_reviewer
  on public.alerts
  for insert
  with check (public.is_reviewer(auth.uid()));

create policy risk_zones_select_authenticated
  on public.risk_zones
  for select
  using (auth.uid() is not null);

create policy risk_zones_insert_reviewer
  on public.risk_zones
  for insert
  with check (public.is_reviewer(auth.uid()));

create policy risk_zones_update_reviewer
  on public.risk_zones
  for update
  using (public.is_reviewer(auth.uid()))
  with check (public.is_reviewer(auth.uid()));

create policy users_select_reviewer_all
  on public.users
  for select
  using (public.is_reviewer(auth.uid()));

create policy users_select_contacts
  on public.users
  for select
  using (
    auth.uid() = id
    or public.has_accepted_contact(auth.uid(), id)
    or exists (
      select 1
      from public.trusted_contacts tc
      where tc.status = 'pending'
        and (
          (tc.requester_id = auth.uid() and tc.addressee_id = id)
          or (tc.requester_id = id and tc.addressee_id = auth.uid())
        )
    )
  );

create policy users_update_admin_manage
  on public.users
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy report_confirmations_select_authenticated
  on public.report_confirmations
  for select
  using (auth.uid() is not null);

create policy report_confirmations_insert_own
  on public.report_confirmations
  for insert
  with check (auth.uid() = user_id);

create policy trust_profiles_select_own_or_reviewer
  on public.user_trust_profiles
  for select
  using (
    auth.uid() = user_id
    or public.is_reviewer(auth.uid())
  );

create policy trust_profiles_insert_reviewer
  on public.user_trust_profiles
  for insert
  with check (public.is_reviewer(auth.uid()));

create policy trust_profiles_update_reviewer
  on public.user_trust_profiles
  for update
  using (public.is_reviewer(auth.uid()))
  with check (public.is_reviewer(auth.uid()));

create policy admin_audit_logs_select_admin
  on public.admin_audit_logs
  for select
  using (public.is_admin(auth.uid()));

create policy admin_audit_logs_insert_admin
  on public.admin_audit_logs
  for insert
  with check (public.is_admin(auth.uid()) and admin_user_id = auth.uid());

create policy trusted_contacts_select_participants
  on public.trusted_contacts
  for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_admin(auth.uid()));

create policy trusted_contacts_insert_requester
  on public.trusted_contacts
  for insert
  with check (auth.uid() = requester_id);

create policy trusted_contacts_update_participants
  on public.trusted_contacts
  for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_admin(auth.uid()))
  with check (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_admin(auth.uid()));

create policy watch_sessions_select_contacts
  on public.watch_sessions
  for select
  using (
    auth.uid() = owner_id
    or public.has_accepted_contact(auth.uid(), owner_id)
    or public.is_admin(auth.uid())
  );

create policy watch_sessions_insert_owner
  on public.watch_sessions
  for insert
  with check (auth.uid() = owner_id);

create policy watch_sessions_update_owner
  on public.watch_sessions
  for update
  using (auth.uid() = owner_id or public.is_admin(auth.uid()))
  with check (auth.uid() = owner_id or public.is_admin(auth.uid()));

grant select, insert, update on public.reports to authenticated;
grant insert on public.reports to anon;
grant select, insert, update on public.alerts to authenticated;
grant select, insert, update on public.risk_zones to authenticated;
grant select, insert on public.report_confirmations to authenticated;
grant select, insert, update on public.user_trust_profiles to authenticated;
grant select on public.users to authenticated;
grant update on public.users to authenticated;
grant select, insert on public.admin_audit_logs to authenticated;
grant select, insert, update on public.trusted_contacts to authenticated;
grant select, insert, update on public.watch_sessions to authenticated;
grant execute on function public.is_reviewer(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.has_accepted_contact(uuid, uuid) to authenticated;
grant execute on function public.request_contact_by_email(text) to authenticated;

create or replace function public.ensure_user_trust_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_trust_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.record_report_confirmation(
  p_report_id uuid,
  p_verdict text,
  p_confidence integer default 3,
  p_note text default null
)
returns public.report_confirmations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.report_confirmations;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_verdict not in ('present', 'absent', 'unsure') then
    raise exception 'Invalid verdict';
  end if;

  if p_confidence < 1 or p_confidence > 5 then
    raise exception 'Invalid confidence';
  end if;

  perform public.ensure_user_trust_profile(v_user_id);

  insert into public.report_confirmations (report_id, user_id, verdict, confidence, note)
  values (p_report_id, v_user_id, p_verdict, p_confidence, p_note)
  on conflict (report_id, user_id) do update
    set verdict = excluded.verdict,
        confidence = excluded.confidence,
        note = excluded.note,
        created_at = now()
  returning * into v_row;

  update public.user_trust_profiles
  set confirmations_total = confirmations_total + 1,
      updated_at = now()
  where user_id = v_user_id;

  return v_row;
end;
$$;

grant execute on function public.record_report_confirmation(uuid, text, integer, text) to authenticated;

create or replace function public.apply_report_review_to_trust(p_report_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_status not in ('confirmed', 'likely', 'unverified', 'false') then
    return;
  end if;

  for r in
    select rc.user_id, rc.verdict
    from public.report_confirmations rc
    where rc.report_id = p_report_id
  loop
    perform public.ensure_user_trust_profile(r.user_id);

    if (p_status in ('confirmed', 'likely') and r.verdict = 'present')
      or (p_status in ('false', 'unverified') and r.verdict = 'absent') then
      update public.user_trust_profiles
      set accurate_confirmations = accurate_confirmations + 1,
          trust_score = least(100, trust_score + 1.5),
          updated_at = now()
      where user_id = r.user_id;
    elsif r.verdict <> 'unsure' then
      update public.user_trust_profiles
      set false_confirmations = false_confirmations + 1,
          trust_score = greatest(0, trust_score - 2.0),
          updated_at = now()
      where user_id = r.user_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.apply_report_review_to_trust(uuid, text) to authenticated;

drop trigger if exists on_report_created_create_alerts on public.reports;
drop function if exists public.create_alerts_for_new_report();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
  ) then
    alter publication supabase_realtime add table public.alerts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'risk_zones'
  ) then
    alter publication supabase_realtime add table public.risk_zones;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'report_confirmations'
  ) then
    alter publication supabase_realtime add table public.report_confirmations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_trust_profiles'
  ) then
    alter publication supabase_realtime add table public.user_trust_profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_audit_logs'
  ) then
    alter publication supabase_realtime add table public.admin_audit_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trusted_contacts'
  ) then
    alter publication supabase_realtime add table public.trusted_contacts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watch_sessions'
  ) then
    alter publication supabase_realtime add table public.watch_sessions;
  end if;
end $$;
