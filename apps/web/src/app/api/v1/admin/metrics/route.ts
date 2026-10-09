import { handler } from "@/lib/server/api";
import { metrics } from "@/lib/server/domain/admin";

export const GET = handler({ auth: "staff" }, async ({ viewer, query }) => metrics(viewer.userId, query.get("demo") === "1"));
