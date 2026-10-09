/**
 * Live video for the mobile debate room (LiveKit). Loaded only when the native WebRTC module
 * is present (a development or store build), never in Expo Go.
 */
import { useEffect } from "react";
import { View } from "react-native";
import { AudioSession, LiveKitRoom, VideoTrack, isTrackReference, useConnectionState, useLocalParticipant, useTracks } from "@livekit/react-native";
import { ConnectionState, Track } from "livekit-client";
import type { SessionState } from "@faceoff/shared";
import { Avatar, Button, T, styles } from "../components/ui";
import { radii, stageTheme as t } from "../theme";

function Tiles({ participants }: { participants: SessionState["participants"] }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const state = useConnectionState();
  const ordered = [...participants].sort((a, b) => (a.side === b.side ? 0 : a.side === "for" ? -1 : 1));
  return (
    <View style={{ gap: 10 }}>
      {state === ConnectionState.Reconnecting ? <T color={t.warning}>Connection lost — reconnecting…</T> : null}
      {ordered.map((p) => {
        const ref = tracks.find((tr) => tr.participant.identity === `debater:${p.userId}`);
        return (
          <View key={p.userId} style={{ aspectRatio: 4 / 3, borderRadius: radii.lg, overflow: "hidden", backgroundColor: t.surfaceSunken, borderWidth: 2, borderColor: p.side === "for" ? t.sideFor : t.sideAgainst }}>
            {ref && isTrackReference(ref) && !ref.publication.isMuted ? (
              <VideoTrack trackRef={ref} style={{ flex: 1 }} objectFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Avatar profile={p.profile} size="lg" side={p.side} />
                <T variant="small" color={t.textMuted}>{ref ? "Camera off" : "Not in the room"}</T>
              </View>
            )}
            <View style={{ position: "absolute", left: 10, bottom: 10, flexDirection: "row", gap: 6, alignItems: "center" }}>
              <View style={{ backgroundColor: p.side === "for" ? "#6498AD" : "#B8352F", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <T variant="small" color={p.side === "for" ? "#0B1419" : "#FFFFFF"}>{p.side === "for" ? "For" : "Against"}</T>
              </View>
              <T variant="label" color="#FFFFFF">{p.profile.displayName}</T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Controls() {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  return (
    <View style={[styles.row, { justifyContent: "center" }]}>
      <Button small variant={isMicrophoneEnabled ? "secondary" : "danger"} title={isMicrophoneEnabled ? "Mute" : "Unmute"} onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)} />
      <Button small variant={isCameraEnabled ? "secondary" : "danger"} title={isCameraEnabled ? "Camera off" : "Camera on"} onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)} />
    </View>
  );
}

export default function MobileStage({ url, token, isDebater, participants }: { url: string; token: string; isDebater: boolean; participants: SessionState["participants"] }) {
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);
  return (
    <LiveKitRoom serverUrl={url} token={token} connect audio={isDebater} video={isDebater} options={{ adaptiveStream: { pixelDensity: "screen" } }}>
      <Tiles participants={participants} />
      {isDebater ? <View style={{ marginTop: 10 }}><Controls /></View> : null}
    </LiveKitRoom>
  );
}
