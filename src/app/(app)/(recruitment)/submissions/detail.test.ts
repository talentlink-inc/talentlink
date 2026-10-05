import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, OTHER_TENANT_ID, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db, getTenantDbFor: () => h.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}), RESUME_BUCKET: "resumes" }));

import { getSubmissionDetail } from "./actions";

// The fake DB ignores `include`, so rows are stored with their relations attached.
const sub = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  tenantId: TENANT.id,
  submissionId: `SUB-${id}`,
  status: "New_Resume",
  billRate: null,
  payRate: null,
  commission: null,
  deletedAt: null,
  candidate: {
    id: `c-${id}`,
    tenantId: TENANT.id,
    name: "Asha Rao",
    email: "asha@example.com",
    phone: "555-0100",
    linkedinUrl: null,
    identityHash: "secret-hash",
    totalExperienceYears: null,
  },
  requirement: null,
  resume: { id: "res1", fileName: "asha.pdf" },
  ...extra,
});

beforeEach(() => {
  h.db = createFakeDb();
  h.user = makeUser("Recruiter");
});

describe("[security] full submission loaded when opened from the list", () => {
  it("returns the record without internal fields", async () => {
    h.db.submission.rows.push(sub("1"));
    const s = await getSubmissionDetail("1");
    expect(s?.submissionId).toBe("SUB-1");
    expect(s?.resume).toEqual({ id: "res1", fileName: "asha.pdf" });
    expect(s && "tenantId" in s).toBe(false);
    expect(s && "identityHash" in s.candidate).toBe(false);
  });

  it("hides email and phone from people without those permissions", async () => {
    h.db.submission.rows.push(sub("1"));
    h.user = makeUser("Recruiter", { canViewEmail: false, canViewPhone: false });
    const s = await getSubmissionDetail("1");
    expect(s?.candidate.email).toBeNull();
    expect(s?.candidate.phone).toBeNull();
    expect(s?.candidate.name).toBe("Asha Rao");
  });

  it("never returns another tenant's or a deleted submission", async () => {
    h.db.submission.rows.push(sub("x", { tenantId: OTHER_TENANT_ID }), sub("gone", { deletedAt: new Date() }));
    expect(await getSubmissionDetail("x")).toBeNull();
    expect(await getSubmissionDetail("gone")).toBeNull();
  });
});

describe("[security] slim list rows", () => {
  it("apply the same email/phone permissions as the full record", async () => {
    const { toSubmissionListRow } = await import("./types");
    const row = {
      id: "1",
      submissionId: "SUB-1",
      status: "New_Resume",
      submissionDate: null,
      billRate: { toString: () => "65" },
      billRateCurrency: "USD",
      employmentType: null,
      requirementJobIdRaw: null,
      requirement: null,
      candidate: { name: "Asha", email: "a@x.com", phone: "555", currentLocation: null, visaStatus: null },
    };
    expect(toSubmissionListRow(row, { canViewEmail: false, canViewPhone: true }).candidate).toMatchObject({ email: null, phone: "555" });
    expect(toSubmissionListRow(row, { canViewEmail: true, canViewPhone: false }).candidate).toMatchObject({ email: "a@x.com", phone: null });
    expect(toSubmissionListRow(row, { canViewEmail: true, canViewPhone: true }).billRate).toBe("65");
  });
});
