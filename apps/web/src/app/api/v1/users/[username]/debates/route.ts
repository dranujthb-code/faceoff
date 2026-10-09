import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { getProfileDetail } from "@/lib/server/domain/profiles";
import { listDebates } from "@/lib/server/domain/debates";

export const GET = handler({ auth: "optional" }, async ({ viewer, params }) => {
  const p = await getProfileDetail(params.username!.toLowerCase(), viewer?.userId ?? null);
  if (!p) throw notFound("User not found");
  if (!p.viewer?.canView) return [];
  return listDebates({ filter: "all", userId: p.userId, includeUnlisted: p.viewer.isSelf, limit: 40 }, viewer?.userId ?? null);
});
