import { handler } from "@/lib/server/api";
import { searchPeople } from "@/lib/server/domain/profiles";
import { listCommunities } from "@/lib/server/domain/communities";
import { listDebates } from "@/lib/server/domain/debates";

export const GET = handler({ auth: "optional" }, async ({ viewer, query }) => {
  const q = (query.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return { people: [], communities: [], debates: [] };
  const uid = viewer?.userId ?? null;
  const [people, communities, debates] = await Promise.all([
    searchPeople(q, uid, 10),
    listCommunities(uid, { q, limit: 10 }),
    listDebates({ filter: "all", q, limit: 20 }, uid),
  ]);
  return { people, communities, debates };
});
