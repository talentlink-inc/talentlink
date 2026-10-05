import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db, getTenantDbFor: () => h.db }));
vi.mock("@/lib/db", () => ({ prisma: { ciSuiteSnapshot: { findMany: async () => [] } } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { listTestCases, getCiSnapshots, listRunBatches, runAllCustomTestCases } from "./actions";

beforeEach(() => {
  h.db = createFakeDb();
});

describe("[security] Test Suite actions are Admin-only, reads included", () => {
  it.each(["Manager", "Recruiter", "BenchSales", "HR"])("%s can't read test cases, CI results or run history", async (role) => {
    h.user = makeUser(role);
    await expect(listTestCases()).rejects.toThrow(/Only Admins/);
    await expect(getCiSnapshots()).rejects.toThrow(/Only Admins/);
    await expect(listRunBatches()).rejects.toThrow(/Only Admins/);
    expect((await runAllCustomTestCases()).error).toMatch(/Only Admins/);
  });

  it("Admins can", async () => {
    h.user = makeUser("Admin");
    await expect(listTestCases()).resolves.toEqual([]);
    await expect(getCiSnapshots()).resolves.toEqual([]);
    await expect(listRunBatches(1000)).resolves.toEqual([]);
  });
});
