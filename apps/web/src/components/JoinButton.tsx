"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ClientApiError } from "@/lib/client/api";
import { useToast } from "./Toast";
import { Button } from "./ui";

export function JoinButton({ communityId, initial, signedIn = true, size = "sm" }: { communityId: string; initial: boolean; signedIn?: boolean; size?: "sm" | "md" }) {
  const [member, setMember] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      size={size}
      variant={member ? "secondary" : "accent"}
      loading={busy}
      aria-pressed={member}
      onClick={async () => {
        if (!signedIn) return router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
        setBusy(true);
        try {
          await api(`/communities/id/${communityId}/membership`, { method: member ? "DELETE" : "POST", body: {} });
          setMember(!member);
          router.refresh();
        } catch (e) {
          toast(e instanceof ClientApiError ? e.message : "Couldn't update membership", "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {member ? "Joined" : "Join"}
    </Button>
  );
}
