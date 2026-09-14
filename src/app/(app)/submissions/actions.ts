"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { candidateIdentityHash } from "@/lib/candidates";
import {
  SUBMISSION_STATUSES,
  isRejectedStatus,
  isQualifyingPlacementStatus,
  shouldClearPlacementId,
} from "@/lib/recruitment";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { getSupabaseAdmin, RESUME_BUCKET } from "@/lib/supabase/admin";
import { canManageRecruitment, canManageUsers } from "@/lib/users";
import { callAiForJson, AiNotConfiguredError } from "@/lib/ai";
import { createHash } from "node:crypto";

const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10MB, matches ITStaffing's cap
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ALLOWED_RESUME_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
const PERMISSION_ERROR = "Your role only has view access to Submissions.";

export type SubmissionFormState = {
  error: string | null;
  needsConfirmation: boolean;
  warningMessage: string | null;
  duplicateSubmissionId?: string;
};

const initialFormState: SubmissionFormState = {
  error: null,
  needsConfirmation: false,
  warningMessage: null,
};

// Mandatory-field set mirrors the original ITStaffing (Google Apps Script)
// Submissions form (PageRecruitment.html: REC_MANDATORY_FIELD_IDS / recSubmitResume) —
// Email, Contact Number, Current Location, Total Experience, Pay Rate, Visa
// Status, Employment Type, and Role with Skills are all required there
// (Recruiter Name is too, but that's the current logged-in user here, not a
// form field). Bill Rate and LinkedIn URL were never on that mandatory list.
const LINKEDIN_URL_PATTERN = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/.+/i;
const PHONE_PATTERN = /^[0-9+\-() ]+$/;

const candidateSchema = z.object({
  requirementId: z.string().trim().min(1, "Select a requirement"),
  candidateName: z.string().trim().min(1, "Candidate name is required"),
  email: z.string().trim().min(1, "Email is required"),
  phone: z
    .string()
    .trim()
    .min(1, "Contact number is required")
    .regex(PHONE_PATTERN, "Phone number can only contain digits, spaces, and + - ( )"),
  country: z.string().trim().optional(),
  currentLocation: z.string().trim().min(1, "Current location is required"),
  totalExperienceYears: z
    .string()
    .trim()
    .min(1, "Total experience is required")
    .transform(Number)
    .pipe(z.number().nonnegative("Total experience cannot be negative")),
  visaStatus: z.string().trim().min(1, "Visa status is required"),
  linkedinUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || LINKEDIN_URL_PATTERN.test(v), {
      message: "Please enter a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/username)",
    }),
  employmentType: z.string().trim().min(1, "Employment type is required"),
  roleWithSkills: z.string().trim().min(1, "Role with skills is required"),
  billRate: z.coerce.number().nonnegative("Bill rate must be 0 or greater").optional().nullable(),
  billRateCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  payRate: z
    .string()
    .trim()
    .min(1, "Pay rate is required")
    .transform(Number)
    .pipe(z.number().nonnegative("Pay rate must be 0 or greater")),
  payRateCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
});

function parseForm(formData: FormData) {
  return candidateSchema.safeParse({
    requirementId: formData.get("requirementId"),
    candidateName: formData.get("candidateName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    country: formData.get("country") || undefined,
    currentLocation: formData.get("currentLocation") ?? "",
    totalExperienceYears: formData.get("totalExperienceYears") ?? "",
    visaStatus: formData.get("visaStatus") ?? "",
    linkedinUrl: formData.get("linkedinUrl") || undefined,
    employmentType: formData.get("employmentType") ?? "",
    roleWithSkills: formData.get("roleWithSkills") ?? "",
    billRate: formData.get("billRate") || null,
    billRateCurrency: formData.get("billRateCurrency") || "USD",
    payRate: formData.get("payRate") ?? "",
    payRateCurrency: formData.get("payRateCurrency") || "USD",
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

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const mimeAllowed = !file.type || ALLOWED_RESUME_MIME_TYPES.has(file.type);
  if (!ALLOWED_RESUME_EXTENSIONS.includes(extension) || !mimeAllowed) {
    throw new Error("Resume must be a .pdf, .doc, or .docx file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileSha256 = createHash("sha256").update(buffer).digest("hex");
  const db = await getTenantDb();

  const existing = await db.resume.findFirst({ where: { tenantId, fileSha256 } });
  if (existing) {
    // Same bytes, but re-uploaded under a different name (e.g. renamed before
    // resubmitting) — the stored metadata should reflect what was actually
    // just uploaded, not silently keep showing the first name that content
    // hash was ever seen under.
    if (existing.fileName !== file.name) {
      await db.resume.update({
        where: { id: existing.id },
        data: { fileName: file.name, fileMime: file.type || existing.fileMime },
      });
    }
    return existing.id;
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${tenantId}/${candidateId}/${fileSha256}-${safeFileName}`;
  const { error } = await getSupabaseAdmin()
    .storage.from(RESUME_BUCKET)
    .upload(storagePath, buffer, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Resume upload failed: ${error.message}`);

  const resume = await db.resume.create({
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

// Second, independent upload slot for visa/compliance docs (DL/Visa/I94/
// NDA) — mirrors the original's recDocDropZone. Simpler than resumes: no
// content-hash dedup, just stored straight onto the submission row's
// additionalDocUrl/additionalDocName (already present in schema, previously
// unwired).
async function uploadDocumentIfPresent(
  formData: FormData,
  tenantId: string,
  submissionId: string
): Promise<{ url: string; name: string } | null> {
  const file = formData.get("additionalDoc");
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("Document must be under 10MB.");
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) {
    throw new Error("Document must be a .pdf, .doc, .docx, .jpg, or .png file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${tenantId}/documents/${submissionId}-${Date.now()}-${safeFileName}`;
  const { error } = await getSupabaseAdmin()
    .storage.from(RESUME_BUCKET)
    .upload(storagePath, buffer, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Document upload failed: ${error.message}`);

  return { url: storagePath, name: file.name };
}

export async function createSubmission(
  _prevState: SubmissionFormState,
  formData: FormData
): Promise<SubmissionFormState> {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) return { ...initialFormState, error: PERMISSION_ERROR };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ...initialFormState, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const force = formData.get("force") === "true";

  // Resume upload is required on the original app's Add path (there's
  // nothing to fall back to yet — on Edit, an already-attached resume
  // satisfies the same check, so it isn't re-required there).
  const resumeFile = formData.get("resume");
  if (!(resumeFile instanceof File) || resumeFile.size === 0) {
    return { ...initialFormState, error: "Resume upload is required." };
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();

  const email = data.email || null;
  const phone = data.phone || null;
  const identityHash = candidateIdentityHash(email, phone, data.candidateName);

  const existingCandidate = await db.candidate.findUnique({
    where: { tenantId_identityHash: { tenantId: tenant.id, identityHash } },
  });

  if (existingCandidate) {
    const existingForSameRequirement = await db.submission.findFirst({
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
        duplicateSubmissionId: existingForSameRequirement.id,
      };
    }

    if (!force) {
      const otherSubmissionCount = await db.submission.count({
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

  const candidate = await db.candidate.upsert({
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

  const submissionCount = await db.submission.count({ where: { tenantId: tenant.id } });
  const submissionId = `SUB-${String(submissionCount + 1).padStart(4, "0")}`;

  let additionalDoc: { url: string; name: string } | null = null;
  try {
    additionalDoc = await uploadDocumentIfPresent(formData, tenant.id, submissionId);
  } catch (err) {
    return { ...initialFormState, error: err instanceof Error ? err.message : "Document upload failed." };
  }

  await db.submission.create({
    data: {
      tenantId: tenant.id,
      submissionId,
      candidateId: candidate.id,
      requirementId: data.requirementId,
      resumeId,
      recruiterUserId: user.id,
      recruiterNameRaw: user.name,
      employmentType: data.employmentType || null,
      roleWithSkills: data.roleWithSkills || null,
      country: data.country || null,
      billRate: data.billRate ?? null,
      billRateCurrency: data.billRateCurrency ?? "USD",
      payRate: data.payRate ?? null,
      payRateCurrency: data.payRateCurrency ?? "USD",
      additionalDocUrl: additionalDoc?.url ?? null,
      additionalDocName: additionalDoc?.name ?? null,
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
  recruiterUserId: z.string().trim().optional(),
});

export async function updateSubmission(
  id: string,
  _prevState: SubmissionFormState,
  formData: FormData
): Promise<SubmissionFormState> {
  const currentUser = await getCurrentUser();
  if (!canManageRecruitment(currentUser.role)) return { ...initialFormState, error: PERMISSION_ERROR };

  const parsed = editSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    totalExperienceYears: formData.get("totalExperienceYears") ?? "",
    billRate: formData.get("billRate") || null,
    payRate: formData.get("payRate") ?? "",
  });
  if (!parsed.success) {
    return { ...initialFormState, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  if (isRejectedStatus(data.status) && !data.rejectReason) {
    return { ...initialFormState, error: "A reject reason is required for this status." };
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.submission.findUnique({ where: { id, tenantId: tenant.id } });
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

  let additionalDocUrl = existing.additionalDocUrl;
  let additionalDocName = existing.additionalDocName;
  try {
    const uploadedDoc = await uploadDocumentIfPresent(formData, tenant.id, id);
    if (uploadedDoc) {
      additionalDocUrl = uploadedDoc.url;
      additionalDocName = uploadedDoc.name;
    }
  } catch (err) {
    return { ...initialFormState, error: err instanceof Error ? err.message : "Document upload failed." };
  }

  const clearPlacement = shouldClearPlacementId(data.status, !!existing.placementId);
  const assignPlacement = isQualifyingPlacementStatus(data.status) && !existing.placementId;

  let placementId = existing.placementId;
  if (clearPlacement) {
    placementId = null;
  } else if (assignPlacement) {
    const count = await db.submission.count({
      where: { tenantId: tenant.id, placementId: { not: null } },
    });
    placementId = `PLC-${String(count + 1).padStart(4, "0")}`;
  }

  await db.candidate.update({
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

  // Recruiter reassignment — mirrors the original's isAdminEditor gate on
  // the Recruiter Name dropdown: only an Admin can hand a submission to a
  // different recruiter. A non-admin posting this field (e.g. a stale form)
  // is silently ignored rather than erroring, since it isn't their edit to make.
  let recruiterUpdate: { recruiterUserId?: string; recruiterNameRaw?: string } = {};
  if (canManageUsers(currentUser.role) && data.recruiterUserId && data.recruiterUserId !== existing.recruiterUserId) {
    const newRecruiter = await db.user.findUnique({ where: { id: data.recruiterUserId, tenantId: tenant.id } });
    if (newRecruiter) {
      recruiterUpdate = { recruiterUserId: newRecruiter.id, recruiterNameRaw: newRecruiter.name };
    }
  }

  await db.submission.update({
    where: { id, tenantId: tenant.id },
    data: {
      requirementId: data.requirementId,
      resumeId,
      employmentType: data.employmentType || null,
      roleWithSkills: data.roleWithSkills || null,
      country: data.country || null,
      billRate: data.billRate ?? null,
      billRateCurrency: data.billRateCurrency ?? existing.billRateCurrency,
      payRate: data.payRate ?? null,
      payRateCurrency: data.payRateCurrency ?? existing.payRateCurrency,
      additionalDocUrl,
      additionalDocName,
      status: data.status,
      rejectReason: isRejectedStatus(data.status) ? data.rejectReason : null,
      placementId,
      selectedDate:
        assignPlacement && !existing.selectedDate ? new Date() : existing.selectedDate,
      ...recruiterUpdate,
    },
  });

  revalidatePath("/submissions");
  revalidatePath("/placements");
  return initialFormState;
}

export async function deleteSubmission(id: string) {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) throw new Error(PERMISSION_ERROR);

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.submission.update({
    where: { id, tenantId: tenant.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/submissions");
  revalidatePath("/placements");
}

// Recruiters an Admin can reassign a submission to — mirrors the original's
// Recruiter Name dropdown source list.
export async function getRecruiterOptions(): Promise<{ id: string; name: string }[]> {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const users = await db.user.findMany({
    where: { tenantId: tenant.id, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export type ParsedResumeFields = {
  candidateName?: string;
  email?: string;
  phone?: string;
  country?: string;
  currentLocation?: string;
  linkedinUrl?: string;
  totalExperienceYears?: number;
  visaStatus?: string;
  roleWithSkills?: string;
};

async function extractResumeText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (extension === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }
  if (extension === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // Legacy .doc (binary format) has no lightweight extractor here — AI
  // autofill just skips it silently, upload itself still works fine.
  return "";
}

// AI-assisted resume autofill (original's _recApplyParsedResume_) — only
// ever fills fields the recruiter left empty; never overwrites what's
// already typed. Takes the raw file from the client (not yet uploaded/
// validated as the real submission resume) purely to extract text for the
// AI call.
export async function parseResumeWithAI(formData: FormData): Promise<ParsedResumeFields> {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) throw new Error(PERMISSION_ERROR);

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a resume file first.");

  const text = (await extractResumeText(file)).trim();
  if (!text) return {};

  const tenant = await getCurrentTenant();
  const fullTenant = await (await getTenantDb()).tenant.findUnique({ where: { id: tenant.id } });
  if (!fullTenant) throw new Error("Tenant not found.");

  try {
    const result = await callAiForJson(
      fullTenant,
      `Extract structured candidate fields from a resume. Respond with ONLY a JSON object, no prose, matching exactly:
{"candidateName": string, "email": string, "phone": string, "country": string, "currentLocation": string, "linkedinUrl": string, "totalExperienceYears": number, "visaStatus": string, "roleWithSkills": string}
"totalExperienceYears" should be your best numeric estimate of total years of professional experience. "roleWithSkills" should be a short 1-2 sentence summary of their current role and top skills. Use "" (or 0 for the number) for anything you can't confidently determine.`,
      text.slice(0, 12000)
    );
    return result as ParsedResumeFields;
  } catch (err) {
    if (err instanceof AiNotConfiguredError) throw err;
    throw new Error(err instanceof Error ? err.message : "AI parsing failed.");
  }
}
