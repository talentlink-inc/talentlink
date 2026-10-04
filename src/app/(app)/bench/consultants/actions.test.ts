import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, OTHER_TENANT_ID, TENANT, type FakeDb } from "@/test/fakeDb";

type TestRow = Record<string, unknown> & { id: string };

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db, getTenantDbFor: () => h.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  RESUME_BUCKET: "resumes",
  getSupabaseAdmin: () => ({ storage: { from: () => ({ upload: async () => ({ error: null }) }) } }),
}));

import {
  createBenchConsultant,
  updateBenchConsultant,
  deleteBenchConsultant,
  updateBenchConsultantStatus,
  setBenchConsultantHotlist,
  setBenchHotlistStatus,
  assignBenchConsultant,
} from "./actions";

const VALID = {
  consultantName: "jane DOE",
  role: "Java Developer",
  technologySkills: "Java, Spring",
  visaStatus: "H1B",
  experience: "8 Years",
  location: "Dallas, TX",
  availability: "Immediate",
  payRate: "$70/hr C2C",
};
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const initial = { error: null };

function seedConsultant(overrides: Record<string, unknown> = {}) {
  const row: TestRow = {
    id: `c-${h.db.benchConsultant.rows.length + 1}`,
    tenantId: TENANT.id,
    consultantCode: `BC-000${h.db.benchConsultant.rows.length + 1}`,
    consultantName: "Seeded Consultant",
    status: "Available",
    marketerUserId: "someone-else",
    marketerNameRaw: "Someone Else",
    onHotlist: false,
    hotlistStatus: null,
    deletedAt: null,
    ...overrides,
  };
  h.db.benchConsultant.rows.push(row);
  return row;
}

beforeEach(() => {
  h.db = createFakeDb();
  h.user = makeUser("Admin");
  h.db.user.rows.push(
    { ...makeUser("Admin"), tenantId: TENANT.id },
    { ...makeUser("BenchSales"), tenantId: TENANT.id },
    { id: "foreign-user", tenantId: OTHER_TENANT_ID, name: "Foreign", status: "active", role: "Admin" }
  );
});

describe("[security] bench consultant access by role", () => {
  it.each(["Recruiter", "HR"])("%s cannot create, edit, change status, hotlist, assign or delete", async (role) => {
    const c = seedConsultant();
    h.user = makeUser(role);
    expect((await createBenchConsultant(initial, form(VALID))).error).toMatch(/access to Bench Sales/);
    expect((await updateBenchConsultant(c.id, initial, form(VALID))).error).toMatch(/access to Bench Sales/);
    await expect(updateBenchConsultantStatus(c.id, "Marketing")).rejects.toThrow(/access to Bench Sales/);
    await expect(setBenchConsultantHotlist(c.id, true)).rejects.toThrow(/access to Bench Sales/);
    await expect(assignBenchConsultant(c.id, null)).rejects.toThrow(/access to Bench Sales/);
    await expect(deleteBenchConsultant(c.id)).rejects.toThrow(/access to Bench Sales/);
    expect(h.db.benchConsultant.rows).toHaveLength(1);
    expect(c.status).toBe("Available");
  });

  it.each(["Admin", "Manager", "BenchSales"])("%s can add a consultant", async (role) => {
    h.user = makeUser(role);
    expect(await createBenchConsultant(initial, form(VALID))).toEqual({ error: null });
    expect(h.db.benchConsultant.rows).toHaveLength(1);
  });
});

describe("bench consultant create", () => {
  it("title-cases the name GAS-style, assigns the next BC code, defaults the marketer to the creator", async () => {
    seedConsultant({ consultantCode: "BC-0041" });
    h.user = makeUser("BenchSales");
    await createBenchConsultant(initial, form(VALID));
    const created = h.db.benchConsultant.rows.at(-1)!;
    expect(created.consultantName).toBe("Jane Doe");
    expect(created.consultantCode).toBe("BC-0042");
    expect(created.marketerUserId).toBe(h.user.id);
    expect(created.status).toBe("Available");
  });

  it("[security] ignores a forged marketer id from another tenant", async () => {
    await createBenchConsultant(initial, form({ ...VALID, marketerUserId: "foreign-user" }));
    expect(h.db.benchConsultant.rows[0].marketerUserId).toBe(h.user.id);
  });

  it("[negative] rejects a missing required field without saving", async () => {
    const result = await createBenchConsultant(initial, form({ ...VALID, payRate: "" }));
    expect(result.error).toMatch(/Pay rate is required/);
    expect(h.db.benchConsultant.rows).toHaveLength(0);
  });

  it("[negative] rejects a resume that isn't pdf/doc/docx", async () => {
    const fd = form(VALID);
    fd.set("resume", new File(["x"], "photo.png", { type: "image/png" }));
    expect((await createBenchConsultant(initial, fd)).error).toMatch(/\.pdf, \.doc, or \.docx/);
    expect(h.db.benchConsultant.rows).toHaveLength(0);
  });
});

describe("bench consultant update", () => {
  it("keeps an unlinked imported marketer when the form posts no marketer", async () => {
    const c = seedConsultant({ marketerUserId: null, marketerNameRaw: "Umesh (GAS)" });
    await updateBenchConsultant(c.id, initial, form(VALID));
    expect(c.marketerNameRaw).toBe("Umesh (GAS)");
    expect(c.marketerUserId).toBeNull();
  });

  it("[security] can't touch another tenant's consultant", async () => {
    const foreign = seedConsultant({ tenantId: OTHER_TENANT_ID });
    expect((await updateBenchConsultant(foreign.id, initial, form(VALID))).error).toBe("Consultant not found.");
    expect(foreign.consultantName).toBe("Seeded Consultant");
  });
});

describe("bench consultant delete (GAS deleteBenchConsultant rules)", () => {
  it("[security] Bench Sales can't delete someone else's consultant", async () => {
    const c = seedConsultant();
    h.user = makeUser("BenchSales");
    expect((await deleteBenchConsultant(c.id)).error).toMatch(/only delete your own/);
    expect(c.deletedAt).toBeNull();
  });

  it("Bench Sales can delete their own (matched by user or, for imports, by name)", async () => {
    h.user = makeUser("BenchSales");
    const own = seedConsultant({ marketerUserId: h.user.id });
    const imported = seedConsultant({ marketerUserId: null, marketerNameRaw: "  benchsales USER " });
    expect((await deleteBenchConsultant(own.id)).error).toBeNull();
    expect((await deleteBenchConsultant(imported.id)).error).toBeNull();
    expect(own.deletedAt).toBeInstanceOf(Date);
  });

  it("is blocked while live submissions reference the consultant, allowed once they're deleted", async () => {
    const c = seedConsultant();
    h.db.benchSubmission.rows.push({ id: "s1", tenantId: TENANT.id, benchConsultantId: c.id, deletedAt: null });
    expect((await deleteBenchConsultant(c.id)).error).toMatch(/1 submission\(s\) reference/);
    h.db.benchSubmission.rows[0].deletedAt = new Date();
    expect((await deleteBenchConsultant(c.id)).error).toBeNull();
  });
});

describe("bench consultant status / hotlist / assignment", () => {
  it("[negative] rejects an unknown status", async () => {
    const c = seedConsultant();
    await expect(updateBenchConsultantStatus(c.id, "Sleeping")).rejects.toThrow(/Invalid status/);
  });

  it("joining the hotlist marks it Active; leaving clears it", async () => {
    const c = seedConsultant();
    await setBenchConsultantHotlist(c.id, true);
    expect([c.onHotlist, c.hotlistStatus]).toEqual([true, "Active"]);
    await setBenchConsultantHotlist(c.id, false);
    expect([c.onHotlist, c.hotlistStatus]).toEqual([false, null]);
  });

  it("[negative] hotlist status only for consultants on the hotlist, and only Active/Inactive", async () => {
    const off = seedConsultant({ onHotlist: false });
    await expect(setBenchHotlistStatus(off.id, "Inactive")).rejects.toThrow();
    const on = seedConsultant({ onHotlist: true, hotlistStatus: "Active" });
    await expect(setBenchHotlistStatus(on.id, "Paused")).rejects.toThrow(/Invalid hotlist status/);
    await setBenchHotlistStatus(on.id, "Inactive");
    expect(on.hotlistStatus).toBe("Inactive");
  });

  it("[security] can't assign to a user from another tenant; empty clears", async () => {
    const c = seedConsultant({ assignedToUserId: "x", assignedToNameRaw: "X" });
    await expect(assignBenchConsultant(c.id, "foreign-user")).rejects.toThrow(/isn't available/);
    await assignBenchConsultant(c.id, null);
    expect([c.assignedToUserId, c.assignedToNameRaw]).toEqual([null, null]);
  });
});
