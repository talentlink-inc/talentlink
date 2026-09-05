import { getCurrentUser } from "@/lib/auth";

// Platform-admin access (the ops console) is a Digital Links Inc concept,
// not a tenant role — it's YOU managing every tenant on the platform, not an
// Admin managing their own workspace. There's no tenant-scoped "platform
// admin" role in the schema on purpose: this is a short, explicit allowlist
// of real people, not something any tenant's own Admin can grant themselves
// by editing a role dropdown.
function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return platformAdminEmails().has(user.email.toLowerCase());
}

export async function requirePlatformAdmin() {
  if (!(await isPlatformAdmin())) {
    throw new Error("Platform ops is restricted to Digital Links Inc staff.");
  }
}
