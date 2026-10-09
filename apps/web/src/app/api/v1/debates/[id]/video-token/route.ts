import { z } from "zod";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { videoToken } from "@/lib/server/domain/debates";

export const POST = handler({ auth: "optional", requireActive: false, body: z.object({ viewerKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional() }) }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  return videoToken(params.id, viewer, body.viewerKey ?? null);
});
