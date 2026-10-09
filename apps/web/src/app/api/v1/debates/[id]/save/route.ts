import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { setSaved } from "@/lib/server/domain/audience";

export const POST = handler({ auth: "required" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  await setSaved(viewer, params.id, true);
  return { saved: true };
});
export const DELETE = handler({ auth: "required" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  await setSaved(viewer, params.id, false);
  return { saved: false };
});
