"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import type { ProfileDetail } from "@faceoff/shared";
import { api, ClientApiError } from "@/lib/client/api";
import { useToast } from "./Toast";
import { Button, Modal } from "./ui";
import { buttonClass } from "./ui/button-class";
import { ReportDialog } from "./ReportDialog";
import { ShareButton } from "./ShareButton";

export function ProfileActions({ profile, viewer, signedIn }: { profile: { userId: string; username: string; displayName: string }; viewer: ProfileDetail["viewer"]; signedIn: boolean }) {
  const [follows, setFollows] = useState(!!viewer?.follows);
  const [blocked, setBlocked] = useState(!!viewer?.blocked);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (viewer?.isSelf) {
    return (
      <div className="flex shrink-0 gap-2">
        <Link href="/settings" className={buttonClass("secondary", "sm")}>Edit Wall</Link>
        <ShareButton path={`/u/${profile.username}`} title={`${profile.displayName} on FaceOff`} />
      </div>
    );
  }
  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    if (!signedIn) return router.push(`/signin?next=/u/${profile.username}`);
    setBusy(true);
    try { await fn(); if (msg) toast(msg, "success"); router.refresh(); }
    catch (e) { toast(e instanceof ClientApiError ? e.message : "Something went wrong", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {!blocked && (
        <Button variant={follows ? "secondary" : "accent"} size="sm" loading={busy} aria-pressed={follows}
          onClick={() => act(async () => { await api(`/users/id/${profile.userId}/follow`, { method: follows ? "DELETE" : "POST", body: {} }); setFollows(!follows); })}>
          {follows ? "Following" : "Follow"}
        </Button>
      )}
      {viewer?.canChallenge && !blocked ? (
        <Link href={`/challenge/new?to=${profile.userId}`} className={buttonClass("primary", "sm")}>Send a challenge</Link>
      ) : !signedIn ? (
        <Link href={`/signin?next=/u/${profile.username}`} className={buttonClass("primary", "sm")}>Send a challenge</Link>
      ) : null}
      <div className="relative" ref={ref}>
        <button className="rounded-full p-2 hover:bg-sunken" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-2xl border border-line bg-surface p-1.5 shadow-xl">
            <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken" onClick={async () => { setMenu(false); await navigator.clipboard?.writeText(`${window.location.origin}/u/${profile.username}`); toast("Link copied", "success"); }}>Copy link</button>
            {signedIn && (
              <>
                <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken" onClick={() => { setMenu(false); act(() => api(`/users/id/${profile.userId}/mute`, { body: {} }), `Muted ${profile.displayName}. You won't see their comments.`); }}>Mute</button>
                <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken" onClick={() => { setMenu(false); if (blocked) act(async () => { await api(`/users/id/${profile.userId}/block`, { method: "DELETE", body: {} }); setBlocked(false); }, "Unblocked"); else setConfirmBlock(true); }}>{blocked ? "Unblock" : "Block"}</button>
                <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-sunken" onClick={() => { setMenu(false); setReport(true); }}>Report</button>
              </>
            )}
          </div>
        )}
      </div>
      <ReportDialog open={report} onClose={() => setReport(false)} targetType="user" targetId={profile.userId} label={profile.displayName} />
      <Modal open={confirmBlock} onClose={() => setConfirmBlock(false)} title={`Block ${profile.displayName}?`}>
        <p className="text-sm text-muted">They won&apos;t be able to challenge you, follow you, see your Wall or comment on your debates. Pending challenges between you are cancelled. They aren&apos;t told that you blocked them.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmBlock(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setConfirmBlock(false); act(async () => { await api(`/users/id/${profile.userId}/block`, { body: {} }); setBlocked(true); setFollows(false); }, `Blocked ${profile.displayName}`); }}>Block</Button>
        </div>
      </Modal>
    </div>
  );
}
