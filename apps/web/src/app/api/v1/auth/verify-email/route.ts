import { verifyEmailSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { verifyEmail } from "@/lib/server/domain/accounts";

export const POST = handler({ auth: "none", body: verifyEmailSchema }, async ({ body }) => {
  await verifyEmail(body.token);
  return { verified: true };
});
