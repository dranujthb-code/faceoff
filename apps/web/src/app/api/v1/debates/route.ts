import { handler } from "@/lib/server/api";
import { isUuid } from "@/lib/server/db";
import { listDebates, type DebateFilter } from "@/lib/server/domain/debates";

const FILTERS: DebateFilter[] = ["live", "upcoming", "replays", "recent", "all"];

export const GET = handler({ auth: "optional" }, async ({ viewer, query }) => {
  const f = query.get("filter") as DebateFilter;
  const community = query.get("community");
  return listDebates(
    {
      filter: FILTERS.includes(f) ? f : "recent",
      communityId: community && isUuid(community) ? community : undefined,
      q: query.get("q") ?? undefined,
      limit: Number(query.get("limit") ?? 24) || 24,
    },
    viewer?.userId ?? null,
  );
});
