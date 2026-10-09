"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { useToast } from "./Toast";
import { Button } from "./ui";

export function ShareButton({ path, title, sessionId, variant = "secondary", size = "sm", label = "Share" }: { path: string; title: string; sessionId?: string; variant?: "secondary" | "ghost"; size?: "sm" | "md"; label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    setBusy(true);
    let channel: "native" | "copy" = "copy";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        channel = "native";
      } else {
        await navigator.clipboard.writeText(url);
        toast("Link copied", "success");
      }
      if (sessionId) api(`/debates/${sessionId}/share`, { body: { channel } }).catch(() => {});
    } catch {
      // user cancelled the share sheet
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant={variant} size={size} onClick={share} loading={busy}>
      <Share2 className="h-4 w-4" aria-hidden />{label}
    </Button>
  );
}
