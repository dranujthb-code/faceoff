import { NextResponse, type NextRequest } from "next/server";
import { asService } from "@/lib/server/db";
import { webhookReceiver } from "@/lib/server/livekit";
import { publicUrl } from "@/lib/server/storage";
import { notify } from "@/lib/server/domain/notifications";
import { syncSession } from "@/lib/server/domain/debates";

export const dynamic = "force-dynamic";

/**
 * LiveKit webhooks (signed with the API secret). Used for:
 *  - participant_joined / participant_left → debater presence (complements client heartbeats)
 *  - egress_ended → mark the replay ready only once LiveKit confirms the file was written.
 */
export async function POST(req: NextRequest) {
  const receiver = webhookReceiver();
  if (!receiver) return NextResponse.json({ ok: false }, { status: 404 });
  const body = await req.text();
  let event;
  try {
    event = await receiver.receive(body, req.headers.get("authorization") ?? undefined);
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const room = event.room?.name;
  const identity = event.participant?.identity ?? "";
  if ((event.event === "participant_joined" || event.event === "participant_left") && room && identity.startsWith("debater:")) {
    const userId = identity.slice("debater:".length);
    const sid = await asService(async (tx) => {
      const [s] = await tx`select id from faceoff.debate_sessions where video_room = ${room}`;
      if (!s) return null;
      if (event.event === "participant_joined") {
        await tx`update faceoff.session_participants set last_seen_at = now(), left_at = null where session_id = ${s.id} and user_id = ${userId}`;
      } else {
        await tx`update faceoff.session_participants set left_at = now() where session_id = ${s.id} and user_id = ${userId}`;
      }
      return s.id as string;
    });
    if (sid) await syncSession(sid);
  }
  if (event.event === "egress_ended" && event.egressInfo) {
    const info = event.egressInfo;
    const file = info.fileResults?.[0];
    const ok = info.status === 3 /* EGRESS_COMPLETE */ && !!file;
    await asService(async (tx) => {
      const [r] = await tx`
        update faceoff.recordings set
          status = ${ok ? "ready" : "failed"},
          playback_url = ${ok ? publicUrl(file!.filename) : null},
          duration_seconds = ${ok ? Math.round(Number(file!.duration ?? 0) / 1e9) : null},
          size_bytes = ${ok ? Number(file!.size ?? 0) : null},
          error = ${ok ? null : info.error || "egress failed"},
          ready_at = ${ok ? new Date() : null}
        where provider_ref = ${info.egressId}
        returning session_id`;
      if (r && ok) {
        const ps = await tx<{ user_id: string }[]>`select user_id from faceoff.session_participants where session_id = ${r.session_id}`;
        for (const p of ps) {
          await notify(tx, { userId: p.user_id, kind: "replay_ready", entity: { type: "session", id: r.session_id }, title: "Your replay is ready", body: "The recording of your FaceOff has finished processing.", href: `/d/${r.session_id}`, dedupeKey: `replay:${r.session_id}` });
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
