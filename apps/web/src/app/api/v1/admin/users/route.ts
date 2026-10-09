import { handler } from "@/lib/server/api";
import { searchUsers } from "@/lib/server/domain/admin";

export const GET = handler({ auth: "staff" }, async ({ viewer, query }) => searchUsers(viewer.userId, query.get("q") ?? ""));
