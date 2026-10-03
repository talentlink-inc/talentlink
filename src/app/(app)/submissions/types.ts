import type { Submission, Candidate, Requirement, Resume } from "@/generated/prisma/client";
import type { DataPermissions } from "@/lib/users";
import { serializeRequirement, type SerializedRequirement } from "../requirements/types";

// See requirements/types.ts for why Decimal fields need explicit conversion
// before crossing the Server->Client Component boundary.
export type SerializedCandidate = Omit<Candidate, "totalExperienceYears"> & {
  totalExperienceYears: string | null;
};

export type SerializedSubmission = Omit<
  Submission,
  "billRate" | "payRate" | "commission"
> & {
  billRate: string | null;
  payRate: string | null;
  commission: string | null;
  candidate: SerializedCandidate;
  requirement: SerializedRequirement | null;
  resume: Resume | null;
};

export function serializeSubmission(
  s: Submission & { candidate: Candidate; requirement: Requirement | null; resume: Resume | null }
): SerializedSubmission {
  return {
    ...s,
    billRate: s.billRate?.toString() ?? null,
    payRate: s.payRate?.toString() ?? null,
    commission: s.commission?.toString() ?? null,
    candidate: {
      ...s.candidate,
      totalExperienceYears: s.candidate.totalExperienceYears?.toString() ?? null,
    },
    requirement: s.requirement ? serializeRequirement(s.requirement) : null,
  };
}

// canViewEmail/canViewPhone have to be enforced before the data leaves the
// server — hiding it in the UI alone still ships it in the page payload,
// readable by anyone who opens dev tools.
export function redactCandidateContact<T extends { candidate: { email: string | null; phone: string | null } }>(
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
    },
  };
}
