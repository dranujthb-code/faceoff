/** Minimal cookie-jar HTTP client for API integration tests against a running server. */
import postgres from "postgres";

export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

export class Client {
  cookie = "";
  /** each simulated person comes from a distinct network address (rate limits are per address) */
  ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  constructor(public name = "client") {}
  async call<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; ok: boolean; data: T; error?: { code: string; message: string } }> {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-faceoff-client": "web",
        origin: BASE,
        "x-forwarded-for": this.ip,
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair?.startsWith("fo_session=")) this.cookie = pair.endsWith("=") ? "" : pair!;
    }
    const json = (await res.json().catch(() => ({}))) as { ok: boolean; data: T; error?: { code: string; message: string } };
    return { status: res.status, ok: json.ok, data: json.data, error: json.error };
  }
  get<T = unknown>(p: string) { return this.call<T>("GET", p); }
  post<T = unknown>(p: string, b: unknown = {}) { return this.call<T>("POST", p, b); }
  patch<T = unknown>(p: string, b: unknown = {}) { return this.call<T>("PATCH", p, b); }
  del<T = unknown>(p: string) { return this.call<T>("DELETE", p, {}); }
}

export const adminSql = () => postgres(process.env.DATABASE_ADMIN_URL ?? "postgres://postgres@127.0.0.1:54322/faceoff_dev", { max: 2, onnotice: () => {} });

export function uniq(prefix = "t") {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

/** Creates, verifies (via the dev outbox link) and onboards a user. */
export async function makeUser(sql: ReturnType<typeof adminSql>, opts: { topics?: string[] } = {}) {
  const c = new Client();
  const handle = uniq("u");
  const email = `${handle}@example.test`;
  const r = await c.post<{ userId: string }>("/auth/signup", { email, password: "Debate-2026-ok", dateOfBirth: "1995-04-02", acceptTerms: true });
  if (!r.ok) throw new Error(`signup failed: ${JSON.stringify(r.error)}`);
  const [mail] = await sql`select text_body from faceoff.dev_outbox where to_email = ${email} order by created_at desc limit 1`;
  const token = decodeURIComponent(/token=([^\s]+)/.exec(mail!.text_body as string)![1]!);
  const v = await c.post("/auth/verify-email", { token });
  if (!v.ok) throw new Error(`verify failed: ${JSON.stringify(v.error)}`);
  const topics = await c.get<Array<{ id: string; slug: string }>>("/topics");
  const topicIds = topics.data.filter((t) => (opts.topics ?? ["politics", "technology"]).includes(t.slug)).map((t) => t.id);
  const o = await c.post("/onboarding", { username: handle, displayName: `Tester ${handle.slice(-4)}`, region: "middle_east", topicIds, communityIds: [] });
  if (!o.ok) throw new Error(`onboarding failed: ${JSON.stringify(o.error)}`);
  return { client: c, userId: r.data.userId, username: handle, email };
}
