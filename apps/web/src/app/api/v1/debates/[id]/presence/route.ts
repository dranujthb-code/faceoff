import { z } from "zod";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { getSessionState, heartbeat } from "@/lib/server/domain/debates";

/** Heartbeat + state in one round trip. Debaters stay "present"; viewers are counted. */
export const POST = handler({ auth: "optional", requireActive: false, body: z.object({ viewerKey: z.string().max(64).optional() }) }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  await heartbeat(params.id, viewer, body.viewerKey ?? null);
  const s = await getSessionState(params.id, viewer);
  if (!s) throw notFound("Debate not found");
  return s;
});
