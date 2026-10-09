"use client";
import { useRouter } from "next/navigation";
import type { ProfileSummary } from "@faceoff/shared";
import { ChallengeComposer, type ComposerMotion } from "@/components/ChallengeComposer";

export function NewChallenge({ recipient, motion, availableNow }: { recipient: ProfileSummary; motion: ComposerMotion | null; availableNow: boolean }) {
  const router = useRouter();
  return <ChallengeComposer recipient={recipient} motion={motion} availableNow={availableNow} onSent={(id) => router.push(`/activity?tab=challenges&sent=${id}`)} />;
}
