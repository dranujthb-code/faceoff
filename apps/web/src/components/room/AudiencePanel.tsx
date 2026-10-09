"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { MoreHorizontal } from "lucide-react";
import { COMMENT_MAX_LENGTH, POLL_DEFINITIONS, REACTIONS, REACTION_EMOJI, type CommentView, type PollKind, type ReactionKind, type SessionState } from "@faceoff/shared";
import { api, ClientApiError } from "@/lib/client/api";
import { Avatar } from "../Avatar";
import { ReportDialog } from "../ReportDialog";
import { useToast } from "../Toast";
import { DemoBadge } from "../ui";

const CHOICE_LABEL: Record<string, string> = { for: "For", against: "Against", tie: "Even", undecided: "Undecided" };

function Poll({ kind, state, onVoted }: { kind: PollKind; state: SessionState; onVoted: () => void }) {
  const def = POLL_DEFINITIONS[kind];
  const poll = state.polls[kind];
  const mine = state.viewer.votes[kind];
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const debaterBlocked = kind === "persuasion" && state.viewer.role === "debater";
  const canVote = state.viewer.canVote && poll.status === "open" && !debaterBlocked;
  const showResults = !!mine || poll.status === "closed" || state.viewer.role === "debater" || ["completed", "interrupted"].includes(state.session.status);
  const name = (c: string) => (c === "for" ? state.session.forSide.displayName : c === "against" ? state.session.againstSide.displayName : null);
  return (
    <fieldset className="rounded-2xl border border-line p-4">
      <legend className="px-1 text-sm font-semibold">{def.question}</legend>
      <p className="text-xs text-muted">{def.help}</p>
      <div className="mt-3 space-y-2">
        {def.choices.map((c) => {
          const n = poll.tallies[c] ?? 0;
          const pct = poll.total ? Math.round((n / poll.total) * 100) : 0;
          const selected = mine === c;
          const tone = c === "for" ? "bg-for" : c === "against" ? "bg-against" : "bg-line-strong";
          return (
            <button
              key={c}
              type="button"
              disabled={!canVote || busy !== null}
              aria-pressed={selected}
              onClick={async () => {
                setBusy(c);
                try { await api(`/debates/${state.session.id}/votes`, { body: { poll: kind, choice: c } }); onVoted(); }
                catch (e) { toast(e instanceof ClientApiError ? e.message : "Couldn't record your vote", "error"); }
                finally { setBusy(null); }
              }}
              className={clsx("relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm disabled:cursor-default", selected ? "border-ink" : "border-line-strong", canVote && "hover:border-ink")}
            >
              {showResults && <span aria-hidden className={clsx("absolute inset-y-0 left-0 opacity-20", tone)} style={{ width: `${pct}%` }} />}
              <span className="relative flex items-center justify-between gap-3">
                <span className="font-medium">
                  {CHOICE_LABEL[c]}
                  {kind === "persuasion" && name(c) ? <span className="font-normal text-muted"> — {name(c)}</span> : null}
                  {selected && <span className="ml-1.5 text-xs text-muted">(your vote)</span>}
                </span>
                {showResults && <span className="tabular-nums text-muted">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        {poll.total} vote{poll.total === 1 ? "" : "s"}
        {poll.status === "closed" ? " — voting closed" : debaterBlocked ? " — debaters can't vote on this one" : !state.viewer.canVote ? (state.viewer.role === "anonymous" ? " — sign in to vote" : " — voting opens when the debate goes live") : " — you can change your vote while voting is open"}
      </p>
    </fieldset>
  );
}

function CommentRow({ c, meId, onRemoved }: { c: CommentView; meId: string | null; onRemoved: () => void }) {
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const toast = useToast();
  if (c.status !== "visible") {
    return <li className="px-1 py-1.5 text-xs italic text-subtle">{c.status === "removed" ? "Comment removed by its author" : "Comment hidden by moderators"}</li>;
  }
  return (
    <li className="group flex gap-2.5 px-1 py-1.5">
      <Avatar profile={c.author} size="xs" />
      <div className="min-w-0 flex-1 text-sm">
        <Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">{c.author.displayName}</Link>
        {c.author.isDemo && <span className="ml-1 align-middle"><DemoBadge /></span>}
        <p className="break-words">{c.body}</p>
      </div>
      {meId && (
        <div className="relative">
          <button className="rounded-full p-1 text-subtle opacity-60 hover:bg-sunken group-hover:opacity-100 focus:opacity-100" aria-label="Comment actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 z-20 w-40 rounded-xl border border-line bg-surface p-1 shadow-xl">
              {c.author.userId === meId ? (
                <button role="menuitem" className="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={async () => { setMenu(false); try { await api(`/comments/${c.id}`, { method: "DELETE", body: {} }); onRemoved(); } catch { toast("Couldn't remove comment", "error"); } }}>Delete</button>
              ) : (
                <>
                  <button role="menuitem" className="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-sunken" onClick={async () => { setMenu(false); await api(`/users/id/${c.author.userId}/mute`, { body: {} }).catch(() => {}); toast(`Muted ${c.author.displayName}`, "success"); onRemoved(); }}>Mute author</button>
                  <button role="menuitem" className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-danger hover:bg-sunken" onClick={() => { setMenu(false); setReport(true); }}>Report</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <ReportDialog open={report} onClose={() => setReport(false)} targetType="comment" targetId={c.id} label="comment" />
    </li>
  );
}

export function AudiencePanel({ state, comments, me, onChanged, reactionBurst }: {
  state: SessionState;
  comments: CommentView[];
  me: { userId: string; onboarded: boolean } | null;
  onChanged: () => void;
  reactionBurst: Array<{ id: number; kind: ReactionKind }>;
}) {
  const [tab, setTab] = useState<"chat" | "vote">("chat");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const listRef = useRef<HTMLUListElement>(null);
  const live = state.session.status === "live";
  const atBottom = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await api(`/debates/${state.session.id}/comments`, { body: { body } });
      setBody("");
      atBottom.current = true;
      onChanged();
    } catch (err) {
      toast(err instanceof ClientApiError ? err.message : "Couldn't post your comment", "error");
    } finally {
      setSending(false);
    }
  };
  const react = async (kind: ReactionKind) => {
    try { await api(`/debates/${state.session.id}/reactions`, { body: { kind } }); onChanged(); }
    catch (err) { toast(err instanceof ClientApiError ? err.message : "Couldn't send reaction", "error"); }
  };

  return (
    <section aria-label="Audience" className="flex h-full min-h-[28rem] flex-col rounded-2xl border border-line bg-surface">
      <div className="flex border-b border-line" role="tablist">
        {(["chat", "vote"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("flex-1 py-3 text-sm font-semibold", tab === t ? "border-b-2 border-ink text-ink" : "text-muted")}>
            {t === "chat" ? `Comments${comments.length ? ` (${comments.filter((c) => c.status === "visible").length})` : ""}` : "Vote"}
          </button>
        ))}
      </div>
      {tab === "chat" ? (
        <>
          <ul ref={listRef} onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }} className="max-h-[26rem] min-h-48 flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-live="polite" aria-relevant="additions">
            {comments.length === 0 && <li className="py-8 text-center text-sm text-muted">No comments yet.</li>}
            {comments.map((c) => <CommentRow key={c.id} c={c} meId={me?.userId ?? null} onRemoved={onChanged} />)}
          </ul>
          {live && (
            <div className="relative flex justify-center gap-1 border-t border-line px-3 py-2" aria-label="Reactions">
              {REACTIONS.map((k) => (
                <button key={k} disabled={!state.viewer.canComment} onClick={() => react(k)} className="rounded-full px-2.5 py-1 text-lg hover:bg-sunken disabled:opacity-40" aria-label={`React ${k}`}>
                  {REACTION_EMOJI[k]} <span className="text-xs tabular-nums text-muted">{state.reactions[k] || ""}</span>
                </button>
              ))}
              <div className="pointer-events-none absolute inset-x-0 bottom-full h-24 overflow-hidden" aria-hidden>
                {reactionBurst.map((r) => <span key={r.id} className="fo-reaction-pop absolute bottom-0 text-2xl" style={{ left: `${15 + ((r.id * 37) % 70)}%` }}>{REACTION_EMOJI[r.kind]}</span>)}
              </div>
            </div>
          )}
          <div className="border-t border-line p-3">
            {state.viewer.canComment ? (
              <form onSubmit={send} className="flex gap-2">
                <label htmlFor="cmt" className="sr-only">Write a comment</label>
                <input id="cmt" value={body} onChange={(e) => setBody(e.target.value)} maxLength={COMMENT_MAX_LENGTH} placeholder="Say something about the arguments" className="min-w-0 flex-1 rounded-full border border-line-strong bg-bg px-4 py-2 text-sm focus:border-accent focus:outline-none" />
                <button disabled={sending || !body.trim()} className="rounded-full bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">Post</button>
              </form>
            ) : !me ? (
              <p className="text-center text-sm text-muted"><Link href={`/signin?next=/d/${state.session.id}`} className="font-semibold text-link underline">Sign in</Link> to comment and vote.</p>
            ) : !me.onboarded ? (
              <p className="text-center text-sm text-muted"><Link href="/onboarding" className="text-link underline">Finish setting up</Link> to comment.</p>
            ) : (
              <p className="text-center text-sm text-muted">Comments open when the debaters enter the room.</p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4 overflow-y-auto p-4">
          <Poll kind="persuasion" state={state} onVoted={onChanged} />
          <Poll kind="position" state={state} onVoted={onChanged} />
        </div>
      )}
    </section>
  );
}
