"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench, canDeleteAnyBenchConsultant } from "@/lib/users";
import { isQualifyingPlacementStatus, isRejectedStatus, SUBMISSION_STATUSES } from "@/lib/recruitment";
import { benchSubmissionSchema, normalizeCompany } from "@/lib/schemas/benchSubmission";
import { nextBenchPlacementId, withNewBenchSubmissionCode } from "@/lib/benchIds";

const PERMISSION_ERROR = "You don't have access to Bench Sales.";

export type BenchSubmissionFormState = { error: string | null; duplicateId?: string };
const initialState: BenchSubmissionFormState = { error: null };

type TenantDb = Awaited<ReturnType<typeof getTenantDb>>;

function readForm(formData: FormData) {
  return {
    benchConsultantId: formData.get("benchConsultantId") ?? "",
    companyName: formData.get("companyName") ?? "",
    contactPerson: formData.get("contactPerson") || undefined,
    contactNumber: formData.get("contactNumber") || undefined,
    email: formData.get("email") || undefined,
    rate: formData.get("rate") || undefined,
    status: formData.get("status") || "Vender_Submission",
    rejectReason: formData.get("rejectReason") || undefined,
    notes: formData.get("notes") || undefined,
  };
}

// GAS hard duplicate block: same consultant + same company.
async function findDuplicate(db: TenantDb, tenantId: string, consultantId: string, company: string, excludeId?: string) {
  const candidates = await db.benchSubmission.findMany({
    where: { tenantId, benchConsultantId: consultantId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, submissionCode: true, companyName: true },
  });
  const key = normalizeCompany(company);
  return candidates.find((c) => normalizeCompany(c.companyName) === key) ?? null;
}

async function liveConsultant(db: TenantDb, tenantId: string, id: string) {
  return db.benchConsultant.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true, consultantName: true },
  });
}

export async function createBenchSubmission(
  _prev: BenchSubmissionFormState,
  formData: FormData
): Promise<BenchSubmissionFormState> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };

  const parsed = benchSubmissionSchema().safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const consultant = await liveConsultant(db, tenant.id, data.benchConsultantId);
  if (!consultant) return { error: "That bench consultant no longer exists." };

  const dup = await findDuplicate(db, tenant.id, consultant.id, data.companyName);
  if (dup) {
    return {
      error: `Duplicate submission blocked: ${consultant.consultantName} is already submitted to ${dup.companyName} (${dup.submissionCode}). Edit the existing submission instead.`,
      duplicateId: dup.id,
    };
  }

  const placementId = isQualifyingPlacementStatus(data.status) ? await nextBenchPlacementId(db, tenant.id) : null;
  const now = new Date();
  await withNewBenchSubmissionCode(db, tenant.id, (submissionCode) =>
    db.benchSubmission.create({
      data: {
        tenantId: tenant.id,
        submissionCode,
        benchConsultantId: consultant.id,
        companyName: data.companyName,
        contactPerson: data.contactPerson || null,
        contactNumber: data.contactNumber || null,
        email: data.email || null,
        rate: data.rate || null,
        status: data.status,
        rejectReason: isRejectedStatus(data.status) ? data.rejectReason ?? null : null,
        notes: data.notes || null,
        submittedByUserId: user.id,
        submittedByNameRaw: user.name,
        submissionDate: now,
        placementId,
        selectedDate: placementId ? now : null,
      },
    })
  );

  revalidatePath("/bench", "layout");
  return initialState;
}

export async function updateBenchSubmission(
  id: string,
  _prev: BenchSubmissionFormState,
  formData: FormData
): Promise<BenchSubmissionFormState> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.benchSubmission.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!existing) return { error: "Submission not found." };

  const parsed = benchSubmissionSchema(existing.status).safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  if (data.benchConsultantId !== existing.benchConsultantId) {
    if (!(await liveConsultant(db, tenant.id, data.benchConsultantId))) {
      return { error: "That bench consultant no longer exists." };
    }
  }
  const dup = await findDuplicate(db, tenant.id, data.benchConsultantId, data.companyName, id);
  if (dup) {
    return { error: `Duplicate submission blocked: already submitted to ${dup.companyName} (${dup.submissionCode}).`, duplicateId: dup.id };
  }

  // GAS _maybeGenerateBenchPlacementId_: a placement id is minted the first
  // time a qualifying status is reached and is never cleared afterwards, so
  // a placement that later falls through stays in placement history.
  const assignPlacement = isQualifyingPlacementStatus(data.status) && !existing.placementId;
  const placementId = assignPlacement ? await nextBenchPlacementId(db, tenant.id) : existing.placementId;

  await db.benchSubmission.update({
    where: { id, tenantId: tenant.id },
    data: {
      benchConsultantId: data.benchConsultantId,
      companyName: data.companyName,
      contactPerson: data.contactPerson || null,
      contactNumber: data.contactNumber || null,
      email: data.email || null,
      rate: data.rate || null,
      status: data.status,
      // Moving to a non-reject status clears a stale reason (GAS parity).
      rejectReason: isRejectedStatus(data.status) ? data.rejectReason ?? null : null,
      notes: data.notes || null,
      placementId,
      selectedDate: assignPlacement && !existing.selectedDate ? new Date() : existing.selectedDate,
    },
  });

  revalidatePath("/bench", "layout");
  return initialState;
}

// GAS deleteBenchSubmission: Admin/Manager only, and never while interviews
// reference it.
export async function deleteBenchSubmission(id: string): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };
  if (!canDeleteAnyBenchConsultant(user.role)) return { error: "Only an Admin or Manager can delete bench submissions." };

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.benchSubmission.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!existing) return { error: "Submission not found." };

  const interviewCount = await db.benchInterview.count({
    where: { tenantId: tenant.id, benchSubmissionId: id, deletedAt: null },
  });
  if (interviewCount > 0) {
    return { error: `Cannot delete: ${interviewCount} interview(s) are linked to this submission. Remove them first.` };
  }

  await db.benchSubmission.update({ where: { id, tenantId: tenant.id }, data: { deletedAt: new Date() } });
  revalidatePath("/bench", "layout");
  return { error: null };
}

// Placements tab edits (GAS updateBenchPlacementDOJ / BillRate + status).
const placementSchema = z.object({
  status: z.string(),
  doj: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), { message: "Enter a valid date of joining" }),
  billRate: z.string().trim().max(100).optional(),
  rejectReason: z.string().trim().optional(),
});

export async function updateBenchPlacement(
  id: string,
  _prev: BenchSubmissionFormState,
  formData: FormData
): Promise<BenchSubmissionFormState> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.benchSubmission.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!existing) return { error: "Placement not found." };

  const parsed = placementSchema.safeParse({
    status: formData.get("status") ?? existing.status,
    doj: formData.get("doj") || undefined,
    billRate: formData.get("billRate") || undefined,
    rejectReason: formData.get("rejectReason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const allowed = new Set<string>([...SUBMISSION_STATUSES, existing.status]);
  if (!allowed.has(data.status)) return { error: "Select a valid status." };
  if (isRejectedStatus(data.status) && !data.rejectReason) return { error: "A reject reason is required for this status." };

  await db.benchSubmission.update({
    where: { id, tenantId: tenant.id },
    data: {
      status: data.status,
      doj: data.doj ? new Date(data.doj) : null,
      billRate: data.billRate || null,
      rejectReason: isRejectedStatus(data.status) ? data.rejectReason ?? null : null,
    },
  });
  revalidatePath("/bench", "layout");
  return initialState;
}
