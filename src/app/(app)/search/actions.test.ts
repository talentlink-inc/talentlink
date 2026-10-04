import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db }));

import { globalSearch } from "./actions";

beforeEach(() => {
  h.db = createFakeDb();
  h.db.benchConsultant.rows.push({
    id: "c1", tenantId: TENANT.id, consultantCode: "BC-0001", consultantName: "Kafka Expert", role: "Data Engineer",
    technologySkills: "Kafka", location: "Austin", status: "Available", onHotlist: true, deletedAt: null,
  });
  h.db.user.rows.push({ id: "u1", tenantId: TENANT.id, name: "Kafka Admin", email: "k@acme.test", role: "Admin" });
});

describe("[security] global search only shows what the role may see", () => {
  it.each(["Recruiter", "HR"])("%s gets no bench results", async (role) => {
    h.user = makeUser(role);
    const results = await globalSearch("kafka");
    expect(results.some((r) => r.category.startsWith("Bench"))).toBe(false);
  });

  it("Bench Sales sees bench consultants, linking to the bench page", async () => {
    h.user = makeUser("BenchSales");
    const bench = (await globalSearch("kafka")).filter((r) => r.category === "Bench Consultants");
    expect(bench).toEqual([
      expect.objectContaining({ label: "BC-0001 — Kafka Expert", href: "/bench/consultants?open=c1" }),
    ]);
  });

  it("users appear only for roles that can view User Management", async () => {
    h.user = makeUser("Recruiter");
    expect((await globalSearch("kafka")).some((r) => r.category === "Users")).toBe(false);
    h.user = makeUser("Manager");
    expect((await globalSearch("kafka")).some((r) => r.category === "Users")).toBe(true);
  });

  it("[range] ignores queries shorter than 2 characters", async () => {
    h.user = makeUser("Admin");
    expect(await globalSearch(" k ")).toEqual([]);
  });

  it("[security] soft-deleted bench consultants never show up", async () => {
    h.user = makeUser("Admin");
    h.db.benchConsultant.rows[0].deletedAt = new Date();
    expect((await globalSearch("kafka")).some((r) => r.category === "Bench Consultants")).toBe(false);
  });
});
