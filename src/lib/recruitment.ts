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
