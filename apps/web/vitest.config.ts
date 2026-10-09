import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    conditions: ["react-server"],
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts", "tests/api/**/*.test.ts"],
    globalSetup: ["tests/db/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
