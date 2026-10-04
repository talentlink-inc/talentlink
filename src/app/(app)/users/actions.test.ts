import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ auth: { admin: { updateUserById: async () => ({ error: null }) } } }) }));

import { updateUser, toggleUserStatus, deleteUser } from "./actions";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  h.db = createFakeDb();
  h.user = makeUser("Admin");
  h.db.user.rows.push({ ...h.user, authUserId: null }, { ...makeUser("Recruiter"), authUserId: null });
});

describe("[security] an Admin can't lock themselves (or the workspace) out of Admin", () => {
  it("editing your own row can't remove your Admin role or deactivate you", async () => {
    const base = { name: "Me", email: h.user.email };
    expect((await updateUser(h.user.id, { error: null }, form({ ...base, role: "Recruiter", status: "active" }))).error).toMatch(/cannot deactivate your own account or remove your own Admin/);
    expect((await updateUser(h.user.id, { error: null }, form({ ...base, role: "Admin", status: "inactive" }))).error).toMatch(/cannot deactivate/);
    expect(h.db.user.rows[0]).toMatchObject({ role: "Admin", status: "active" });
    expect((await updateUser(h.user.id, { error: null }, form({ ...base, role: "Admin", status: "active", name: "Renamed" }))).error).toBeNull();
    expect(h.db.user.rows[0].name).toBe("Renamed");
  });

  it("the toggle and delete buttons refuse your own account too", async () => {
    expect((await toggleUserStatus(h.user.id)).error).toMatch(/your own account/);
    expect((await deleteUser(h.user.id)).error).toMatch(/your own account/);
  });

  it("non-Admins can't manage users at all", async () => {
    h.user = makeUser("Manager");
    await expect(updateUser("user-recruiter", { error: null }, form({ name: "X", email: "x@acme.test", role: "Admin", status: "active" }))).rejects.toThrow(/Only Admins/);
    expect(h.db.user.rows[1].role).toBe("Recruiter");
  });
});
