import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const origin = url.origin;

  if (oauthError) {
    return NextResponse.redirect(`${origin}/interviews?integration_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/interviews?integration_error=missing_code`);
  }

  const tenant = await getCurrentTenant();
  const integration = await prisma.calendarIntegration.findUnique({ where: { tenantId: tenant.id } });
  if (!integration?.clientId || !integration.clientSecret) {
    return NextResponse.redirect(`${origin}/interviews?integration_error=missing_credentials`);
  }

  const redirectUri = `${origin}/api/integrations/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: integration.clientId,
      client_secret: integration.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${origin}/interviews?integration_error=${encodeURIComponent(tokenData.error_description ?? "token_exchange_failed")}`
    );
  }

  let connectedEmail: string | null = null;
  try {
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json();
      connectedEmail = info.email ?? null;
    }
  } catch {
    // non-fatal — connection still succeeds without a display email
  }

  await prisma.calendarIntegration.update({
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
