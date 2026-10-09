import { handler } from "@/lib/server/api";
import { listBlocked } from "@/lib/server/domain/profiles";

export const GET = handler({ auth: "required" }, async ({ viewer }) => listBlocked(viewer.userId));
