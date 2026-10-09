"use client";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import type { SessionState } from "@faceoff/shared";
import { api } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/useSubmit";
import { Button, Checkbox, ErrorNote } from "../ui";

const RULES = [
  "Ten minutes, one-on-one, unscripted. The clock is kept by the server and can't be paused.",
  "Argue the idea, not the person. No threats, harassment or hate against protected groups.",
  "Don't share anyone's private information, and don't impersonate anyone.",
  "The debate is public. The audience can comment and vote, and anyone can report a violation.",
];

export function GreenRoom({ state, onReady, videoConfigured }: { state: SessionState; onReady: () => void; videoConfigured: boolean }) {
  const [rules, setRules] = useState(false);
  const [recording, setRecording] = useState(true);
  const [preview, setPreview] = useState<"idle" | "on" | "blocked" | "none">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { busy, error, run } = useSubmit();
  const s = state.session;
  const opponent = state.participants.find((p) => p.side !== state.viewer.side);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const testDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPreview("on");
    } catch (e) {
      setPreview((e as Error).name === "NotAllowedError" ? "blocked" : "none");
    }
  };

  const ready = () =>
    run(async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      await api(`/debates/${s.id}/ready`, { body: { acceptRules: true, acceptRecording: s.recordingEnabled ? recording : false } });
      onReady();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-serif text-2xl font-semibold">Green room</h2>
        <p className="mt-1 text-sm text-muted">
          You argue <strong className={state.viewer.side === "for" ? "text-for" : "text-against"}>{state.viewer.side}</strong>.{" "}
          {opponent?.readyAt ? `${opponent.profile.displayName} is ready.` : `Waiting for ${opponent?.profile.displayName ?? "your opponent"} to get ready.`}
          {" "}The clock starts the moment you&apos;re both ready.
        </p>
        <ul className="mt-5 space-y-2.5 text-sm">
          {RULES.map((r) => <li key={r} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden />{r}</li>)}
        </ul>
        {s.recordingEnabled && (
          <div className="mt-5 rounded-xl bg-sunken p-4 text-sm">
            <p className="font-semibold">This debate is set to be recorded</p>
            <p className="mt-1 text-muted">Audio and video are recorded and the replay is published with the debate. Recording happens only if both debaters agree. If you say no, nothing is recorded.</p>
            <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Recording consent">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" role="radio" aria-checked={recording === v} onClick={() => setRecording(v)}
                  className={clsx("rounded-full border px-4 py-1.5 text-sm font-medium", recording === v ? "border-ink bg-ink text-bg" : "border-line-strong")}>
                  {v ? "I agree to be recorded" : "Don't record"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5">
          <Checkbox checked={rules} onChange={setRules} label="I agree to the debate rules and the Community Guidelines" />
        </div>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <Button className="mt-5 w-full" size="lg" disabled={!rules} loading={busy} onClick={ready}>I&apos;m ready</Button>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="font-semibold">Check your camera and microphone</h3>
        <div className="mt-3 aspect-video overflow-hidden rounded-xl bg-sunken">
          <video ref={videoRef} autoPlay playsInline muted className={clsx("h-full w-full -scale-x-100 object-cover", preview !== "on" && "hidden")} />
          {preview !== "on" && (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
              {preview === "blocked" ? "Camera access is blocked. Allow it in your browser's site settings, then try again." : preview === "none" ? "No camera or microphone found." : "Preview your camera before you go live."}
            </div>
          )}
        </div>
        <Button variant="secondary" className="mt-3" onClick={testDevices} disabled={preview === "on"}>{preview === "on" ? "Camera is working" : "Test camera and mic"}</Button>
        {!videoConfigured && <p className="mt-3 text-xs text-muted">Note: live video isn&apos;t configured on this server, so your camera won&apos;t be broadcast.</p>}
      </div>
    </div>
  );
}
