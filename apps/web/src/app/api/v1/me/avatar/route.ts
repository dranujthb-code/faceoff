import { handler } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { uploadAvatar } from "@/lib/server/domain/profiles";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

export const POST = handler({ auth: "required", requireOnboarded: true }, async ({ req, viewer }) => {
  await enforceRateLimit(RATE_RULES.upload, viewer.userId);
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > 6 * 1024 * 1024) throw badRequest("Images must be under 5 MB");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Choose an image to upload");
  return uploadAvatar(viewer.userId, file);
});
