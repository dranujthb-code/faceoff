-- 0005 — swipe-left memory for the challenge deck (hidden for 7 days, then may reappear)
set search_path = faceoff, public;

create table faceoff.discovery_skips (
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  skipped_id uuid not null references faceoff.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, skipped_id)
);
alter table faceoff.discovery_skips enable row level security;
alter table faceoff.discovery_skips force row level security;
grant select, insert, update, delete on faceoff.discovery_skips to authenticated;
grant all on faceoff.discovery_skips to service_role;
create policy discovery_skips_own on faceoff.discovery_skips for all to authenticated
  using (user_id = app.uid()) with check (user_id = app.uid());
