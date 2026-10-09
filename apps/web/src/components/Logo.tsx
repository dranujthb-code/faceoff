import { clsx } from "clsx";

/**
 * FaceOff mark: the F (blue) and O (red) speech bubbles facing each other across the
 * central ink divider with its dot — redrawn as vector from the brand logo.
 */
export function LogoMark({ className, title = "FaceOff" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 120 88" className={className} {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}>
      {title ? <title>{title}</title> : null}
      {/* For bubble */}
      <path d="M8 18c0-6.6 5.4-12 12-12h22c6.6 0 12 5.4 12 12v26c0 6.6-5.4 12-12 12h-2l12 18-26-18H20c-6.6 0-12-5.4-12-12z" fill="var(--fo-logo-blue, #6498AD)" />
      {/* Against bubble */}
      <path d="M66 18c0-6.6 5.4-12 12-12h22c6.6 0 12 5.4 12 12v26c0 6.6-5.4 12-12 12H80L54 74l12-18z" fill="var(--fo-logo-red, #E5504A)" />
      <text x="31" y="47" textAnchor="middle" fontFamily="var(--font-serif), Georgia, serif" fontWeight="800" fontSize="34" fill="#0B1419">F</text>
      <text x="89" y="47" textAnchor="middle" fontFamily="var(--font-serif), Georgia, serif" fontWeight="800" fontSize="34" fill="#0B1419">O</text>
      {/* divider + dot */}
      <rect x="58.5" y="12" width="3" height="66" rx="1.5" fill="var(--fo-ink, #0B1419)" />
      <circle cx="60" cy="5" r="4.5" fill="var(--fo-ink, #0B1419)" />
    </svg>
  );
}

export function Wordmark({ className, tagline = false, size = "md" }: { className?: string; tagline?: boolean; size?: "sm" | "md" | "lg" }) {
  const text = { sm: "text-xl", md: "text-2xl", lg: "text-5xl sm:text-6xl" }[size];
  return (
    <span className={clsx("inline-flex flex-col leading-none", className)}>
      <span className={clsx("font-serif font-extrabold tracking-tight text-ink", text)}>FaceOff</span>
      {tagline && (
        <span className={clsx("mt-1 font-sans font-semibold uppercase text-muted", size === "lg" ? "text-sm tracking-[0.22em]" : "text-[10px] tracking-[0.18em]")}>
          You have a voice
        </span>
      )}
    </span>
  );
}

export function Logo({ className, tagline = false, size = "md" }: { className?: string; tagline?: boolean; size?: "sm" | "md" | "lg" }) {
  const mark = { sm: "h-7 w-auto", md: "h-9 w-auto", lg: "h-20 w-auto" }[size];
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={mark} title="" />
      <Wordmark tagline={tagline} size={size} />
    </span>
  );
}
