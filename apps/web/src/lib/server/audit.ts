import "server-only";
import type { Tx } from "./db";

export async function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  target: { type: string; id: string } | null,
  metadata: Record<string, unknown> = {},
) {
  await tx`insert into faceoff.audit_logs (actor_id, action, target_type, target_id, metadata)
           values (${actorId}, ${action}, ${target?.type ?? null}, ${target?.id ?? null}, ${tx.json(metadata as never)})`;
}
