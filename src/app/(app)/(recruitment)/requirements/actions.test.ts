import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, OTHER_TENANT_ID, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db, getTenantDbFor: () => h.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { getRequirementDetail } from "./actions";

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

describe("[security] full requirement loaded when it is opened or cloned", () => {
  it("returns the record with a sanitized job description", async () => {
    h.db.requirement.rows.push(req("r1", { jobDescription: '<p onclick="x()">Hi</p><script>steal()</script>', billRate: null, payRate: null }));
    const r = await getRequirementDetail("r1");
    expect(r?.jobTitle).toBe("Java Developer");
    expect(r?.jobDescription).toBe("<p>Hi</p>");
  });

  it("never returns another tenant's or a deleted requirement's description", async () => {
    h.db.requirement.rows.push(req("other", { tenantId: OTHER_TENANT_ID }), req("gone", { deletedAt: new Date() }));
    expect(await getRequirementDetail("other")).toBeNull();
    expect(await getRequirementDetail("gone")).toBeNull();
    expect(await getRequirementDetail("missing")).toBeNull();
  });

  it("respects the user's region restriction, same as the list", async () => {
    h.db.requirement.rows.push(req("us", { country: "USA" }), req("in", { country: "India" }));
    h.user = makeUser("Recruiter", { regions: "India" });
    expect(await getRequirementDetail("us")).toBeNull();
    expect((await getRequirementDetail("in"))?.jobDescription).toBe("<p>Build <b>things</b></p>");
  });

  it("[unit] keeps an empty description empty", async () => {
    h.db.requirement.rows.push(req("empty", { jobDescription: null }));
    expect((await getRequirementDetail("empty"))?.jobDescription).toBeNull();
  });
});
