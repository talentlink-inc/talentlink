import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db, getTenantDbFor: () => h.db }));
vi.mock("@/lib/supabase/admin", () => ({
  RESUME_BUCKET: "resumes",
  getSupabaseAdmin: () => ({ storage: { from: () => ({ upload: async () => ({ error: null }) }) } }),
}));

import { submitApplication } from "./actions";
import { candidateIdentityHash } from "@/lib/candidates";

const applicant = { candidateName: "Jane Doe", email: "jane@example.com", phone: "+1 555 0100", currentLocation: "Austin, TX" };
function form(extra: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...applicant, ...extra })) fd.set(k, v);
  fd.set("resume", new File(["%PDF-1.4 test"], "cv.pdf", { type: "application/pdf" }));
  return fd;
}
const initial = { error: null, submitted: false };

beforeEach(() => {
  h.db = createFakeDb();
  h.db.requirement.rows.push(
    { id: "open", tenantId: TENANT.id, publicApplyToken: "tok-open", status: "Open", screeningQuestions: [], deletedAt: null },
    { id: "closed", tenantId: TENANT.id, publicApplyToken: "tok-closed", status: "Closed", screeningQuestions: [], deletedAt: null },
    { id: "filled", tenantId: TENANT.id, publicApplyToken: "tok-filled", status: "Filled", screeningQuestions: [], deletedAt: null }
  );
});

describe("[security] public apply link", () => {
  it.each(["tok-closed", "tok-filled"])("refuses applications to a %s requirement even via a direct POST", async (token) => {
    const r = await submitApplication(token, initial, form());
    expect(r.error).toMatch(/no longer accepting/);
    expect(h.db.submission.rows).toHaveLength(0);
  });

  it("an unknown or deleted token is refused", async () => {
    expect((await submitApplication("nope", initial, form())).error).toMatch(/no longer valid/);
  });

  it("never overwrites an existing candidate's recruiter-maintained record", async () => {
    const identityHash = candidateIdentityHash(applicant.email, applicant.phone, applicant.candidateName);
    h.db.candidate.rows.push({ id: "cand", tenantId: TENANT.id, identityHash, name: "Jane Doe", currentLocation: "Recruiter-verified: Dallas", linkedinUrl: null, deletedAt: null });
    const r = await submitApplication("tok-open", initial, form({ currentLocation: "Somewhere else" }));
    expect(r).toEqual({ error: null, submitted: true });
    expect(h.db.candidate.rows[0].currentLocation).toBe("Recruiter-verified: Dallas");
    expect(h.db.submission.rows[0]).toMatchObject({ candidateId: "cand", requirementId: "open", status: "New_Resume" });
  });

  it("[negative] rejects a non-resume file type", async () => {
    const fd = form();
    fd.set("resume", new File(["x"], "virus.exe", { type: "application/octet-stream" }));
    expect((await submitApplication("tok-open", initial, fd)).error).toMatch(/\.pdf, \.doc, or \.docx/);
    expect(h.db.submission.rows).toHaveLength(0);
  });

  it("numbers new submissions after the highest existing SUB id, not the row count", async () => {
    h.db.submission.rows.push({ id: "x", tenantId: TENANT.id, submissionId: "SUB-0558", candidateId: "z", requirementId: "other", deletedAt: null });
    await submitApplication("tok-open", initial, form());
    expect(h.db.submission.rows.at(-1)!.submissionId).toBe("SUB-0559");
  });
});
