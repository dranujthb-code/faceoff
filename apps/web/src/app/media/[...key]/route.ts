import { NextResponse, type NextRequest } from "next/server";
import { readLocalObject } from "@/lib/server/storage";
import { env } from "@/lib/server/env";

/** Serves locally stored uploads in development (STORAGE_DRIVER=local). Production uses a CDN/S3 URL. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  if (env.STORAGE_DRIVER !== "local") return new NextResponse("Not found", { status: 404 });
  const { key } = await params;
  const k = key.join("/");
  const buf = await readLocalObject(k);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  const type = k.endsWith(".webp") ? "image/webp" : k.endsWith(".png") ? "image/png" : k.endsWith(".mp4") ? "video/mp4" : "image/jpeg";
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
