"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { candidateIdentityHash } from "@/lib/candidates";
import {
  SUBMISSION_STATUSES,
  isRejectedStatus,
  isQualifyingPlacementStatus,
  shouldClearPlacementId,
} from "@/lib/recruitment";
import { supabaseAdmin, RESUME_BUCKET } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10MB, matches ITStaffing's cap

export type SubmissionFormState = {
  error: string | null;
  needsConfirmation: boolean;
  warningMessage: string | null;
};

const initialFormState: SubmissionFormState = {
  error: null,
  needsConfirmation: false,
  warningMessage: null,
};

const candidateSchema = z.object({
  requirementId: z.string().trim().min(1, "Select a requirement"),
  candidateName: z.string().trim().min(1, "Candidate name is required"),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  currentLocation: z.string().trim().optional(),
  totalExperienceYears: z.coerce.number().optional().nullable(),
  visaStatus: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  employmentType: z.string().trim().optional(),
  roleWithSkills: z.string().trim().optional(),
  billRate: z.coerce.number().optional().nullable(),
  payRate: z.coerce.number().optional().nullable(),
});

function parseForm(formData: FormData) {
  return candidateSchema.safeParse({
    requirementId: formData.get("requirementId"),
    candidateName: formData.get("candidateName"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    currentLocation: formData.get("currentLocation") || undefined,
    totalExperienceYears: formData.get("totalExperienceYears") || null,
    visaStatus: formData.get("visaStatus") || undefined,
    linkedinUrl: formData.get("linkedinUrl") || undefined,
    employmentType: formData.get("employmentType") || undefined,
    roleWithSkills: formData.get("roleWithSkills") || undefined,
    billRate: formData.get("billRate") || null,
    payRate: formData.get("payRate") || null,
  });
}

async function uploadResumeIfPresent(
  formData: FormData,
  tenantId: string,
  candidateId: string
): Promise<string | null> {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > MAX_RESUME_BYTES) {
    throw new Error("Resume must be under 10MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileSha256 = createHash("sha256").update(buffer).digest("hex");

  const existing = await prisma.resume.findFirst({ where: { tenantId, fileSha256 } });
  if (existing) return existing.id;

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${tenantId}/${candidateId}/${fileSha256}-${safeFileName}`;
  const { error } = await supabaseAdmin.storage
    .from(RESUME_BUCKET)
    .upload(storagePath, buffer, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Resume upload failed: ${error.message}`);

  const resume = await prisma.resume.create({
    data: {
      tenantId,
      candidateId,
      fileUrl: storagePath,
      fileName: file.name,
      fileMime: file.type || null,
      fileSizeBytes: buffer.byteLength,
      fileSha256,
      source: "manual_upload",
    },
  });
  return resume.id;
}

export async function createSubmission(
  _prevState: SubmissionFormState,
  formData: FormData
): Promise<SubmissionFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ...initialFormState, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const force = formData.get("force") === "true";

  const tenant = await getCurrentTenant();
  const user = await getCurrentUser();

  const email = data.email || null;
  const phone = data.phone || null;
  const identityHash = candidateIdentityHash(email, phone, data.candidateName);

  const existingCandidate = await prisma.candidate.findUnique({
    where: { tenantId_identityHash: { tenantId: tenant.id, identityHash } },
  });

  if (existingCandidate) {
    const existingForSameRequirement = await prisma.submission.findFirst({
      where: {
        tenantId: tenant.id,
        candidateId: existingCandidate.id,
        requirementId: data.requirementId,
        deletedAt: null,
      },
    });
    if (existingForSameRequirement) {
      return {
        ...initialFormState,
        error: `${data.candidateName} is already submitted against this requirement (status: ${existingForSameRequirement.status}). Edit the existing submission instead.`,
      };
    }

    if (!force) {
      const otherSubmissionCount = await prisma.submission.count({
        where: { tenantId: tenant.id, candidateId: existingCandidate.id, deletedAt: null },
      });
      if (otherSubmissionCount > 0) {
        return {
          error: null,
          needsConfirmation: true,
          warningMessage: `${data.candidateName} already has ${otherSubmissionCount} other submission(s) on file. Submit anyway?`,
        };
      }
    }
  }

  const candidate = await prisma.candidate.upsert({
    where: { tenantId_identityHash: { tenantId: tenant.id, identityHash } },
    update: {
      name: data.candidateName,
      email,
      phone,
      currentLocation: data.currentLocation || null,
      totalExperienceYears: data.totalExperienceYears ?? null,
      visaStatus: data.visaStatus || null,
      linkedinUrl: data.linkedinUrl || null,
    },
    create: {
      tenantId: tenant.id,
      identityHash,
      name: data.candidateName,
      email,
      phone,
      currentLocation: data.currentLocation || null,
      totalExperienceYears: data.totalExperienceYears ?? null,
      visaStatus: data.visaStatus || null,
      linkedinUrl: data.linkedinUrl || null,
    },
  });

  let resumeId: string | null = null;
  try {
    resumeId = await uploadResumeIfPresent(formData, tenant.id, candidate.id);
  } catch (err) {
    return { ...initialFormState, error: err instanceof Error ? err.message : "Resume upload failed." };
  }

  await prisma.submission.create({
    data: {
      tenantId: tenant.id,
      candidateId: candidate.id,
      requirementId: data.requirementId,
      resumeId,
      recruiterUserId: user.id,
      recruiterNameRaw: user.name,
      employmentType: data.employmentType || null,
      roleWithSkills: data.roleWithSkills || null,
      billRate: data.billRate ?? null,
      payRate: data.payRate ?? null,
      submissionDate: new Date(),
      status: "New_Resume",
    },
  });

  revalidatePath("/submissions");
  revalidatePath("/placements");
  return initialFormState;
}

const editSchema = candidateSchema.extend({
  status: z.enum(SUBMISSION_STATUSES),
  rejectReason: z.string().trim().optional(),
});

export async function updateSubmission(
  id: string,
  _prevState: SubmissionFormState,
  formData: FormData
): Promise<SubmissionFormState> {
  const parsed = editSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    totalExperienceYears: formData.get("totalExperienceYears") || null,
    billRate: formData.get("billRate") || null,
    payRate: formData.get("payRate") || null,
  });
  if (!parsed.success) {
    return { ...initialFormState, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  if (isRejectedStatus(data.status) && !data.rejectReason) {
    return { ...initialFormState, error: "A reject reason is required for this status." };
  }

  const tenant = await getCurrentTenant();
  const existing = await prisma.submission.findUnique({ where: { id, tenantId: tenant.id } });
  if (!existing) {
    return { ...initialFormState, error: "Submission not found." };
  }

  let resumeId = existing.resumeId;
  try {
    const uploaded = await uploadResumeIfPresent(formData, tenant.id, existing.candidateId);
    if (uploaded) resumeId = uploaded;
  } catch (err) {
    return { ...initialFormState, error: err instanceof Error ? err.message : "Resume upload failed." };
  }

  const clearPlacement = shouldClearPlacementId(data.status, !!existing.placementId);
  const assignPlacement = isQualifyingPlacementStatus(data.status) && !existing.placementId;

  let placementId = existing.placementId;
  if (clearPlacement) {
    placementId = null;
  } else if (assignPlacement) {
    const count = await prisma.submission.count({
      where: { tenantId: tenant.id, placementId: { not: null } },
    });
    placementId = `PLC-${String(count + 1).padStart(4, "0")}`;
  }

  await prisma.candidate.update({
    where: { id: existing.candidateId },
    data: {
      name: data.candidateName,
      email: data.email || null,
      phone: data.phone || null,
      currentLocation: data.currentLocation || null,
      totalExperienceYears: data.totalExperienceYears ?? null,
      visaStatus: data.visaStatus || null,
      linkedinUrl: data.linkedinUrl || null,
    },
  });

  await prisma.submission.update({
    where: { id, tenantId: tenant.id },
    data: {
      requirementId: data.requirementId,
      resumeId,
      employmentType: data.employmentType || null,
      roleWithSkills: data.roleWithSkills || null,
      billRate: data.billRate ?? null,
      payRate: data.payRate ?? null,
      status: data.status,
      rejectReason: isRejectedStatus(data.status) ? data.rejectReason : null,
      placementId,
      selectedDate:
        assignPlacement && !existing.selectedDate ? new Date() : existing.selectedDate,
    },
  });

  revalidatePath("/submissions");
  revalidatePath("/placements");
  return initialFormState;
}

export async function deleteSubmission(id: string) {
  const tenant = await getCurrentTenant();
  await prisma.submission.update({
    where: { id, tenantId: tenant.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/submissions");
  revalidatePath("/placements");
}
