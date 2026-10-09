import { handler } from "@/lib/server/api";
import { supportRequests } from "@/lib/server/domain/admin";

export const GET = handler({ auth: "staff" }, async () => supportRequests());
