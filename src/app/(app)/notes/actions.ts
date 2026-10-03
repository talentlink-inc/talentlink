"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench } from "@/lib/users";

export type NoteModule =
  | "requirement"
  | "submission"
  | "interview"
  | "bench_consultant"
  | "bench_submission"
  | "bench_interview";

// Bench Sales is hidden from Recruiters/HR entirely, so its notes have to be
// too — the record ids alone aren't a secret worth relying on.
async function assertCanUseModule(module: NoteModule) {
  if (!module.startsWith("bench_")) return;
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) throw new Error("You don't have access to Bench Sales.");
}

export async function listNotes(module: NoteModule, recordId: string) {
  await assertCanUseModule(module);
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  return db.note.findMany({
    where: { tenantId: tenant.id, module, recordId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

const bodySchema = z.string().trim().min(1).max(4000);

export async function addNote(
  module: NoteModule,
  recordId: string,
  _prevState: string | null,
  formData: FormData
) {
  const parsed = bodySchema.safeParse(formData.get("body"));
  if (!parsed.success) return "Note can't be empty.";
  await assertCanUseModule(module);

  const tenant = await getCurrentTenant();
  const user = await getCurrentUser();
  const db = await getTenantDb();

  await db.note.create({
    data: {
      tenantId: tenant.id,
      module,
      recordId,
      userId: user.id,
      body: parsed.data,
    },
  });

  revalidatePath("/requirements");
  revalidatePath("/submissions");
  revalidatePath("/interviews");
  revalidatePath("/placements");
  revalidatePath("/bench", "layout");
  return null;
}

export async function updateNote(id: string, body: string) {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) throw new Error("Note can't be empty.");

  const tenant = await getCurrentTenant();
  const user = await getCurrentUser();
  const db = await getTenantDb();

  const note = await db.note.findUnique({ where: { id } });
  if (!note || note.tenantId !== tenant.id) throw new Error("Note not found.");
  if (note.userId !== user.id) throw new Error("Only the author can edit a note.");

  await db.note.update({ where: { id }, data: { body: parsed.data } });
  revalidatePath("/requirements");
  revalidatePath("/submissions");
  revalidatePath("/interviews");
  revalidatePath("/placements");
  revalidatePath("/bench", "layout");
}

export async function deleteNote(id: string) {
  const tenant = await getCurrentTenant();
  const user = await getCurrentUser();
  const db = await getTenantDb();

  const note = await db.note.findUnique({ where: { id } });
  if (!note || note.tenantId !== tenant.id) return;
  if (note.userId !== user.id && !["Admin", "Manager"].includes(user.role)) {
    throw new Error("Only the author or an Admin/Manager can delete a note.");
  }

  await db.note.delete({ where: { id } });
  revalidatePath("/requirements");
  revalidatePath("/submissions");
  revalidatePath("/interviews");
  revalidatePath("/placements");
  revalidatePath("/bench", "layout");
}
