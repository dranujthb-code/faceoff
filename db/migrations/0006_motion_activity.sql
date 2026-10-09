-- 0006 — public activity counts for trending motions (challenges are private rows)
set search_path = faceoff, public;

create or replace function app.motion_activity(mid uuid)
returns table (recent_challenges int, recent_debates int, last_activity timestamptz)
language sql stable security definer set search_path = faceoff, pg_temp as $$
  select
    (select count(*)::int from faceoff.challenges ch where ch.motion_id = mid and ch.created_at > now() - interval '7 days'),
    (select count(*)::int from faceoff.debate_sessions s where s.motion_id = mid and s.status in ('live','completed')
       and s.visibility = 'public' and s.created_at > now() - interval '7 days'),
    greatest(
      (select created_at from faceoff.motions where id = mid),
      (select max(created_at) from faceoff.motion_votes v where v.motion_id = mid),
      (select max(created_at) from faceoff.challenges ch where ch.motion_id = mid))
$$;
grant execute on function app.motion_activity(uuid) to anon, authenticated, service_role;
