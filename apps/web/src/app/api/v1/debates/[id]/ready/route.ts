import { consentSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { isUuid } from "@/lib/server/db";
import { consentAndReady } from "@/lib/server/domain/debates";

export const POST = handler({ auth: "required", requireOnboarded: true, body: consentSchema }, async ({ req, viewer, params, body }) => {
  if (!isUuid(params.id)) throw notFound();
  return consentAndReady(params.id, viewer, body, req.headers.get("user-agent"));
});
