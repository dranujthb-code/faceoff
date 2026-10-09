"use client";
import { useRouter } from "next/navigation";
import { MotionComposer } from "@/components/MotionComposer";

export function NewMotion({ username }: { username: string }) {
  const router = useRouter();
  return <MotionComposer onDone={() => router.push(`/u/${username}`)} />;
}
