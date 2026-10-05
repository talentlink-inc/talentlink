import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, makeUser, OTHER_TENANT_ID, TENANT, type FakeDb } from "@/test/fakeDb";

const h = vi.hoisted(() => ({ user: null as unknown as ReturnType<typeof makeUser>, db: null as unknown as FakeDb }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => h.user }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenant: async () => TENANT }));
vi.mock("@/lib/tenantDb", () => ({ getTenantDb: async () => h.db, getTenantDbFor: () => h.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { createHelpTopic, updateHelpTopic, deleteHelpTopic, reorderHelpTopics } from "./actions";
import { listNotes, addNote } from "../notes/actions";

const initial = { error: null };
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const topic = (id: string, sortOrder: number, tenantId = TENANT.id) => ({ id, tenantId, title: id, content: "<p>x</p>", sortOrder, status: "Active" });

beforeEach(() => {
  h.db = createFakeDb();
  h.user = makeUser("Admin");
});

describe("[security] Help Center topics are Admin-managed (GAS HelpContent.js)", () => {
  it.each(["Manager", "Recruiter", "BenchSales", "HR"])("%s can't add, edit, delete or reorder topics", async (role) => {
    h.db.helpTopic.rows.push(topic("a", 1));
    h.user = makeUser(role);
    expect((await createHelpTopic(initial, form({ title: "T", content: "<p>c</p>" }))).error).toMatch(/Only Admins/);
    expect((await updateHelpTopic("a", initial, form({ title: "T", content: "<p>c</p>" }))).error).toMatch(/Only Admins/);
    expect((await deleteHelpTopic("a")).error).toMatch(/Only Admins/);
    await expect(reorderHelpTopics(["a"])).rejects.toThrow(/Only Admins/);
    expect(h.db.helpTopic.rows).toEqual([topic("a", 1)]);
  });

  it("strips scripts, event handlers and links from topic content on save", async () => {
    await createHelpTopic(initial, form({ title: "Visas", content: '<h4 onclick="x()">H1B</h4><script>steal()</script><p>ok <a href="javascript:x">l</a></p><img src=x onerror=y>' }));
    expect(h.db.helpTopic.rows[0].content).toBe("<h4>H1B</h4><p>ok l</p>");
  });

  it("[negative] rejects content that's empty once sanitized, and a blank title", async () => {
    expect((await createHelpTopic(initial, form({ title: "T", content: "<script>only()</script>" }))).error).toMatch(/Content is required/);
    expect((await createHelpTopic(initial, form({ title: "  ", content: "<p>c</p>" }))).error).toMatch(/Title is required/);
    expect(h.db.helpTopic.rows).toHaveLength(0);
  });

  it("new topics go to the end; reorder renumbers and refuses a stale/foreign id list", async () => {
    h.db.helpTopic.rows.push(topic("a", 1), topic("b", 2), topic("z", 1, OTHER_TENANT_ID));
    await createHelpTopic(initial, form({ title: "C", content: "<p>c</p>" }));
    expect(h.db.helpTopic.rows.at(-1)!.sortOrder).toBe(3);
    const c = h.db.helpTopic.rows.at(-1)!.id as string;
    expect((await reorderHelpTopics(["b", "a"])).error).toMatch(/changed/); // missing c
    expect((await reorderHelpTopics(["b", "a", "z"])).error).toMatch(/changed/); // foreign id
    expect((await reorderHelpTopics([c, "b", "a"])).error).toBeNull();
    const order = h.db.helpTopic.rows.filter((r) => r.tenantId === TENANT.id).sort((x, y) => (x.sortOrder as number) - (y.sortOrder as number)).map((r) => r.id);
    expect(order).toEqual([c, "b", "a"]);
  });

  it("[module] a save returns the topic id so the page can reopen that topic", async () => {
    h.db.helpTopic.rows.push(topic("a", 1));
    const created = await createHelpTopic(initial, form({ title: "New", content: "<p>c</p>" }));
    expect(created.error).toBeNull();
    expect(created.savedId).toBe(h.db.helpTopic.rows.at(-1)!.id);
    expect(await updateHelpTopic("a", initial, form({ title: "A2", content: "<p>c</p>" }))).toEqual({ error: null, savedId: "a" });
  });

  it("[security] can't edit or delete another tenant's topic", async () => {
    h.db.helpTopic.rows.push(topic("z", 1, OTHER_TENANT_ID));
    expect((await updateHelpTopic("z", initial, form({ title: "T", content: "<p>c</p>" }))).error).toBe("Topic not found.");
    expect((await deleteHelpTopic("z")).error).toBe("Topic not found.");
  });
});

describe("[security] bench notes are hidden from roles without Bench Sales", () => {
  it.each(["Recruiter", "HR"])("%s can't read or add bench notes", async (role) => {
    h.user = makeUser(role);
    for (const noteModule of ["bench_consultant", "bench_submission", "bench_interview", "bench_board"] as const) {
      await expect(listNotes(noteModule, "r1")).rejects.toThrow(/access to Bench Sales/);
      await expect(addNote(noteModule, "r1", null, form({ body: "hi" }))).rejects.toThrow(/access to Bench Sales/);
    }
    expect(h.db.note.rows).toHaveLength(0);
  });

  it("Recruiters can still use recruitment notes; BenchSales can use bench notes", async () => {
    h.user = makeUser("Recruiter");
    expect(await addNote("submission", "r1", null, form({ body: "hi" }))).toBeNull();
    h.user = makeUser("BenchSales");
    expect(await addNote("bench_board", "board", null, form({ body: "team note" }))).toBeNull();
    expect(h.db.note.rows).toHaveLength(2);
  });

  it.each(["Recruiter", "HR", "BenchSales"])("[module] %s can use the Recruitment team notes board", async (role) => {
    h.user = makeUser(role);
    expect(await addNote("recruitment_board", "board", null, form({ body: "team note" }))).toBeNull();
    expect((await listNotes("recruitment_board", "board")).map((n) => n.body)).toContain("team note");
  });
});

describe("[security] who may delete a note", () => {
  beforeEach(() => {
    h.db.note.rows.push(
      { id: "n-own", tenantId: TENANT.id, module: "submission", recordId: "r1", userId: "user-recruiter", body: "mine", createdAt: new Date(), user: { name: "R" } },
      { id: "n-other", tenantId: TENANT.id, module: "submission", recordId: "r1", userId: "someone", body: "theirs", createdAt: new Date(), user: { name: "S" } }
    );
  });

  it("authors can delete their own notes but not others'", async () => {
    h.user = makeUser("Recruiter");
    const notes = await listNotes("submission", "r1");
    expect(Object.fromEntries(notes.map((n) => [n.id, n.canDelete]))).toEqual({ "n-own": true, "n-other": false });
  });

  it.each(["Admin", "Manager"])("%s can delete anyone's note — offered in the list, matching deleteNote", async (role) => {
    h.user = makeUser(role);
    const notes = await listNotes("submission", "r1");
    expect(notes.every((n) => n.canDelete)).toBe(true);
  });
});
