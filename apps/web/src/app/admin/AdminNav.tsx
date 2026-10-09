"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items = [
    ["/admin", "Overview"],
    ["/admin/reports", "Reports"],
    ["/admin/appeals", "Appeals"],
    ["/admin/debates", "Debates"],
    ["/admin/users", "Users"],
    ["/admin/communities", "Communities and topics"],
    ["/admin/support", "Support inbox"],
    ...(isAdmin ? [["/admin/audit", "Audit log"]] : []),
  ];
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto text-sm lg:flex-col">
        {items.map(([href, label]) => (
          <li key={href}>
            <Link href={href!} aria-current={path === href ? "page" : undefined} className={clsx("block whitespace-nowrap rounded-lg px-3 py-2", path === href ? "bg-ink text-bg" : "text-muted hover:bg-sunken hover:text-ink")}>{label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
