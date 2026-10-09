import "server-only";
import { redirect } from "next/navigation";
import { getViewer, isStaff, type Viewer } from "./auth";

/** For authenticated pages: redirects to sign-in (or onboarding) when needed. */
export async function requireViewer(next: string, opts: { onboarded?: boolean } = { onboarded: true }): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/signin?next=${encodeURIComponent(next)}`);
  if (opts.onboarded !== false && !v.onboarded) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return v;
}

export async function requireStaff(next: string): Promise<Viewer> {
  const v = await requireViewer(next);
  if (!isStaff(v)) redirect("/home");
  return v;
}

export function safeNext(next: string | string[] | undefined, fallback = "/home"): string {
  const n = Array.isArray(next) ? next[0] : next;
  return n && n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}
