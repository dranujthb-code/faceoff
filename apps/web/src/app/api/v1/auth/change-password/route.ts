import { changePasswordSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { changePassword } from "@/lib/server/domain/accounts";

export const POST = handler({ auth: "required", requireActive: false, body: changePasswordSchema }, async ({ viewer, body }) => {
  await changePassword(viewer.userId, viewer.sessionId, body.currentPassword, body.newPassword);
  return { changed: true };
});
