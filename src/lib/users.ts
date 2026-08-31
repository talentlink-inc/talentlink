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

export type DataPermissions = {
  canViewResume: boolean;
  canDownloadResume: boolean;
  canViewPhone: boolean;
  canViewEmail: boolean;
};
