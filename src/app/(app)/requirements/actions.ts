"use server";

import { z } from "zod";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { REQUIREMENT_STATUSES } from "@/lib/recruitment";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { SUPPORTED_REGIONS } from "@/lib/regions";
import { canManageRecruitment } from "@/lib/users";
import { callAiForJson, AiNotConfiguredError } from "@/lib/ai";

const PERMISSION_ERROR = "Your role only has view access to Requirements.";

const screeningQuestionSchema = z.object({
  id: z.string(),
  text: z.string().trim().min(1),
  type: z.enum(["short", "long", "rating", "yesno"]),
  required: z.boolean(),
});

function parseScreeningQuestions(raw: FormDataEntryValue | null) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return z.array(screeningQuestionSchema).parse(parsed);
  } catch {
    return [];
  }
}

// Mandatory-field set mirrors the original ITStaffing (Google Apps Script)
// Requirements form validation (PageRecruitment.html: reqSaveRequirement) —
// Client Name, Job Description, Duration, Mandatory Skills, Country, Bill
// Rate, and Employment Type are all required there, plus Visa (only when
// Country includes USA) and Work Location (only when not Remote). Job ID
// isn't part of the form at all there — it's auto-generated (generateJobId
// in the original Recruitment.js), see generateJobId below.
const requirementSchema = z
  .object({
    jobTitle: z.string().trim().min(1, "Job title is required").max(200, "Job title cannot exceed 200 characters"),
    clientName: z.string().trim().min(1, "Client name is required"),
    status: z.enum(REQUIREMENT_STATUSES),
    priority: z.coerce.number().int().min(0).max(5),
    employmentType: z.string().trim().min(1, "Employment type is required"),
    duration: z.string().trim().min(1, "Duration is required"),
    visa: z.string().trim().optional(),
    workLocation: z.string().trim().optional(),
    country: z.string().trim().min(1, "Country is required"),
    isRemote: z.coerce.boolean().optional(),
    billRate: z
      .string()
      .trim()
      .min(1, "Bill rate is required")
      .transform(Number)
      .pipe(z.number().nonnegative("Bill rate must be 0 or greater")),
    billRateCurrency: z.enum(SUPPORTED_CURRENCIES),
    payRate: z.coerce.number().nonnegative("Pay rate must be 0 or greater").optional().nullable(),
    payRateCurrency: z.enum(SUPPORTED_CURRENCIES),
    mandatorySkills: z.string().trim().min(1, "Mandatory skills is required"),
    // Rendered through a rich-text editor and sanitized before it ever
    // reaches here — see sanitizeHtml in RequirementModal's save path... no,
    // sanitization happens server-side below (sanitizeRichText) so a
    // malicious client can't bypass it by posting the form directly.
    jobDescription: z
      .string()
      .trim()
      .min(1, "Job description is required")
      .max(20000, "Job description cannot exceed 20,000 characters"),
    accountManagerRaw: z.string().trim().optional(),
    screeningQuestions: z.array(screeningQuestionSchema).optional(),
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

// Original app's Job Description is contenteditable rich text (bold/italic/
// underline/lists) — plain-tag allowlist, no attributes, so no repeat of
// this session's earlier legacy-data HTML contamination bug (no <span
// data-teams>, no event handlers, no <script>).
const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "p", "div"]);
function sanitizeRichText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(\/?)([a-zA-Z0-9]+)(\s[^>]*)?>/g, (match, closing, tag) => {
      const lower = tag.toLowerCase();
      return ALLOWED_TAGS.has(lower) ? `<${closing}${lower}>` : "";
    });
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
