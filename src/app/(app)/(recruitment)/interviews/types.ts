import type { Interview } from "@/generated/prisma/client";

// Interview screens show only the candidate's name and the requirement's
// title/client for each interview's submission, and the submission picker
// needs only id, status and job ID — so that's all that's loaded and sent
// (embedding whole submissions made /interviews several hundred KB).
export const INTERVIEW_SUBMISSION_SELECT = {
  id: true,
  status: true,
  requirementJobIdRaw: true,
  candidate: { select: { name: true } },
  requirement: { select: { jobTitle: true, clientName: true } },
} as const;

export type InterviewSubmissionSummary = {
  id: string;
  status: string;
  requirementJobIdRaw: string | null;
  candidate: { name: string };
  requirement: { jobTitle: string; clientName: string | null } | null;
};

export type SerializedInterview = Omit<Interview, "tenantId" | "legacyId" | "deletedAt" | "updatedAt"> & {
  submission: InterviewSubmissionSummary;
};

export function serializeInterview(
  i: Interview & { submission: InterviewSubmissionSummary }
): SerializedInterview {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tenantId, legacyId, deletedAt, updatedAt, ...rest } = i;
  return rest;
}
