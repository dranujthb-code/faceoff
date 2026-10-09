import Link from "next/link";
import { Bell } from "lucide-react";
import { getViewer } from "@/lib/server/auth";
import { unreadCount } from "@/lib/server/domain/notifications";
import { publicUrl } from "@/lib/server/storage";
import { Logo } from "../Logo";
import { Avatar } from "../Avatar";
import { buttonClass } from "../ui/button-class";
import { NavLinks, BottomNav } from "./Nav";
import { UserMenu } from "./UserMenu";

export async function SiteHeader() {
  const viewer = await getViewer();
  const unread = viewer?.onboarded ? await unreadCount(viewer.userId).catch(() => 0) : 0;
  const me = viewer && viewer.username
    ? { username: viewer.username, displayName: viewer.displayName ?? viewer.username, avatarUrl: publicUrl(viewer.avatarKey) }
    : null;
  return (
    <>
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[70] rounded-full bg-ink px-4 py-2 text-sm text-bg">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href={viewer?.onboarded ? "/home" : "/"} aria-label="FaceOff home" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <NavLinks signedIn={!!viewer?.onboarded} />
          <div className="ml-auto flex items-center gap-2">
            {viewer ? (
              viewer.onboarded && me ? (
                <>
                  <span className="hidden md:block">
                    <Link href="/challenge" className={buttonClass("primary", "sm")}>Start a FaceOff</Link>
                  </span>
                  <Link href="/activity" className="relative rounded-full p-2 text-ink hover:bg-sunken" aria-label={unread ? `Activity, ${unread} unread` : "Activity"}>
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                      <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-on-primary">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                  <UserMenu me={me} isStaff={viewer.role !== "user"}>
                    <Avatar profile={me} size="sm" />
                  </UserMenu>
                </>
              ) : (
                <Link href="/onboarding" className={buttonClass("primary", "sm")}>Finish setup</Link>
              )
            ) : (
              <>
                <Link href="/signin" className={buttonClass("ghost", "sm")}>Sign in</Link>
                <Link href="/signup" className={buttonClass("primary", "sm")}>Create your Wall</Link>
              </>
            )}
          </div>
        </div>
      </header>
      {viewer?.onboarded && me && <BottomNav username={me.username} unread={unread} />}
    </>
  );
}
