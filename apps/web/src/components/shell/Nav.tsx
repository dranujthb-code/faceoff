"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Bell, Compass, Home, User } from "lucide-react";
import { LogoMark } from "../Logo";

const PUBLIC_LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/communities", label: "Communities" },
  { href: "/how-it-works", label: "How it works" },
];
const SIGNED_IN_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/communities", label: "Communities" },
];

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const links = signedIn ? SIGNED_IN_LINKS : PUBLIC_LINKS;
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
            className={clsx("rounded-full px-3 py-1.5 text-sm font-medium", active ? "bg-sunken text-ink" : "text-muted hover:text-ink")}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom navigation: Home, Discover, FaceOff (primary), Activity, Profile. */
export function BottomNav({ username, unread }: { username: string; unread: number }) {
  const path = usePathname();
  if (path.startsWith("/d/") && path.split("/").length === 3) return null; // the debate room is full-screen on mobile
  const items = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/challenge", label: "FaceOff", icon: null },
    { href: "/activity", label: "Activity", icon: Bell, badge: unread },
    { href: `/u/${username}`, label: "Profile", icon: User },
  ];
  return (
    <>
      <div className="h-20 md:hidden" aria-hidden />
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
          {items.map((it) => {
            const active = path === it.href || (it.href !== "/home" && path.startsWith(it.href));
            if (!it.icon) {
              return (
                <li key={it.href} className="flex items-center justify-center">
                  <Link href={it.href} aria-label="Start a FaceOff" aria-current={active ? "page" : undefined}
                    className={clsx("-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl border bg-surface shadow-md", active ? "border-ink" : "border-line")}>
                    <LogoMark className="h-8 w-auto" title="" />
                  </Link>
                </li>
              );
            }
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={active ? "page" : undefined}
                  className={clsx("relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-ink" : "text-subtle")}>
                  <Icon className="h-5 w-5" aria-hidden />
                  {it.label}
                  {!!it.badge && <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-primary" aria-label={`${it.badge} unread`} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
