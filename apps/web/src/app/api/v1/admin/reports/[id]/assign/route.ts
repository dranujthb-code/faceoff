import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { assignReport } from "@/lib/server/domain/moderation";

export const POST = handler({ auth: "staff" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  await assignReport(viewer, params.id);
  return { assigned: true };
});
