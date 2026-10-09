"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { REGION_LABELS, type OpponentCard, type TopicSummary } from "@faceoff/shared";
import { api, ClientApiError } from "@/lib/client/api";
import { Avatar } from "@/components/Avatar";
import { ChallengeComposer } from "@/components/ChallengeComposer";
import { Badge, Button, DemoBadge, EmptyState, ErrorNote, Modal, Spinner, Notice } from "@/components/ui";
import { LogoMark } from "@/components/Logo";

const THRESHOLD = 110;

export function SwipeDeck({ topics, canChallenge }: { topics: TopicSummary[]; canChallenge: boolean }) {
  const [cards, setCards] = useState<OpponentCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [composing, setComposing] = useState<OpponentCard | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const start = useRef<number | null>(null);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams();
    if (topic) qs.set("topic", topic);
    if (availableOnly) qs.set("available", "1");
    api<OpponentCard[]>(`/discover/opponents?${qs}`).then(
      (c) => { if (live) { setCards(c); setError(null); } },
      (e) => { if (live) setError(e instanceof ClientApiError ? e.message : "Couldn't load opponents"); },
    );
    return () => { live = false; };
  }, [topic, availableOnly, version]);
  const load = () => setVersion((v) => v + 1);

  const top = cards?.[0];
  const advance = () => { setCards((c) => (c ? c.slice(1) : c)); setDx(0); setLeaving(null); };

  const skip = useCallback(() => {
    if (!top) return;
    setLeaving("left");
    api("/discover/skip", { body: { userId: top.profile.userId } }).catch(() => {});
    setTimeout(advance, 220);
  }, [top]);
  const challenge = useCallback(() => {
    if (!top) return;
    setLeaving("right");
    setTimeout(() => { setComposing(top); setDx(0); setLeaving(null); }, 220);
  }, [top]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (composing || (e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "ArrowLeft") skip();
      if (e.key === "ArrowRight" && canChallenge) challenge();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [skip, challenge, composing, canChallenge]);

  const onDown = (e: React.PointerEvent) => { start.current = e.clientX; setDragging(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (start.current !== null) setDx(e.clientX - start.current); };
  const onUp = () => {
    setDragging(false);
    start.current = null;
    if (dx > THRESHOLD && canChallenge) challenge();
    else if (dx < -THRESHOLD) skip();
    else setDx(0);
  };

  const offset = leaving === "left" ? -600 : leaving === "right" ? 600 : dx;
  const intent = offset > 40 ? "right" : offset < -40 ? "left" : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="topic">Topic</label>
        <select id="topic" value={topic} onChange={(e) => { setCards(null); setTopic(e.target.value); }} className="rounded-full border border-line-strong bg-surface px-4 py-1.5 text-sm">
          <option value="">Any topic</option>
          {topics.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
        </select>
        <button type="button" aria-pressed={availableOnly} onClick={() => { setCards(null); setAvailableOnly((a) => !a); }}
          className={clsx("rounded-full border px-4 py-1.5 text-sm font-medium", availableOnly ? "border-success bg-success/10 text-success" : "border-line-strong")}>
          Available now
        </button>
      </div>
      {sent && <div className="mb-4"><Notice tone="for">Challenge sent to {sent}. You&apos;ll be notified when they respond.</Notice></div>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {!cards && !error && <div className="py-16 text-center"><Spinner label="Finding opponents" /></div>}
      {cards && cards.length === 0 && (
        <EmptyState title="You've seen everyone for now" body="Try another topic, or post a motion so challengers can find you." action={<Button variant="secondary" onClick={() => { setCards(null); load(); }}>Refresh</Button>} />
      )}
      {top && (
        <div>
          <div className="relative">
          {cards![1] && <div aria-hidden className="absolute inset-x-4 -bottom-2.5 top-2.5 rounded-3xl border border-line bg-surface" />}
          <article
            aria-label={`${top.profile.displayName}`}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ transform: `translateX(${offset}px) rotate(${offset / 25}deg)`, transition: dragging ? "none" : "transform .22s ease-out", touchAction: "pan-y" }}
            className="relative cursor-grab touch-pan-y select-none overflow-hidden rounded-3xl border border-line bg-surface active:cursor-grabbing"
          >
            <div className={clsx("pointer-events-none absolute inset-0 z-10 flex items-start p-6 transition-opacity", intent ? "opacity-100" : "opacity-0", intent === "right" ? "justify-start" : "justify-end")}>
              <span className={clsx("rounded-xl border-2 px-3 py-1 text-lg font-bold", intent === "right" ? "-rotate-6 border-primary text-primary" : "rotate-6 border-muted text-muted")}>{intent === "right" ? "Challenge" : "Skip"}</span>
            </div>
            <div className="flex flex-col items-center px-6 pb-6 pt-10 text-center">
              <Avatar profile={top.profile} size="xl" />
              <h2 className="mt-4 font-serif text-2xl font-semibold">{top.profile.displayName}</h2>
              <p className="text-sm text-muted">@{top.profile.username}{top.profile.region ? ` — ${REGION_LABELS[top.profile.region]}` : ""}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {top.availableNow && <Badge tone="success">Available now</Badge>}
                {top.profile.isDemo && <DemoBadge />}
                <Badge>{top.debatesCompleted} debates</Badge>
              </div>
              {top.profile.bio && <p className="mt-4 max-w-sm text-sm">{top.profile.bio}</p>}
            </div>
            {top.motion && (
              <div className="border-t border-line bg-sunken/60 px-6 py-5">
                <p className="text-xs font-semibold text-muted">{top.profile.displayName.split(" ")[0]} will defend</p>
                <p className="fo-proposition mt-1 text-xl">{top.motion.title}</p>
                {top.motion.authorSide && (
                  <p className="mt-2 text-sm">
                    They argue <span className={clsx("font-semibold", top.motion.authorSide === "for" ? "text-for" : "text-against")}>{top.motion.authorSide}</span>
                    {" "}— swipe right to argue <span className={clsx("font-semibold", top.motion.authorSide === "for" ? "text-against" : "text-for")}>{top.motion.authorSide === "for" ? "against" : "for"}</span>.
                  </p>
                )}
              </div>
            )}
            <div className="border-t border-line px-6 py-4">
              <div className="flex flex-wrap gap-1.5">{top.topics.slice(0, 5).map((t) => <span key={t.id} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs">{t.name}</span>)}</div>
              {top.reasons.length > 0 && <p className="mt-2 text-xs text-muted">Why you&apos;re seeing this: {top.reasons.join(", ").toLowerCase()}</p>}
            </div>
          </article>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6">
            <button onClick={skip} className="flex h-14 w-14 items-center justify-center rounded-full border border-line-strong bg-surface hover:bg-sunken" aria-label={`Skip ${top.profile.displayName}`}>
              <X className="h-6 w-6" />
            </button>
            <button onClick={challenge} disabled={!canChallenge} className="flex h-16 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50" aria-label={`Challenge ${top.profile.displayName}`}>
              <LogoMark className="h-7 w-auto" title="" />Challenge
            </button>
          </div>
          {top.profile.isDemo && <p className="mt-3 text-center text-xs text-muted">Demo accounts never respond — challenges to them will expire.</p>}
        </div>
      )}
      <Modal open={!!composing} onClose={() => setComposing(null)} title="Send a challenge" wide>
        {composing && (
          <ChallengeComposer
            recipient={composing.profile}
            availableNow={composing.availableNow}
            motion={composing.motion ? { id: composing.motion.id, title: composing.motion.title, authorSide: composing.motion.authorSide, authorId: composing.profile.userId } : null}
            onSent={() => { setSent(composing.profile.displayName); setComposing(null); advance(); }}
          />
        )}
      </Modal>
    </div>
  );
}
