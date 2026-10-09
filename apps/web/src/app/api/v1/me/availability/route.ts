import { z } from "zod";
import { handler } from "@/lib/server/api";
import { setAvailability } from "@/lib/server/domain/profiles";

export const POST = handler({ auth: "required", requireOnboarded: true, body: z.object({ minutes: z.number().int().min(0).max(180) }) }, async ({ viewer, body }) =>
  setAvailability(viewer.userId, body.minutes),
);
