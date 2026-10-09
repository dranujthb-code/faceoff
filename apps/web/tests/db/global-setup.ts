import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Builds a fresh test database from the real migrations before the DB test suite runs. */
export default function setup() {
  const admin = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@127.0.0.1:54322/faceoff_test";
  const app = process.env.TEST_DATABASE_URL ?? "postgres://faceoff_api:faceoff_api_dev_password@127.0.0.1:54322/faceoff_test";
  process.env.TEST_DATABASE_ADMIN_URL = admin;
  process.env.TEST_DATABASE_URL = app;
  execFileSync("npx", ["tsx", "scripts/migrate.ts", "--reset"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    env: { ...process.env, DATABASE_ADMIN_URL: admin, DATABASE_URL: app, DB_CREATE_APP_ROLE: "true", APP_ENV: "test" },
    stdio: "inherit",
  });
}
