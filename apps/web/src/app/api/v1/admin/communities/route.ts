import { z } from "zod";
import { handler } from "@/lib/server/api";
import { upsertCommunity } from "@/lib/server/domain/admin";

const schema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().regex(/^[a-z0-9-]{2,48}$/, "Use lowercase letters, numbers and dashes"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional(),
  topicId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().max(24)).max(8).optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(["active", "archived"]).optional(),
});
export const POST = handler({ auth: "admin", body: schema }, async ({ viewer, body }) => ({ id: await upsertCommunity(viewer, body) }));
