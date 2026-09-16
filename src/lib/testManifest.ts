// Single source of truth for the Test Suite dashboard's category list
// (src/app/(app)/test-suite). Three execution modes:
//
// - "custom": admin-managed TestCase rows (Prisma), declarative only (no
//   arbitrary code/SQL — see the TestCase model comment in schema.prisma
//   for why), run live from the dashboard via Server Actions.
// - "code": real automated tests living in the repo (Vitest today, adding
//   Playwright in a later phase), run in CI. The dashboard shows the
//   latest result from CiSuiteSnapshot (written by the CI webhook), not a
//   live execution — nothing runs inside the deployed app's own process
//   for these.
// - "manual": deliberately NOT runnable from the live app at all. Load,
//   stress, and performance tests intentionally throw real traffic at the
//   app — running them from the production admin UI risks degrading the
//   app for real tenants (a self-inflicted denial of service). These stay
//   CLI-only scripts, run by a human against a non-production target.
export type TestCategoryMode = "custom" | "code" | "manual";

export interface TestCategoryMeta {
  key: string;
  label: string;
  description: string;
  mode: TestCategoryMode;
}

export const TEST_CATEGORIES: TestCategoryMeta[] = [
  {
    key: "unit",
    label: "Unit",
    description: "Pure functions and business logic in src/lib — no DB, no network.",
    mode: "code",
  },
  {
    key: "integration",
    label: "Integration",
    description: "Zod validation schemas and multi-module logic, exercised end to end within a module.",
    mode: "code",
  },
  {
    key: "module",
    label: "Module",
    description: "Cross-cutting checks across everything a single module (e.g. recruitment.ts) exports.",
    mode: "code",
  },
  {
    key: "negative",
    label: "Negative",
    description: "Inputs that must be rejected — missing required fields, invalid enums, malformed values.",
    mode: "code",
  },
  {
    key: "range",
    label: "Range",
    description: "Boundary values for numeric/length-limited fields — just inside, just outside, and at the edge.",
    mode: "code",
  },
  {
    key: "security",
    label: "Security",
    description: "Sanitization, authorization, and data-visibility scoping — the highest-stakes category.",
    mode: "code",
  },
  {
    key: "interoperability",
    label: "Interoperability",
    description: "Contracts between two modules that must stay in sync (e.g. every region has a currency default).",
    mode: "code",
  },
  {
    key: "acceptance",
    label: "Acceptance / E2E",
    description: "Full user flows in a real browser. Planned for a later phase (Playwright) — not built yet.",
    mode: "code",
  },
  {
    key: "api",
    label: "API",
    description: "Admin-defined HTTP checks against this app's own GET API routes (read-only, same-origin only).",
    mode: "custom",
  },
  {
    key: "sanity",
    label: "Sanity",
    description: "Admin-defined read-only checks that key data looks healthy (e.g. row counts within an expected range).",
    mode: "custom",
  },
  {
    key: "performance",
    label: "Performance",
    description: "Response-time budgets under light load. CLI-only — see scripts/loadtest/README.md.",
    mode: "manual",
  },
  {
    key: "load",
    label: "Load",
    description: "Sustained expected-traffic simulation. CLI-only, staging/local target only — never production.",
    mode: "manual",
  },
  {
    key: "stress",
    label: "Stress",
    description: "Beyond-capacity traffic to find the breaking point. CLI-only, staging/local target only — never production.",
    mode: "manual",
  },
];

export function categoryMeta(key: string): TestCategoryMeta | undefined {
  return TEST_CATEGORIES.find((c) => c.key === key);
}

// Categories an admin can actually create custom TestCase rows under.
export const CUSTOM_TEST_KINDS = ["api", "sanity"] as const;
export type CustomTestKind = (typeof CUSTOM_TEST_KINDS)[number];
