"use client";
import { useNow } from "@/lib/client/useNow";

function relative(ms: number): string {
  const abs = Math.abs(ms);
  const fut = ms > 0;
  const m = Math.round(abs / 60000);
  if (m < 1) return fut ? "in under a minute" : "just now";
  if (m < 60) return fut ? `in ${m} min` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return fut ? `in ${h} h` : `${h} h ago`;
  const d = Math.round(h / 24);
  return fut ? `in ${d} day${d > 1 ? "s" : ""}` : `${d} day${d > 1 ? "s" : ""} ago`;
}

/** Renders times in the viewer's own timezone; the server renders a neutral UTC fallback. */
export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "relative" | "time" | "date" }) {
  const now = useNow(mode === "relative" ? 30_000 : 3_600_000);
  const d = new Date(iso);
  let text: string;
  if (now === null) text = `${iso.slice(0, 16).replace("T", " ")} UTC`;
  else if (mode === "relative") text = relative(d.getTime() - now);
  else if (mode === "time") text = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  else if (mode === "date") text = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  else text = d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
