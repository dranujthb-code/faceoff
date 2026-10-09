import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError, forbidden, unauthorized } from "./errors";
import { getViewer, isAdmin, isStaff, readSessionToken, type Viewer } from "./auth";
import { env } from "./env";

type AuthMode = "none" | "optional" | "required" | "staff" | "admin";

interface Options<B> {
  auth?: AuthMode;
  body?: ZodType<B>;
  /** default true for required auth: the account must be active (not suspended) to mutate */
  requireActive?: boolean;
  requireVerified?: boolean;
  requireOnboarded?: boolean;
}

export interface HandlerCtx<B, A extends AuthMode> {
  req: NextRequest;
  viewer: A extends "required" | "staff" | "admin" ? Viewer : Viewer | null;
  body: B;
  params: Record<string, string>;
  query: URLSearchParams;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ ok: false, error: { code: e.code, message: e.message, fields: e.fields } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) {
      const k = issue.path.join(".") || "_";
      fields[k] ??= issue.message;
    }
    const first = e.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ ok: false, error: { code: "validation_error", message: first, fields } }, { status: 422 });
  }
  const pg = e as { code?: string; constraint_name?: string; message?: string };
  if (pg?.code === "42501") {
    // insufficient_privilege / RLS rejection — never leak details
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "You don't have permission to do that" } }, { status: 403 });
  }
  if (pg?.code === "23505") {
    return NextResponse.json({ ok: false, error: { code: "conflict", message: "That already exists" } }, { status: 409 });
  }
  console.error("Unhandled API error", e);
  return NextResponse.json({ ok: false, error: { code: "internal", message: "Something went wrong. Please try again." } }, { status: 500 });
}

/**
 * Cookie-authenticated mutations must come from our own origin. Requests carrying a bearer
 * token (mobile) are not subject to CSRF.
 */
async function checkCsrf(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  const t = await readSessionToken();
  if (!t || t.via === "bearer") return;
  const origin = req.headers.get("origin");
  const allowed = new Set([new URL(env.APP_URL).origin, req.nextUrl.origin]);
  if (origin && allowed.has(origin)) return;
  if (!origin && req.headers.get("x-faceoff-client") === "web") return;
  throw forbidden("Cross-site request blocked");
}

export function handler<B = undefined, A extends AuthMode = "optional">(
  opts: Options<B> & { auth?: A },
  fn: (ctx: HandlerCtx<B, A>) => Promise<unknown> | unknown,
) {
  return async (req: NextRequest, route: { params: Promise<Record<string, string>> }) => {
    try {
      const mode: AuthMode = opts.auth ?? "optional";
      await checkCsrf(req);
      const viewer = mode === "none" ? null : await getViewer();
      if ((mode === "required" || mode === "staff" || mode === "admin") && !viewer) throw unauthorized();
      if (mode === "staff" && !isStaff(viewer)) throw forbidden();
      if (mode === "admin" && !isAdmin(viewer)) throw forbidden();
      if (viewer && MUTATING.has(req.method) && (opts.requireActive ?? mode === "required") && viewer.status !== "active") {
        throw new ApiError(403, "account_restricted", "Your account is currently restricted. See Settings for details or to appeal.");
      }
      if (viewer && opts.requireVerified && !viewer.emailVerified) {
        throw new ApiError(403, "email_unverified", "Confirm your email address first — check your inbox for the link.");
      }
      if (viewer && opts.requireOnboarded && !viewer.onboarded) {
        throw new ApiError(403, "onboarding_required", "Finish setting up your profile first.");
      }
      let body = undefined as B;
      if (opts.body) {
        let raw: unknown = {};
        const ct = req.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const text = await req.text();
          if (text.length > 64_000) throw new ApiError(413, "too_large", "Request is too large");
          raw = text ? JSON.parse(text) : {};
        }
        body = opts.body.parse(raw);
      }
      const params = route?.params ? await route.params : {};
      const result = await fn({ req, viewer: viewer as never, body, params, query: req.nextUrl.searchParams });
      if (result instanceof Response) return result;
      return ok(result ?? null);
    } catch (e) {
      if (e instanceof SyntaxError) return errorResponse(new ApiError(400, "bad_json", "Malformed JSON body"));
      return errorResponse(e);
    }
  };
}
