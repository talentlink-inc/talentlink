"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin, RESUME_BUCKET } from "@/lib/supabase/admin";
import { canAccessBench, canDeleteAnyBenchConsultant } from "@/lib/users";
import { BENCH_CONSULTANT_STATUSES } from "@/lib/bench";
import { benchConsultantSchema, titleCaseName } from "@/lib/schemas/benchConsultant";
import { withNewConsultantCode } from "@/lib/benchIds";

const PERMISSION_ERROR = "You don't have access to Bench Sales.";
const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ALLOWED_RESUME_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type ConsultantFormState = { error: string | null };
const initialState: ConsultantFormState = { error: null };

async function requireBenchUser() {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) throw new Error(PERMISSION_ERROR);
  return user;
}

function parseForm(formData: FormData) {
  return benchConsultantSchema.safeParse({
    consultantName: formData.get("consultantName") ?? "",
    role: formData.get("role") ?? "",
    technologySkills: formData.get("technologySkills") ?? "",
    visaStatus: formData.get("visaStatus") ?? "",
    relocation: formData.get("relocation") || undefined,
    experience: formData.get("experience") ?? "",
    location: formData.get("location") ?? "",
    availability: formData.get("availability") ?? "",
    payRate: formData.get("payRate") ?? "",
    marketingRate: formData.get("marketingRate") || undefined,
    status: formData.get("status") || undefined,
    linkedinUrl: formData.get("linkedinUrl") || undefined,
    marketerUserId: formData.get("marketerUserId") || undefined,
  });
}

// Validated file → stored in Supabase Storage under the tenant's own prefix.
// Returns null when no file was chosen (resume is optional on bench, as in GAS).
async function uploadResumeIfPresent(formData: FormData, tenantId: string, consultantKey: string) {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_RESUME_BYTES) throw new Error("Resume must be under 10MB.");
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const mimeAllowed = !file.type || ALLOWED_RESUME_MIME_TYPES.has(file.type);
  if (!ALLOWED_RESUME_EXTENSIONS.includes(extension) || !mimeAllowed) {
    throw new Error("Resume must be a .pdf, .doc, or .docx file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha = createHash("sha256").update(buffer).digest("hex");
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${tenantId}/bench/${consultantKey}/${sha}-${safeFileName}`;
  const { error } = await getSupabaseAdmin()
    .storage.from(RESUME_BUCKET)
    .upload(storagePath, buffer, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Resume upload failed: ${error.message}`);
  return { resumeFileUrl: storagePath, resumeFileName: file.name, resumeFileMime: file.type || null };
}

// The marketer dropdown posts a user id; resolve it to a real active user in
// this tenant (falling back to the current user) rather than trusting it.
async function resolveMarketer(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  tenantId: string,
  requestedId: string | undefined,
  fallback: { id: string; name: string }
) {
  if (!requestedId || requestedId === fallback.id) return fallback;
  const user = await db.user.findFirst({
    where: { id: requestedId, tenantId, status: "active" },
    select: { id: true, name: true },
  });
  return user ?? fallback;
}

export async function createBenchConsultant(
  _prev: ConsultantFormState,
  formData: FormData
): Promise<ConsultantFormState> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const marketer = await resolveMarketer(db, tenant.id, data.marketerUserId, user);

  let resume: Awaited<ReturnType<typeof uploadResumeIfPresent>> = null;
  try {
    resume = await uploadResumeIfPresent(formData, tenant.id, `new-${Date.now()}`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Resume upload failed." };
  }

  await withNewConsultantCode(db, tenant.id, (consultantCode) =>
    db.benchConsultant.create({
      data: {
        tenantId: tenant.id,
        consultantCode,
        consultantName: titleCaseName(data.consultantName),
        role: data.role,
        technologySkills: data.technologySkills,
        visaStatus: data.visaStatus,
        relocation: data.relocation,
        experience: data.experience,
        location: data.location,
        availability: data.availability,
        payRate: data.payRate,
        marketingRate: data.marketingRate || null,
        status: data.status,
        linkedinUrl: data.linkedinUrl || null,
        marketerUserId: marketer.id,
        marketerNameRaw: marketer.name,
        ...(resume ?? {}),
      },
    })
  );

  revalidatePath("/bench", "layout");
  return initialState;
}

export async function updateBenchConsultant(
  id: string,
  _prev: ConsultantFormState,
  formData: FormData
): Promise<ConsultantFormState> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.benchConsultant.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!existing) return { error: "Consultant not found." };

  // Keep the current marketer unless a different one was actually chosen —
  // an imported consultant's marketer may not be a linked user at all.
  let marketerUpdate: { marketerUserId?: string; marketerNameRaw?: string } = {};
  if (data.marketerUserId && data.marketerUserId !== existing.marketerUserId) {
    const marketer = await resolveMarketer(db, tenant.id, data.marketerUserId, {
      id: existing.marketerUserId ?? user.id,
      name: existing.marketerNameRaw ?? user.name,
    });
    marketerUpdate = { marketerUserId: marketer.id, marketerNameRaw: marketer.name };
  }

  let resume: Awaited<ReturnType<typeof uploadResumeIfPresent>> = null;
  try {
    resume = await uploadResumeIfPresent(formData, tenant.id, existing.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Resume upload failed." };
  }

  await db.benchConsultant.update({
    where: { id, tenantId: tenant.id },
    data: {
      consultantName: titleCaseName(data.consultantName),
      role: data.role,
      technologySkills: data.technologySkills,
      visaStatus: data.visaStatus,
      relocation: data.relocation,
      experience: data.experience,
      location: data.location,
      availability: data.availability,
      payRate: data.payRate,
      marketingRate: data.marketingRate || null,
      status: data.status,
      linkedinUrl: data.linkedinUrl || null,
      ...marketerUpdate,
      ...(resume ?? {}),
    },
  });

  revalidatePath("/bench", "layout");
  return initialState;
}

export async function updateBenchConsultantStatus(id: string, status: string) {
  await requireBenchUser();
  if (!(BENCH_CONSULTANT_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status value.");
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.benchConsultant.update({ where: { id, tenantId: tenant.id, deletedAt: null }, data: { status } });
  revalidatePath("/bench", "layout");
}

// GAS addToHotlist / removeFromHotlist: joining the hotlist marks it Active.
export async function setBenchConsultantHotlist(id: string, onHotlist: boolean) {
  await requireBenchUser();
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.benchConsultant.update({
    where: { id, tenantId: tenant.id, deletedAt: null },
    data: { onHotlist, hotlistStatus: onHotlist ? "Active" : null },
  });
  revalidatePath("/bench", "layout");
}

// GAS updateBenchConsultantAssignment — an empty id clears the assignment.
export async function assignBenchConsultant(id: string, assignedToUserId: string | null) {
  await requireBenchUser();
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  let assignee: { id: string; name: string } | null = null;
  if (assignedToUserId) {
    assignee = await db.user.findFirst({
      where: { id: assignedToUserId, tenantId: tenant.id, status: "active" },
      select: { id: true, name: true },
    });
    if (!assignee) throw new Error("That user isn't available for assignment.");
  }
  await db.benchConsultant.update({
    where: { id, tenantId: tenant.id, deletedAt: null },
    data: { assignedToUserId: assignee?.id ?? null, assignedToNameRaw: assignee?.name ?? null },
  });
  revalidatePath("/bench", "layout");
}

export async function deleteBenchConsultant(id: string): Promise<{ error: string | null }> {
  const user = await requireBenchUser();
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.benchConsultant.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!existing) return { error: "Consultant not found." };

  // GAS deleteBenchConsultant rules: non-Admin/Manager can only delete their
  // own, and never one that still has submissions referencing it.
  const isOwn =
    existing.marketerUserId === user.id ||
    (!existing.marketerUserId && existing.marketerNameRaw?.trim().toLowerCase() === user.name.trim().toLowerCase());
  if (!canDeleteAnyBenchConsultant(user.role) && !isOwn) {
    return { error: "You can only delete your own bench consultants." };
  }
  const refCount = await db.benchSubmission.count({
    where: { tenantId: tenant.id, benchConsultantId: id, deletedAt: null },
  });
  if (refCount > 0) {
    return {
      error: `Cannot delete: ${refCount} submission(s) reference ${existing.consultantName}. Remove them first.`,
    };
  }

  await db.benchConsultant.update({ where: { id, tenantId: tenant.id }, data: { deletedAt: new Date() } });
  revalidatePath("/bench", "layout");
  return { error: null };
}

// Marketer / Assigned-to dropdown source — active users in this tenant who
// can work bench (GAS getBenchSalesRoleUsers).
export async function getBenchUserOptions(): Promise<{ id: string; name: string }[]> {
  await requireBenchUser();
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  return db.user.findMany({
    where: { tenantId: tenant.id, status: "active", role: { in: ["Admin", "Manager", "BenchSales"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
