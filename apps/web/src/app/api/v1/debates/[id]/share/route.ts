import { z } from "zod";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { track } from "@/lib/server/analytics";

/** Records a share action (channel only — no destination details). */
export const POST = handler({ auth: "optional", requireActive: false, body: z.object({ channel: z.enum(["copy", "native", "x", "whatsapp", "facebook", "linkedin"]), replay: z.boolean().default(false) }) }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  await track(body.replay ? "replay_viewed" : "share_clicked", viewer?.userId ?? null, { channel: body.channel }, { sessionId: params.id });
  if (body.replay) return { ok: true };
  return { ok: true };
});
