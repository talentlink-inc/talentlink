export const USER_ROLES = ["Admin", "Manager", "Recruiter", "BenchSales", "HR"] as const;

export const USER_STATUSES = ["active", "inactive"] as const;

export function canManageUsers(role: string): boolean {
  return role === "Admin";
}

export function canViewUsers(role: string): boolean {
  return role === "Admin" || role === "Manager";
}
