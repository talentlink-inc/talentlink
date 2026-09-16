// Mirrors the constants in the source Apps Script app's Recruitment.js so the
// migrated data and the new UI agree on what a "placement" is.

export const QUALIFYING_PLACEMENT_STATUSES = [
  "Client_Selected",
  "Background_Check",
  "Onboarding",
  "Started_Billable",
] as const;

export const REJECTED_STATUSES = [
  "Internal_Reject",
  "Vender_Reject",
  "Client_Reject",
  "Blocklist",
  "BGV_Failed",
  "Client_Withdrawn_Offer",
  "Candidate_Backs_Out",
  "Duplicate",
  "Position_Closed",
  "L1_Reject",
  "L2_Reject",
] as const;

export const SUBMISSION_STATUSES = [
  "New_Resume",
  "Internal_Submission",
  "Vender_Submission",
  "Online_Test",
  "Client_Submission",
  "L1_Interview",
  "L2_Interview",
  ...QUALIFYING_PLACEMENT_STATUSES,
  "On_Hold",
  ...REJECTED_STATUSES,
] as const;

// Only submissions in these statuses are eligible to schedule an interview
// against, matching ITStaffing's Interviews.js candidate picker filter.
export const INTERVIEW_ELIGIBLE_SUBMISSION_STATUSES = [
  "Internal_Submission",
  "L1_Interview",
  "L2_Interview",
] as const;

export const INTERVIEW_MODES = ["phone", "video", "in_person"] as const;

export const INTERVIEW_TYPES = ["AM_Technical_Screening", "L1", "L2", "Final"] as const;

export const INTERVIEW_STATUSES = [
  "Scheduled",
  "L1_Scheduled",
  "L2_Scheduled",
  "Feedback_Pending",
  "L1_Cleared",
  "L2_Cleared",
  "Selected",
  "Cancelled",
  "Rescheduled",
  "No_Show",
  "Rejected",
] as const;

export const REQUIREMENT_STATUSES = [
  "Open",
  "Submitted",
  "On Hold",
  "Closed",
  "Filled",
] as const;

export const VISA_STATUSES = [
  "USC",
  "GC",
  "H1B",
  "OPT",
  "CPT",
  "TN",
  "L1",
  "L2",
  "EAD",
  "GC-EAD",
  "H4-EAD",
  "N/A",
] as const;

export const REJECT_REASON_OPTIONS = [
  "Visa_Mismatch",
  "Skill_Mismatch",
  "Location_Mismatch",
  "Rate_Too_High",
  "Experience_Mismatch",
  "Domain_Mismatch",
  "Communication",
  "Availability",
  "Overqualified",
  "Underqualified",
  "Client_Circumvention",
] as const;

export function isQualifyingPlacementStatus(status: string) {
  return (QUALIFYING_PLACEMENT_STATUSES as readonly string[]).includes(status);
}

export function isRejectedStatus(status: string) {
  return (REJECTED_STATUSES as readonly string[]).includes(status);
}

// Matches ITStaffing's Recruitment.js rule: moving into a qualifying status
// assigns a durable PlacementID (kept forever, even through a later reject —
// that's tracked as "fell through" rather than erased). Moving to any other
// non-qualifying, non-rejected status (i.e. back into the ordinary pipeline)
// wipes it, since that's a genuine regression out of the placement pipeline.
export function shouldClearPlacementId(nextStatus: string, hadPlacementId: boolean) {
  if (!hadPlacementId) return false;
  return !isQualifyingPlacementStatus(nextStatus) && !isRejectedStatus(nextStatus);
}

// Employment Type is a checkbox group in the original app (reqEmpTypeChk /
// recHiringModel), stored as a comma-joined string of whichever were
// checked (e.g. "W2, C2C") — not free text, and not a single-select. Same
// 5 options on Requirements; Submissions additionally offers
// "Others-Referral".
export const REQUIREMENT_EMPLOYMENT_TYPES = [
  { value: "W2", label: "W2" },
  { value: "C2C", label: "C2C" },
  { value: "1099", label: "1099" },
  { value: "FTE", label: "Full-time" },
  { value: "C2H", label: "C2H" },
] as const;

export const SUBMISSION_EMPLOYMENT_TYPES = [
  ...REQUIREMENT_EMPLOYMENT_TYPES,
  { value: "Others-Referral", label: "Others-Referral" },
] as const;

export function parseEmploymentTypes(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function toggleEmploymentType(current: string, value: string): string {
  const set = new Set(parseEmploymentTypes(current));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set).join(", ");
}

// Per-requirement candidate screening questions — mirrors the original
// app's reqScreeningQuestions shape exactly (id/text/type/required).
export type ScreeningQuestionType = "short" | "long" | "rating" | "yesno";

export interface ScreeningQuestion {
  id: string;
  text: string;
  type: ScreeningQuestionType;
  required: boolean;
}

export const SCREENING_QUESTION_TYPE_LABELS: Record<ScreeningQuestionType, string> = {
  short: "Short answer",
  long: "Long answer",
  rating: "Rating 1–5",
  yesno: "Yes / No",
};

export interface ScreeningAnswer {
  id: string;
  text: string;
  type: ScreeningQuestionType;
  answer: string;
}
