import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { getProfileDetail } from "@/lib/server/domain/profiles";

export const GET = handler({ auth: "optional" }, async ({ viewer, params }) => {
  const p = await getProfileDetail(params.username!.toLowerCase(), viewer?.userId ?? null);
  if (!p) throw notFound("User not found");
  return p;
});
