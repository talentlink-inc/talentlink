import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const integration = await db.calendarIntegration.findUnique({ where: { tenantId: tenant.id } });
  if (!integration?.clientId) {
    return NextResponse.redirect(new URL("/interviews?integration_error=missing_credentials", request.url));
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/integrations/google/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", integration.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email"
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", tenant.id);

  return NextResponse.redirect(url.toString());
}
