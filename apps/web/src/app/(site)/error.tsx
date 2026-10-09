"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-3xl font-semibold">Something broke on our side</h1>
      <p className="mt-2 text-muted">Try again. If it keeps happening, let us know through the contact page{error.digest ? ` and mention code ${error.digest}` : ""}.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
