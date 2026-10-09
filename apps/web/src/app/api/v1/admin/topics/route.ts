import { z } from "zod";
import { handler } from "@/lib/server/api";
import { adminTopicsAndCommunities, upsertTopic } from "@/lib/server/domain/admin";

const schema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/, "Use lowercase letters, numbers and dashes"),
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});
export const GET = handler({ auth: "staff" }, async () => adminTopicsAndCommunities());
export const POST = handler({ auth: "admin", body: schema }, async ({ viewer, body }) => ({ id: await upsertTopic(viewer, body) }));
