import { z } from "zod";
import { handler } from "@/lib/server/api";
import { markRead } from "@/lib/server/domain/notifications";

export const POST = handler({ auth: "required", requireActive: false, body: z.object({ ids: z.union([z.literal("all"), z.array(z.string().uuid()).max(100)]) }) }, async ({ viewer, body }) => {
  await markRead(viewer.userId, body.ids);
  return { ok: true };
});
