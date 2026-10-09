import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { removeOwnComment } from "@/lib/server/domain/audience";

export const DELETE = handler({ auth: "required", requireActive: false }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  await removeOwnComment(viewer, params.id);
  return { removed: true };
});
