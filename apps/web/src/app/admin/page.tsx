import Link from "next/link";
import { getViewer } from "@/lib/server/auth";
import { metrics } from "@/lib/server/domain/admin";
import { features } from "@/lib/server/env";

export const dynamic = "force-dynamic";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export default async function AdminOverview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = (await getViewer())!;
  const includeDemo = sp.demo === "1";
  const m = await metrics(v.userId, includeDemo);
  const max = Math.max(1, ...m.northStar.series.map((s) => s.value));
  const cohorts = [...new Set(m.cohorts.map((c) => c.cohort))];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Overview</h1>
          <p className="text-sm text-muted">Live from the database. {includeDemo ? "Including" : "Excluding"} demo content. Generated {new Date(m.generatedAt).toUTCString()}.</p>
        </div>
        <Link href={includeDemo ? "/admin" : "/admin?demo=1"} className="text-sm text-link underline">{includeDemo ? "Exclude demo content" : "Include demo content"}</Link>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">North Star — {m.northStar.label}</h2>
        <div className="mt-4 flex h-40 items-end gap-2" role="img" aria-label={`Weekly completed debates: ${m.northStar.series.map((s) => `${s.week}: ${s.value}`).join(", ")}`}>
          {m.northStar.series.map((s) => (
            <div key={s.week} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs tabular-nums text-muted">{s.value}</span>
              <div className="w-full rounded-t-md bg-for" style={{ height: `${(s.value / max) * 120 + 2}px` }} />
              <span className="text-[10px] text-subtle">{s.week.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Platform status</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Live video (LiveKit)" value={features.video ? "Configured" : "Not configured"} />
          <Stat label="Recording (Egress)" value={features.recording ? "Configured" : "Not configured"} />
          <Stat label="Email delivery" value={features.email ? "Resend" : "Dev outbox"} />
          <Stat label="Live now" value={m.debates!.live_now} hint={`${m.debates!.upcoming} upcoming`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Growth (last 7 / 30 days)</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Sign-ups (7d)" value={m.users!.signups_7d} hint={`${m.users!.signups_30d} in 30d`} />
          <Stat label="Email confirmed (30d)" value={m.users!.signups_30d ? pct(m.users!.verified_30d / m.users!.signups_30d) : "—"} />
          <Stat label="Onboarding completed (30d)" value={m.users!.signups_30d ? pct(m.users!.onboarded_30d / m.users!.signups_30d) : "—"} />
          <Stat label="Active users (7d)" value={m.users!.active_7d} />
          <Stat label="Returning users (7d)" value={m.users!.returning_7d} hint="Active this week, joined before it" />
          <Stat label="Community joins (7d)" value={m.events.communityJoins} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Challenge funnel</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Challenges sent (7d)" value={m.challenges.sent_7d} />
          <Stat label="Acceptance rate (7d)" value={pct(m.challenges.acceptanceRate)} />
          <Stat label="Declined (7d)" value={m.challenges.declined_7d} />
          <Stat label="Expired (7d)" value={m.challenges.expired_7d} />
          <Stat label="Challenge → live (30d)" value={pct(m.conversion.challengeToLive)} hint={`${m.conversion.went_live} of ${m.conversion.accepted} accepted`} />
          <Stat label="Debates started (7d)" value={m.debates!.started_7d} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Debates and audience</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Completed (7d)" value={m.debates!.completed_7d} />
          <Stat label="Interrupted (7d)" value={m.debates!.interrupted_7d} />
          <Stat label="No-shows (7d)" value={m.debates!.failed_7d} />
          <Stat label="Avg. watch time (30d)" value={`${Math.round(m.watch!.avg_watch_seconds / 6) / 10} min`} hint={`${m.watch!.unique_viewers_30d} signed-in viewers`} />
          <Stat label="Comments / votes (7d)" value={`${m.audience!.comments_7d} / ${m.audience!.votes_7d}`} hint={`${m.audience!.reactions_7d} reactions`} />
          <Stat label="Replay views / shares (7d)" value={`${m.events.replayViews} / ${m.events.shares}`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Trust and safety</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Open reports" value={m.safety.open_reports} hint={`${m.safety.urgent_open} urgent`} />
          <Stat label="Reports filed (7d)" value={m.safety.reports_7d} />
          <Stat label="Reports per 100 debates (7d)" value={m.safety.reportsPer100Debates === null ? "—" : m.safety.reportsPer100Debates.toFixed(1)} />
          <Stat label="Enforcement actions (7d)" value={m.safety.actions7d} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Weekly retention by sign-up cohort</h2>
        <p className="text-xs text-muted">Share of each weekly sign-up cohort active in later weeks (any tracked activity).</p>
        {cohorts.length === 0 ? <p className="mt-3 text-sm text-muted">No cohorts yet.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="pr-4 font-medium">Cohort</th><th className="pr-4 font-medium">Size</th>{[0, 1, 2, 3, 4, 5].map((w) => <th key={w} className="px-2 font-medium">W{w}</th>)}</tr></thead>
              <tbody>
                {cohorts.map((c) => {
                  const rows = m.cohorts.filter((x) => x.cohort === c);
                  const size = rows[0]?.size ?? 0;
                  return (
                    <tr key={c}>
                      <td className="pr-4 py-1 tabular-nums">{c}</td><td className="pr-4 tabular-nums">{size}</td>
                      {[0, 1, 2, 3, 4, 5].map((w) => { const r = rows.find((x) => x.weekOffset === w); return <td key={w} className="px-2 tabular-nums">{r && size ? `${Math.round((r.active / size) * 100)}%` : ""}</td>; })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
