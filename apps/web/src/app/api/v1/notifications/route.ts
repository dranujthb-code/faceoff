import { handler } from "@/lib/server/api";
import { listNotifications } from "@/lib/server/domain/notifications";

export const GET = handler({ auth: "required", requireActive: false }, async ({ viewer, query }) =>
  listNotifications(viewer.userId, 30, query.get("before") ?? undefined),
);
