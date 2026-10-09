-- 0003 — authorization: helper functions, grants and Row Level Security
-- Principle: the API sets `app.user_id` and switches to role `authenticated` (or `anon`) for every
-- user-scoped request. Privileged workflows (auth, state transitions, moderation) run as
-- `service_role` only after explicit server-side authorization checks.

set search_path = faceoff, public;

-- ── Helper functions (SECURITY DEFINER so policies can consult tables the caller can't read) ──

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select exists (
    select 1 from faceoff.users u
    where u.id = app.uid() and u.status = 'active' and u.role in ('moderator', 'admin')
  )
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select exists (select 1 from faceoff.users u where u.id = app.uid() and u.status = 'active' and u.role = 'admin')
$$;

create or replace function app.is_active_user(uid uuid) returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select exists (
    select 1 from faceoff.users u
    where u.id = uid and u.status = 'active' and (u.suspended_until is null or u.suspended_until < now())
  )
$$;

-- true if either user has blocked the other
create or replace function app.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select a is not null and b is not null and exists (
    select 1 from faceoff.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- true if `blocker` has blocked `target`
create or replace function app.has_blocked(blocker uuid, target uuid) returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select blocker is not null and target is not null
    and exists (select 1 from faceoff.blocks where blocker_id = blocker and blocked_id = target)
$$;

create or replace function app.is_participant(sid uuid) returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select exists (select 1 from faceoff.session_participants p where p.session_id = sid and p.user_id = app.uid())
$$;

create or replace function app.can_view_session(sid uuid) returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select exists (
    select 1 from faceoff.debate_sessions s
    where s.id = sid and (
      (s.visibility in ('public', 'unlisted') and s.moderation_state = 'visible')
      or exists (select 1 from faceoff.session_participants p where p.session_id = s.id and p.user_id = app.uid())
      or exists (select 1 from faceoff.session_access a where a.session_id = s.id and a.user_id = app.uid())
      or app.is_staff()
    )
  )
$$;

-- Can the current user participate (comment/react/vote) in this session's audience?
create or replace function app.can_engage_session(sid uuid) returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select app.uid() is not null
    and app.is_active_user(app.uid())
    and app.can_view_session(sid)
    and exists (select 1 from faceoff.debate_sessions s where s.id = sid and s.status in ('ready', 'live', 'completed', 'interrupted'))
    and not exists (
      select 1 from faceoff.session_participants p
      where p.session_id = sid and app.blocked_between(p.user_id, app.uid())
    )
$$;

create or replace function app.poll_accepts_vote(pid uuid, voter uuid) returns boolean
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select exists (
    select 1 from faceoff.polls pl
    where pl.id = pid and pl.status = 'open'
      -- debaters may not judge their own debate's persuasion poll
      and not (pl.kind = 'persuasion' and exists (
        select 1 from faceoff.session_participants p where p.session_id = pl.session_id and p.user_id = voter))
  )
$$;

-- Aggregated tallies without exposing individual ballots.
create or replace function app.poll_tallies(sid uuid)
returns table (kind text, status text, choice text, votes bigint)
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select pl.kind, pl.status, v.choice, count(v.user_id)
  from faceoff.polls pl
  left join faceoff.poll_votes v on v.poll_id = pl.id
  where pl.session_id = sid and app.can_view_session(sid)
  group by pl.kind, pl.status, v.choice
$$;

create or replace function app.reaction_counts(sid uuid)
returns table (kind text, total bigint)
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select r.kind, count(*) from faceoff.reactions r
  where r.session_id = sid and app.can_view_session(sid)
  group by r.kind
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- ── Grants ── (RLS policies below further restrict rows)

revoke all on all tables in schema faceoff from public, anon, authenticated;
grant all on all tables in schema faceoff to service_role;
grant usage, select on all sequences in schema faceoff to service_role, authenticated;

grant select on faceoff.topics, faceoff.communities, faceoff.community_memberships, faceoff.profiles,
  faceoff.user_interests, faceoff.follows, faceoff.motions, faceoff.motion_votes, faceoff.debate_sessions,
  faceoff.session_participants, faceoff.recordings, faceoff.comments, faceoff.polls
  to anon, authenticated;

grant select on faceoff.users to authenticated;
grant insert on faceoff.profiles to authenticated;
grant update (username, display_name, bio, location, region, avatar_key, visibility, challenge_eligibility, available_until, onboarded_at)
  on faceoff.profiles to authenticated;
grant select, insert, update on faceoff.user_preferences to authenticated;
grant insert, delete on faceoff.user_interests, faceoff.community_memberships, faceoff.follows, faceoff.motion_votes to authenticated;
grant select, insert, delete on faceoff.blocks, faceoff.mutes, faceoff.saved_debates to authenticated;
grant select on faceoff.view_history to authenticated;
grant insert on faceoff.motions to authenticated;
grant update (status) on faceoff.motions to authenticated;
grant select on faceoff.challenges, faceoff.session_access, faceoff.consents to authenticated;
grant insert on faceoff.comments, faceoff.reactions to authenticated;
grant select, insert, update on faceoff.poll_votes to authenticated;
grant select on faceoff.notifications to authenticated;
grant update (read_at) on faceoff.notifications to authenticated;
grant select, insert on faceoff.reports, faceoff.appeals to authenticated;
grant select on faceoff.moderation_actions, faceoff.audit_logs, faceoff.entitlements, faceoff.analytics_events to authenticated;

-- ── Enable RLS everywhere ──
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'faceoff' loop
    execute format('alter table faceoff.%I enable row level security', t.tablename);
    execute format('alter table faceoff.%I force row level security', t.tablename);
  end loop;
end $$;

-- users: you can read your own account row; staff can read all. Writes are service-only.
create policy users_self_read on faceoff.users for select to authenticated
  using (id = app.uid() or app.is_staff());

-- profiles: active profiles are public identity cards, except to people the owner has blocked.
create policy profiles_read on faceoff.profiles for select to anon, authenticated
  using (
    user_id = app.uid() or app.is_staff()
    or (account_status = 'active' and not app.has_blocked(profiles.user_id, app.uid()))
  );
create policy profiles_insert_self on faceoff.profiles for insert to authenticated
  with check (user_id = app.uid() and account_status = 'active' and is_demo = false);
create policy profiles_update_self on faceoff.profiles for update to authenticated
  using (user_id = app.uid()) with check (user_id = app.uid());

create policy prefs_own on faceoff.user_preferences for all to authenticated
  using (user_id = app.uid()) with check (user_id = app.uid());

create policy topics_read on faceoff.topics for select to anon, authenticated using (is_active or app.is_staff());

create policy interests_read on faceoff.user_interests for select to anon, authenticated using (true);
create policy interests_write on faceoff.user_interests for insert to authenticated with check (user_id = app.uid());
create policy interests_delete on faceoff.user_interests for delete to authenticated using (user_id = app.uid());

create policy communities_read on faceoff.communities for select to anon, authenticated
  using (status = 'active' or app.is_staff());

create policy memberships_read on faceoff.community_memberships for select to anon, authenticated using (true);
create policy memberships_join on faceoff.community_memberships for insert to authenticated
  with check (
    user_id = app.uid() and role = 'member' and app.is_active_user(app.uid())
    and exists (select 1 from faceoff.communities c where c.id = community_id and c.status = 'active')
  );
create policy memberships_leave on faceoff.community_memberships for delete to authenticated using (user_id = app.uid());

create policy follows_read on faceoff.follows for select to anon, authenticated using (true);
create policy follows_insert on faceoff.follows for insert to authenticated
  with check (follower_id = app.uid() and app.is_active_user(app.uid()) and not app.blocked_between(follower_id, followee_id));
create policy follows_delete on faceoff.follows for delete to authenticated using (follower_id = app.uid());

create policy blocks_own on faceoff.blocks for all to authenticated
  using (blocker_id = app.uid()) with check (blocker_id = app.uid());
create policy mutes_own on faceoff.mutes for all to authenticated
  using (muter_id = app.uid()) with check (muter_id = app.uid());

create policy motions_read on faceoff.motions for select to anon, authenticated
  using (
    author_id = app.uid() or app.is_staff()
    or (moderation_state = 'visible' and status in ('proposed', 'listed')
        and not app.blocked_between(author_id, app.uid()))
  );
create policy motions_insert on faceoff.motions for insert to authenticated
  with check (author_id = app.uid() and status = 'proposed' and moderation_state = 'visible' and is_demo = false
              and app.is_active_user(app.uid()));
create policy motions_archive_own on faceoff.motions for update to authenticated
  using (author_id = app.uid()) with check (author_id = app.uid() and status in ('proposed', 'listed', 'archived'));

create policy motion_votes_read on faceoff.motion_votes for select to anon, authenticated using (true);
create policy motion_votes_insert on faceoff.motion_votes for insert to authenticated
  with check (user_id = app.uid() and app.is_active_user(app.uid()));
create policy motion_votes_delete on faceoff.motion_votes for delete to authenticated using (user_id = app.uid());

-- challenges are private between the two parties (and staff).
create policy challenges_parties on faceoff.challenges for select to authenticated
  using (challenger_id = app.uid() or recipient_id = app.uid() or app.is_staff());

create policy sessions_read on faceoff.debate_sessions for select to anon, authenticated
  using (app.can_view_session(id));
create policy participants_read on faceoff.session_participants for select to anon, authenticated
  using (app.can_view_session(session_id));
create policy session_access_read on faceoff.session_access for select to authenticated
  using (user_id = app.uid() or app.is_participant(session_id) or app.is_staff());

create policy consents_own on faceoff.consents for select to authenticated
  using (user_id = app.uid() or app.is_staff());

-- Replays are visible only once processing has succeeded (participants & staff see in-progress state).
create policy recordings_read on faceoff.recordings for select to anon, authenticated
  using (app.can_view_session(session_id) and (status = 'ready' or app.is_participant(session_id) or app.is_staff()));

create policy comments_read on faceoff.comments for select to anon, authenticated
  using (app.can_view_session(session_id) and (status = 'visible' or author_id = app.uid() or app.is_staff()));
create policy comments_insert on faceoff.comments for insert to authenticated
  with check (author_id = app.uid() and status = 'visible' and app.can_engage_session(session_id));

create policy reactions_insert on faceoff.reactions for insert to authenticated
  with check (user_id = app.uid() and app.can_engage_session(session_id)
              and exists (select 1 from faceoff.debate_sessions s where s.id = session_id and s.status = 'live'));

create policy polls_read on faceoff.polls for select to anon, authenticated using (app.can_view_session(session_id));

-- Individual ballots are private: you see only your own vote. Tallies come from app.poll_tallies().
create policy poll_votes_own_read on faceoff.poll_votes for select to authenticated using (user_id = app.uid());
create policy poll_votes_insert on faceoff.poll_votes for insert to authenticated
  with check (user_id = app.uid() and app.is_active_user(app.uid()) and app.poll_accepts_vote(poll_id, app.uid())
              and app.can_engage_session((select session_id from faceoff.polls where id = poll_id)));
create policy poll_votes_update on faceoff.poll_votes for update to authenticated
  using (user_id = app.uid()) with check (user_id = app.uid() and app.poll_accepts_vote(poll_id, app.uid()));

create policy saved_own on faceoff.saved_debates for all to authenticated
  using (user_id = app.uid()) with check (user_id = app.uid() and app.can_view_session(session_id));
create policy history_own on faceoff.view_history for select to authenticated using (user_id = app.uid());

create policy notifications_own_read on faceoff.notifications for select to authenticated using (user_id = app.uid());
create policy notifications_own_mark on faceoff.notifications for update to authenticated
  using (user_id = app.uid()) with check (user_id = app.uid());

create policy reports_insert on faceoff.reports for insert to authenticated
  with check (reporter_id = app.uid() and status = 'open' and assigned_to is null and resolution is null);
create policy reports_read on faceoff.reports for select to authenticated
  using (reporter_id = app.uid() or app.is_staff());

create policy mod_actions_read on faceoff.moderation_actions for select to authenticated
  using (subject_user_id = app.uid() or app.is_staff());

create policy appeals_insert on faceoff.appeals for insert to authenticated
  with check (user_id = app.uid() and status = 'open'
              and exists (select 1 from faceoff.moderation_actions m where m.id = action_id and m.subject_user_id = app.uid()));
create policy appeals_read on faceoff.appeals for select to authenticated using (user_id = app.uid() or app.is_staff());

create policy audit_admin_read on faceoff.audit_logs for select to authenticated using (app.is_admin());
create policy analytics_admin_read on faceoff.analytics_events for select to authenticated using (app.is_staff());
create policy entitlements_own on faceoff.entitlements for select to authenticated using (user_id = app.uid() or app.is_admin());

-- Tables with NO policies for anon/authenticated (service-only): auth_sessions, auth_tokens,
-- session_viewers, rate_limits, support_requests, dev_outbox. RLS + no grants = no access.
