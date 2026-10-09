import { clsx } from "clsx";
import type { ProfileSummary } from "@faceoff/shared";

const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-lg", xl: "h-24 w-24 text-2xl" };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Avatar({ profile, size = "md", side, className }: { profile: Pick<ProfileSummary, "displayName" | "avatarUrl">; size?: keyof typeof sizes; side?: "for" | "against" | null; className?: string }) {
  const ring = side === "for" ? "ring-2 ring-for ring-offset-2 ring-offset-bg" : side === "against" ? "ring-2 ring-against ring-offset-2 ring-offset-bg" : "";
  if (profile.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatarUrl} alt="" className={clsx("shrink-0 rounded-full object-cover", sizes[size], ring, className)} />;
  }
  const tint = side === "against" ? "bg-against-soft text-against" : side === "for" ? "bg-for-soft text-for" : "bg-sunken text-muted";
  return (
    <span aria-hidden className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", sizes[size], tint, ring, className)}>
      {initials(profile.displayName)}
    </span>
  );
}
