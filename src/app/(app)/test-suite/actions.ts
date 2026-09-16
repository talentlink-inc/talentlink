"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";
import { prisma } from "@/lib/db";
import { CUSTOM_TEST_KINDS, TEST_CATEGORIES } from "@/lib/testManifest";
import {
  runApiTestCase,
  runSanityTestCase,
  validateApiDefinition,
  validateSanityDefinition,
  type ApiDefinition,
  type SanityDefinition,
  type TestResult,
} from "./runners";

const PERMISSION_ERROR = "Only Admins can manage the Test Suite.";

export type TestCaseState = { error: string | null };

const kindEnum = z.enum(CUSTOM_TEST_KINDS);
const categoryKeys = TEST_CATEGORIES.map((c) => c.key) as [string, ...string[]];

const apiDefinitionSchema = z.object({
  path: z.string().trim().min(1),
  expectedStatus: z.coerce.number().int(),
  bodyContains: z.string().trim().optional(),
});
const sanityDefinitionSchema = z.object({
  model: z.string().trim().min(1),
  filterField: z.string().trim().optional(),
  filterEquals: z.string().trim().optional(),
  min: z.coerce.number().int().nonnegative(),
  max: z.coerce.number().int().nonnegative(),
});

const testCaseInputSchema = z.object({
  category: z.enum(categoryKeys),
  kind: kindEnum,
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(2000).optional(),
  definition: z.union([apiDefinitionSchema, sanityDefinitionSchema]),
});

export type TestCaseInput = z.infer<typeof testCaseInputSchema>;

function validateDefinitionForKind(kind: string, definition: unknown): string | null {
  if (kind === "api") {
    const parsed = apiDefinitionSchema.safeParse(definition);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid API definition.";
    return validateApiDefinition(parsed.data);
  }
  if (kind === "sanity") {
    const parsed = sanityDefinitionSchema.safeParse(definition);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid sanity definition.";
    return validateSanityDefinition(parsed.data);
  }
  return `Unknown test kind "${kind}".`;
}

export async function listTestCases() {
  const db = await getTenantDb();
  return db.testCase.findMany({ orderBy: [{ category: "asc" }, { createdAt: "asc" }] });
}

// CI results are about the one shared codebase every tenant runs on, not
// any tenant's data — read via the plain client, not getTenantDb(). See
// the CiSuiteSnapshot model comment in schema.prisma.
export async function getCiSnapshots() {
  return prisma.ciSuiteSnapshot.findMany();
}

export async function createTestCase(input: TestCaseInput): Promise<TestCaseState> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) return { error: PERMISSION_ERROR };

  const parsed = testCaseInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const invalid = validateDefinitionForKind(parsed.data.kind, parsed.data.definition);
  if (invalid) return { error: invalid };

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.testCase.create({
    data: {
      tenantId: tenant.id,
      category: parsed.data.category,
      kind: parsed.data.kind,
      name: parsed.data.name,
      description: parsed.data.description || null,
      definition: parsed.data.definition,
      createdByUserId: user.id,
    },
  });

  revalidatePath("/test-suite");
  return { error: null };
}

export async function updateTestCase(id: string, input: TestCaseInput): Promise<TestCaseState> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) return { error: PERMISSION_ERROR };

  const parsed = testCaseInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const invalid = validateDefinitionForKind(parsed.data.kind, parsed.data.definition);
  if (invalid) return { error: invalid };

  const db = await getTenantDb();
  const existing = await db.testCase.findUnique({ where: { id } });
  if (!existing) return { error: "Test case not found." };

  await db.testCase.update({
    where: { id },
    data: {
      category: parsed.data.category,
      kind: parsed.data.kind,
      name: parsed.data.name,
      description: parsed.data.description || null,
      definition: parsed.data.definition,
    },
  });

  revalidatePath("/test-suite");
  return { error: null };
}

export async function deleteTestCase(id: string): Promise<TestCaseState> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) return { error: PERMISSION_ERROR };

  const db = await getTenantDb();
  const existing = await db.testCase.findUnique({ where: { id } });
  if (!existing) return { error: "Test case not found." };

  await db.testCase.delete({ where: { id } });
  revalidatePath("/test-suite");
  return { error: null };
}

async function executeOne(testCase: { id: string; kind: string; definition: unknown }): Promise<TestResult> {
  if (testCase.kind === "api") return runApiTestCase(testCase.definition as ApiDefinition);
  if (testCase.kind === "sanity") return runSanityTestCase(testCase.definition as SanityDefinition);
  return { status: "error", message: `Unknown test kind "${testCase.kind}".`, durationMs: 0 };
}

export type RunSummary = {
  error: string | null;
  passCount: number;
  failCount: number;
  results: { testCaseId: string; name: string; status: TestResult["status"]; message: string; durationMs: number }[];
};

// Runs every given test case live, records each result on the TestCase row,
// and writes one TestRunBatch summarizing the whole run.
export async function runTestCases(ids: string[], scope: string): Promise<RunSummary> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    return { error: PERMISSION_ERROR, passCount: 0, failCount: 0, results: [] };
  }
  if (ids.length === 0) return { error: "No test cases to run.", passCount: 0, failCount: 0, results: [] };

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const testCases = await db.testCase.findMany({ where: { id: { in: ids } } });

  const results: RunSummary["results"] = [];
  for (const tc of testCases) {
    const result = await executeOne(tc);
    results.push({ testCaseId: tc.id, name: tc.name, status: result.status, message: result.message, durationMs: result.durationMs });
    await db.testCase.update({
      where: { id: tc.id },
      data: {
        lastRunStatus: result.status,
        lastRunMessage: result.message,
        lastRunAt: new Date(),
        lastRunDurationMs: result.durationMs,
      },
    });
  }

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.length - passCount;

  await db.testRunBatch.create({
    data: {
      tenantId: tenant.id,
      scope,
      triggeredByUserId: user.id,
      finishedAt: new Date(),
      passCount,
      failCount,
      results,
    },
  });

  revalidatePath("/test-suite");
  return { error: null, passCount, failCount, results };
}

export async function runCategory(category: string): Promise<RunSummary> {
  const db = await getTenantDb();
  const testCases = await db.testCase.findMany({ where: { category, isActive: true }, select: { id: true } });
  return runTestCases(
    testCases.map((t) => t.id),
    category
  );
}

export async function runAllCustomTestCases(): Promise<RunSummary> {
  const db = await getTenantDb();
  const testCases = await db.testCase.findMany({ where: { isActive: true }, select: { id: true } });
  return runTestCases(
    testCases.map((t) => t.id),
    "all"
  );
}

export async function listRunBatches(limit = 10) {
  const db = await getTenantDb();
  return db.testRunBatch.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}

export type CiDispatchState = { error: string | null; message: string | null };

// Triggers the tests.yml GitHub Actions workflow via workflow_dispatch.
// Requires a repo-scoped PAT (Actions: read/write) in GITHUB_ACTIONS_TOKEN —
// that's an org/repo credential only a human can create and hand to
// Vercel's env vars, so this degrades to a clear error rather than
// crashing when it's unset.
export async function dispatchCiRun(): Promise<CiDispatchState> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) return { error: PERMISSION_ERROR, message: null };

  const token = process.env.GITHUB_ACTIONS_TOKEN;
  const repo = process.env.GITHUB_ACTIONS_REPO || "talentlink-inc/talentlink";
  if (!token) {
    return {
      error:
        "CI dispatch isn't configured yet — add a GITHUB_ACTIONS_TOKEN (repo-scoped PAT with Actions read/write) to this app's environment variables to enable it. Push to main still runs CI automatically.",
      message: null,
    };
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/tests.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main" }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `GitHub API returned ${res.status}: ${text.slice(0, 300)}`, message: null };
  }

  return { error: null, message: "CI run triggered. Results will appear here once the workflow finishes (usually a minute or two)." };
}
