-- 0004 — aggregate helpers that expose counts without exposing underlying private rows
set search_path = faceoff, public;

create or replace function app.session_stats(sid uuid)
returns table (comments int, votes int, views int)
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select
    (select count(*)::int from faceoff.comments c where c.session_id = sid and c.status = 'visible'),
    (select count(*)::int from faceoff.poll_votes v join faceoff.polls pl on pl.id = v.poll_id where pl.session_id = sid),
    (select count(*)::int from faceoff.session_viewers sv where sv.session_id = sid)
  where app.can_view_session(sid)
$$;

create or replace function app.viewers_now(sid uuid, stale_seconds int default 30)
returns int
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select count(*)::int from faceoff.session_viewers sv
  where sv.session_id = sid and sv.last_seen_at > now() - make_interval(secs => stale_seconds) and app.can_view_session(sid)
$$;

grant execute on function app.session_stats(uuid) to anon, authenticated, service_role;
grant execute on function app.viewers_now(uuid, int) to anon, authenticated, service_role;
