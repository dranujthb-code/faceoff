import { handler } from "@/lib/server/api";
import { listFollows } from "@/lib/server/domain/profiles";

export const GET = handler({ auth: "optional" }, async ({ viewer, params }) => listFollows(params.username!.toLowerCase(), "followers", viewer?.userId ?? null));
