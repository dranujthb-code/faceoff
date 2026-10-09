import { z } from "zod";
import { handler } from "@/lib/server/api";
import { applyModeration } from "@/lib/server/domain/moderation";

const schema = z.object({
  action: z.enum(["warn", "hide_comment", "restore_comment", "hide_session", "restore_session", "hide_motion", "restore_motion", "terminate_session", "suspend_user", "unsuspend_user", "ban_user", "dismiss_report"]),
  targetType: z.enum(["user", "session", "comment", "motion", "report"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3, "Give a reason").max(500),
  reportId: z.string().uuid().optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
});

export const POST = handler({ auth: "staff", body: schema }, async ({ viewer, body }) => applyModeration(viewer, body));
