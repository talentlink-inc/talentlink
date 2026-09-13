"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { REQUIREMENT_STATUSES } from "@/lib/recruitment";
import { canManageRecruitment } from "@/lib/users";

const PERMISSION_ERROR = "Your role only has view access to Requirements.";

// Mandatory-field set mirrors the original ITStaffing (Google Apps Script)
// Requirements form validation (PageRecruitment.html: reqSaveRequirement) —
// Client Name, Job Description, Duration, Mandatory Skills, Country, Bill
// Rate, and Employment Type are all required there, plus Visa (only when
// Country includes USA) and Work Location (only when not Remote). Job ID
// isn't part of the form at all there — it's auto-generated (generateJobId
// in the original Recruitment.js), see generateJobId below.
const requirementSchema = z
  .object({
    jobTitle: z.string().trim().min(1, "Job title is required"),
    clientName: z.string().trim().min(1, "Client name is required"),
    status: z.enum(REQUIREMENT_STATUSES),
    priority: z.coerce.number().int().min(0).max(5),
    employmentType: z.string().trim().min(1, "Employment type is required"),
    duration: z.string().trim().min(1, "Duration is required"),
    visa: z.string().trim().optional(),
    workLocation: z.string().trim().optional(),
    country: z.string().trim().min(1, "Country is required"),
    isRemote: z.coerce.boolean().optional(),
    billRate: z.string().trim().min(1, "Bill rate is required").transform(Number),
    payRate: z.coerce.number().optional().nullable(),
    mandatorySkills: z.string().trim().min(1, "Mandatory skills is required"),
    jobDescription: z.string().trim().min(1, "Job description is required"),
    cpocRaw: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isRemote && !data.workLocation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workLocation"],
        message: "Work location is required (or check Remote)",
      });
    }
    if (data.country.toUpperCase().includes("USA") && !data.visa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visa"],
        message: "Visa is required for USA roles",
      });
    }
  });

function parseForm(formData: FormData) {
  return requirementSchema.safeParse({
    jobTitle: formData.get("jobTitle"),
    clientName: formData.get("clientName") ?? "",
    status: formData.get("status"),
    priority: formData.get("priority"),
    employmentType: formData.get("employmentType") ?? "",
    duration: formData.get("duration") ?? "",
    visa: formData.get("visa") || undefined,
    workLocation: formData.get("workLocation") || undefined,
    country: formData.get("country") ?? "",
    isRemote: formData.get("isRemote") === "on",
    billRate: formData.get("billRate") ?? "",
    payRate: formData.get("payRate") || null,
    mandatorySkills: formData.get("mandatorySkills") ?? "",
    jobDescription: formData.get("jobDescription") ?? "",
    cpocRaw: formData.get("cpocRaw") || undefined,
  });
}

// Mirrors the original app's generateJobId (a monotonic counter that's never
// reused after a delete), but zero-padded to 4 digits — "JOB-0001" — to match
// this app's own SUB-0001/PLC-0001 convention rather than the original's
// 3-digit one. There's no Script Properties equivalent here, but
// requirements are only ever soft-deleted (deletedAt), so the max JobID
// already on record — deleted rows included — gives the same never-reused
// guarantee without a separate counter to maintain. See
// scripts/renumber-job-ids.ts, which brought existing rows onto this scheme.
async function generateJobId(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  tenantId: string
): Promise<string> {
  const rows = await db.requirement.findMany({
    where: { tenantId },
    select: { jobId: true },
  });
  let max = 0;
  for (const { jobId } of rows) {
    const match = jobId.match(/^JOB-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `JOB-${String(max + 1).padStart(4, "0")}`;
}

export async function createRequirement(_prevState: string | null, formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) return PERMISSION_ERROR;

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input";
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();

  // Retries a few times in the rare case two requirements are created in
  // the same instant and land on the same generated Job ID.
  for (let attempt = 0; attempt < 5; attempt++) {
    const jobId = await generateJobId(db, tenant.id);
    try {
      await db.requirement.create({
        data: {
          ...parsed.data,
          jobId,
          tenantId: tenant.id,
          postedByUserId: user.id,
        },
      });
      revalidatePath("/requirements");
      return null;
    } catch (err) {
      const isConflict = err instanceof Error && err.message.includes("Unique constraint");
      if (!isConflict || attempt === 4) throw err;
    }
  }
  throw new Error("Could not generate a unique Job ID after several attempts.");
}

export async function updateRequirement(
  id: string,
  _prevState: string | null,
  formData: FormData
) {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) return PERMISSION_ERROR;

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input";
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();

  // Job ID is immutable once created (never part of the edit form), so the
  // update never touches it.
  await db.requirement.update({
    where: { id, tenantId: tenant.id },
    data: parsed.data,
  });

  revalidatePath("/requirements");
  return null;
}

export async function deleteRequirement(id: string) {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) throw new Error(PERMISSION_ERROR);

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.requirement.update({
    where: { id, tenantId: tenant.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/requirements");
}
