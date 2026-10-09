import { handler } from "@/lib/server/api";
import { homeFeed } from "@/lib/server/domain/discover";

export const GET = handler({ auth: "required", requireOnboarded: true }, async ({ viewer }) => homeFeed(viewer.userId));
