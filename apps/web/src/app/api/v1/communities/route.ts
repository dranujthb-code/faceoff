import { handler } from "@/lib/server/api";
import { listCommunities } from "@/lib/server/domain/communities";

export const GET = handler({ auth: "optional" }, async ({ viewer, query }) =>
  listCommunities(viewer?.userId ?? null, {
    topicSlug: query.get("topic") ?? undefined,
    q: query.get("q") ?? undefined,
    mine: query.get("mine") === "1",
    featured: query.get("featured") === "1",
  }),
);
