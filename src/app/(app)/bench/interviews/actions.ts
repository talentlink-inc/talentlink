"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench, canDeleteAnyBenchConsultant } from "@/lib/users";
import { INTERVIEW_MODES, INTERVIEW_STATUSES } from "@/lib/recruitment";
import { isValidTimeZone, zonedLocalToUtc } from "@/lib/timezone";
import { BENCH_INTERVIEW_ELIGIBLE_STATUSES } from "@/lib/bench";

const PERMISSION_ERROR = "You don't have access to Bench Sales.";

export type BenchInterviewFormState = { error: string | null };
const initialState: BenchInterviewFormState = { error: null };

// GAS addBenchInterview: round, date, time and mode required. The
// datetime-local value is wall-clock time in the chosen timezone (see
// src/lib/timezone.ts) — same handling as Recruitment interviews.
const interviewSchema = z
  .object({
    benchSubmissionId: z.string().trim().min(1, "Select a consultant submission"),
    interviewType: z.string().trim().min(1, "Interview round is required").max(50),
    scheduledAt: z.string().trim().min(1, "Date/time is required"),
    timezone: z
      .string()
      .trim()
      .min(1, "Timezone is required")
      .refine(isValidTimeZone, { message: "Select a valid timezone" }),
    mode: z.enum(INTERVIEW_MODES, { message: "Interview mode is required" }),
    durationMinutes: z.coerce
      .number()
      .int("Duration must be a whole number of minutes")
      .positive("Duration must be greater than 0 minutes")
      .optional()
      .nullable(),
    clientCompany: z.string().trim().max(300).optional(),
    status: z.enum(INTERVIEW_STATUSES).optional(),
    feedback: z.string().trim().max(5000).optional(),
  })
  .transform((data, ctx) => {
    const scheduledAt = zonedLocalToUtc(data.scheduledAt, data.timezone);
    if (!scheduledAt) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time", path: ["scheduledAt"] });
      return z.NEVER;
    }
    return { ...data, scheduledAt };
  });

function parseForm(formData: FormData) {
  return interviewSchema.safeParse({
    benchSubmissionId: formData.get("benchSubmissionId") ?? "",
    interviewType: formData.get("interviewType") ?? "",
    scheduledAt: formData.get("scheduledAt") ?? "",
    timezone: formData.get("timezone") ?? "",
    mode: formData.get("mode") ?? "",
    durationMinutes: formData.get("durationMinutes") || null,
    clientCompany: formData.get("clientCompany") || undefined,
    status: formData.get("status") || undefined,
    feedback: formData.get("feedback") || undefined,
  });
}

async function eligibleSubmission(db: Awaited<ReturnType<typeof getTenantDb>>, tenantId: string, id: string, allowId?: string) {
  const sub = await db.benchSubmission.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!sub) return false;
  // An existing interview may keep its submission even after that
  // submission's status moves on; new links must be interview-stage.
  return sub.id === allowId || (BENCH_INTERVIEW_ELIGIBLE_STATUSES as readonly string[]).includes(sub.status);
}

export async function createBenchInterview(
  _prev: BenchInterviewFormState,
  formData: FormData
): Promise<BenchInterviewFormState> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  if (!(await eligibleSubmission(db, tenant.id, data.benchSubmissionId))) {
    return { error: "Interviews can only be scheduled for submissions at L1_Interview or L2_Interview." };
  }

  await db.benchInterview.create({
    data: {
      tenantId: tenant.id,
      benchSubmissionId: data.benchSubmissionId,
      interviewType: data.interviewType,
      scheduledAt: data.scheduledAt,
      timezone: data.timezone,
      durationMinutes: data.durationMinutes ?? null,
      mode: data.mode,
      clientCompany: data.clientCompany || null,
      status: "Scheduled",
      scheduledByUserId: user.id,
      scheduledByNameRaw: user.name,
    },
  });
  revalidatePath("/bench", "layout");
  return initialState;
}

export async function updateBenchInterview(
  id: string,
  _prev: BenchInterviewFormState,
  formData: FormData
): Promise<BenchInterviewFormState> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.benchInterview.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!existing) return { error: "Interview not found." };
  if (!(await eligibleSubmission(db, tenant.id, data.benchSubmissionId, existing.benchSubmissionId))) {
    return { error: "Interviews can only be scheduled for submissions at L1_Interview or L2_Interview." };
  }

  await db.benchInterview.update({
    where: { id, tenantId: tenant.id },
    data: {
      benchSubmissionId: data.benchSubmissionId,
      interviewType: data.interviewType,
      scheduledAt: data.scheduledAt,
      timezone: data.timezone,
      durationMinutes: data.durationMinutes ?? null,
      mode: data.mode,
      clientCompany: data.clientCompany || null,
      status: data.status ?? existing.status,
      feedback: data.feedback || null,
    },
  });
  revalidatePath("/bench", "layout");
  return initialState;
}

// GAS deleteBenchInterview: Admin/Manager can delete any; everyone else
// only interviews they scheduled.
export async function deleteBenchInterview(id: string): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) return { error: PERMISSION_ERROR };
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.benchInterview.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!existing) return { error: "Interview not found." };
  const isOwn =
    existing.scheduledByUserId === user.id ||
    (!existing.scheduledByUserId && existing.scheduledByNameRaw?.trim().toLowerCase() === user.name.trim().toLowerCase());
  if (!canDeleteAnyBenchConsultant(user.role) && !isOwn) {
    return { error: "You can only delete interviews you scheduled." };
  }
  await db.benchInterview.update({ where: { id, tenantId: tenant.id }, data: { deletedAt: new Date() } });
  revalidatePath("/bench", "layout");
  return { error: null };
}
