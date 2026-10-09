import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { getDebateCard } from "@/lib/server/domain/debates";

export const GET = handler({ auth: "optional" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  const d = await getDebateCard(params.id, viewer?.userId ?? null);
  if (!d) throw notFound("Debate not found");
  return d;
});
