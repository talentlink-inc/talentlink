"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { INTERVIEW_STATUSES } from "@/lib/recruitment";
import { canManageRecruitment } from "@/lib/users";
import { syncInterviewToCalendar, deleteInterviewCalendarEvent } from "@/lib/calendarIntegration";

export type InterviewFormState = { error: string | null };
const initialState: InterviewFormState = { error: null };
const PERMISSION_ERROR = "Your role only has view access to Interviews.";

const interviewSchema = z.object({
  submissionId: z.string().trim().min(1, "Select a candidate submission"),
  interviewType: z.string().trim().min(1, "Interview round is required"),
  scheduledAt: z.string().trim().min(1, "Date/time is required"),
  durationMinutes: z.coerce.number().int().positive().optional().nullable(),
  mode: z.string().trim().optional(),
  timezone: z.string().trim().optional(),
  clientCompany: z.string().trim().optional(),
  status: z.enum(INTERVIEW_STATUSES).optional(),
  feedback: z.string().trim().optional(),
});

function parseForm(formData: FormData) {
  return interviewSchema.safeParse({
    submissionId: formData.get("submissionId"),
    interviewType: formData.get("interviewType"),
    scheduledAt: formData.get("scheduledAt"),
    durationMinutes: formData.get("durationMinutes") || null,
    mode: formData.get("mode") || undefined,
    timezone: formData.get("timezone") || undefined,
    clientCompany: formData.get("clientCompany") || undefined,
    status: formData.get("status") || undefined,
    feedback: formData.get("feedback") || undefined,
  });
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

  const interview = await db.interview.create({
    data: {
      tenantId: tenant.id,
      submissionId: data.submissionId,
      interviewType: data.interviewType,
      scheduledAt: new Date(data.scheduledAt),
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

  const interview = await db.interview.update({
    where: { id, tenantId: tenant.id },
    data: {
      submissionId: data.submissionId,
      interviewType: data.interviewType,
      scheduledAt: new Date(data.scheduledAt),
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
