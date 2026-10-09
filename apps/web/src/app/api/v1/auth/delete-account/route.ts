import { z } from "zod";
import { handler } from "@/lib/server/api";
import { deleteAccount } from "@/lib/server/domain/accounts";
import { clearSessionCookie } from "@/lib/server/auth";

export const POST = handler({ auth: "required", requireActive: false, body: z.object({ password: z.string().min(1).max(128), confirm: z.literal("DELETE") }) }, async ({ viewer, body }) => {
  await deleteAccount(viewer.userId, body.password);
  await clearSessionCookie();
  return { deleted: true };
});
