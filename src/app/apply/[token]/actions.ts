"use server";

import { z } from "zod";
import { createHash } from "node:crypto";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { candidateIdentityHash } from "@/lib/candidates";
import { getSupabaseAdmin, RESUME_BUCKET } from "@/lib/supabase/admin";
import type { ScreeningQuestion } from "@/lib/recruitment";

// Public route — no session, no getCurrentUser() anywhere in this file.
// Tenant is still resolved normally via the subdomain (see proxy.ts), the
// token just has to belong to a requirement in THAT tenant.

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ALLOWED_RESUME_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const LINKEDIN_URL_PATTERN = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/.+/i;
const PHONE_PATTERN = /^[0-9+\-() ]+$/;

const applicationSchema = z.object({
  candidateName: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(PHONE_PATTERN, "Phone number can only contain digits, spaces, and + - ( )"),
  currentLocation: z.string().trim().min(1, "Current location is required"),
  linkedinUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || LINKEDIN_URL_PATTERN.test(v), { message: "Enter a valid LinkedIn profile URL" }),
});

export type ApplicationFormState = { error: string | null; submitted: boolean };
const initialState: ApplicationFormState = { error: null, submitted: false };

export async function submitApplication(
  token: string,
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();

  const requirement = await db.requirement.findFirst({
    where: { tenantId: tenant.id, publicApplyToken: token, deletedAt: null },
  });
  if (!requirement) return { ...initialState, error: "This application link is no longer valid." };

  const parsed = applicationSchema.safeParse({
    candidateName: formData.get("candidateName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    currentLocation: formData.get("currentLocation"),
    linkedinUrl: formData.get("linkedinUrl") || undefined,
  });
  if (!parsed.success) {
    return { ...initialState, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const data = parsed.data;

  const questions = Array.isArray(requirement.screeningQuestions)
    ? (requirement.screeningQuestions as unknown as ScreeningQuestion[])
    : [];
  const answers = questions.map((q) => ({
    id: q.id,
    text: q.text,
    type: q.type,
    answer: String(formData.get(`question_${q.id}`) ?? "").trim(),
  }));
  const missingRequired = questions.find(
    (q) => q.required && !answers.find((a) => a.id === q.id)?.answer
  );
  if (missingRequired) {
    return { ...initialState, error: `Please answer: ${missingRequired.text}` };
  }

  const resumeFile = formData.get("resume");
  if (!(resumeFile instanceof File) || resumeFile.size === 0) {
    return { ...initialState, error: "Please attach your resume." };
  }
  if (resumeFile.size > MAX_RESUME_BYTES) {
    return { ...initialState, error: "Resume must be under 10MB." };
  }
  const extension = resumeFile.name.slice(resumeFile.name.lastIndexOf(".")).toLowerCase();
  const mimeAllowed = !resumeFile.type || ALLOWED_RESUME_MIME_TYPES.has(resumeFile.type);
  if (!ALLOWED_RESUME_EXTENSIONS.includes(extension) || !mimeAllowed) {
    return { ...initialState, error: "Resume must be a .pdf, .doc, or .docx file." };
  }

  const identityHash = candidateIdentityHash(data.email, data.phone, data.candidateName);
  const candidate = await db.candidate.upsert({
    where: { tenantId_identityHash: { tenantId: tenant.id, identityHash } },
    update: {
      name: data.candidateName,
      email: data.email,
      phone: data.phone,
      currentLocation: data.currentLocation,
      linkedinUrl: data.linkedinUrl || null,
    },
    create: {
      tenantId: tenant.id,
      identityHash,
      name: data.candidateName,
      email: data.email,
      phone: data.phone,
      currentLocation: data.currentLocation,
      linkedinUrl: data.linkedinUrl || null,
    },
  });

  const existing = await db.submission.findFirst({
    where: { tenantId: tenant.id, candidateId: candidate.id, requirementId: requirement.id, deletedAt: null },
  });
  if (existing) {
    return {
      ...initialState,
      error: "You've already applied to this position — we have your application on file.",
    };
  }

  const buffer = Buffer.from(await resumeFile.arrayBuffer());
  const fileSha256 = createHash("sha256").update(buffer).digest("hex");
  let resumeId: string;
  const existingResume = await db.resume.findFirst({ where: { tenantId: tenant.id, fileSha256 } });
  if (existingResume) {
    resumeId = existingResume.id;
  } else {
    const safeFileName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${tenant.id}/${candidate.id}/${fileSha256}-${safeFileName}`;
    const { error } = await getSupabaseAdmin()
      .storage.from(RESUME_BUCKET)
      .upload(storagePath, buffer, { upsert: true, contentType: resumeFile.type });
    if (error) return { ...initialState, error: `Resume upload failed: ${error.message}` };

    const resume = await db.resume.create({
      data: {
        tenantId: tenant.id,
        candidateId: candidate.id,
        fileUrl: storagePath,
        fileName: resumeFile.name,
        fileMime: resumeFile.type || null,
        fileSizeBytes: buffer.byteLength,
        fileSha256,
        source: "public_apply",
      },
    });
    resumeId = resume.id;
  }

  const submissionCount = await db.submission.count({ where: { tenantId: tenant.id } });
  const submissionId = `SUB-${String(submissionCount + 1).padStart(4, "0")}`;

  await db.submission.create({
    data: {
      tenantId: tenant.id,
      submissionId,
      candidateId: candidate.id,
      requirementId: requirement.id,
      resumeId,
      recruiterNameRaw: "Public Application",
      screeningAnswers: answers.length ? answers : undefined,
      submissionDate: new Date(),
      status: "New_Resume",
    },
  });

  return { error: null, submitted: true };
}
