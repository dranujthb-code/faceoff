"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useToast } from "./Toast";
import { Button } from "./ui";
import { LocalTime } from "./LocalTime";

/** "Available now" lists you at the top of other people's challenge decks for instant FaceOffs. */
export function AvailabilityToggle({ initialUntil }: { initialUntil: string | null }) {
  const [until, setUntil] = useState(initialUntil);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = async (minutes: number) => {
    setBusy(true);
    try {
      const r = await api<{ availableUntil: string | null }>("/me/availability", { body: { minutes } });
      setUntil(r.availableUntil);
      toast(minutes ? "You're available for instant FaceOffs" : "You're no longer listed as available", "success");
    } catch {
      toast("Couldn't update availability", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-semibold">{until ? "You're available now" : "Up for a debate right now?"}</p>
      <p className="mt-1 text-sm text-muted">
        {until ? <>Listed for instant challenges until <LocalTime iso={until} mode="time" />.</> : "Show up first in other people's challenge decks for the next hour."}
      </p>
      <div className="mt-4">
        {until ? (
          <Button variant="secondary" size="sm" onClick={() => set(0)} loading={busy}>Stop being available</Button>
        ) : (
          <Button variant="accent" size="sm" onClick={() => set(60)} loading={busy}>I&apos;m available for an hour</Button>
        )}
      </div>
    </div>
  );
}
