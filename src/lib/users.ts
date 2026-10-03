export const USER_ROLES = ["Admin", "Manager", "Recruiter", "BenchSales", "HR"] as const;

export const USER_STATUSES = ["active", "inactive"] as const;

export function canManageUsers(role: string): boolean {
  return role === "Admin";
}

export function canViewUsers(role: string): boolean {
  return role === "Admin" || role === "Manager";
}

// Requirements/Submissions/Interviews/Placements are a shared resource for
// Admin and Recruiter (any Recruiter can create/edit any record, matching
// ITStaffing's model) — Manager, BenchSales, and HR are view-only until their
// own dedicated modules exist.
export function canManageRecruitment(role: string): boolean {
  return role === "Admin" || role === "Recruiter";
}

// Bench Sales — GAS gates hotlist/status/assignment changes to Admin,
// Manager and Bench Sales (Hotlist.js / BenchSales.js _requireRole), and
// Recruiters/HR don't see the module at all.
export function canAccessBench(role: string): boolean {
  return role === "Admin" || role === "Manager" || role === "BenchSales";
}

// GAS deleteBenchConsultant: only Admin/Manager may delete anyone's bench
// consultant; everyone else only the ones they market themselves.
export function canDeleteAnyBenchConsultant(role: string): boolean {
  return role === "Admin" || role === "Manager";
}

export type DataPermissions = {
  canViewResume: boolean;
  canDownloadResume: boolean;
  canViewPhone: boolean;
  canViewEmail: boolean;
};
