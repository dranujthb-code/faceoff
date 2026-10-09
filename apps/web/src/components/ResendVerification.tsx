"use client";
import { useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import { Button } from "./ui";

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | string>("idle");
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm"><strong>Confirm your email</strong> to send challenges and post motions. We sent a link to {email}.</p>
      {state === "sent" ? (
        <span className="text-sm font-medium text-success">New link sent</span>
      ) : (
        <Button size="sm" variant="secondary" loading={state === "busy"} onClick={async () => {
          setState("busy");
          try { await api("/auth/resend-verification", { body: {} }); setState("sent"); }
          catch (e) { setState(e instanceof ClientApiError ? e.message : "Couldn't send"); }
        }}>Resend link</Button>
      )}
      {state !== "idle" && state !== "busy" && state !== "sent" && <span className="text-sm text-danger">{state}</span>}
    </div>
  );
}
