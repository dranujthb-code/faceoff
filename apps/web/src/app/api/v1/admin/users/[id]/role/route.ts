import { z } from "zod";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { setRole } from "@/lib/server/domain/admin";

export const POST = handler({ auth: "admin", body: z.object({ role: z.enum(["user", "moderator", "admin"]) }) }, async ({ viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  await setRole(viewer, params.id, body.role);
  return { role: body.role };
});
