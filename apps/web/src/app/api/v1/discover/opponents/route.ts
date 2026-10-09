import { handler } from "@/lib/server/api";
import { isUuid } from "@/lib/server/db";
import { opponentDeck } from "@/lib/server/domain/discover";

export const GET = handler({ auth: "required", requireOnboarded: true }, async ({ viewer, query }) => {
  const community = query.get("community");
  return opponentDeck(viewer.userId, {
    topicSlug: query.get("topic") ?? undefined,
    communityId: community && isUuid(community) ? community : undefined,
    availableOnly: query.get("available") === "1",
  });
});
