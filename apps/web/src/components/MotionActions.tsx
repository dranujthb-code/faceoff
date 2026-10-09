"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { MotionView } from "@faceoff/shared";
import { api, ClientApiError } from "@/lib/client/api";
import { useToast } from "./Toast";
import { buttonClass } from "./ui";

export function MotionActions({ m, viewerId }: { m: MotionView; viewerId: string | null }) {
  const toast = useToast();
  const [supported, setSupported] = useState(m.viewerSupported);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const mine = viewerId === m.author.userId;
  const toggle = async () => {
    if (!viewerId) return router.push("/signin");
    setBusy(true);
    try {
      await api(`/motions/${m.id}/support`, { method: supported ? "DELETE" : "POST", body: {} });
      setSupported(!supported);
    } catch (e) {
      toast(e instanceof ClientApiError ? e.message : "Couldn't update support", "error");
    } finally {
      setBusy(false);
    }
  };
  const opposite = m.authorSide === "for" ? "against" : "for";
  return (
    <span className="ml-auto flex items-center gap-2">
      {m.community && m.status === "proposed" && !mine && (
        <button onClick={toggle} disabled={busy} aria-pressed={supported} className={buttonClass(supported ? "accent" : "secondary", "sm")}>
          {supported ? "Supported" : "Support"}
        </button>
      )}
      {!mine && m.status === "listed" && (
        <Link
          href={`/challenge/new?to=${m.author.userId}&motion=${m.id}`}
          className={buttonClass("primary", "sm")}
          aria-label={`Challenge ${m.author.displayName}${m.authorSide ? ` — you'd argue ${opposite}` : ""}`}
        >
          Challenge{m.authorSide ? ` (argue ${opposite})` : ""}
        </Link>
      )}
    </span>
  );
}
