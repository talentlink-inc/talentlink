import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const origin = url.origin;

  if (oauthError) {
    return NextResponse.redirect(`${origin}/interviews?integration_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/interviews?integration_error=missing_code`);
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const integration = await db.calendarIntegration.findUnique({ where: { tenantId: tenant.id } });
  if (!integration?.clientId || !integration.clientSecret || !integration.microsoftTenantId) {
    return NextResponse.redirect(`${origin}/interviews?integration_error=missing_credentials`);
  }

  const redirectUri = `${origin}/api/integrations/microsoft/callback`;

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${integration.microsoftTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: integration.clientId,
        client_secret: integration.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "offline_access Calendars.ReadWrite User.Read",
      }),
    }
  );
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${origin}/interviews?integration_error=${encodeURIComponent(tokenData.error_description ?? "token_exchange_failed")}`
    );
  }

  let connectedEmail: string | null = null;
  try {
    const infoRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json();
      connectedEmail = info.mail ?? info.userPrincipalName ?? null;
    }
  } catch {
    // non-fatal
  }

  await db.calendarIntegration.update({
    where: { tenantId: tenant.id },
    data: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? integration.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      connectedEmail,
    },
  });

  return NextResponse.redirect(`${origin}/interviews?integration_connected=1`);
}
