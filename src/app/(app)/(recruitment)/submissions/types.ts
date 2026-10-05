import type { Submission, Candidate, Requirement, Resume } from "@/generated/prisma/client";
import type { DataPermissions } from "@/lib/users";

// Submission/placement/interview screens only ever show a requirement's title
// and client (plus the picker's Job ID/status), so that's all that's loaded
// and sent — embedding the whole Requirement (job description HTML,
// screening questions, apply token) on every row made /submissions a
// multi-megabyte payload.
export const REQUIREMENT_SUMMARY_SELECT = {
  id: true,
  jobId: true,
  jobTitle: true,
  clientName: true,
  status: true,
} as const;
export type RequirementSummary = Pick<Requirement, keyof typeof REQUIREMENT_SUMMARY_SELECT>;

function toRequirementSummary(r: RequirementSummary): RequirementSummary {
  return { id: r.id, jobId: r.jobId, jobTitle: r.jobTitle, clientName: r.clientName, status: r.status };
}

// The screens only show the resume's file name and link to /api/resumes/:id
// (which checks canViewResume). Loading the whole row also shipped
// parsedText — the full resume text — to every viewer, permission or not,
// and was most of the /submissions payload.
export const RESUME_SUMMARY_SELECT = { id: true, fileName: true } as const;
export type ResumeSummary = Pick<Resume, keyof typeof RESUME_SUMMARY_SELECT>;

// See requirements/types.ts for why Decimal fields need explicit conversion
// before crossing the Server->Client Component boundary.
export type SerializedCandidate = Omit<
  Candidate,
  "totalExperienceYears" | "identityHash" | "tenantId" | "legacyId" | "deletedAt" | "updatedAt" | "createdAt"
> & {
  totalExperienceYears: string | null;
};

// Internal bookkeeping columns no screen reads; left out of what's sent to the
// browser to keep list payloads small (hundreds of rows per page).
type Bookkeeping = "tenantId" | "legacyId" | "deletedAt" | "updatedAt" | "submissionCountDate";

export type SerializedSubmission = Omit<
  Submission,
  "billRate" | "payRate" | "commission" | Bookkeeping
> & {
  billRate: string | null;
  payRate: string | null;
  commission: string | null;
  candidate: SerializedCandidate;
  requirement: RequirementSummary | null;
  resume: ResumeSummary | null;
};

export function serializeSubmission(
  s: Submission & { candidate: Candidate; requirement: RequirementSummary | null; resume: ResumeSummary | null }
): SerializedSubmission {
  // identityHash is a hash of the candidate's email + phone — a phone number
  // is few enough digits to brute-force back out of it, so it never goes to
  // the browser (nothing client-side uses it anyway).
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { identityHash, tenantId: _ct, legacyId: _cl, deletedAt: _cd, updatedAt: _cu, createdAt: _cc, ...candidate } = s.candidate;
  const { tenantId, legacyId, deletedAt, updatedAt, submissionCountDate, ...submission } = s;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return {
    ...submission,
    billRate: s.billRate?.toString() ?? null,
    payRate: s.payRate?.toString() ?? null,
    commission: s.commission?.toString() ?? null,
    candidate: {
      ...candidate,
      totalExperienceYears: s.candidate.totalExperienceYears?.toString() ?? null,
    },
    requirement: s.requirement ? toRequirementSummary(s.requirement) : null,
    resume: s.resume ? { id: s.resume.id, fileName: s.resume.fileName } : null,
  };
}

// canViewEmail/canViewPhone have to be enforced before the data leaves the
// server — hiding it in the UI alone still ships it in the page payload,
// readable by anyone who opens dev tools.
export function redactCandidateContact<
  T extends { candidate: { email: string | null; phone: string | null; linkedinUrl: string | null } },
>(
  row: T,
  permissions: Pick<DataPermissions, "canViewEmail" | "canViewPhone">
): T {
  if (permissions.canViewEmail && permissions.canViewPhone) return row;
  return {
    ...row,
    candidate: {
      ...row.candidate,
      email: permissions.canViewEmail ? row.candidate.email : null,
      phone: permissions.canViewPhone ? row.candidate.phone : null,
      // Some imported GAS rows have the candidate's email typed into the
      // LinkedIn column — don't let that slip past canViewEmail.
      linkedinUrl:
        !permissions.canViewEmail && row.candidate.linkedinUrl?.includes("@") ? null : row.candidate.linkedinUrl,
    },
  };
}

// What the Submissions list needs per row (its columns, filters and search).
// The full record loads when a submission is opened (getSubmissionDetail), so
// the list stays small enough to arrive quickly from the US to India.
export const SUBMISSION_LIST_SELECT = {
  id: true,
  submissionId: true,
  status: true,
  submissionDate: true,
  billRate: true,
  billRateCurrency: true,
  employmentType: true,
  requirementJobIdRaw: true,
  requirement: { select: { jobTitle: true } },
  candidate: { select: { name: true, email: true, phone: true, currentLocation: true, visaStatus: true } },
} as const;

export type SubmissionListRow = {
  id: string;
  submissionId: string | null;
  status: string;
  submissionDate: Date | null;
  billRate: string | null;
  billRateCurrency: string;
  employmentType: string | null;
  requirementJobIdRaw: string | null;
  requirement: { jobTitle: string } | null;
  candidate: { name: string; email: string | null; phone: string | null; currentLocation: string | null; visaStatus: string | null };
};

export function toSubmissionListRow(
  s: Omit<SubmissionListRow, "billRate"> & { billRate: { toString(): string } | null },
  permissions: Pick<DataPermissions, "canViewEmail" | "canViewPhone">
): SubmissionListRow {
  return {
    ...s,
    billRate: s.billRate?.toString() ?? null,
    candidate: {
      ...s.candidate,
      email: permissions.canViewEmail ? s.candidate.email : null,
      phone: permissions.canViewPhone ? s.candidate.phone : null,
    },
  };
}
