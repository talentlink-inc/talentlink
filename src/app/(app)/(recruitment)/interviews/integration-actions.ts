"use server";

import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";

export type IntegrationStatus = {
  provider: "google" | "microsoft" | null;
  connectedEmail: string | null;
  hasCredentials: boolean;
  isConnected: boolean;
};

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    throw new Error("Only Admins can manage calendar integration.");
  }
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const integration = await db.calendarIntegration.findUnique({ where: { tenantId: tenant.id } });
  if (!integration) {
    return { provider: null, connectedEmail: null, hasCredentials: false, isConnected: false };
  }
  return {
    provider: (integration.provider as "google" | "microsoft" | null) ?? null,
    connectedEmail: integration.connectedEmail,
    hasCredentials: !!integration.clientId && !!integration.clientSecret,
    isConnected: !!integration.accessToken,
  };
}

export async function saveIntegrationCredentials(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requireAdmin();

  const provider = String(formData.get("provider") ?? "");
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  const microsoftTenantId = String(formData.get("microsoftTenantId") ?? "").trim();

  if (provider !== "google" && provider !== "microsoft") {
    return { error: "Select a provider." };
  }
  if (!clientId || !clientSecret) {
    return { error: "Client ID and Client Secret are required." };
  }
  if (provider === "microsoft" && !microsoftTenantId) {
    return { error: "Tenant ID is required for Microsoft." };
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.calendarIntegration.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      provider,
      clientId,
      clientSecret,
      microsoftTenantId: provider === "microsoft" ? microsoftTenantId : null,
    },
    update: {
      provider,
      clientId,
      clientSecret,
      microsoftTenantId: provider === "microsoft" ? microsoftTenantId : null,
      // Credentials changed — any existing connection was authorized under
      // the old app registration and can't be trusted to still be valid.
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      connectedEmail: null,
    },
  });

  revalidatePath("/interviews");
  return { error: null };
}

export async function disconnectIntegration(): Promise<{ error: string | null }> {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  await db.calendarIntegration.update({
    where: { tenantId: tenant.id },
    data: { accessToken: null, refreshToken: null, tokenExpiresAt: null, connectedEmail: null },
  });
  revalidatePath("/interviews");
  return { error: null };
}
