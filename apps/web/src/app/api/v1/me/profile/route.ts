import { profileUpdateSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { updateProfile } from "@/lib/server/domain/profiles";

export const PATCH = handler({ auth: "required", requireOnboarded: true, body: profileUpdateSchema }, async ({ viewer, body }) => {
  await updateProfile(viewer.userId, body);
  return { updated: true };
});
