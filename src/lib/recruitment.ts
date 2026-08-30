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
