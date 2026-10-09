import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { getCommunity, listMotions } from "@/lib/server/domain/communities";
import { listDebates } from "@/lib/server/domain/debates";

export const GET = handler({ auth: "optional" }, async ({ viewer, params }) => {
  const uid = viewer?.userId ?? null;
  const c = await getCommunity(params.slug!, uid);
  if (!c) throw notFound("Community not found");
  const [live, upcoming, replays, listed, proposed] = await Promise.all([
    listDebates({ filter: "live", communityId: c.id }, uid),
    listDebates({ filter: "upcoming", communityId: c.id }, uid),
    listDebates({ filter: "replays", communityId: c.id, limit: 12 }, uid),
    listMotions(uid, { communityId: c.id, status: "listed", trending: true }),
    listMotions(uid, { communityId: c.id, status: "proposed" }),
  ]);
  return { community: c, live, upcoming, replays, motions: { listed, proposed } };
});
