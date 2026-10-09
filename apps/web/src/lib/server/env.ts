import "server-only";
import { z } from "zod";

const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");

const schema = z.object({
  APP_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  AUTH_COOKIE_NAME: z.string().default("fo_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  EMAIL_DRIVER: z.enum(["dev", "resend"]).default("dev"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("FaceOff <hello@example.com>"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_EGRESS_ENABLED: bool,
  CRON_SECRET: z.string().optional(),
});

function load() {
  // On Vercel, default APP_URL to the deployment's own domain when it isn't set explicitly.
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const source = { ...process.env, APP_URL: process.env.APP_URL || (vercelHost ? `https://${vercelHost}` : undefined) };
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${msg}`);
  }
  const e = parsed.data;
  if (e.APP_ENV === "production") {
    if (e.EMAIL_DRIVER === "dev") throw new Error("EMAIL_DRIVER=dev is not allowed in production");
    if (!e.CRON_SECRET || e.CRON_SECRET.startsWith("change-me")) throw new Error("Set a strong CRON_SECRET in production");
    // Serverless file systems are ephemeral: uploads must go to S3-compatible storage.
    if (e.STORAGE_DRIVER !== "s3") throw new Error("STORAGE_DRIVER must be s3 in production");
  }
  return e;
}

export const env = load();

export const features = {
  video: Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET),
  recording: Boolean(
    env.LIVEKIT_EGRESS_ENABLED && env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.S3_BUCKET && env.S3_ACCESS_KEY_ID,
  ),
  email: env.EMAIL_DRIVER === "resend" && Boolean(env.RESEND_API_KEY),
  /** Captured emails: open in development; staff-only on staging; never in production. */
  devMailbox: env.EMAIL_DRIVER === "dev" && env.APP_ENV !== "production",
};
