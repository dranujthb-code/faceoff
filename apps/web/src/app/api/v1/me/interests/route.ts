import { z } from "zod";
import { handler } from "@/lib/server/api";
import { setInterests } from "@/lib/server/domain/profiles";

export const PUT = handler({ auth: "required", requireOnboarded: true, body: z.object({ topicIds: z.array(z.string().uuid()).min(1, "Pick at least one topic").max(12) }) }, async ({ viewer, body }) => {
  await setInterests(viewer.userId, body.topicIds);
  return { updated: true };
});
