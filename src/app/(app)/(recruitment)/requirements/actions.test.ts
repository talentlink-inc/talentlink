import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, OTHER_TENANT_ID, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db, getTenantDbFor: () => h.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { getRequirementJobDescription } from "./actions";

const req = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  tenantId: TENANT.id,
  jobId: id,
  jobTitle: "Java Developer",
  jobDescription: "<p>Build <b>things</b></p>",
  country: "USA",
  deletedAt: null,
  ...extra,
});

beforeEach(() => {
  h.db = createFakeDb();
  h.user = makeUser("Recruiter");
});

describe("[security] job description loaded when a requirement panel opens", () => {
  it("returns the sanitized description for a visible requirement", async () => {
    h.db.requirement.rows.push(req("r1", { jobDescription: '<p onclick="x()">Hi</p><script>steal()</script>' }));
    expect(await getRequirementJobDescription("r1")).toBe("<p>Hi</p>");
  });

  it("never returns another tenant's or a deleted requirement's description", async () => {
    h.db.requirement.rows.push(req("other", { tenantId: OTHER_TENANT_ID }), req("gone", { deletedAt: new Date() }));
    expect(await getRequirementJobDescription("other")).toBeNull();
    expect(await getRequirementJobDescription("gone")).toBeNull();
    expect(await getRequirementJobDescription("missing")).toBeNull();
  });

  it("respects the user's region restriction, same as the list", async () => {
    h.db.requirement.rows.push(req("us", { country: "USA" }), req("in", { country: "India" }));
    h.user = makeUser("Recruiter", { regions: "India" });
    expect(await getRequirementJobDescription("us")).toBeNull();
    expect(await getRequirementJobDescription("in")).toBe("<p>Build <b>things</b></p>");
  });

  it("[unit] returns null when there is no description", async () => {
    h.db.requirement.rows.push(req("empty", { jobDescription: null }));
    expect(await getRequirementJobDescription("empty")).toBeNull();
  });
});
