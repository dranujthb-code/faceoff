import { handler } from "@/lib/server/api";
import { notFound } from "@/lib/server/errors";
import { asUser, isUuid } from "@/lib/server/db";
import { getProfileDetail } from "@/lib/server/domain/profiles";

/** Profile by user id (used by the mobile challenge composer). */
export const GET = handler({ auth: "optional" }, async ({ viewer, params }) => {
  if (!isUuid(params.id)) throw notFound();
  const [row] = await asUser(viewer?.userId ?? null, (tx) => tx<{ username: string }[]>`select username from faceoff.profiles where user_id = ${params.id}`);
  const p = row ? await getProfileDetail(row.username, viewer?.userId ?? null) : null;
  if (!p) throw notFound("User not found");
  return p;
});
