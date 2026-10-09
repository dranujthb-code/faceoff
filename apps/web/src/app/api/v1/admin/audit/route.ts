import { handler } from "@/lib/server/api";
import { auditLog } from "@/lib/server/domain/admin";

export const GET = handler({ auth: "admin" }, async ({ viewer }) => auditLog(viewer.userId));
