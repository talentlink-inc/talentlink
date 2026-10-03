// Bench Sales vocabulary — mirrors the GAS app's BenchSales.js /
// PageBenchSales.html. Submission statuses, reject reasons and the
// placement rule are shared with Recruitment (src/lib/recruitment.ts), as
// GAS deliberately kept the two vocabularies identical.

export const BENCH_CONSULTANT_STATUSES = ["Available", "Marketing", "Placed", "On Hold"] as const;

export const BENCH_RELOCATION_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: "Open", label: "Open to discuss" },
] as const;

export const BENCH_HOTLIST_STATUSES = ["Active", "Inactive"] as const;

export function relocationLabel(value: string): string {
  return BENCH_RELOCATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// GAS BENCH_SUB_STATUS_BUCKET (BenchSubmissions.js) — identical to
// Recruitment's pipeline buckets: early (blue), in play (amber), placed
// (green), closed out (red).
const STATUS_BUCKETS: Record<string, "blue" | "amber" | "green" | "red"> = {
  New_Resume: "blue",
  Internal_Submission: "blue",
  Submitted: "blue",
  Vender_Submission: "amber",
  Online_Test: "amber",
  Client_Submission: "amber",
  L1_Interview: "amber",
  L2_Interview: "amber",
  Client_Selected: "amber",
  Background_Check: "amber",
  Onboarding: "green",
  Started_Billable: "green",
};

export function submissionStatusBucket(status: string): "blue" | "amber" | "green" | "red" {
  return STATUS_BUCKETS[status] ?? "red";
}

// GAS getBenchInterviewCandidates: only submissions at an interview stage
// can have a bench interview scheduled against them.
export const BENCH_INTERVIEW_ELIGIBLE_STATUSES = ["L1_Interview", "L2_Interview"] as const;
