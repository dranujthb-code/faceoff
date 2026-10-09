import "server-only";
import type { NextRequest } from "next/server";
import { sha256 } from "./crypto";

/** A privacy-preserving key for per-client rate limiting (hashed IP; never stored raw). */
export function clientKey(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return sha256(`rl:${ip}`).slice(0, 24);
}
