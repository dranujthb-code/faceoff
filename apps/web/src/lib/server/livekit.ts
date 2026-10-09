import "server-only";
import {
  AccessToken,
  DataPacket_Kind,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  WebhookReceiver,
} from "livekit-server-sdk";
import { env, features } from "./env";

/**
 * LiveKit integration boundary. Every function is a no-op (or returns null) when LiveKit is not
 * configured, and callers surface "video not configured" honestly instead of simulating video.
 */

function httpHost(): string {
  return env.LIVEKIT_URL!.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

let rooms: RoomServiceClient | null = null;
function roomClient(): RoomServiceClient | null {
  if (!features.video) return null;
  rooms ??= new RoomServiceClient(httpHost(), env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
  return rooms;
}

export function videoConfig() {
  return { configured: features.video, url: features.video ? env.LIVEKIT_URL! : null };
}

export async function ensureRoom(roomName: string, maxParticipants = 500): Promise<void> {
  const c = roomClient();
  if (!c) return;
  await c.createRoom({ name: roomName, emptyTimeout: 5 * 60, departureTimeout: 120, maxParticipants });
}

export async function closeRoom(roomName: string): Promise<void> {
  const c = roomClient();
  if (!c) return;
  try {
    await c.deleteRoom(roomName); // disconnects everyone — the server, not the client, ends the debate
  } catch (e) {
    console.warn("livekit deleteRoom failed", roomName, (e as Error).message);
  }
}

export async function mintToken(opts: {
  roomName: string;
  identity: string;
  name: string;
  role: "debater" | "audience";
  ttlSeconds: number;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  if (!features.video) return null;
  const at = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, {
    identity: opts.identity,
    name: opts.name,
    ttl: Math.max(60, Math.min(opts.ttlSeconds, 4 * 3600)),
    metadata: JSON.stringify({ role: opts.role, ...opts.metadata }),
    attributes: { role: opts.role },
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublish: opts.role === "debater",
    canPublishData: false, // chat, votes and reactions go through the API (persisted + moderated)
    canUpdateOwnMetadata: false,
    hidden: opts.role === "audience",
  });
  return at.toJwt();
}

/** Fan out a small realtime event to everyone in the room (best-effort; clients also poll). */
export async function broadcast(roomName: string, topic: string, payload: unknown): Promise<void> {
  const c = roomClient();
  if (!c) return;
  try {
    await c.sendData(roomName, new TextEncoder().encode(JSON.stringify(payload)), DataPacket_Kind.RELIABLE, { topic });
  } catch {
    // room may not exist yet / already closed; polling covers it
  }
}

export async function presentIdentities(roomName: string): Promise<Set<string> | null> {
  const c = roomClient();
  if (!c) return null;
  try {
    const ps = await c.listParticipants(roomName);
    return new Set(ps.map((p) => p.identity));
  } catch {
    return null;
  }
}

export async function startRecording(roomName: string, sessionId: string): Promise<{ egressId: string; key: string } | null> {
  if (!features.recording) return null;
  const egress = new EgressClient(httpHost(), env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
  const key = `replays/${sessionId}.mp4`;
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: key,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: env.S3_ACCESS_KEY_ID!,
        secret: env.S3_SECRET_ACCESS_KEY!,
        bucket: env.S3_BUCKET!,
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT ?? "",
        forcePathStyle: true,
      }),
    },
  });
  const info = await egress.startRoomCompositeEgress(roomName, output, { layout: "speaker" });
  return { egressId: info.egressId, key };
}

export async function stopRecording(egressId: string): Promise<void> {
  if (!features.recording) return;
  const egress = new EgressClient(httpHost(), env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
  try {
    await egress.stopEgress(egressId);
  } catch (e) {
    console.warn("stopEgress failed", egressId, (e as Error).message);
  }
}

export function webhookReceiver(): WebhookReceiver | null {
  if (!features.video) return null;
  return new WebhookReceiver(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
}
