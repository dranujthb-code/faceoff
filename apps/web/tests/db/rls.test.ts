/**
 * Row Level Security tests. They connect as the runtime login role and act as anonymous users,
 * ordinary users and staff, proving the database itself refuses unauthorized access even if
 * application code had a bug.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const admin = postgres(process.env.TEST_DATABASE_ADMIN_URL!, { max: 2, onnotice: () => {} });
const app = postgres(process.env.TEST_DATABASE_URL!, { max: 4, onnotice: () => {}, prepare: false });

type Tx = postgres.TransactionSql;
async function as<T>(uid: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return app.begin(async (tx) => {
    await tx.unsafe(uid ? "set local role authenticated" : "set local role anon");
    await tx`select set_config('app.user_id', ${uid ?? ""}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
const denied = (p: Promise<unknown>) => expect(p).rejects.toMatchObject({ code: "42501" });

let alice: string, bob: string, carol: string, mod: string;
let publicSession: string, privateSession: string, hiddenSession: string, unlisted: string;
let challengeAB: string;

async function user(name: string, role = "user") {
  const [u] = await admin`insert into faceoff.users (email, password_hash, date_of_birth, terms_version, role, email_verified_at)
    values (${name + "@t.test"}, 'x', '1990-01-01', 'v', ${role}, now()) returning id`;
  await admin`insert into faceoff.profiles (user_id, username, display_name, onboarded_at) values (${u!.id}, ${name}, ${name}, now())`;
  await admin`insert into faceoff.user_preferences (user_id) values (${u!.id})`;
  return u!.id as string;
}
async function session(host: string, other: string, o: { visibility?: string; moderation?: string; status?: string } = {}) {
  const [s] = await admin`insert into faceoff.debate_sessions (host_id, proposition, status, visibility, moderation_state, video_room, live_started_at, ends_at)
    values (${host}, 'Test proposition here', ${o.status ?? "live"}, ${o.visibility ?? "public"}, ${o.moderation ?? "visible"}, ${"r" + Math.random()}, now(), now() + interval '10 minutes') returning id`;
  await admin`insert into faceoff.session_participants (session_id, user_id, side, ready_at) values (${s!.id}, ${host}, 'for', now()), (${s!.id}, ${other}, 'against', now())`;
  await admin`insert into faceoff.polls (session_id, kind, question) values (${s!.id}, 'persuasion', 'q'), (${s!.id}, 'position', 'q')`;
  return s!.id as string;
}

beforeAll(async () => {
  alice = await user("alice");
  bob = await user("bob");
  carol = await user("carol");
  mod = await user("mod", "moderator");
  publicSession = await session(alice, bob);
  privateSession = await session(alice, bob, { visibility: "private" });
  hiddenSession = await session(alice, bob, { moderation: "hidden" });
  unlisted = await session(alice, bob, { visibility: "unlisted" });
  const [c] = await admin`insert into faceoff.challenges (challenger_id, recipient_id, proposition, challenger_side, kind, last_proposed_by, expires_at)
    values (${alice}, ${bob}, 'Private challenge text', 'for', 'instant', ${alice}, now() + interval '15 minutes') returning id`;
  challengeAB = c!.id;
  await admin`insert into faceoff.notifications (user_id, kind, title, dedupe_key) values (${alice}, 'new_follower', 'secret for alice', 'k1')`;
  await admin`insert into faceoff.reports (reporter_id, target_type, target_id, reason) values (${carol}, 'session', ${publicSession}, 'spam')`;
});

afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("account data", () => {
  it("anonymous visitors can't read accounts at all", async () => {
    await denied(as(null, (tx) => tx`select * from faceoff.users`));
  });
  it("users see only their own account row (emails stay private)", async () => {
    const rows = await as(bob, (tx) => tx`select id, email from faceoff.users`);
    expect(rows.map((r) => r.id)).toEqual([bob]);
  });
  it("users can't promote themselves or change account status", async () => {
    await denied(as(bob, (tx) => tx`update faceoff.users set role = 'admin' where id = ${bob}`));
    await denied(as(bob, (tx) => tx`update faceoff.profiles set account_status = 'active', is_demo = true where user_id = ${bob}`));
  });
  it("users can edit their own profile but not someone else's", async () => {
    const own = await as(bob, (tx) => tx`update faceoff.profiles set bio = 'mine' where user_id = ${bob}`);
    expect(own.count).toBe(1);
    const other = await as(bob, (tx) => tx`update faceoff.profiles set bio = 'hacked' where user_id = ${alice}`);
    expect(other.count).toBe(0);
  });
  it("auth sessions, tokens and the dev outbox are unreachable", async () => {
    await denied(as(bob, (tx) => tx`select * from faceoff.auth_sessions`));
    await denied(as(bob, (tx) => tx`select * from faceoff.auth_tokens`));
    await denied(as(bob, (tx) => tx`select * from faceoff.dev_outbox`));
    await denied(as(null, (tx) => tx`select * from faceoff.rate_limits`));
  });
});

describe("private interactions", () => {
  it("challenges are visible only to the two parties", async () => {
    expect((await as(alice, (tx) => tx`select id from faceoff.challenges where id = ${challengeAB}`)).length).toBe(1);
    expect((await as(bob, (tx) => tx`select id from faceoff.challenges where id = ${challengeAB}`)).length).toBe(1);
    expect((await as(carol, (tx) => tx`select id from faceoff.challenges where id = ${challengeAB}`)).length).toBe(0);
    await denied(as(null, (tx) => tx`select id from faceoff.challenges`));
  });
  it("users can't forge challenges directly", async () => {
    await denied(as(carol, (tx) => tx`insert into faceoff.challenges (challenger_id, recipient_id, proposition, challenger_side, kind, last_proposed_by, expires_at)
      values (${carol}, ${bob}, 'Forged challenge', 'for', 'instant', ${carol}, now())`));
  });
  it("notifications are private to their recipient", async () => {
    expect((await as(alice, (tx) => tx`select * from faceoff.notifications`)).length).toBe(1);
    expect((await as(bob, (tx) => tx`select * from faceoff.notifications`)).length).toBe(0);
    const marked = await as(bob, (tx) => tx`update faceoff.notifications set read_at = now() where user_id = ${alice}`);
    expect(marked.count).toBe(0);
  });
});

describe("debate visibility", () => {
  it("public and unlisted debates are readable; private and hidden ones are not", async () => {
    const ids = (await as(carol, (tx) => tx`select id from faceoff.debate_sessions`)).map((r) => r.id);
    expect(ids).toContain(publicSession);
    expect(ids).toContain(unlisted);
    expect(ids).not.toContain(privateSession);
    expect(ids).not.toContain(hiddenSession);
    const anonIds = (await as(null, (tx) => tx`select id from faceoff.debate_sessions`)).map((r) => r.id);
    expect(anonIds).not.toContain(privateSession);
  });
  it("participants still see their private or hidden debates", async () => {
    const ids = (await as(bob, (tx) => tx`select id from faceoff.debate_sessions`)).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([privateSession, hiddenSession]));
  });
  it("staff can see hidden debates", async () => {
    const ids = (await as(mod, (tx) => tx`select id from faceoff.debate_sessions`)).map((r) => r.id);
    expect(ids).toContain(hiddenSession);
  });
});

describe("audience participation", () => {
  it("signed-in users can comment on visible debates, not private ones", async () => {
    await as(carol, (tx) => tx`insert into faceoff.comments (session_id, author_id, body) values (${publicSession}, ${carol}, 'good point')`);
    await denied(as(carol, (tx) => tx`insert into faceoff.comments (session_id, author_id, body) values (${privateSession}, ${carol}, 'sneaky')`));
  });
  it("users can't comment as someone else", async () => {
    await denied(as(carol, (tx) => tx`insert into faceoff.comments (session_id, author_id, body) values (${publicSession}, ${bob}, 'impersonation')`));
  });
  it("a user blocked by a debater can't comment on that debate", async () => {
    await admin`insert into faceoff.blocks (blocker_id, blocked_id) values (${bob}, ${carol}) on conflict do nothing`;
    await denied(as(carol, (tx) => tx`insert into faceoff.comments (session_id, author_id, body) values (${publicSession}, ${carol}, 'after block')`));
    await admin`delete from faceoff.blocks where blocker_id = ${bob} and blocked_id = ${carol}`;
  });
  it("debaters can't vote on their own persuasion poll, but can state a position", async () => {
    const [pp] = await admin`select id from faceoff.polls where session_id = ${publicSession} and kind = 'persuasion'`;
    const [po] = await admin`select id from faceoff.polls where session_id = ${publicSession} and kind = 'position'`;
    await denied(as(alice, (tx) => tx`insert into faceoff.poll_votes (poll_id, user_id, choice) values (${pp!.id}, ${alice}, 'for')`));
    await as(alice, (tx) => tx`insert into faceoff.poll_votes (poll_id, user_id, choice) values (${po!.id}, ${alice}, 'for')`);
  });
  it("ballots are secret: users see only their own vote; tallies are aggregate", async () => {
    const [pp] = await admin`select id from faceoff.polls where session_id = ${publicSession} and kind = 'persuasion'`;
    await as(carol, (tx) => tx`insert into faceoff.poll_votes (poll_id, user_id, choice) values (${pp!.id}, ${carol}, 'against')`);
    expect((await as(mod, (tx) => tx`select * from faceoff.poll_votes`)).length).toBe(0);
    expect((await as(carol, (tx) => tx`select * from faceoff.poll_votes`)).length).toBe(1);
    const tallies = await as(null, (tx) => tx`select * from app.poll_tallies(${publicSession}) where kind = 'persuasion' and choice = 'against'`);
    expect(Number(tallies[0]!.votes)).toBe(1);
  });
  it("votes are rejected once a poll closes", async () => {
    const [po] = await admin`update faceoff.polls set status = 'closed' where session_id = ${publicSession} and kind = 'position' returning id`;
    await denied(as(carol, (tx) => tx`insert into faceoff.poll_votes (poll_id, user_id, choice) values (${po!.id}, ${carol}, 'for')`));
  });
  it("tallies of private debates aren't exposed through the aggregate function", async () => {
    const rows = await as(carol, (tx) => tx`select * from app.poll_tallies(${privateSession})`);
    expect(rows.length).toBe(0);
  });
});

describe("trust and safety", () => {
  it("reporters see their own reports; others don't; staff see all", async () => {
    expect((await as(carol, (tx) => tx`select * from faceoff.reports`)).length).toBe(1);
    expect((await as(bob, (tx) => tx`select * from faceoff.reports`)).length).toBe(0);
    expect((await as(mod, (tx) => tx`select * from faceoff.reports`)).length).toBeGreaterThanOrEqual(1);
  });
  it("users can't file reports pre-resolved or in someone else's name", async () => {
    await denied(as(bob, (tx) => tx`insert into faceoff.reports (reporter_id, target_type, target_id, reason) values (${carol}, 'user', ${alice}, 'spam')`));
    await denied(as(bob, (tx) => tx`insert into faceoff.reports (reporter_id, target_type, target_id, reason, status) values (${bob}, 'user', ${alice}, 'spam', 'dismissed')`));
  });
  it("the audit log is readable only by admins and is append-only for everyone", async () => {
    await admin`insert into faceoff.audit_logs (actor_id, action) values (${mod}, 'test.action')`;
    expect((await as(mod, (tx) => tx`select * from faceoff.audit_logs`)).length).toBe(0); // moderators aren't admins
    await expect(admin`update faceoff.audit_logs set action = 'tampered'`).rejects.toThrow(/append-only/);
    await expect(admin`delete from faceoff.audit_logs`).rejects.toThrow(/append-only/);
  });
  it("blocking hides the blocker's profile from the blocked user", async () => {
    await admin`insert into faceoff.blocks (blocker_id, blocked_id) values (${alice}, ${carol}) on conflict do nothing`;
    expect((await as(carol, (tx) => tx`select user_id from faceoff.profiles where user_id = ${alice}`)).length).toBe(0);
    expect((await as(bob, (tx) => tx`select user_id from faceoff.profiles where user_id = ${alice}`)).length).toBe(1);
    await denied(as(carol, (tx) => tx`insert into faceoff.follows (follower_id, followee_id) values (${carol}, ${alice})`));
  });
  it("users can't follow on someone else's behalf", async () => {
    await denied(as(carol, (tx) => tx`insert into faceoff.follows (follower_id, followee_id) values (${bob}, ${mod})`));
  });
});
