"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { INTERVIEW_STATUSES } from "@/lib/recruitment";
import { canManageRecruitment } from "@/lib/users";
import { syncInterviewToCalendar, deleteInterviewCalendarEvent } from "@/lib/calendarIntegration";
import { isValidTimeZone, zonedLocalToUtc } from "@/lib/timezone";

export type InterviewFormState = { error: string | null };
const initialState: InterviewFormState = { error: null };
const PERMISSION_ERROR = "Your role only has view access to Interviews.";

const interviewSchema = z.object({
  submissionId: z.string().trim().min(1, "Select a candidate submission"),
  interviewType: z.string().trim().min(1, "Interview round is required"),
  scheduledAt: z.string().trim().min(1, "Date/time is required"),
  durationMinutes: z.coerce
    .number()
    .int("Duration must be a whole number of minutes")
    .positive("Duration must be greater than 0 minutes")
    .optional()
    .nullable(),
  mode: z.string().trim().optional(),
  // Required in the original app's Interview form ("Timezone *") — dropped
  // here during the port even though the field itself stayed.
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required")
    .refine(isValidTimeZone, { message: "Enter a valid timezone, e.g. America/New_York or Asia/Kolkata" }),
  clientCompany: z.string().trim().optional(),
  status: z.enum(INTERVIEW_STATUSES).optional(),
  feedback: z.string().trim().optional(),
});

function parseForm(formData: FormData) {
  return interviewSchema
    .transform((data, ctx) => {
      // datetime-local has no offset — it's wall-clock time in the chosen
      // timezone, not the server's. See src/lib/timezone.ts.
      const scheduledAt = zonedLocalToUtc(data.scheduledAt, data.timezone);
      if (!scheduledAt) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date and time", path: ["scheduledAt"] });
        return z.NEVER;
      }
      return { ...data, scheduledAt };
    })
    .safeParse({
    submissionId: formData.get("submissionId"),
    interviewType: formData.get("interviewType"),
    scheduledAt: formData.get("scheduledAt"),
    durationMinutes: formData.get("durationMinutes") || null,
    mode: formData.get("mode") || undefined,
    timezone: formData.get("timezone") ?? "",
    clientCompany: formData.get("clientCompany") || undefined,
    status: formData.get("status") || undefined,
    feedback: formData.get("feedback") || undefined,
  });
}

async function submissionExists(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  tenantId: string,
  submissionId: string
): Promise<boolean> {
  const submission = await db.submission.findFirst({
    where: { id: submissionId, tenantId, deletedAt: null },
    select: { id: true },
  });
  return !!submission;
}

export async function createInterview(
  _prevState: InterviewFormState,
  formData: FormData
): Promise<InterviewFormState> {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) return { error: PERMISSION_ERROR };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  if (!(await submissionExists(db, tenant.id, data.submissionId))) {
    return { error: "That submission no longer exists." };
  }

  const interview = await db.interview.create({
    data: {
      tenantId: tenant.id,
      submissionId: data.submissionId,
      interviewType: data.interviewType,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes ?? null,
      mode: data.mode || null,
      timezone: data.timezone || null,
      clientCompany: data.clientCompany || null,
      scheduledByUserId: user.id,
      scheduledByNameRaw: user.name,
      status: "Scheduled",
    },
    include: { submission: { include: { candidate: true, requirement: true } } },
  });

  await syncInterviewToCalendar(interview);

  revalidatePath("/interviews");
  return initialState;
}

export async function updateInterview(
  id: string,
  _prevState: InterviewFormState,
  formData: FormData
): Promise<InterviewFormState> {
  const currentUser = await getCurrentUser();
  if (!canManageRecruitment(currentUser.role)) return { error: PERMISSION_ERROR };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.interview.findUnique({ where: { id, tenantId: tenant.id }, select: { submissionId: true } });
  if (!existing) return { error: "Interview not found." };
  if (data.submissionId !== existing.submissionId && !(await submissionExists(db, tenant.id, data.submissionId))) {
    return { error: "That submission no longer exists." };
  }

  const interview = await db.interview.update({
    where: { id, tenantId: tenant.id },
    data: {
      submissionId: data.submissionId,
      interviewType: data.interviewType,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes ?? null,
      mode: data.mode || null,
      timezone: data.timezone || null,
      clientCompany: data.clientCompany || null,
      status: data.status,
      feedback: data.feedback || null,
    },
    include: { submission: { include: { candidate: true, requirement: true } } },
  });

  await syncInterviewToCalendar(interview);

  revalidatePath("/interviews");
  return initialState;
}

export async function deleteInterview(id: string) {
  const user = await getCurrentUser();
  if (!canManageRecruitment(user.role)) throw new Error(PERMISSION_ERROR);

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const interview = await db.interview.update({
    where: { id, tenantId: tenant.id },
    data: { deletedAt: new Date() },
    include: { submission: { include: { candidate: true, requirement: true } } },
  });

  await deleteInterviewCalendarEvent(interview);

  revalidatePath("/interviews");
}
