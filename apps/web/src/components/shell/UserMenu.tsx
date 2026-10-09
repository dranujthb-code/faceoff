"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";

export function UserMenu({ me, isStaff, children }: { me: { username: string; displayName: string }; isStaff: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  const signOut = async () => {
    await api("/auth/signout", { method: "POST", body: {} }).catch(() => {});
    router.push("/");
    router.refresh();
  };
  const item = "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken";
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className="rounded-full">
        {children}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-xl">
          <p className="px-3 py-2 text-sm"><span className="block font-semibold">{me.displayName}</span><span className="text-muted">@{me.username}</span></p>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" href={`/u/${me.username}`} className={item} onClick={() => setOpen(false)}>Your Wall</Link>
          <Link role="menuitem" href="/saved" className={item} onClick={() => setOpen(false)}>Saved and history</Link>
          <Link role="menuitem" href="/settings" className={item} onClick={() => setOpen(false)}>Settings</Link>
          {isStaff && <Link role="menuitem" href="/admin" className={item} onClick={() => setOpen(false)}>Admin console</Link>}
          <div className="my-1 h-px bg-line" />
          <button role="menuitem" onClick={signOut} className={item}>Sign out</button>
        </div>
      )}
    </div>
  );
}
