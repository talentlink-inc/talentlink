// What people see for a status (design review decision 4A: plain-English
// chips). Stored values never change — they stay GAS-compatible codes like
// "Vender_Submission" — only the label and colour shown on screen do.

export type StatusTone = "early" | "progress" | "placed" | "closed" | "neutral";

const LABELS: Record<string, string> = {
  // Submission pipeline (Recruitment + Bench share one vocabulary)
  New_Resume: "New resume",
  Internal_Submission: "Internal submission",
  Vender_Submission: "Vendor submission",
  Submitted: "Submitted",
  Online_Test: "Online test",
  Client_Submission: "Client submission",
  L1_Interview: "L1 interview",
  L2_Interview: "L2 interview",
  Client_Selected: "Client selected",
  Background_Check: "Background check",
  Onboarding: "Onboarding",
  Started_Billable: "Started (billable)",
  On_Hold: "On hold",
  Internal_Reject: "Internal reject",
  Vender_Reject: "Vendor rejected",
  Client_Reject: "Client rejected",
  Blocklist: "Blocklisted",
  BGV_Failed: "BGV failed",
  Client_Withdrawn_Offer: "Offer withdrawn",
  Candidate_Backs_Out: "Candidate backed out",
  Duplicate: "Duplicate",
  Position_Closed: "Position closed",
  L1_Reject: "L1 rejected",
  L2_Reject: "L2 rejected",
  // Interviews
  Scheduled: "Scheduled",
  L1_Scheduled: "L1 scheduled",
  L2_Scheduled: "L2 scheduled",
  Feedback_Pending: "Feedback pending",
  L1_Cleared: "L1 cleared",
  L2_Cleared: "L2 cleared",
  Selected: "Selected",
  Cancelled: "Cancelled",
  Rescheduled: "Rescheduled",
  No_Show: "No-show",
  Rejected: "Rejected",
  // Interview rounds / modes
  AM_Technical_Screening: "AM technical screening",
  phone: "Phone",
  video: "Video",
  in_person: "In person",
  // User accounts (stored lowercase)
  active: "Active",
  inactive: "Inactive",
};

const TONES: Record<string, StatusTone> = {
  New_Resume: "early",
  Internal_Submission: "early",
  Submitted: "early",
  Scheduled: "early",
  L1_Scheduled: "early",
  L2_Scheduled: "early",
  Rescheduled: "early",
  Vender_Submission: "progress",
  Online_Test: "progress",
  Client_Submission: "progress",
  L1_Interview: "progress",
  L2_Interview: "progress",
  Client_Selected: "progress",
  Background_Check: "progress",
  Feedback_Pending: "progress",
  L1_Cleared: "progress",
  L2_Cleared: "progress",
  Onboarding: "placed",
  Started_Billable: "placed",
  Selected: "placed",
  On_Hold: "neutral",
  Cancelled: "neutral",
  // Requirements / bench consultant statuses
  Open: "progress",
  Available: "placed",
  Marketing: "progress",
  Placed: "placed",
  "On Hold": "neutral",
  Closed: "neutral",
  Filled: "placed",
  Active: "placed",
  Inactive: "neutral",
  active: "placed",
  inactive: "neutral",
};

/** Human label for a stored code; unknown values are de-underscored as-is. */
export function statusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS[value] ?? value.replace(/_/g, " ");
}

/** Colour family: early (blue), progress (amber), placed (green), closed (red), neutral (grey).
 *  Anything not listed is a reject/closed-out status, matching GAS's buckets. */
export function statusTone(value: string | null | undefined): StatusTone {
  if (!value) return "neutral";
  return TONES[value] ?? "closed";
}

// GAS's canonical status colours (Index.html window.STATUS_COLORS), used for
// the outlined status pills so both apps read the same at a glance.
const COLORS: Record<string, string> = {
  // Submission pipeline (Recruitment + Bench share these)
  New_Resume: "#0288d1",
  Internal_Submission: "#1565c0",
  Submitted: "#1565c0",
  Vender_Submission: "#6a1b9a",
  Online_Test: "#0277bd",
  Client_Submission: "#00838f",
  L1_Interview: "#e65100",
  L2_Interview: "#6a1b9a",
  Client_Selected: "#2e7d32",
  Background_Check: "#00acc1",
  Onboarding: "#1b5e20",
  Started_Billable: "#6a1b9a",
  Internal_Reject: "#c62828",
  Vender_Reject: "#ad1457",
  Client_Reject: "#b71c1c",
  Blocklist: "#212121",
  Position_Closed: "#455a64",
  BGV_Failed: "#c62828",
  Client_Withdrawn_Offer: "#e64a19",
  Candidate_Backs_Out: "#8d6e63",
  Duplicate: "#616161",
  On_Hold: "#757575",
  L1_Reject: "#d32f2f",
  L2_Reject: "#9a0007",
  // Requirements
  Open: "#2e7d32",
  "On Hold": "#e65100",
  Closed: "#757575",
  Filled: "#6a1b9a",
  // Bench consultants
  Available: "#2e7d32",
  Marketing: "#1565c0",
  Interview: "#e65100",
  Placed: "#6a1b9a",
  // Interviews
  Scheduled: "#1565c0",
  L1_Scheduled: "#5e35b1",
  L2_Scheduled: "#4527a0",
  Feedback_Pending: "#f57f17",
  L1_Cleared: "#1976d2",
  L2_Cleared: "#0277bd",
  Selected: "#2e7d32",
  Cancelled: "#c62828",
  Rescheduled: "#e65100",
  No_Show: "#757575",
  Rejected: "#b71c1c",
  // Hotlist / users
  Active: "#2e7d32",
  Inactive: "#757575",
  active: "#2e7d32",
  inactive: "#c62828",
};

/** The status's GAS colour; grey for anything unknown. */
export function statusColor(value: string | null | undefined): string {
  return (value && COLORS[value]) || "#757575";
}
