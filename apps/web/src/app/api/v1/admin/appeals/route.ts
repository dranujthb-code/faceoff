import { handler } from "@/lib/server/api";
import { listAppeals } from "@/lib/server/domain/moderation";

export const GET = handler({ auth: "staff" }, async ({ viewer }) => listAppeals(viewer.userId));
