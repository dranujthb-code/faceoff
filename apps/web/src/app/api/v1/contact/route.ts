import { contactSchema } from "@faceoff/shared";
import { handler } from "@/lib/server/api";
import { asService } from "@/lib/server/db";
import { enforceRateLimit, RATE_RULES } from "@/lib/server/rate-limit";
import { clientKey } from "@/lib/server/request";

export const POST = handler({ auth: "optional", requireActive: false, body: contactSchema }, async ({ req, viewer, body }) => {
  await enforceRateLimit(RATE_RULES.contact, viewer?.userId ?? clientKey(req));
  await asService((tx) => tx`insert into faceoff.support_requests (user_id, name, email, topic, message)
    values (${viewer?.userId ?? null}, ${body.name}, ${body.email}, ${body.topic}, ${body.message})`);
  return { received: true };
});
