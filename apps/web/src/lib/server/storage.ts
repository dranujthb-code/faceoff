import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { AwsClient } from "aws4fetch";
import { env } from "./env";

const LOCAL_ROOT = join(process.cwd(), ".data", "uploads");
const KEY_RE = /^[a-z0-9/_-]+\.(webp|jpg|png|mp4)$/;

function s3() {
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3 storage is not configured");
  }
  return new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION,
    service: "s3",
  });
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (!KEY_RE.test(key)) throw new Error("invalid storage key");
  if (env.STORAGE_DRIVER === "s3") {
    const url = `${env.S3_ENDPOINT!.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`;
    const res = await s3().fetch(url, {
      method: "PUT",
      body: new Uint8Array(body),
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) throw new Error(`S3 upload failed: HTTP ${res.status}`);
    return;
  }
  const path = normalize(join(LOCAL_ROOT, key));
  if (!path.startsWith(LOCAL_ROOT)) throw new Error("invalid storage key");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  if (!KEY_RE.test(key)) return null;
  const path = normalize(join(LOCAL_ROOT, key));
  if (!path.startsWith(LOCAL_ROOT)) return null;
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

/** Public URL for a stored object (avatars are public; replays use their own access checks). */
export function publicUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http://") || key.startsWith("https://")) return key; // demo seeds may use external art
  if (key.startsWith("/")) return key;
  if (env.STORAGE_DRIVER === "s3" && env.S3_PUBLIC_BASE_URL) return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  return `/media/${key}`;
}
