import { handler } from "@/lib/server/api";
import { listTopics } from "@/lib/server/domain/communities";

export const GET = handler({ auth: "none" }, async () => listTopics());
