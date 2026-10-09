"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import { ButtonLink, ErrorNote, Spinner } from "@/components/ui";

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "error">(token ? "working" : "error");
  const [msg, setMsg] = useState(token ? "" : "This confirmation link is incomplete.");
  const started = useRef(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api("/auth/verify-email", { body: { token } })
      .then(() => setState("done"))
      .catch((e) => {
        setState("error");
        setMsg(e instanceof ClientApiError ? e.message : "Couldn't confirm your email.");
      });
  }, [token]);
  if (state === "working") return <Spinner label="Confirming your email" />;
  if (state === "error")
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-3xl font-semibold">Link not valid</h1>
        <ErrorNote>{msg}</ErrorNote>
        <p className="text-sm text-muted">Signed in? You can send a fresh link from <Link className="text-link underline" href="/settings">Settings</Link>.</p>
      </div>
    );
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-semibold">Email confirmed</h1>
      <p className="text-muted">You can now send challenges and post motions.</p>
      <ButtonLink href="/home">Go to FaceOff</ButtonLink>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
