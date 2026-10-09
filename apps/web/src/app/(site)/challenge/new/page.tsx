import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/server/page-guards";
import { asUser, isUuid } from "@/lib/server/db";
import { getProfileDetail } from "@/lib/server/domain/profiles";
import { getMotion } from "@/lib/server/domain/communities";
import { toProfileSummary } from "@/lib/server/domain/mappers";
import { EmptyState, ButtonLink } from "@/components/ui";
import { ResendVerification } from "@/components/ResendVerification";
import { NewChallenge } from "./NewChallenge";

export const metadata = { title: "Send a challenge" };
export const dynamic = "force-dynamic";

export default async function NewChallengePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const v = await requireViewer(`/challenge/new?to=${sp.to ?? ""}${sp.motion ? `&motion=${sp.motion}` : ""}`);
  if (!isUuid(sp.to)) notFound();
  const [row] = await asUser(v.userId, (tx) => tx`select user_id, username, display_name, avatar_key, is_demo, available_until, account_status from faceoff.profiles where user_id = ${sp.to!}`);
  if (!row) notFound();
  const detail = await getProfileDetail(row.username, v.userId);
  const motion = isUuid(sp.motion) ? await getMotion(sp.motion, v.userId) : null;
  const recipient = toProfileSummary(row as never);
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold">Send a challenge</h1>
      <div className="mt-6">
        {!v.emailVerified ? (
          <ResendVerification email={v.email} />
        ) : !detail?.viewer?.canChallenge ? (
          <EmptyState title={`${recipient.displayName} isn't accepting challenges from you`} body="They may only accept challenges from people they follow, or have challenges turned off." action={<ButtonLink href="/challenge" variant="secondary">Find someone else</ButtonLink>} />
        ) : (
          <NewChallenge recipient={recipient} motion={motion ? { id: motion.id, title: motion.title, authorSide: motion.authorSide, authorId: motion.author.userId, communityId: motion.community?.id ?? null } : null} availableNow={!!recipient.availableNow} />
        )}
      </div>
    </div>
  );
}
