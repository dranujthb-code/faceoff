import Link from "next/link";
import { requireStaff } from "@/lib/server/page-guards";
import { Logo } from "@/components/Logo";
import { AdminNav } from "./AdminNav";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const v = await requireStaff("/admin");
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/home"><Logo size="sm" /></Link>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-bg">{v.role === "admin" ? "Admin" : "Moderator"}</span>
          <span className="ml-auto text-sm text-muted">@{v.username}</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[200px_1fr]">
        <AdminNav isAdmin={v.role === "admin"} />
        <main id="main" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
