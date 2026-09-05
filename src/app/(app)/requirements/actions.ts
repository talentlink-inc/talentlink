"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { REQUIREMENT_STATUSES } from "@/lib/recruitment";
import { canManageRecruitment } from "@/lib/users";

const PERMISSION_ERROR = "Your role only has view access to Requirements.";

const requirementSchema = z.object({
  jobId: z.string().trim().min(1, "Job ID is required"),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  clientName: z.string().trim().optional(),
  status: z.enum(REQUIREMENT_STATUSES),
  priority: z.coerce.number().int().min(0).max(5),
  employmentType: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  visa: z.string().trim().optional(),
  workLocation: z.string().trim().optional(),
  country: z.string().trim().optional(),
  isRemote: z.coerce.boolean().optional(),
  billRate: z.coerce.number().optional().nullable(),
  payRate: z.coerce.number().optional().nullable(),
  mandatorySkills: z.string().trim().optional(),
  jobDescription: z.string().trim().optional(),
  cpocRaw: z.string().trim().optional(),
});

function parseForm(formData: FormData) {
  return requirementSchema.safeParse({
    jobId: formData.get("jobId"),
    jobTitle: formData.get("jobTitle"),
    clientName: formData.get("clientName") || undefined,
    status: formData.get("status"),
    priority: formData.get("priority"),
    employmentType: formData.get("employmentType") || undefined,
    duration: formData.get("duration") || undefined,
    visa: formData.get("visa") || undefined,
    workLocation: formData.get("workLocation") || undefined,
    country: formData.get("country") || undefined,
    isRemote: formData.get("isRemote") === "on",
    billRate: formData.get("billRate") || null,
    payRate: formData.get("payRate") || null,
    mandatorySkills: formData.get("mandatorySkills") || undefined,
    jobDescription: formData.get("jobDescription") || undefined,
    cpocRaw: formData.get("cpocRaw") || undefined,
  });
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

  try {
    await db.requirement.create({
      data: {
        ...parsed.data,
        tenantId: tenant.id,
        postedByUserId: user.id,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return `Job ID "${parsed.data.jobId}" already exists.`;
    }
    throw err;
  }

  revalidatePath("/requirements");
  return null;
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

  try {
    await db.requirement.update({
      where: { id, tenantId: tenant.id },
      data: parsed.data,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return `Job ID "${parsed.data.jobId}" already exists.`;
    }
    throw err;
  }

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
