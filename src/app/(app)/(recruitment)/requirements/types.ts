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
} as const;

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
};

export function toRequirementListRow(r: Omit<RequirementListRow, "billRate"> & { billRate: { toString(): string } | null }): RequirementListRow {
  return { ...r, billRate: r.billRate?.toString() ?? null };
}
