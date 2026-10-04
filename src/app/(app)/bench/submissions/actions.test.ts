import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, OTHER_TENANT_ID, TENANT, type FakeDb } from "@/test/fakeDb";

type TestRow = Record<string, unknown> & { id: string };

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db, getTenantDbFor: () => h.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { createBenchSubmission, updateBenchSubmission, deleteBenchSubmission, updateBenchPlacement } from "./actions";
import { createBenchInterview, updateBenchInterview, deleteBenchInterview } from "../interviews/actions";

const initial = { error: null };
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

function seedConsultant(id = "c1", tenantId = TENANT.id) {
  h.db.benchConsultant.rows.push({ id, tenantId, consultantCode: "BC-0001", consultantName: "Jane Doe", deletedAt: null });
}
function seedSubmission(overrides: Record<string, unknown> = {}) {
  const row: TestRow = {
    id: `s${h.db.benchSubmission.rows.length + 1}`,
    tenantId: TENANT.id,
    submissionCode: `BSUB-000${h.db.benchSubmission.rows.length + 1}`,
    benchConsultantId: "c1",
    companyName: "Acme Corp",
    status: "Vender_Submission",
    placementId: null,
    selectedDate: null,
    deletedAt: null,
    ...overrides,
  };
  h.db.benchSubmission.rows.push(row);
  return row;
}

beforeEach(() => {
  h.db = createFakeDb();
  h.user = makeUser("BenchSales");
  seedConsultant();
});

describe("[security] bench submission access by role", () => {
  it.each(["Recruiter", "HR"])("%s cannot create or edit bench submissions", async (role) => {
    const s = seedSubmission();
    h.user = makeUser(role);
    expect((await createBenchSubmission(initial, form({ benchConsultantId: "c1", companyName: "X" }))).error).toMatch(/access/);
    expect((await updateBenchSubmission(s.id, initial, form({ benchConsultantId: "c1", companyName: "Y" }))).error).toMatch(/access/);
    expect(s.companyName).toBe("Acme Corp");
  });

  it("only Admin/Manager can delete (GAS deleteBenchSubmission)", async () => {
    const s = seedSubmission();
    expect((await deleteBenchSubmission(s.id)).error).toMatch(/Only an Admin or Manager/);
    h.user = makeUser("Manager");
    expect((await deleteBenchSubmission(s.id)).error).toBeNull();
    expect(s.deletedAt).toBeInstanceOf(Date);
  });

  it("can't submit another tenant's consultant", async () => {
    seedConsultant("foreign", OTHER_TENANT_ID);
    const r = await createBenchSubmission(initial, form({ benchConsultantId: "foreign", companyName: "X" }));
    expect(r.error).toMatch(/no longer exists/);
    expect(h.db.benchSubmission.rows).toHaveLength(0);
  });
});

describe("bench submission duplicate rule (GAS hard block)", () => {
  it("blocks the same consultant + company regardless of case/spacing, and points at the existing one", async () => {
    const existing = seedSubmission({ companyName: "Acme Corp" });
    const r = await createBenchSubmission(initial, form({ benchConsultantId: "c1", companyName: "  ACME   corp " }));
    expect(r.error).toMatch(/Duplicate submission blocked/);
    expect(r.duplicateId).toBe(existing.id);
    expect(h.db.benchSubmission.rows).toHaveLength(1);
  });

  it("allows it again once the earlier one is deleted, and allows other companies", async () => {
    seedSubmission({ companyName: "Acme Corp", deletedAt: new Date() });
    expect((await createBenchSubmission(initial, form({ benchConsultantId: "c1", companyName: "Acme Corp" }))).error).toBeNull();
    expect((await createBenchSubmission(initial, form({ benchConsultantId: "c1", companyName: "Globex" }))).error).toBeNull();
  });

  it("editing a submission into a duplicate is blocked too", async () => {
    seedSubmission({ companyName: "Acme Corp" });
    const other = seedSubmission({ companyName: "Globex" });
    const r = await updateBenchSubmission(other.id, initial, form({ benchConsultantId: "c1", companyName: "acme corp", status: "Vender_Submission" }));
    expect(r.error).toMatch(/Duplicate/);
    expect(other.companyName).toBe("Globex");
  });
});

describe("bench submission statuses, reject reasons and placements", () => {
  it("[negative] a reject status needs a valid reject reason", async () => {
    const s = seedSubmission();
    const base = { benchConsultantId: "c1", companyName: "Acme Corp", status: "Client_Reject" };
    expect((await updateBenchSubmission(s.id, initial, form(base))).error).toMatch(/reject reason is required/);
    expect((await updateBenchSubmission(s.id, initial, form({ ...base, rejectReason: "Bogus" }))).error).toMatch(/valid reject reason/);
    expect((await updateBenchSubmission(s.id, initial, form({ ...base, rejectReason: "Rate_Too_High" }))).error).toBeNull();
    expect(s.rejectReason).toBe("Rate_Too_High");
  });

  it("clears a stale reject reason when moving to a non-reject status", async () => {
    const s = seedSubmission({ status: "Client_Reject", rejectReason: "Rate_Too_High" });
    await updateBenchSubmission(s.id, initial, form({ benchConsultantId: "c1", companyName: "Acme Corp", status: "L1_Interview" }));
    expect(s.rejectReason).toBeNull();
  });

  it("mints the next BPLC id on the first qualifying status and keeps it after falling back", async () => {
    seedSubmission({ companyName: "Old", placementId: "BPLC-0007" });
    const s = seedSubmission({ companyName: "Acme Corp" });
    const base = { benchConsultantId: "c1", companyName: "Acme Corp" };
    await updateBenchSubmission(s.id, initial, form({ ...base, status: "Client_Selected" }));
    expect(s.placementId).toBe("BPLC-0008");
    expect(s.selectedDate).toBeInstanceOf(Date);
    await updateBenchSubmission(s.id, initial, form({ ...base, status: "L1_Interview" }));
    await updateBenchSubmission(s.id, initial, form({ ...base, status: "Onboarding" }));
    expect(s.placementId).toBe("BPLC-0008");
  });

  it("keeps a legacy imported status valid on edit, but won't accept it on new records", async () => {
    const s = seedSubmission({ status: "Submitted" });
    expect((await updateBenchSubmission(s.id, initial, form({ benchConsultantId: "c1", companyName: "Acme Corp", status: "Submitted" }))).error).toBeNull();
    expect((await createBenchSubmission(initial, form({ benchConsultantId: "c1", companyName: "New Co", status: "Submitted" }))).error).toMatch(/valid status/);
  });

  it("delete is blocked while interviews reference the submission", async () => {
    h.user = makeUser("Admin");
    const s = seedSubmission();
    h.db.benchInterview.rows.push({ id: "i1", tenantId: TENANT.id, benchSubmissionId: s.id, deletedAt: null });
    expect((await deleteBenchSubmission(s.id)).error).toMatch(/1 interview\(s\) are linked/);
    expect(s.deletedAt).toBeNull();
  });

  it("[negative] placement edit rejects an invalid date and a reject status without a reason", async () => {
    const s = seedSubmission({ placementId: "BPLC-0001", status: "Onboarding" });
    expect((await updateBenchPlacement(s.id, initial, form({ status: "Onboarding", doj: "not-a-date" }))).error).toMatch(/valid date/);
    expect((await updateBenchPlacement(s.id, initial, form({ status: "Client_Reject" }))).error).toMatch(/reject reason/);
    expect((await updateBenchPlacement(s.id, initial, form({ status: "Started_Billable", doj: "2026-11-02", billRate: "$85/hr" }))).error).toBeNull();
    expect((s.doj as unknown as Date).toISOString().slice(0, 10)).toBe("2026-11-02");
  });
});

describe("bench interviews", () => {
  const valid = (benchSubmissionId: string) => ({
    benchSubmissionId,
    interviewType: "L1",
    scheduledAt: "2026-12-15T10:00",
    timezone: "America/New_York",
    mode: "video",
  });

  it("only submissions at L1_Interview / L2_Interview can get a new interview", async () => {
    const early = seedSubmission({ status: "Vender_Submission" });
    const ready = seedSubmission({ companyName: "Globex", status: "L2_Interview" });
    expect((await createBenchInterview(initial, form(valid(early.id)))).error).toMatch(/L1_Interview or L2_Interview/);
    expect((await createBenchInterview(initial, form(valid(ready.id)))).error).toBeNull();
  });

  it("stores the wall-clock time in the chosen timezone (10:00 New York = 15:00 UTC in December)", async () => {
    const s = seedSubmission({ status: "L1_Interview" });
    await createBenchInterview(initial, form(valid(s.id)));
    expect((h.db.benchInterview.rows[0].scheduledAt as Date).toISOString()).toBe("2026-12-15T15:00:00.000Z");
  });

  it("[negative] rejects an invalid timezone, mode and a non-positive duration", async () => {
    const s = seedSubmission({ status: "L1_Interview" });
    expect((await createBenchInterview(initial, form({ ...valid(s.id), timezone: "Mars/Olympus" }))).error).toMatch(/valid timezone/);
    expect((await createBenchInterview(initial, form({ ...valid(s.id), mode: "carrier-pigeon" }))).error).toMatch(/mode/);
    expect((await createBenchInterview(initial, form({ ...valid(s.id), durationMinutes: "-5" }))).error).toMatch(/greater than 0/);
    expect(h.db.benchInterview.rows).toHaveLength(0);
  });

  it("an existing interview keeps its submission even after that submission's status moved on", async () => {
    const s = seedSubmission({ status: "L1_Interview" });
    await createBenchInterview(initial, form(valid(s.id)));
    s.status = "Client_Reject";
    const id = h.db.benchInterview.rows[0].id as string;
    expect((await updateBenchInterview(id, initial, form({ ...valid(s.id), status: "Rejected" }))).error).toBeNull();
  });

  it("[security] delete: Admin/Manager any, others only interviews they scheduled", async () => {
    const s = seedSubmission({ status: "L1_Interview" });
    h.db.benchInterview.rows.push(
      { id: "mine", tenantId: TENANT.id, benchSubmissionId: s.id, scheduledByUserId: h.user.id, deletedAt: null },
      { id: "theirs", tenantId: TENANT.id, benchSubmissionId: s.id, scheduledByUserId: "other", deletedAt: null }
    );
    expect((await deleteBenchInterview("theirs")).error).toMatch(/only delete interviews you scheduled/);
    expect((await deleteBenchInterview("mine")).error).toBeNull();
    h.user = makeUser("Admin");
    expect((await deleteBenchInterview("theirs")).error).toBeNull();
  });
});
