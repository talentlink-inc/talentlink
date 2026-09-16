import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Unit + integration tests only (pure lib functions, zod schemas, mocked
// server actions). Acceptance/E2E tests live separately under Playwright
// (see playwright.config.ts, added in Phase 2) — kept out of this glob so
// `npx vitest run` never tries to boot a browser.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: process.env.CI ? { json: "vitest-report.json" } : undefined,
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
