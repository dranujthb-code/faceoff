"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Mic, MicOff, Video, VideoOff, WifiOff } from "lucide-react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type Participant,
} from "livekit-client";
import type { SessionState } from "@faceoff/shared";
import { api, ClientApiError } from "@/lib/client/api";
import { Avatar } from "../Avatar";

type Debater = SessionState["participants"][number];

interface Props {
  sessionId: string;
  debaters: Debater[];
  role: "debater" | "audience" | "anonymous";
  /** connect only when true (debater: ready & room open; audience: live) */
  shouldConnect: boolean;
  videoConfigured: boolean;
  viewerKey: string;
  onRealtime: (topic: string) => void;
}

function useAttach(track: Track | undefined, kind: "video" | "audio") {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track, kind]);
  return ref;
}

function Tile({ debater, participant, local, connected }: { debater: Debater; participant: Participant | undefined; local: boolean; connected: boolean }) {
  const cam = participant?.getTrackPublication(Track.Source.Camera);
  const mic = participant?.getTrackPublication(Track.Source.Microphone);
  const videoTrack = cam && !cam.isMuted ? cam.track : undefined;
  const audioTrack = !local && mic && !mic.isMuted ? mic.track : undefined;
  const vref = useAttach(videoTrack, "video");
  const aref = useAttach(audioTrack, "audio");
  const speaking = participant?.isSpeaking;
  const side = debater.side;
  return (
    <figure
      className={clsx(
        "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-sunken ring-2 transition-shadow sm:aspect-video",
        speaking ? (side === "for" ? "ring-for" : "ring-against") : "ring-transparent",
      )}
    >
      {videoTrack ? (
        <video ref={vref} autoPlay playsInline muted={local} className={clsx("h-full w-full object-cover", local && "-scale-x-100")} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <Avatar profile={debater.profile} size="xl" side={side} />
          <p className="text-sm text-muted">
            {!connected ? "Not connected" : participant ? (cam ? "Camera off" : "Starting camera") : debater.present ? "Connecting…" : "Not in the room"}
          </p>
        </div>
      )}
      {audioTrack && <audio ref={aref} autoPlay />}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-white">
        <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-bold", side === "for" ? "bg-[#6498AD] text-[#0B1419]" : "bg-[#B8352F] text-white")}>{side === "for" ? "For" : "Against"}</span>
        <span className="truncate text-sm font-semibold">{debater.profile.displayName}{local ? " (you)" : ""}</span>
        {participant && mic?.isMuted && <MicOff className="ml-auto h-4 w-4" aria-label="Muted" />}
      </figcaption>
    </figure>
  );
}

export function VideoStage({ sessionId, debaters, role, shouldConnect, videoConfigured, viewerKey, onRealtime }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [, bump] = useState(0);
  const [conn, setConn] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const realtime = useRef(onRealtime);
  useEffect(() => {
    realtime.current = onRealtime;
  });

  useEffect(() => {
    if (!videoConfigured || !shouldConnect) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    const rerender = () => bump((x) => x + 1);
    room
      .on(RoomEvent.ConnectionStateChanged, (s) => { setConn(s); rerender(); })
      .on(RoomEvent.TrackSubscribed, rerender)
      .on(RoomEvent.TrackUnsubscribed, rerender)
      .on(RoomEvent.TrackMuted, rerender)
      .on(RoomEvent.TrackUnmuted, rerender)
      .on(RoomEvent.LocalTrackPublished, rerender)
      .on(RoomEvent.LocalTrackUnpublished, rerender)
      .on(RoomEvent.ParticipantConnected, rerender)
      .on(RoomEvent.ParticipantDisconnected, rerender)
      .on(RoomEvent.ActiveSpeakersChanged, rerender)
      .on(RoomEvent.DataReceived, (_p, _participant, _k, topic) => realtime.current(topic ?? "update"))
      .on(RoomEvent.Disconnected, () => { setConn(ConnectionState.Disconnected); rerender(); });

    (async () => {
      try {
        const t = await api<{ token: string; url: string; role: "debater" | "audience" }>(`/debates/${sessionId}/video-token`, { body: role === "anonymous" ? { viewerKey } : {} });
        if (cancelled) return;
        await room.connect(t.url, t.token, { autoSubscribe: true });
        if (cancelled) return;
        setRoom(room);
        if (t.role === "debater") {
          try {
            await room.localParticipant.enableCameraAndMicrophone();
          } catch (e) {
            const name = (e as Error).name;
            setMediaError(
              name === "NotAllowedError"
                ? "Camera and microphone access was blocked. Allow access in your browser's site settings, then reload."
                : name === "NotFoundError"
                  ? "No camera or microphone was found."
                  : "Couldn't start your camera or microphone.",
            );
          }
        }
        rerender();
      } catch (e) {
        if (!cancelled) setError(e instanceof ClientApiError ? e.message : "Couldn't connect to the live video service.");
      }
    })();
    return () => {
      cancelled = true;
      room.disconnect();
      setRoom(null);
    };
  }, [sessionId, role, shouldConnect, videoConfigured, viewerKey]);

  const findParticipant = (userId: string): Participant | undefined => {
    if (!room) return undefined;
    const id = `debater:${userId}`;
    if (room.localParticipant.identity === id) return room.localParticipant;
    return [...room.remoteParticipants.values()].find((p) => p.identity === id);
  };
  const local: LocalParticipant | undefined = room?.localParticipant;
  const amDebater = role === "debater";
  const connected = conn === ConnectionState.Connected;
  const ordered = [...debaters].sort((a, b) => (a.side === b.side ? 0 : a.side === "for" ? -1 : 1));

  return (
    <div>
      {!videoConfigured && (
        <p className="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-ink">
          Live video isn&apos;t configured on this server yet. The debate clock, chat and voting work; cameras will appear once a LiveKit project is connected.
        </p>
      )}
      {error && <p role="alert" className="mb-3 rounded-xl bg-against-soft px-4 py-2.5 text-sm text-danger">{error}</p>}
      {mediaError && <p role="alert" className="mb-3 rounded-xl bg-against-soft px-4 py-2.5 text-sm text-danger">{mediaError}</p>}
      {(conn === ConnectionState.Reconnecting || conn === ConnectionState.SignalReconnecting) && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-warning/15 px-4 py-2.5 text-sm"><WifiOff className="h-4 w-4" /> Connection lost — reconnecting…</p>
      )}
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {ordered.map((d, i) => (
          <div key={d.userId} style={{ order: i * 2 }}>
            <Tile debater={d} participant={findParticipant(d.userId)} local={local?.identity === `debater:${d.userId}`} connected={connected} />
          </div>
        ))}
        <span className="fo-divider order-1 mx-auto hidden h-auto sm:block" aria-hidden />
      </div>
      {amDebater && videoConfigured && shouldConnect && (
        <div className="mt-4 flex items-center justify-center gap-3" role="toolbar" aria-label="Your camera and microphone">
          <button
            className={clsx("flex h-12 w-12 items-center justify-center rounded-full border", micOn ? "border-line-strong bg-raised" : "border-danger bg-danger text-white")}
            aria-pressed={!micOn}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            onClick={async () => { await local?.setMicrophoneEnabled(!micOn).catch(() => {}); setMicOn(!micOn); }}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            className={clsx("flex h-12 w-12 items-center justify-center rounded-full border", camOn ? "border-line-strong bg-raised" : "border-danger bg-danger text-white")}
            aria-pressed={!camOn}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
            onClick={async () => { await local?.setCameraEnabled(!camOn).catch(() => {}); setCamOn(!camOn); }}
          >
            {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
          <span className="text-xs text-muted">{connected ? "Connected" : conn === ConnectionState.Connecting ? "Connecting…" : "Not connected"}</span>
        </div>
      )}
    </div>
  );
}
