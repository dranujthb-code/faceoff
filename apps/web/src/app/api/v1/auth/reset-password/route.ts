import { resetPasswordSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { resetPassword } from "@/lib/server/domain/accounts";

export const POST = handler({ auth: "none", body: resetPasswordSchema }, async ({ body }) => {
  await resetPassword(body.token, body.password);
  return { reset: true };
});
