import { reportSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { fileReport } from "@/lib/server/domain/moderation";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";

// Suspended users can still report (safety reports must never be blocked).
export const POST = handler({ auth: "required", requireActive: false, body: reportSchema }, async ({ viewer, body }) => {
  await enforceRateLimit(RATE_RULES.report, viewer.userId);
  await fileReport(viewer, body);
  return { reported: true, message: "Thanks — our Trust & Safety team will review this." };
});
