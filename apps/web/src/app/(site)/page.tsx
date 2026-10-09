import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server/auth";
import { listDebates } from "@/lib/server/domain/debates";
import { listMotions } from "@/lib/server/domain/communities";
import { DebateCard } from "@/components/DebateCard";
import { MotionCard } from "@/components/MotionCard";
import { ButtonLink, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Pick a motion", "Find a proposition you care about — or post your own to your Wall and say which side you'll defend."],
  ["Swipe to challenge", "Swipe right on someone who disagrees. They see the exact motion and their side before they accept."],
  ["Go live for ten minutes", "Two cameras, one clock, no host. The timer is enforced by the server, not by whoever talks loudest."],
  ["Let the audience judge", "Viewers vote on who argued more persuasively — separately from which side they personally support."],
] as const;

export default async function Landing() {
  const viewer = await getViewer();
  if (viewer?.onboarded) redirect("/home");
  const [live, upcoming, replays, motions] = await Promise.all([
    listDebates({ filter: "live", limit: 3 }, null),
    listDebates({ filter: "upcoming", limit: 3 }, null),
    listDebates({ filter: "replays", limit: 3 }, null),
    listMotions(null, { status: "listed", limit: 30, trending: true }),
  ]);
  const featured = live[0] ?? replays[0] ?? null;

  return (
    <>
      {/* Hero: the stage itself — a proposition split down the logo's divider. */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <div className="max-w-3xl">
          <h1 className="font-serif text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
            You have a voice. Use it live.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            FaceOff is the arena for live, one-on-one, ten-minute debates. Pick a motion, challenge someone who disagrees,
            and let the audience judge the argument — not the volume.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/discover" variant="secondary" size="lg">Explore debates</ButtonLink>
            <ButtonLink href="/signup?next=/challenge" size="lg">Start a FaceOff</ButtonLink>
            <ButtonLink href="/signup" variant="ghost" size="lg">Create your Wall</ButtonLink>
          </div>
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="grid min-h-64 grid-cols-[1fr_auto_1fr]">
            <div className="flex flex-col justify-end bg-for-soft p-6 sm:p-10">
              <p className="text-sm font-semibold text-for">For</p>
              <p className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">{featured?.forSide.displayName ?? "You"}</p>
            </div>
            <div className="relative flex flex-col items-center justify-center px-4 sm:px-8">
              <span className="fo-divider absolute inset-y-10 left-1/2 -translate-x-1/2" aria-hidden />
              <span className="relative z-10 rounded-full border border-line bg-surface px-4 py-2 font-sans text-2xl font-semibold tabular-nums sm:text-3xl">10:00</span>
            </div>
            <div className="flex flex-col items-end justify-end bg-against-soft p-6 text-right sm:p-10">
              <p className="text-sm font-semibold text-against">Against</p>
              <p className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">{featured?.againstSide.displayName ?? "Them"}</p>
            </div>
          </div>
          <div className="border-t border-line px-6 py-6 text-center sm:px-10">
            <p className="fo-proposition text-3xl sm:text-4xl">{featured?.proposition ?? "Voting should be mandatory"}</p>
            {featured ? (
              <Link href={`/d/${featured.id}`} className="mt-3 inline-block text-sm font-medium text-link underline underline-offset-4">
                {featured.status === "live" ? "Watch live now" : featured.isDemo ? "See this demo debate" : "Watch the replay"}
              </Link>
            ) : (
              <p className="mt-3 text-sm text-muted">Every FaceOff starts with one clear proposition and two people on opposite sides.</p>
            )}
          </div>
        </div>
      </section>

      {live.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <SectionHeading title="Live now" action={<Link href="/discover?tab=live" className="text-sm font-medium text-link">See all</Link>} />
          <div className="grid gap-4 md:grid-cols-3">{live.map((d) => <DebateCard key={d.id} d={d} />)}</div>
        </section>
      )}

      <section className="border-y border-line bg-sunken/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">How a FaceOff works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, b], i) => (
              <li key={t}>
                <span className="font-serif text-4xl font-bold text-subtle">{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm text-muted">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionHeading title={upcoming.length ? "Coming up" : "Recent debates"} action={<Link href="/discover" className="text-sm font-medium text-link">Discover more</Link>} />
          <div className="grid gap-4">
            {(upcoming.length ? upcoming : replays).map((d) => <DebateCard key={d.id} d={d} />)}
            {upcoming.length === 0 && replays.length === 0 && (
              <p className="text-muted">No debates yet. Be the first to start one.</p>
            )}
          </div>
        </div>
        <div>
          <SectionHeading title="Motions waiting for a challenger" />
          <div className="space-y-3">
            {motions.slice(0, 5).map((m) => <MotionCard key={m.id} m={m} compact />)}
            {motions.length === 0 && <p className="text-muted">No open motions yet.</p>}
          </div>
          <Link href="/trending" className="mt-4 inline-block text-sm font-medium text-link underline underline-offset-4">All trending motions</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl bg-ink px-6 py-12 text-bg sm:px-12">
          <h2 className="max-w-2xl font-serif text-3xl font-semibold sm:text-4xl">Unscripted. Not unaccountable.</h2>
          <p className="mt-4 max-w-2xl text-bg/75">
            There is no moderator in the room and no topic is off-limits for honest argument. There are also clear rules: no threats,
            no harassment, no hate against protected groups, no doxxing. Anyone can report, block or mute, and every enforcement
            decision can be appealed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/guidelines" variant="secondary" className="!border-bg/30 !bg-transparent !text-bg hover:!bg-bg/10">Read the guidelines</ButtonLink>
            <ButtonLink href="/signup">Create your Wall</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
