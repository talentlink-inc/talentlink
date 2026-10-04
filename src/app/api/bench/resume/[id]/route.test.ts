import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, OTHER_TENANT_ID, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({
  user: null as unknown as ReturnType<typeof makeUser>,
  db: null as unknown as FakeDb,
  signed: [] as { path: string; opts: unknown }[],
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db }));
vi.mock("@/lib/supabase/admin", () => ({
  RESUME_BUCKET: "resumes",
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async (path: string, _ttl: number, opts: unknown) => {
          h.signed.push({ path, opts });
          return { data: { signedUrl: `https://storage.test/${path}` }, error: null };
        },
      }),
    },
  }),
}));

import { GET } from "./route";

const call = (id: string, download = false) =>
  GET(new Request(`https://app.test/api/bench/resume/${id}${download ? "?download=1" : ""}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  h.db = createFakeDb();
  h.signed = [];
  h.user = makeUser("BenchSales", { canViewResume: false, canDownloadResume: false });
  h.db.benchConsultant.rows.push(
    { id: "mine", tenantId: TENANT.id, marketerUserId: h.user.id, resumeFileUrl: "t/bench/mine/cv.pdf", resumeFileName: "cv.pdf", deletedAt: null },
    { id: "theirs", tenantId: TENANT.id, marketerUserId: "other", resumeFileUrl: "t/bench/theirs/cv.pdf", resumeFileName: "cv.pdf", deletedAt: null },
    { id: "foreign", tenantId: OTHER_TENANT_ID, marketerUserId: h.user.id, resumeFileUrl: "b/x.pdf", deletedAt: null },
    { id: "noresume", tenantId: TENANT.id, marketerUserId: h.user.id, resumeFileUrl: null, deletedAt: null }
  );
});

describe("[security] bench resume access (GAS getBenchResumeForView/downloadBenchResume)", () => {
  it("roles without Bench Sales get 403 even for an existing resume", async () => {
    h.user = makeUser("Recruiter");
    expect((await call("theirs")).status).toBe(403);
    expect(h.signed).toHaveLength(0);
  });

  it("the consultant's own marketer can view and download without the resume flags", async () => {
    expect((await call("mine")).status).toBe(307);
    expect((await call("mine", true)).status).toBe(307);
    expect(h.signed[1].opts).toEqual({ download: "cv.pdf" });
  });

  it("anyone else needs canViewResume / canDownloadResume respectively", async () => {
    expect((await call("theirs")).status).toBe(403);
    h.user = makeUser("BenchSales", { canViewResume: true, canDownloadResume: false });
    expect((await call("theirs")).status).toBe(307);
    expect((await call("theirs", true)).status).toBe(403);
  });

  it("another tenant's consultant, a deleted one, or one without a resume is a 404", async () => {
    expect((await call("foreign")).status).toBe(404);
    expect((await call("noresume")).status).toBe(404);
    h.db.benchConsultant.rows[0].deletedAt = new Date();
    expect((await call("mine")).status).toBe(404);
    expect(h.signed).toHaveLength(0);
  });
});
