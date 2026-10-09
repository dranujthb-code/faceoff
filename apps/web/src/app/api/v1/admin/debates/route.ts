import { handler } from "@/lib/server/api";
import { adminDebates } from "@/lib/server/domain/admin";

export const GET = handler({ auth: "staff" }, async ({ viewer, query }) => adminDebates(viewer.userId, query.get("status")));
