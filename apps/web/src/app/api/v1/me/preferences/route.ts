import { preferencesSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { getPreferences, updatePreferences } from "@/lib/server/domain/profiles";

export const GET = handler({ auth: "required" }, async ({ viewer }) => getPreferences(viewer.userId));
export const PATCH = handler({ auth: "required", requireActive: false, body: preferencesSchema }, async ({ viewer, body }) => {
  await updatePreferences(viewer.userId, body);
  return getPreferences(viewer.userId);
});
