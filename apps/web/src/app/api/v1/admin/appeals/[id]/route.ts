import { z } from "zod";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { decideAppeal } from "@/lib/server/domain/moderation";

export const POST = handler({ auth: "staff", body: z.object({ decision: z.enum(["upheld", "overturned"]), note: z.string().trim().min(3).max(500) }) }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  await decideAppeal(viewer, params.id, body.decision, body.note);
  return { decided: body.decision };
});
