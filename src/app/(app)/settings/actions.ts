"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";

const PERMISSION_ERROR = "Only Admins can change tenant settings.";

export type SettingsState = { error: string | null; saved: boolean };
const initialState: SettingsState = { error: null, saved: false };

export type TenantSettings = {
  aiProvider: string;
  hasAiApiKey: boolean;
  logoStyle: string;
};

export async function getTenantSettings(): Promise<TenantSettings> {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const full = await db.tenant.findUnique({ where: { id: tenant.id } });
  return {
    aiProvider: full?.aiProvider ?? "groq",
    hasAiApiKey: !!full?.aiApiKey,
    logoStyle: full?.logoStyle ?? "full",
  };
}

const settingsSchema = z.object({
  aiProvider: z.enum(["groq", "anthropic"]),
  aiApiKey: z.string().trim().optional(), // blank = leave the existing key untouched
  clearAiApiKey: z.coerce.boolean().optional(),
  logoStyle: z.enum(["people", "wordmark", "full"]),
});

export async function updateTenantSettings(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) return { ...initialState, error: PERMISSION_ERROR };

  const parsed = settingsSchema.safeParse({
    aiProvider: formData.get("aiProvider"),
    aiApiKey: formData.get("aiApiKey") || undefined,
    clearAiApiKey: formData.get("clearAiApiKey") === "on",
    logoStyle: formData.get("logoStyle"),
  });
  if (!parsed.success) {
    return { ...initialState, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      aiProvider: data.aiProvider,
      logoStyle: data.logoStyle,
      // Only touches the stored key when the admin actually typed a new one
      // or explicitly asked to clear it — an empty field on every other
      // save just means "leave it as-is", not "erase it".
      ...(data.clearAiApiKey ? { aiApiKey: null } : data.aiApiKey ? { aiApiKey: data.aiApiKey } : {}),
    },
  });

  revalidatePath("/settings");
  return { error: null, saved: true };
}
