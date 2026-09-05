"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generatePassword } from "@/lib/password";
import { USER_ROLES, USER_STATUSES, canManageUsers } from "@/lib/users";

export type UserFormState = {
  error: string | null;
  generatedPassword?: string | null;
};
const initialState: UserFormState = { error: null };

const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  phone: z.string().trim().optional(),
  canViewResume: z.coerce.boolean(),
  canDownloadResume: z.coerce.boolean(),
  canViewPhone: z.coerce.boolean(),
  canViewEmail: z.coerce.boolean(),
});

function parseForm(formData: FormData) {
  return userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    status: formData.get("status"),
    phone: formData.get("phone") || undefined,
    canViewResume: formData.get("canViewResume") === "on",
    canDownloadResume: formData.get("canDownloadResume") === "on",
    canViewPhone: formData.get("canViewPhone") === "on",
    canViewEmail: formData.get("canViewEmail") === "on",
  });
}

async function requireAdmin() {
  const currentUser = await getCurrentUser();
  if (!canManageUsers(currentUser.role)) {
    throw new Error("Only Admins can manage users.");
  }
  return currentUser;
}

export async function createUser(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();

  const existing = await db.user.findFirst({
    where: { tenantId: tenant.id, email: { equals: data.email, mode: "insensitive" } },
  });
  if (existing) {
    return { error: `A user with email "${data.email}" already exists.` };
  }

  const password = generatePassword();
  const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
    email: data.email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return { error: authError?.message ?? "Failed to create the login account." };
  }

  try {
    await db.user.create({
      data: {
        tenantId: tenant.id,
        authUserId: authData.user.id,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        phone: data.phone || null,
        canViewResume: data.canViewResume,
        canDownloadResume: data.canDownloadResume,
        canViewPhone: data.canViewPhone,
        canViewEmail: data.canViewEmail,
      },
    });
  } catch (err) {
    await getSupabaseAdmin().auth.admin.deleteUser(authData.user.id).catch(() => {});
    throw err;
  }

  revalidatePath("/users");
  return { error: null, generatedPassword: password };
}

export async function updateUser(
  id: string,
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();

  const existing = await db.user.findUnique({ where: { id, tenantId: tenant.id } });
  if (!existing) return { error: "User not found." };

  const emailTaken = await db.user.findFirst({
    where: {
      tenantId: tenant.id,
      email: { equals: data.email, mode: "insensitive" },
      id: { not: id },
    },
  });
  if (emailTaken) {
    return { error: `A user with email "${data.email}" already exists.` };
  }

  if (existing.authUserId && data.email.toLowerCase() !== existing.email.toLowerCase()) {
    const { error: authError } = await getSupabaseAdmin().auth.admin.updateUserById(
      existing.authUserId,
      { email: data.email }
    );
    if (authError) {
      return { error: `Could not update login email: ${authError.message}` };
    }
  }

  await db.user.update({
    where: { id, tenantId: tenant.id },
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status,
      phone: data.phone || null,
      canViewResume: data.canViewResume,
      canDownloadResume: data.canDownloadResume,
      canViewPhone: data.canViewPhone,
      canViewEmail: data.canViewEmail,
    },
  });

  revalidatePath("/users");
  return initialState;
}

export async function toggleUserStatus(id: string): Promise<{ error: string | null }> {
  const currentUser = await requireAdmin();
  if (currentUser.id === id) {
    return { error: "You cannot deactivate your own account." };
  }
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.user.findUnique({ where: { id, tenantId: tenant.id } });
  if (!existing) return { error: "User not found." };

  await db.user.update({
    where: { id, tenantId: tenant.id },
    data: { status: existing.status === "active" ? "inactive" : "active" },
  });
  revalidatePath("/users");
  return { error: null };
}

export async function resetUserPassword(
  id: string
): Promise<{ error: string | null; password?: string }> {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.user.findUnique({ where: { id, tenantId: tenant.id } });
  if (!existing) return { error: "User not found." };
  if (!existing.authUserId) return { error: "This user has no login account to reset." };

  const password = generatePassword();
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(existing.authUserId, {
    password,
  });
  if (error) return { error: error.message };

  return { error: null, password };
}

export async function deleteUser(id: string): Promise<{ error: string | null }> {
  const currentUser = await requireAdmin();
  if (currentUser.id === id) {
    return { error: "You cannot delete your own account." };
  }
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.user.findUnique({ where: { id, tenantId: tenant.id } });
  if (!existing) return { error: "User not found." };

  try {
    await db.user.delete({ where: { id, tenantId: tenant.id } });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Foreign key constraint")) {
      return {
        error: "This user has associated requirements, submissions, or interviews — deactivate instead of deleting.",
      };
    }
    throw err;
  }

  if (existing.authUserId) {
    await getSupabaseAdmin().auth.admin.deleteUser(existing.authUserId).catch(() => {});
  }

  revalidatePath("/users");
  return { error: null };
}
