import type { Requirement } from "@/generated/prisma/client";
import { sanitizeRichText } from "@/lib/sanitizeRichText";

// Prisma's Decimal isn't a plain object, so it can't cross the Server->Client
// Component boundary (or a server action's return value) without an explicit
// conversion — Next.js otherwise falls back to Decimal's toJSON() with a dev
// warning rather than a real error, so this is easy to miss.
// jobDescription is undefined when it wasn't loaded (the list page leaves it
// out; RequirementModal fetches it via getRequirementJobDescription).
export type SerializedRequirement = Omit<Requirement, "billRate" | "payRate" | "jobDescription"> & {
  billRate: string | null;
  payRate: string | null;
  jobDescription?: string | null;
};

export function serializeRequirement(r: Omit<Requirement, "jobDescription"> & { jobDescription?: string | null }): SerializedRequirement {
  return {
    ...r,
    billRate: r.billRate?.toString() ?? null,
    payRate: r.payRate?.toString() ?? null,
    // RequirementModal renders this via dangerouslySetInnerHTML. New writes
    // are sanitized, but rows saved before the sanitizer fix (or imported by
    // older migration scripts) never were — so sanitize on the way out too.
    ...(r.jobDescription !== undefined
      ? { jobDescription: r.jobDescription ? sanitizeRichText(r.jobDescription) : r.jobDescription }
      : {}),
  };
}

// What the Requirements list needs per row (columns, filters, region check).
// The full requirement — job description included — loads when it's opened
// (getRequirementDetail), keeping the list small enough to arrive quickly.
export const REQUIREMENT_LIST_SELECT = {
  id: true,
  jobId: true,
  jobTitle: true,
  clientName: true,
  status: true,
  priority: true,
  billRate: true,
  billRateCurrency: true,
  employmentType: true,
  createdAt: true,
  mandatorySkills: true,
  visa: true,
  workLocation: true,
  isRemote: true,
  country: true,
  assignees: { select: { user: { select: { name: true } } } },
} as const;

// Submissions against a requirement by pipeline stage — GAS's coloured count
// bubbles next to the Job ID: blue received, amber in consideration, green
// won, red rejected / out.
export type SubmissionBuckets = { blue: number; amber: number; green: number; red: number };

export type RequirementListRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  clientName: string | null;
  status: string;
  priority: number;
  billRate: string | null;
  billRateCurrency: string;
  employmentType: string | null;
  createdAt: Date;
  mandatorySkills: string | null; // trimmed for the list; full text in the panel
  visa: string | null;
  location: string | null; // "Remote" or the work location
  country: string | null;
  assignees: string[];
  buckets: SubmissionBuckets;
};

type ListQueryRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  clientName: string | null;
  status: string;
  priority: number;
  billRate: { toString(): string } | null;
  billRateCurrency: string;
  employmentType: string | null;
  createdAt: Date;
  mandatorySkills: string | null;
  visa: string | null;
  workLocation: string | null;
  isRemote: boolean;
  country: string | null;
  assignees: { user: { name: string } }[];
};

const EMPTY_BUCKETS: SubmissionBuckets = { blue: 0, amber: 0, green: 0, red: 0 };

export function toRequirementListRow(r: ListQueryRow, buckets?: SubmissionBuckets): RequirementListRow {
  const skills = r.mandatorySkills?.replace(/\s+/g, " ").trim() ?? null;
  return {
    id: r.id,
    jobId: r.jobId,
    jobTitle: r.jobTitle,
    clientName: r.clientName,
    status: r.status,
    priority: r.priority,
    billRate: r.billRate?.toString() ?? null,
    billRateCurrency: r.billRateCurrency,
    employmentType: r.employmentType,
    createdAt: r.createdAt,
    mandatorySkills: skills && skills.length > 90 ? `${skills.slice(0, 90)}…` : skills,
    visa: r.visa,
    location: r.isRemote ? "Remote" : r.workLocation,
    country: r.country,
    assignees: r.assignees.map((a) => a.user.name),
    buckets: buckets ?? EMPTY_BUCKETS,
  };
}
