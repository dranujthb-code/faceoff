/**
 * Minimal, dependency-free migration runner.
 *   pnpm db:migrate            apply pending migrations from /db/migrations
 *   pnpm db:migrate --reset    drop FaceOff schemas and re-apply (refused in production)
 */
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"), quiet: true });
config({ quiet: true });

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, "../../../db/migrations");

async function ensureDatabase(adminUrl: string) {
  const url = new URL(adminUrl);
  const dbName = url.pathname.slice(1);
  url.pathname = "/postgres";
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql`select 1 as x from pg_database where datname = ${dbName}`;
    if (!row) {
      await sql.unsafe(`create database "${dbName.replace(/"/g, "")}"`);
      console.log(`created database ${dbName}`);
    }
  } catch (e) {
    console.warn(`could not verify/create database (${(e as Error).message}); continuing`);
  } finally {
    await sql.end();
  }
}

async function main() {
  const adminUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) throw new Error("DATABASE_ADMIN_URL is not set");
  const reset = process.argv.includes("--reset");
  if (reset && process.env.APP_ENV === "production") throw new Error("Refusing to reset a production database");

  await ensureDatabase(adminUrl);
  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    if (reset) {
      await sql.unsafe(`drop schema if exists faceoff cascade; drop schema if exists app cascade; drop table if exists public.schema_migrations;`);
      console.log("reset: dropped faceoff & app schemas");
    }
    await sql`create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())`;
    const applied = new Set((await sql<{ version: string }[]>`select version from public.schema_migrations`).map((r) => r.version));
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into public.schema_migrations (version) values (${file})`;
      });
      console.log(`applied ${file}`);
      count++;
    }
    if (process.env.DB_CREATE_APP_ROLE === "true" && process.env.DATABASE_URL) {
      const app = new URL(process.env.DATABASE_URL);
      const user = decodeURIComponent(app.username);
      const pass = decodeURIComponent(app.password);
      if (!/^[a-z_][a-z0-9_]*$/.test(user)) throw new Error("unsafe role name");
      const [exists] = await sql`select 1 as x from pg_roles where rolname = ${user}`;
      if (!exists) {
        await sql.unsafe(`create role ${user} login noinherit password '${pass.replace(/'/g, "''")}'`);
        console.log(`created login role ${user}`);
      }
      await sql.unsafe(`grant anon, authenticated, service_role to ${user}`);
      await sql.unsafe(`grant connect on database "${new URL(adminUrl).pathname.slice(1)}" to ${user}`);
    }
    console.log(count === 0 ? "database is up to date" : `${count} migration(s) applied`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
