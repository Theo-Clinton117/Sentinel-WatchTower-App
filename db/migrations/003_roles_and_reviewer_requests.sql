insert into roles (name)
values ('user'), ('reviewer'), ('admin')
on conflict (name) do nothing;

insert into user_roles (user_id, role_id)
select u.id, r.id
from users u
cross join roles r
where r.name = 'user'
on conflict (user_id, role_id) do nothing;

create table if not exists reviewer_role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending',
  motivation text,
  admin_note text,
  reviewed_by uuid references users(id) on delete set null,
  requested_at timestamptz default now(),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_reviewer_role_requests_pending_user
  on reviewer_role_requests(user_id)
  where status = 'pending';

alter table reviewer_role_requests enable row level security;

create policy reviewer_role_requests_read on reviewer_role_requests
  for select
  using (user_id = auth.uid());

create policy reviewer_role_requests_write on reviewer_role_requests
  for insert
  with check (user_id = auth.uid());
