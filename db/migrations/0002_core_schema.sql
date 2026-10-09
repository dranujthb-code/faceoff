-- 0002 — core relational schema
set search_path = faceoff, public;

create or replace function faceoff.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────────── Identity & accounts ─────────────────────────────

create table faceoff.users (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  password_hash     text not null,
  email_verified_at timestamptz,
  date_of_birth     date not null,
  role              text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  status            text not null default 'active' check (status in ('active', 'suspended', 'banned', 'deleted')),
  suspended_until   timestamptz,
  terms_version     text not null,
  is_demo           boolean not null default false,
  last_active_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger users_touch before update on faceoff.users for each row execute function faceoff.touch_updated_at();

create table faceoff.auth_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references faceoff.users(id) on delete cascade,
  token_hash   text not null unique,
  client       text not null default 'web' check (client in ('web', 'mobile')),
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);
create index auth_sessions_user_idx on faceoff.auth_sessions(user_id) where revoked_at is null;

create table faceoff.auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  kind       text not null check (kind in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_user_kind_idx on faceoff.auth_tokens(user_id, kind);

create table faceoff.profiles (
  user_id              uuid primary key references faceoff.users(id) on delete cascade,
  username             citext not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name         text not null check (char_length(display_name) between 1 and 50),
  bio                  text check (char_length(bio) <= 280),
  location             text check (char_length(location) <= 60),
  region               text check (region in ('global','middle_east','south_asia','europe','americas','africa','east_asia','oceania')),
  avatar_key           text,
  visibility           text not null default 'public' check (visibility in ('public', 'followers')),
  challenge_eligibility text not null default 'everyone' check (challenge_eligibility in ('everyone', 'following', 'nobody')),
  available_until      timestamptz, -- "available now for instant debates" until this time
  account_status       text not null default 'active' check (account_status in ('active', 'suspended', 'banned', 'deleted')),
  is_demo              boolean not null default false,
  onboarded_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger profiles_touch before update on faceoff.profiles for each row execute function faceoff.touch_updated_at();
create index profiles_available_idx on faceoff.profiles(available_until) where account_status = 'active';

create table faceoff.user_preferences (
  user_id              uuid primary key references faceoff.users(id) on delete cascade,
  notify_challenges    boolean not null default true,
  notify_reminders     boolean not null default true,
  notify_followers     boolean not null default true,
  notify_community     boolean not null default true,
  notify_replays       boolean not null default true,
  email_notifications  boolean not null default true,
  updated_at           timestamptz not null default now()
);
create trigger prefs_touch before update on faceoff.user_preferences for each row execute function faceoff.touch_updated_at();

-- ───────────────────────────── Social graph ─────────────────────────────

create table faceoff.follows (
  follower_id uuid not null references faceoff.users(id) on delete cascade,
  followee_id uuid not null references faceoff.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on faceoff.follows(followee_id);

create table faceoff.blocks (
  blocker_id uuid not null references faceoff.users(id) on delete cascade,
  blocked_id uuid not null references faceoff.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on faceoff.blocks(blocked_id);

create table faceoff.mutes (
  muter_id   uuid not null references faceoff.users(id) on delete cascade,
  muted_id   uuid not null references faceoff.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

-- ───────────────────────────── Topics & communities ─────────────────────────────

create table faceoff.topics (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null,
  description text,
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now()
);

create table faceoff.user_interests (
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  topic_id   uuid not null references faceoff.topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index user_interests_topic_idx on faceoff.user_interests(topic_id);

create table faceoff.communities (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,48}$'),
  name         text not null check (char_length(name) between 2 and 60),
  description  text check (char_length(description) <= 500),
  topic_id     uuid references faceoff.topics(id) on delete set null,
  tags         text[] not null default '{}',
  region       text,
  member_count int not null default 0,
  is_featured  boolean not null default false,
  status       text not null default 'active' check (status in ('active', 'archived')),
  is_demo      boolean not null default false,
  created_by   uuid references faceoff.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger communities_touch before update on faceoff.communities for each row execute function faceoff.touch_updated_at();
create index communities_topic_idx on faceoff.communities(topic_id) where status = 'active';

create table faceoff.community_memberships (
  community_id uuid not null references faceoff.communities(id) on delete cascade,
  user_id      uuid not null references faceoff.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('member', 'moderator')),
  created_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_memberships_user_idx on faceoff.community_memberships(user_id);

create or replace function faceoff.sync_member_count() returns trigger
language plpgsql security definer set search_path = faceoff, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update faceoff.communities set member_count = member_count + 1 where id = new.community_id;
  elsif tg_op = 'DELETE' then
    update faceoff.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end $$;
create trigger community_memberships_count after insert or delete on faceoff.community_memberships
  for each row execute function faceoff.sync_member_count();

-- Motions: debate propositions. Posted to a Wall ("I'll defend this — who'll take me on?")
-- and/or proposed in a community, where 20% member support lists it (BRD rule).
create table faceoff.motions (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references faceoff.users(id) on delete cascade,
  community_id uuid references faceoff.communities(id) on delete set null,
  title        text not null check (char_length(title) between 8 and 160),
  context      text check (char_length(context) <= 500),
  author_side  text check (author_side in ('for', 'against')),
  status       text not null default 'proposed' check (status in ('proposed', 'listed', 'archived')),
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'hidden')),
  is_demo      boolean not null default false,
  listed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger motions_touch before update on faceoff.motions for each row execute function faceoff.touch_updated_at();
create index motions_community_idx on faceoff.motions(community_id, status, created_at desc);
create index motions_author_idx on faceoff.motions(author_id, created_at desc);

create table faceoff.motion_votes (
  motion_id  uuid not null references faceoff.motions(id) on delete cascade,
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (motion_id, user_id)
);

-- ───────────────────────────── Challenges & debates ─────────────────────────────

create table faceoff.challenges (
  id                uuid primary key default gen_random_uuid(),
  challenger_id     uuid not null references faceoff.users(id) on delete cascade,
  recipient_id      uuid not null references faceoff.users(id) on delete cascade,
  proposition       text not null check (char_length(proposition) between 8 and 160),
  context           text check (char_length(context) <= 500),
  ground_rules      text check (char_length(ground_rules) <= 300),
  challenger_side   text not null check (challenger_side in ('for', 'against')),
  motion_id         uuid references faceoff.motions(id) on delete set null,
  community_id      uuid references faceoff.communities(id) on delete set null,
  kind              text not null check (kind in ('instant', 'scheduled')),
  proposed_start    timestamptz,
  last_proposed_by  uuid not null references faceoff.users(id) on delete cascade,
  recording_enabled boolean not null default true,
  visibility        text not null default 'public' check (visibility in ('public', 'unlisted')),
  status            text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired','completed')),
  decline_reason    text check (char_length(decline_reason) <= 200),
  expires_at        timestamptz not null,
  responded_at      timestamptz,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (challenger_id <> recipient_id),
  check (kind = 'instant' or proposed_start is not null)
);
create trigger challenges_touch before update on faceoff.challenges for each row execute function faceoff.touch_updated_at();
-- One active challenge per pair (in either direction) at a time.
create unique index challenges_one_active_per_pair on faceoff.challenges
  (least(challenger_id, recipient_id), greatest(challenger_id, recipient_id))
  where status in ('pending', 'accepted');
create index challenges_recipient_idx on faceoff.challenges(recipient_id, status, created_at desc);
create index challenges_challenger_idx on faceoff.challenges(challenger_id, status, created_at desc);
create index challenges_expiry_idx on faceoff.challenges(expires_at) where status = 'pending';

create table faceoff.debate_sessions (
  id                uuid primary key default gen_random_uuid(),
  challenge_id      uuid unique references faceoff.challenges(id) on delete set null,
  host_id           uuid not null references faceoff.users(id) on delete cascade,
  proposition       text not null,
  context           text,
  ground_rules      text,
  motion_id         uuid references faceoff.motions(id) on delete set null,
  community_id      uuid references faceoff.communities(id) on delete set null,
  status            text not null default 'created' check (status in ('created','scheduled','ready','live','completed','cancelled','failed','interrupted')),
  visibility        text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  moderation_state  text not null default 'visible' check (moderation_state in ('visible', 'hidden')),
  access_tier       text not null default 'free' check (access_tier in ('free', 'premium')), -- Phase 2 hook
  format            text not null default 'standard_1v1',
  duration_seconds  int not null default 600 check (duration_seconds between 60 and 3600),
  recording_enabled boolean not null default false,
  scheduled_start   timestamptz,
  ready_opened_at   timestamptz,
  live_started_at   timestamptz,
  ends_at           timestamptz,
  ended_at          timestamptz,
  end_reason        text check (end_reason in ('time_elapsed','host_ended','participant_left','no_show','cancelled','admin_terminated','video_failure')),
  ended_by          uuid references faceoff.users(id) on delete set null,
  video_room        text unique,
  viewer_peak       int not null default 0,
  reminder_sent_at  timestamptz,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (status <> 'live' or (live_started_at is not null and ends_at is not null))
);
create trigger sessions_touch before update on faceoff.debate_sessions for each row execute function faceoff.touch_updated_at();
create index sessions_status_idx on faceoff.debate_sessions(status, scheduled_start);
create index sessions_public_idx on faceoff.debate_sessions(visibility, moderation_state, status, coalesce(ended_at, live_started_at, scheduled_start) desc);
create index sessions_community_idx on faceoff.debate_sessions(community_id, created_at desc);

create table faceoff.session_participants (
  session_id        uuid not null references faceoff.debate_sessions(id) on delete cascade,
  user_id           uuid not null references faceoff.users(id) on delete cascade,
  side              text not null check (side in ('for', 'against')),
  role              text not null default 'debater' check (role in ('debater')),
  consented_at      timestamptz,
  recording_consent boolean,
  ready_at          timestamptz,
  joined_at         timestamptz,
  last_seen_at      timestamptz,
  left_at           timestamptz,
  created_at        timestamptz not null default now(),
  primary key (session_id, user_id),
  unique (session_id, side)
);
create index session_participants_user_idx on faceoff.session_participants(user_id, created_at desc);

-- Explicit access grants for private sessions (invite list).
create table faceoff.session_access (
  session_id uuid not null references faceoff.debate_sessions(id) on delete cascade,
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  granted_by uuid references faceoff.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- Append-only consent & disclosure ledger (terms at sign-up, rules + recording before each debate).
create table faceoff.consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references faceoff.users(id) on delete cascade,
  session_id  uuid references faceoff.debate_sessions(id) on delete cascade,
  kind        text not null check (kind in ('terms', 'age', 'rules', 'recording')),
  granted     boolean not null,
  version     text not null,
  disclosure  text not null, -- the exact text shown to the user
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index consents_user_idx on faceoff.consents(user_id, created_at desc);
create index consents_session_idx on faceoff.consents(session_id);

create table faceoff.recordings (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null unique references faceoff.debate_sessions(id) on delete cascade,
  provider         text not null default 'livekit_egress',
  provider_ref     text unique, -- egress id
  status           text not null default 'requested' check (status in ('requested','recording','processing','ready','failed')),
  storage_key      text,
  playback_url     text,
  duration_seconds int,
  size_bytes       bigint,
  error            text,
  requested_at     timestamptz not null default now(),
  ready_at         timestamptz,
  updated_at       timestamptz not null default now()
);
create trigger recordings_touch before update on faceoff.recordings for each row execute function faceoff.touch_updated_at();

-- Audience presence (approximate viewer counts).
create table faceoff.session_viewers (
  session_id   uuid not null references faceoff.debate_sessions(id) on delete cascade,
  viewer_key   text not null, -- user id or a random per-tab id for signed-out viewers
  user_id      uuid references faceoff.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, viewer_key)
);
create index session_viewers_recent_idx on faceoff.session_viewers(session_id, last_seen_at);

-- ───────────────────────────── Audience participation ─────────────────────────────

create table faceoff.comments (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references faceoff.debate_sessions(id) on delete cascade,
  author_id  uuid not null references faceoff.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  status     text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index comments_session_idx on faceoff.comments(session_id, created_at);
create index comments_author_idx on faceoff.comments(author_id, created_at desc);

create table faceoff.reactions (
  id         bigint generated always as identity primary key,
  session_id uuid not null references faceoff.debate_sessions(id) on delete cascade,
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  kind       text not null check (kind in ('fire', 'clap', 'think', 'laugh', 'doubt')),
  side       text check (side in ('for', 'against')),
  created_at timestamptz not null default now()
);
create index reactions_session_idx on faceoff.reactions(session_id, kind);

create table faceoff.polls (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references faceoff.debate_sessions(id) on delete cascade,
  kind       text not null check (kind in ('persuasion', 'position')),
  question   text not null,
  status     text not null default 'open' check (status in ('open', 'closed')),
  closes_at  timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, kind)
);

create table faceoff.poll_votes (
  poll_id    uuid not null references faceoff.polls(id) on delete cascade,
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  choice     text not null check (choice in ('for', 'against', 'tie', 'undecided')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
create trigger poll_votes_touch before update on faceoff.poll_votes for each row execute function faceoff.touch_updated_at();

create table faceoff.saved_debates (
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  session_id uuid not null references faceoff.debate_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create table faceoff.view_history (
  user_id         uuid not null references faceoff.users(id) on delete cascade,
  session_id      uuid not null references faceoff.debate_sessions(id) on delete cascade,
  watched_seconds int not null default 0,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at  timestamptz not null default now(),
  primary key (user_id, session_id)
);
create index view_history_recent_idx on faceoff.view_history(user_id, last_viewed_at desc);

-- ───────────────────────────── Notifications ─────────────────────────────

create table faceoff.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references faceoff.users(id) on delete cascade,
  kind        text not null,
  actor_id    uuid references faceoff.users(id) on delete set null,
  entity_type text,
  entity_id   uuid,
  title       text not null,
  body        text,
  href        text,
  dedupe_key  text not null,
  read_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on faceoff.notifications(user_id, created_at desc);
create index notifications_unread_idx on faceoff.notifications(user_id) where read_at is null;

-- ───────────────────────────── Trust & safety ─────────────────────────────

create table faceoff.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references faceoff.users(id) on delete cascade,
  target_type    text not null check (target_type in ('user', 'session', 'comment', 'motion')),
  target_id      uuid not null,
  target_user_id uuid references faceoff.users(id) on delete set null, -- owner of the reported content
  reason         text not null,
  details        text check (char_length(details) <= 1000),
  priority       int not null default 2 check (priority between 1 and 3), -- 1 = urgent
  status         text not null default 'open' check (status in ('open', 'in_review', 'actioned', 'dismissed')),
  assigned_to    uuid references faceoff.users(id) on delete set null,
  resolution     text,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger reports_touch before update on faceoff.reports for each row execute function faceoff.touch_updated_at();
create index reports_queue_idx on faceoff.reports(status, priority, created_at);
create unique index reports_one_open_per_reporter on faceoff.reports(reporter_id, target_type, target_id) where status in ('open', 'in_review');

create table faceoff.moderation_actions (
  id             uuid primary key default gen_random_uuid(),
  moderator_id   uuid references faceoff.users(id) on delete set null,
  action         text not null check (action in ('warn','hide_comment','restore_comment','hide_session','restore_session','hide_motion','restore_motion','terminate_session','suspend_user','unsuspend_user','ban_user','dismiss_report')),
  target_type    text not null check (target_type in ('user', 'session', 'comment', 'motion', 'report')),
  target_id      uuid not null,
  subject_user_id uuid references faceoff.users(id) on delete set null, -- whose content/account was affected
  report_id      uuid references faceoff.reports(id) on delete set null,
  reason         text not null,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index moderation_actions_subject_idx on faceoff.moderation_actions(subject_user_id, created_at desc);

create table faceoff.appeals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references faceoff.users(id) on delete cascade,
  action_id     uuid not null references faceoff.moderation_actions(id) on delete cascade,
  body          text not null check (char_length(body) between 10 and 1000),
  status        text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  decided_by    uuid references faceoff.users(id) on delete set null,
  decision_note text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (action_id, user_id)
);

-- Immutable audit trail of privileged actions.
create table faceoff.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references faceoff.users(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on faceoff.audit_logs(created_at desc);

create or replace function faceoff.audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_no_update before update or delete on faceoff.audit_logs
  for each row execute function faceoff.audit_logs_immutable();

-- ───────────────────────────── Operations ─────────────────────────────

-- Fixed-window rate limiting shared across all API instances.
create table faceoff.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key, window_start)
);

-- Privacy-conscious product analytics: no IP addresses, no user agents, no free text.
create table faceoff.analytics_events (
  id         bigint generated always as identity primary key,
  name       text not null check (name ~ '^[a-z_]{3,48}$'),
  user_id    uuid references faceoff.users(id) on delete set null,
  session_id uuid,
  props      jsonb not null default '{}',
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);
create index analytics_events_name_time_idx on faceoff.analytics_events(name, created_at);
create index analytics_events_user_idx on faceoff.analytics_events(user_id, created_at);

create table faceoff.support_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references faceoff.users(id) on delete set null,
  name       text not null,
  email      citext not null,
  topic      text not null,
  message    text not null,
  status     text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

-- Development-only email capture (EMAIL_DRIVER=dev). Never used in production.
create table faceoff.dev_outbox (
  id         uuid primary key default gen_random_uuid(),
  to_email   text not null,
  subject    text not null,
  text_body  text not null,
  html_body  text,
  created_at timestamptz not null default now()
);

-- ───────────────────────────── Monetization (schema only; no payments in MVP) ─────────────────────────────

create table faceoff.entitlements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references faceoff.users(id) on delete cascade,
  feature    text not null check (feature in ('premium_viewing', 'sansad_seat', 'challenge_pass', 'ad_free')),
  source     text not null check (source in ('grant', 'subscription', 'iap_apple', 'iap_google', 'web_checkout')),
  external_ref text,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);
create index entitlements_user_idx on faceoff.entitlements(user_id, feature);
