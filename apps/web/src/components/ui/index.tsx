"use client";
import { clsx } from "clsx";
import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Loader2, X } from "lucide-react";

import { buttonClass, type Variant, type Size } from "./button-class";
export { buttonClass };

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }>(
  function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
    return (
      <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

export function ButtonLink({ href, variant = "primary", size = "md", className, children, ...rest }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode; prefetch?: boolean }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted" id={`${id}-hint`}>{hint}</p>}
      {error && (
        <p className="text-sm text-danger" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "block w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={clsx(inputCls, className)} aria-invalid={invalid || undefined} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(inputCls, "min-h-24", className)} aria-invalid={invalid || undefined} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx(inputCls, "appearance-none bg-[length:16px] pr-9", className)} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ label, description, checked, onChange, id, disabled }: { label: ReactNode; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; id?: string; disabled?: boolean }) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <div className="flex items-start gap-3">
      <input id={cid} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong accent-[var(--fo-accent)]" />
      <label htmlFor={cid} className="text-sm leading-snug">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-muted">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p id={`${id}-l`} className="text-sm font-medium">{label}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-accent" : "bg-line-strong")}
      >
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5.5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "for" | "against" | "live" | "demo" | "success" | "warning"; className?: string }) {
  const tones = {
    neutral: "bg-sunken text-muted",
    for: "bg-for-soft text-for",
    against: "bg-against-soft text-against",
    live: "bg-live text-white",
    demo: "border border-dashed border-line-strong text-muted",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
  };
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function LiveBadge() {
  return (
    <Badge tone="live">
      <span className="fo-live-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      Live
    </Badge>
  );
}

export function DemoBadge() {
  return (
    <Badge tone="demo" className="font-medium">
      <span title="Demonstration content — not a real person or a real debate">Demo</span>
    </Badge>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-serif text-xl font-semibold">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-against-soft px-4 py-3 text-sm text-danger">
      {children}
    </div>
  );
}

export function Notice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "for" | "warning" }) {
  const t = { neutral: "bg-sunken text-ink", for: "bg-for-soft text-ink", warning: "bg-warning/12 text-ink" }[tone];
  return <div className={clsx("rounded-xl px-4 py-3 text-sm", t)}>{children}</div>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={clsx(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
      aria-labelledby="modal-title"
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="font-serif text-2xl font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-sunken" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rounded-2xl border border-line bg-surface", className)}>{children}</div>;
}

export function SectionHeading({ title, action, sub }: { title: string; action?: ReactNode; sub?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
