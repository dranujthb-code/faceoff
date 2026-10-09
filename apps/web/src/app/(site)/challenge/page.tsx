import { requireViewer } from "@/lib/server/page-guards";
import { listTopics } from "@/lib/server/domain/communities";
import { ResendVerification } from "@/components/ResendVerification";
import { SwipeDeck } from "./SwipeDeck";

export const metadata = { title: "Start a FaceOff" };
export const dynamic = "force-dynamic";

export default async function ChallengeDeckPage() {
  const v = await requireViewer("/challenge");
  const topics = await listTopics();
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Start a FaceOff</h1>
      <p className="mt-1.5 text-muted">Swipe right to challenge, left to skip. Or use the buttons, or your arrow keys.</p>
      {!v.emailVerified && <div className="mt-5"><ResendVerification email={v.email} /></div>}
      <div className="mt-6"><SwipeDeck topics={topics} canChallenge={v.emailVerified} /></div>
    </div>
  );
}
