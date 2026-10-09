import { NextResponse } from "next/server";
import { sql } from "@/lib/server/db";
import { features } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql`select 1`;
    return NextResponse.json({ ok: true, data: { db: "up", video: features.video, recording: features.recording, email: features.email } });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "db_down", message: "Database unavailable" } }, { status: 503 });
  }
}
