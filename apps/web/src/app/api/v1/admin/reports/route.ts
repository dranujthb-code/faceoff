import { handler } from "@/lib/server/api";
import { listReports } from "@/lib/server/domain/moderation";

const S = ["open", "in_review", "actioned", "dismissed", "all"] as const;
export const GET = handler({ auth: "staff" }, async ({ viewer, query }) => {
  const s = query.get("status") as (typeof S)[number];
  return listReports(S.includes(s) ? s : "open", viewer.userId);
});
