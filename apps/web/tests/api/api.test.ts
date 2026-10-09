/**
 * API integration tests against a running FaceOff server (TEST_BASE_URL, default http://localhost:3000)
 * and its database (DATABASE_ADMIN_URL). Each test creates its own users.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, Client, adminSql, makeUser, uniq } from "./client";

const sql = adminSql();
let up = false;

beforeAll(async () => {
  up = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false);
  if (!up) console.warn(`API tests skipped: no server at ${BASE}`);
});
afterAll(() => sql.end());

const it_ = (name: string, fn: () => Promise<void>) => it(name, async () => { if (!up) return; await fn(); });

async function liveDebate() {
  const a = await makeUser(sql);
  const b = await makeUser(sql);
  const ch = await a.client.post<{ id: string }>("/challenges", { recipientId: b.userId, proposition: "Cities should ban private cars", challengerSide: "for", kind: "instant" });
  const acc = await b.client.post<{ sessionId: string }>(`/challenges/${ch.data.id}/respond`, { action: "accept" });
  const sid = acc.data.sessionId;
  await a.client.post(`/debates/${sid}/ready`, { acceptRules: true, acceptRecording: true });
  await b.client.post(`/debates/${sid}/ready`, { acceptRules: true, acceptRecording: true });
  return { a, b, sid, challengeId: ch.data.id };
}

describe("authentication", () => {
  it_("rejects under-18 sign-ups and weak passwords with field errors", async () => {
    const c = new Client();
    const kid = new Date(Date.now() - 16 * 365 * 86_400_000).toISOString().slice(0, 10);
    const r = await c.post("/auth/signup", { email: `${uniq()}@x.test`, password: "short", dateOfBirth: kid, acceptTerms: true });
    expect(r.status).toBe(422);
    expect(r.error?.code).toBe("validation_error");
  });
  it_("prevents duplicate accounts and wrong passwords", async () => {
    const u = await makeUser(sql);
    const dup = await new Client().post("/auth/signup", { email: u.email, password: "Debate-2026-ok", dateOfBirth: "1990-01-01", acceptTerms: true });
    expect(dup.status).toBe(409);
    const bad = await new Client().post("/auth/signin", { email: u.email, password: "Wrong-password-1" });
    expect(bad.status).toBe(401);
    const good = new Client();
    expect((await good.post("/auth/signin", { email: u.email, password: "Debate-2026-ok" })).status).toBe(200);
    const me = await good.get<{ id: string; onboarded: boolean }>("/me");
    expect(me.data.id).toBe(u.userId);
    await good.post("/auth/signout");
    expect((await good.get("/me")).data).toBeNull();
  });
  it_("does not reveal whether an email exists on password reset", async () => {
    const u = await makeUser(sql);
    const a = await new Client().post<{ message: string }>("/auth/forgot-password", { email: u.email });
    const b = await new Client().post<{ message: string }>("/auth/forgot-password", { email: `${uniq()}@nobody.test` });
    expect(a.data.message).toBe(b.data.message);
  });
  it_("password reset links work once and sign out other sessions", async () => {
    const u = await makeUser(sql);
    await new Client().post("/auth/forgot-password", { email: u.email });
    const [m] = await sql`select text_body from faceoff.dev_outbox where to_email = ${u.email} and subject like 'Reset%' order by created_at desc limit 1`;
    const token = decodeURIComponent(/token=([^\s]+)/.exec(m!.text_body as string)![1]!);
    expect((await new Client().post("/auth/reset-password", { token, password: "New-password-2026" })).status).toBe(200);
    expect((await new Client().post("/auth/reset-password", { token, password: "Another-pass-2026" })).status).toBe(400);
    expect((await u.client.get("/me")).data).toBeNull(); // old session revoked
  });
  it_("blocks cross-site cookie requests (CSRF)", async () => {
    const u = await makeUser(sql);
    const res = await fetch(`${BASE}/api/v1/motions`, {
      method: "POST",
      headers: { cookie: u.client.cookie, origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ title: "Cross-site forged motion" }),
    });
    expect(res.status).toBe(403);
  });
  it_("accepts bearer tokens for the mobile app", async () => {
    const u = await makeUser(sql);
    const r = await fetch(`${BASE}/api/v1/auth/signin`, { method: "POST", headers: { "content-type": "application/json", "x-faceoff-client": "mobile" }, body: JSON.stringify({ email: u.email, password: "Debate-2026-ok" }) });
    const { data } = (await r.json()) as { data: { token: string } };
    expect(data.token.length).toBeGreaterThan(20);
    const me = await fetch(`${BASE}/api/v1/me`, { headers: { authorization: `Bearer ${data.token}` } }).then((x) => x.json());
    expect(me.data.id).toBe(u.userId);
  });
});

describe("challenges", () => {
  it_("requires a confirmed email to challenge", async () => {
    const target = await makeUser(sql);
    const c = new Client();
    const email = `${uniq()}@x.test`;
    await c.post("/auth/signup", { email, password: "Debate-2026-ok", dateOfBirth: "1990-01-01", acceptTerms: true });
    const topics = await c.get<Array<{ id: string }>>("/topics");
    await c.post("/onboarding", { username: uniq("n"), displayName: "Unverified", region: "global", topicIds: [topics.data[0]!.id], communityIds: [] });
    const r = await c.post("/challenges", { recipientId: target.userId, proposition: "Unverified users shouldn't challenge", challengerSide: "for", kind: "instant" });
    expect(r.status).toBe(403);
    expect(r.error?.code).toBe("email_unverified");
  });
  it_("respects the recipient's challenge settings and blocks", async () => {
    const a = await makeUser(sql);
    const b = await makeUser(sql);
    await b.client.patch("/me/profile", { challengeEligibility: "nobody" });
    expect((await a.client.post("/challenges", { recipientId: b.userId, proposition: "You can't refuse this", challengerSide: "for", kind: "instant" })).status).toBe(400);
    await b.client.patch("/me/profile", { challengeEligibility: "everyone" });
    await b.client.post(`/users/id/${a.userId}/block`);
    const blocked = await a.client.post("/challenges", { recipientId: b.userId, proposition: "You can't refuse this", challengerSide: "for", kind: "instant" });
    expect(blocked.status).toBe(400);
  });
  it_("only the parties can respond, and only the person who didn't propose last", async () => {
    const a = await makeUser(sql);
    const b = await makeUser(sql);
    const outsider = await makeUser(sql);
    const ch = await a.client.post<{ id: string }>("/challenges", { recipientId: b.userId, proposition: "Homework should be abolished", challengerSide: "against", kind: "instant" });
    expect((await outsider.client.post(`/challenges/${ch.data.id}/respond`, { action: "accept" })).status).toBe(404);
    expect((await a.client.post(`/challenges/${ch.data.id}/respond`, { action: "accept" })).status).toBe(403);
    // recipient counter-proposes a time → now the challenger must respond
    const later = new Date(Date.now() + 2 * 3600_000).toISOString();
    expect((await b.client.post(`/challenges/${ch.data.id}/respond`, { action: "propose_time", proposedStart: later })).status).toBe(200);
    expect((await b.client.post(`/challenges/${ch.data.id}/respond`, { action: "accept" })).status).toBe(403);
    const acc = await a.client.post<{ sessionId: string }>(`/challenges/${ch.data.id}/respond`, { action: "accept" });
    expect(acc.status).toBe(200);
    const st = await outsider.client.get<{ session: { status: string } }>(`/debates/${acc.data.sessionId}/state`);
    expect(st.data.session.status).toBe("scheduled");
  });
  it_("expires unanswered instant challenges", async () => {
    const a = await makeUser(sql);
    const b = await makeUser(sql);
    const ch = await a.client.post<{ id: string }>("/challenges", { recipientId: b.userId, proposition: "Tea is better than coffee", challengerSide: "for", kind: "instant" });
    await sql`update faceoff.challenges set expires_at = now() - interval '1 second' where id = ${ch.data.id}`;
    const r = await b.client.post(`/challenges/${ch.data.id}/respond`, { action: "accept" });
    expect(r.status).toBe(409);
    const list = await a.client.get<{ past: Array<{ id: string; status: string }> }>("/challenges");
    expect(list.data.past.find((c) => c.id === ch.data.id)?.status).toBe("expired");
  });
});

describe("live debate lifecycle (server-authoritative)", () => {
  it_("goes live only when both debaters are ready and ends when the server clock runs out", async () => {
    const { a, sid } = await liveDebate();
    const live = await a.client.get<{ session: { status: string; endsAt: string; liveStartedAt: string } }>(`/debates/${sid}/state`);
    expect(live.data.session.status).toBe("live");
    expect(Date.parse(live.data.session.endsAt) - Date.parse(live.data.session.liveStartedAt)).toBe(600_000);
    await sql`update faceoff.debate_sessions set ends_at = now() - interval '1 second' where id = ${sid}`;
    const done = await new Client().get<{ session: { status: string; endReason: string } }>(`/debates/${sid}/state`);
    expect(done.data.session.status).toBe("completed");
    expect(done.data.session.endReason).toBe("time_elapsed");
  });
  it_("interrupts a debate when a debater disappears past the grace period", async () => {
    const { b, sid } = await liveDebate();
    await sql`update faceoff.session_participants set last_seen_at = now() - interval '5 minutes' where session_id = ${sid} and user_id = ${b.userId}`;
    const st = await new Client().get<{ session: { status: string; endReason: string } }>(`/debates/${sid}/state`);
    expect(st.data.session.status).toBe("interrupted");
    expect(st.data.session.endReason).toBe("participant_left");
  });
  it_("fails as a no-show when a debater never gets ready", async () => {
    const a = await makeUser(sql);
    const b = await makeUser(sql);
    const ch = await a.client.post<{ id: string }>("/challenges", { recipientId: b.userId, proposition: "Zoos should be closed down", challengerSide: "for", kind: "instant" });
    const acc = await b.client.post<{ sessionId: string }>(`/challenges/${ch.data.id}/respond`, { action: "accept" });
    await b.client.post(`/debates/${acc.data.sessionId}/ready`, { acceptRules: true, acceptRecording: false });
    await sql`update faceoff.debate_sessions set ready_opened_at = now() - interval '11 minutes' where id = ${acc.data.sessionId}`;
    const st = await a.client.get<{ session: { status: string; endReason: string } }>(`/debates/${acc.data.sessionId}/state`);
    expect(st.data.session.status).toBe("failed");
    expect(st.data.session.endReason).toBe("no_show");
  });
  it_("only participants can get ready; only the host can end early", async () => {
    const { a, b, sid } = await liveDebate();
    const outsider = await makeUser(sql);
    expect((await outsider.client.post(`/debates/${sid}/ready`, { acceptRules: true, acceptRecording: true })).status).toBe(403);
    expect((await b.client.post(`/debates/${sid}/end`)).status).toBe(403);
    expect((await a.client.post(`/debates/${sid}/end`)).status).toBe(200);
  });
  it_("either debater can veto recording, and consent is recorded", async () => {
    const { sid, b } = await liveDebate();
    const [s] = await sql`select recording_enabled from faceoff.debate_sessions where id = ${sid}`;
    expect(s!.recording_enabled).toBe(true);
    const a2 = await makeUser(sql);
    const ch = await a2.client.post<{ id: string }>("/challenges", { recipientId: b.userId, proposition: "Recording consent matters", challengerSide: "for", kind: "instant", recordingEnabled: true });
    const acc = await b.client.post<{ sessionId: string }>(`/challenges/${ch.data.id}/respond`, { action: "accept" });
    await b.client.post(`/debates/${acc.data.sessionId}/ready`, { acceptRules: true, acceptRecording: false });
    const [s2] = await sql`select recording_enabled from faceoff.debate_sessions where id = ${acc.data.sessionId}`;
    expect(s2!.recording_enabled).toBe(false);
    const consents = await sql`select kind, granted from faceoff.consents where session_id = ${acc.data.sessionId} and user_id = ${b.userId} order by kind`;
    expect(consents.map((c) => `${c.kind}:${c.granted}`)).toEqual(["recording:false", "rules:true"]);
  });
  it_("never issues video tokens without a configured provider", async () => {
    const { a, sid } = await liveDebate();
    const r = await a.client.post(`/debates/${sid}/video-token`);
    const configured = (await fetch(`${BASE}/api/health`).then((x) => x.json())).data.video;
    if (!configured) expect(r.status).toBe(503);
    else expect(r.status).toBe(200);
  });
});

describe("audience", () => {
  it_("audience can comment, react and vote; votes are one per person and changeable", async () => {
    const { sid } = await liveDebate();
    const v = await makeUser(sql);
    expect((await v.client.post(`/debates/${sid}/comments`, { body: "Strong opening" })).status).toBe(200);
    expect((await v.client.post(`/debates/${sid}/reactions`, { kind: "clap" })).status).toBe(200);
    await v.client.post(`/debates/${sid}/votes`, { poll: "persuasion", choice: "for" });
    await v.client.post(`/debates/${sid}/votes`, { poll: "persuasion", choice: "against" });
    const st = await v.client.get<{ polls: { persuasion: { total: number; tallies: Record<string, number> } }; viewer: { votes: Record<string, string> } }>(`/debates/${sid}/state`);
    expect(st.data.polls.persuasion.total).toBe(1);
    expect(st.data.polls.persuasion.tallies.against).toBe(1);
    expect(st.data.viewer.votes.persuasion).toBe("against");
  });
  it_("signed-out visitors can watch but not participate", async () => {
    const { sid } = await liveDebate();
    const anon = new Client();
    expect((await anon.get(`/debates/${sid}/state`)).status).toBe(200);
    expect((await anon.post(`/debates/${sid}/comments`, { body: "hello" })).status).toBe(401);
  });
  it_("rate-limits comment floods", async () => {
    const { sid } = await liveDebate();
    const v = await makeUser(sql);
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) codes.push((await v.client.post(`/debates/${sid}/comments`, { body: `message ${i}` })).status);
    expect(codes).toContain(429);
  });
});

describe("moderation and admin protection", () => {
  async function staff(role: "moderator" | "admin") {
    const u = await makeUser(sql);
    await sql`update faceoff.users set role = ${role} where id = ${u.userId}`;
    return u;
  }
  it_("ordinary users can't reach admin endpoints", async () => {
    const u = await makeUser(sql);
    expect((await u.client.get("/admin/metrics")).status).toBe(403);
    expect((await u.client.post("/admin/moderation", { action: "ban_user", targetType: "user", targetId: u.userId, reason: "nope" })).status).toBe(403);
    expect((await new Client().get("/admin/reports")).status).toBe(401);
  });
  it_("moderators can suspend but not ban; suspended users can still report but not comment", async () => {
    const mod = await staff("moderator");
    const bad = await makeUser(sql);
    expect((await mod.client.post("/admin/moderation", { action: "ban_user", targetType: "user", targetId: bad.userId, reason: "test ban" })).status).toBe(403);
    expect((await mod.client.post("/admin/moderation", { action: "suspend_user", targetType: "user", targetId: bad.userId, reason: "harassment", durationDays: 3 })).status).toBe(200);
    const { sid } = await liveDebate();
    expect((await bad.client.post(`/debates/${sid}/comments`, { body: "still here?" })).status).toBe(403);
    expect((await bad.client.post("/reports", { targetType: "session", targetId: sid, reason: "spam" })).status).toBe(200);
    const standing = await bad.client.get<{ status: string; actions: unknown[] }>("/me/standing");
    expect(standing.data.status).toBe("suspended");
    const [log] = await sql`select action from faceoff.audit_logs where target_id = ${bad.userId} order by id desc limit 1`;
    expect(log!.action).toBe("moderation.suspend_user");
  });
  it_("reports flow into the queue and actioning one hides the content", async () => {
    const admin = await staff("admin");
    const { sid } = await liveDebate();
    const v = await makeUser(sql);
    const c = await v.client.post<{ id: string }>(`/debates/${sid}/comments`, { body: "a comment that gets reported" });
    const reporter = await makeUser(sql);
    expect((await reporter.client.post("/reports", { targetType: "comment", targetId: c.data.id, reason: "harassment" })).status).toBe(200);
    expect((await reporter.client.post("/reports", { targetType: "comment", targetId: c.data.id, reason: "harassment" })).status).toBe(409);
    const queue = await admin.client.get<Array<{ id: string; target_id: string }>>("/admin/reports?status=open");
    const rep = queue.data.find((r) => r.target_id === c.data.id)!;
    expect(rep).toBeTruthy();
    expect((await admin.client.post("/admin/moderation", { action: "hide_comment", targetType: "comment", targetId: c.data.id, reportId: rep.id, reason: "Harassment" })).status).toBe(200);
    const visible = await new Client().get<Array<{ id: string; status: string; body: string }>>(`/debates/${sid}/comments`);
    expect(visible.data.find((x) => x.id === c.data.id)).toBeUndefined();
    // the author is told, and can appeal
    const standing = await v.client.get<{ actions: Array<{ id: string }> }>("/me/standing");
    expect((await v.client.post("/appeals", { actionId: standing.data.actions[0]!.id, body: "I was quoting the other debater." })).status).toBe(200);
  });
  it_("the cron sweeper requires its secret", async () => {
    expect((await fetch(`${BASE}/api/cron/sweep`)).status).toBe(401);
    expect((await fetch(`${BASE}/api/cron/sweep`, { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
  });
});
