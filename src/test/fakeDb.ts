// Minimal in-memory stand-in for the tenant-scoped Prisma client, so server
// actions can be tested for real (permission gates, business rules, tenant
// scoping) without a database. Supports the query shapes the actions use:
// equality, null, { not }, { in }, { startsWith }, { equals, mode:
// "insensitive" }; findFirst / findUnique / findMany / count / create /
// update / delete / aggregate(_max). Like Prisma, update/delete throw when
// the where clause matches nothing — so a tenant/deleted/ownership filter
// that excludes a row behaves exactly as it would in production.
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matchesValue(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null || value === undefined;
  if (typeof cond === "object" && cond !== null && !(cond instanceof Date) && !Array.isArray(cond)) {
    const c = cond as Record<string, unknown>;
    if ("not" in c) return !matchesValue(value, c.not);
    if ("in" in c) return (c.in as unknown[]).includes(value);
    if ("startsWith" in c) return typeof value === "string" && value.startsWith(c.startsWith as string);
    if ("contains" in c) {
      const insensitive = c.mode === "insensitive";
      const v = String(value ?? "");
      const needle = String(c.contains);
      return insensitive ? v.toLowerCase().includes(needle.toLowerCase()) : v.includes(needle);
    }
    if ("equals" in c) {
      return c.mode === "insensitive"
        ? String(value ?? "").toLowerCase() === String(c.equals).toLowerCase()
        : value === c.equals;
    }
  }
  return value === cond;
}

export function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Where[]).some((w) => matches(row, w));
    if (key === "AND") return (cond as Where[]).every((w) => matches(row, w));
    if (cond === undefined) return true;
    return matchesValue(row[key], cond);
  });
}

class NotFoundError extends Error {
  code = "P2025";
  constructor(model: string) {
    super(`No ${model} record found for the where condition`);
  }
}

function model(name: string, rows: Row[]) {
  return {
    rows,
    async findFirst({ where }: { where?: Where } = {}) {
      return rows.find((r) => matches(r, where)) ?? null;
    },
    async findUnique({ where }: { where?: Where } = {}) {
      return rows.find((r) => matches(r, where)) ?? null;
    },
    async findMany({ where }: { where?: Where } = {}) {
      return rows.filter((r) => matches(r, where));
    },
    async count({ where }: { where?: Where } = {}) {
      return rows.filter((r) => matches(r, where)).length;
    },
    async create({ data }: { data: Row }) {
      const row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), deletedAt: null, ...data };
      rows.push(row);
      return row;
    },
    async update({ where, data }: { where: Where; data: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new NotFoundError(name);
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    async delete({ where }: { where: Where }) {
      const i = rows.findIndex((r) => matches(r, where));
      if (i < 0) throw new NotFoundError(name);
      return rows.splice(i, 1)[0];
    },
    async aggregate({ where, _max }: { where?: Where; _max?: Record<string, boolean> }) {
      const filtered = rows.filter((r) => matches(r, where));
      const max: Record<string, unknown> = {};
      for (const key of Object.keys(_max ?? {})) {
        const values = filtered.map((r) => r[key] as number).filter((v) => typeof v === "number");
        max[key] = values.length ? Math.max(...values) : null;
      }
      return { _max: max };
    },
  };
}

export function createFakeDb() {
  return {
    user: model("user", []),
    benchConsultant: model("benchConsultant", []),
    benchSubmission: model("benchSubmission", []),
    benchInterview: model("benchInterview", []),
    helpTopic: model("helpTopic", []),
    note: model("note", []),
    requirement: model("requirement", []),
    submission: model("submission", []),
    interview: model("interview", []),
    candidate: {
      ...model("candidate", []),
      // Prisma upsert on the (tenantId, identityHash) compound key.
      async upsert(this: { rows: Row[] }, { where, update, create }: { where: { tenantId_identityHash: Row }; update: Row; create: Row }) {
        const key = where.tenantId_identityHash;
        const row = this.rows.find((r) => r.tenantId === key.tenantId && r.identityHash === key.identityHash);
        if (row) return Object.assign(row, update);
        const created = { id: randomUUID(), deletedAt: null, ...create };
        this.rows.push(created);
        return created;
      },
    },
    resume: model("resume", []),
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;

export const TENANT = { id: "tenant-a", name: "Acme Staffing", subdomain: "acme" };
export const OTHER_TENANT_ID = "tenant-b";

export function makeUser(role: string, overrides: Row = {}) {
  return {
    id: `user-${role.toLowerCase()}`,
    tenantId: TENANT.id,
    name: `${role} User`,
    email: `${role.toLowerCase()}@acme.test`,
    role,
    status: "active",
    canViewResume: true,
    canDownloadResume: true,
    canViewPhone: true,
    canViewEmail: true,
    ...overrides,
  };
}
