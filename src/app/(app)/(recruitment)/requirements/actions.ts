"use server";

import { z } from "zod";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { SUPPORTED_REGIONS } from "@/lib/regions";
import { canManageRecruitment } from "@/lib/users";
import { callAiForJson, AiNotConfiguredError } from "@/lib/ai";
import { requirementSchema, screeningQuestionSchema } from "@/lib/schemas/requirement";
import { sanitizeRichText } from "@/lib/sanitizeRichText";

const PERMISSION_ERROR = "Your role only has view access to Requirements.";

function parseScreeningQuestions(raw: FormDataEntryValue | null) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return z.array(screeningQuestionSchema).parse(parsed);
  } catch {
    return [];
  }
}

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
    billRateCurrency: formData.get("billRateCurrency") || "USD",
    payRate: formData.get("payRate") || null,
    payRateCurrency: formData.get("payRateCurrency") || "USD",
    mandatorySkills: formData.get("mandatorySkills") ?? "",
    jobDescription: formData.get("jobDescription") ?? "",
    accountManagerRaw: formData.get("accountManagerRaw") || undefined,
    screeningQuestions: parseScreeningQuestions(formData.get("screeningQuestions")),
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
  const { jobDescription, ...rest } = parsed.data;

  // Retries a few times in the rare case two requirements are created in
  // the same instant and land on the same generated Job ID.
  for (let attempt = 0; attempt < 5; attempt++) {
    const jobId = await generateJobId(db, tenant.id);
    try {
      await db.requirement.create({
        data: {
          ...rest,
          jobDescription: sanitizeRichText(jobDescription),
          jobId,
          tenantId: tenant.id,
          postedByUserId: user.id,
          publicApplyToken: randomBytes(16).toString("hex"),
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
  const { jobDescription, ...rest } = parsed.data;

  // Job ID is immutable once created (never part of the edit form), so the
  // update never touches it.
  await db.requirement.update({
    where: { id, tenantId: tenant.id },
    data: { ...rest, jobDescription: sanitizeRichText(jobDescription) },
  });

  revalidatePath("/requirements");
  return null;
}

// Inline priority stars (table row + view modal) — a lightweight partial
// update, separate from the full form, mirroring the original's
// reqUpdatePriority (updates immediately, no modal round trip).
export async function updateRequirementPriority(id: string, priority: number) {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) throw new Error(PERMISSION_ERROR);
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) {
    throw new Error("Priority must be between 0 and 5.");
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.requirement.update({
    where: { id, tenantId: tenant.id },
    data: { priority },
  });
  revalidatePath("/requirements");
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

export type ParsedJdFields = {
  jobTitle?: string;
  visa?: string;
  mandatorySkills?: string;
  isRemote?: boolean;
  workLocation?: string;
  country?: string;
};

// AI-assisted JD parsing (original's "Parse with AI") — paste a JD, get back
// a best-effort guess at the structured fields. Never overwrites what the
// user already typed; RequirementModal only fills empty fields with this.
export async function parseJobDescriptionWithAI(jdText: string): Promise<ParsedJdFields> {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) throw new Error(PERMISSION_ERROR);
  const text = jdText.trim();
  if (!text) throw new Error("Paste a job description first.");

  const tenant = await getCurrentTenant();
  const fullTenant = await (await getTenantDb()).tenant.findUnique({ where: { id: tenant.id } });
  if (!fullTenant) throw new Error("Tenant not found.");

  try {
    const result = await callAiForJson(
      fullTenant,
      `Extract structured fields from a job description. Respond with ONLY a JSON object, no prose, matching exactly:
{"jobTitle": string, "visa": string, "mandatorySkills": string, "isRemote": boolean, "workLocation": string, "country": string}
"country" must be a comma-joined subset of exactly these values: ${SUPPORTED_REGIONS.join(", ")}. Use "" for any field you can't confidently determine. "visa" should be a short comma-joined list like "USC, GC, H1B" if the JD mentions visa requirements, else "".`,
      text
    );
    return result as ParsedJdFields;
  } catch (err) {
    if (err instanceof AiNotConfiguredError) throw err;
    throw new Error(err instanceof Error ? err.message : "AI parsing failed.");
  }
}

// Distinct Account Manager names already on file, for the autocomplete —
// mirrors the original's getCPOCList.
export async function getAccountManagerSuggestions(): Promise<string[]> {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const rows = await db.requirement.findMany({
    where: { tenantId: tenant.id, accountManagerRaw: { not: null } },
    select: { accountManagerRaw: true },
    distinct: ["accountManagerRaw"],
  });
  const names = rows.map((r) => r.accountManagerRaw!).filter(Boolean);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}
