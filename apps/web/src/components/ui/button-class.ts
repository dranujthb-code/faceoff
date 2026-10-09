import { clsx } from "clsx";

export type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  accent: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink hover:bg-sunken",
  danger: "border border-danger/40 bg-surface text-danger hover:bg-against-soft",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3.5 text-sm", md: "h-10 px-5 text-[15px]", lg: "h-12 px-7 text-base" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return clsx(base, variants[variant], sizes[size], className);
}

