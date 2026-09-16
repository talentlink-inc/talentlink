import { headers } from "next/headers";
import { getTenantDb } from "@/lib/tenantDb";

export type TestResult = { status: "pass" | "fail" | "error"; message: string; durationMs: number };

function pass(message: string, start: number): TestResult {
  return { status: "pass", message, durationMs: Date.now() - start };
}
function fail(message: string, start: number): TestResult {
  return { status: "fail", message, durationMs: Date.now() - start };
}

// ---- "sanity" kind ----
// A read-only row-count check against an allowlisted model/field, never
// arbitrary SQL or an admin-authored filter shape — see the TestCase model
// comment in schema.prisma for why that boundary matters.
type TenantDb = Awaited<ReturnType<typeof getTenantDb>>;

const SANITY_COUNTERS: Record<string, (db: TenantDb, where?: Record<string, string>) => Promise<number>> = {
  requirement: (db, where) => db.requirement.count({ where: where as never }),
  submission: (db, where) => db.submission.count({ where: where as never }),
  interview: (db, where) => db.interview.count({ where: where as never }),
  candidate: (db, where) => db.candidate.count({ where: where as never }),
  user: (db, where) => db.user.count({ where: where as never }),
};

const SANITY_ALLOWED_FIELDS: Record<string, string[]> = {
  requirement: ["status"],
  submission: ["status"],
  interview: ["status"],
  candidate: [],
  user: ["role", "status"],
};

export interface SanityDefinition {
  model: string;
  filterField?: string;
  filterEquals?: string;
  min: number;
  max: number;
}

export function validateSanityDefinition(def: SanityDefinition): string | null {
  if (!SANITY_COUNTERS[def.model]) return `Unknown model "${def.model}".`;
  if (def.filterField && !SANITY_ALLOWED_FIELDS[def.model]?.includes(def.filterField)) {
    return `Field "${def.filterField}" isn't allowlisted for ${def.model}.`;
  }
  if (def.min > def.max) return "Min cannot be greater than max.";
  return null;
}

export async function runSanityTestCase(definition: SanityDefinition): Promise<TestResult> {
  const start = Date.now();
  try {
    const invalid = validateSanityDefinition(definition);
    if (invalid) return fail(invalid, start);
    const counter = SANITY_COUNTERS[definition.model];
    const db = await getTenantDb();
    const where =
      definition.filterField && definition.filterEquals
        ? { [definition.filterField]: definition.filterEquals }
        : undefined;
    const count = await counter(db, where);
    if (count < definition.min || count > definition.max) {
      return fail(`Count was ${count}, expected between ${definition.min} and ${definition.max}.`, start);
    }
    return pass(`Count was ${count} (within [${definition.min}, ${definition.max}]).`, start);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Unknown error", durationMs: Date.now() - start };
  }
}

// ---- "api" kind ----
// GET-only, same-origin, "/api/..." paths only — no arbitrary URLs (SSRF
// risk) and no mutating methods (a repeatable test case that POSTs to a
// production endpoint on every run would create real data as a side
// effect, which defeats the point of a safely re-runnable check).
export interface ApiDefinition {
  path: string;
  expectedStatus: number;
  bodyContains?: string;
}

export function validateApiDefinition(def: ApiDefinition): string | null {
  if (!def.path.startsWith("/api/")) return 'Path must start with "/api/".';
  if (def.path.startsWith("//") || def.path.includes("://")) {
    return "Path must be a same-origin relative path, not an absolute URL.";
  }
  if (def.expectedStatus < 100 || def.expectedStatus > 599) return "Expected status must be a valid HTTP status code.";
  return null;
}

export async function runApiTestCase(definition: ApiDefinition): Promise<TestResult> {
  const start = Date.now();
  try {
    const invalid = validateApiDefinition(definition);
    if (invalid) return fail(invalid, start);

    const h = await headers();
    const host = h.get("host");
    if (!host) return fail("No host header available on this request.", start);
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const cookie = h.get("cookie");

    const res = await fetch(`${proto}://${host}${definition.path}`, {
      method: "GET",
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
    const body = await res.text();

    if (res.status !== definition.expectedStatus) {
      return fail(`Expected status ${definition.expectedStatus}, got ${res.status}.`, start);
    }
    if (definition.bodyContains && !body.includes(definition.bodyContains)) {
      return fail(`Response body did not contain "${definition.bodyContains}".`, start);
    }
    return pass(`GET ${definition.path} -> ${res.status}`, start);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Unknown error", durationMs: Date.now() - start };
  }
}
