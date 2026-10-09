import { z } from "zod";
import { handler } from "@/lib/server/api";
import { skipOpponent } from "@/lib/server/domain/discover";

export const POST = handler({ auth: "required", requireOnboarded: true, body: z.object({ userId: z.string().uuid() }) }, async ({ viewer, body }) => {
  await skipOpponent(viewer.userId, body.userId);
  return { skipped: true };
});
