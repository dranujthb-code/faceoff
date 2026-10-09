import { appealSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { fileAppeal } from "@/lib/server/domain/moderation";

export const POST = handler({ auth: "required", requireActive: false, body: appealSchema }, async ({ viewer, body }) => {
  await fileAppeal(viewer, body.actionId, body.body);
  return { appealed: true };
});
