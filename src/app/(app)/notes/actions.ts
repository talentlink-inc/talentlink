"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";

export type NoteModule = "requirement" | "submission" | "interview";

export async function listNotes(module: NoteModule, recordId: string) {
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
  return null;
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
}
