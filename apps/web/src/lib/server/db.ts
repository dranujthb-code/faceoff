import "server-only";
import postgres, { type Sql, type TransactionSql } from "postgres";
import { env } from "./env";

/**
 * Database access with per-request authorization context.
 *
 *  - asUser(uid, fn)  runs fn in a transaction as role `authenticated` (or `anon` when uid is null)
 *                     with app.user_id set — Row Level Security applies to every query.
 *  - asService(fn)    runs fn as `service_role` (bypasses RLS). Use ONLY after explicit
 *                     authorization checks in code, for workflows that span several users' rows.
 *
 * Both use SET LOCAL, so context can never leak across pooled connections.
 */

declare global {
  var __faceoffSql: Sql | undefined;
}

function create(): Sql {
  return postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
    // Supabase/PgBouncer transaction pooling does not support prepared statements.
    prepare: false,
    onnotice: () => {},
    transform: { undefined: null },
    connection: { application_name: "faceoff-api" },
  });
}

export const sql: Sql = globalThis.__faceoffSql ?? create();
if (env.APP_ENV !== "production") globalThis.__faceoffSql = sql;

export type Tx = TransactionSql;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function asUser<T>(userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (userId !== null && !UUID_RE.test(userId)) throw new Error("invalid user id for db context");
  return sql.begin(async (tx) => {
    await tx.unsafe(userId ? "set local role authenticated" : "set local role anon");
    await tx`select set_config('app.user_id', ${userId ?? ""}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

export async function asService<T>(fn: (tx: Tx) => Promise<T>, actingUserId?: string | null): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe("set local role service_role");
    await tx`select set_config('app.user_id', ${actingUserId ?? ""}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
