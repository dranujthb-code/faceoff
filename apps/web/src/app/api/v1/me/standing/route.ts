import { handler } from "@/lib/server/api";
import { myStanding } from "@/lib/server/domain/moderation";

export const GET = handler({ auth: "required" }, async ({ viewer }) => myStanding(viewer.userId));
