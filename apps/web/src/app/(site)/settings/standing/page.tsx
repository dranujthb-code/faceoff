import { requireViewer } from "@/lib/server/page-guards";
import { myStanding } from "@/lib/server/domain/moderation";
import { Standing } from "./Standing";

export const metadata = { title: "Account standing" };
export const dynamic = "force-dynamic";

export default async function StandingPage() {
  const v = await requireViewer("/settings/standing");
  const s = await myStanding(v.userId);
  return (
    <Standing
      status={s.status}
      suspendedUntil={s.suspendedUntil?.toISOString() ?? null}
      actions={s.actions.map((a) => ({ id: a.id, action: a.action, reason: a.reason, createdAt: a.created_at.toISOString(), expiresAt: a.expires_at?.toISOString() ?? null, appealStatus: a.appeal_status, decisionNote: a.decision_note }))}
    />
  );
}
