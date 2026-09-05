import { getTenantDbFor } from "@/lib/tenantDb";
import type { CalendarIntegration } from "@/generated/prisma/client";

type AuthResult = { provider: "google" | "microsoft"; accessToken: string };

async function refreshGoogleToken(integration: CalendarIntegration): Promise<AuthResult | null> {
  if (!integration.clientId || !integration.clientSecret || !integration.refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: integration.clientId,
      client_secret: integration.clientSecret,
      refresh_token: integration.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) return null;

  await getTenantDbFor(integration.tenantId).calendarIntegration.update({
    where: { tenantId: integration.tenantId },
    data: {
      accessToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return { provider: "google", accessToken: data.access_token };
}

async function refreshMicrosoftToken(integration: CalendarIntegration): Promise<AuthResult | null> {
  if (
    !integration.clientId ||
    !integration.clientSecret ||
    !integration.refreshToken ||
    !integration.microsoftTenantId
  ) {
    return null;
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${integration.microsoftTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: integration.clientId,
        client_secret: integration.clientSecret,
        refresh_token: integration.refreshToken,
        grant_type: "refresh_token",
        scope: "offline_access Calendars.ReadWrite User.Read",
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) return null;

  await getTenantDbFor(integration.tenantId).calendarIntegration.update({
    where: { tenantId: integration.tenantId },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? integration.refreshToken,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return { provider: "microsoft", accessToken: data.access_token };
}

async function getValidAuth(tenantId: string): Promise<AuthResult | null> {
  const integration = await getTenantDbFor(tenantId).calendarIntegration.findUnique({ where: { tenantId } });
  if (!integration || !integration.provider || !integration.accessToken) return null;

  const stillValid =
    integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) {
    return { provider: integration.provider as "google" | "microsoft", accessToken: integration.accessToken };
  }

  if (integration.provider === "google") return refreshGoogleToken(integration);
  if (integration.provider === "microsoft") return refreshMicrosoftToken(integration);
  return null;
}

export type InterviewForSync = {
  id: string;
  tenantId: string;
  interviewType: string;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  timezone: string | null;
  clientCompany: string | null;
  mode: string | null;
  outlookEventId: string | null;
  googleEventId: string | null;
  submission: {
    candidate: { name: string; email: string | null };
    requirement: { jobTitle: string } | null;
  };
};

// Best-effort: scheduling/editing/deleting an interview should never fail
// because the calendar sync call errored, so every branch here swallows its
// own errors rather than propagating them to the caller.
export async function syncInterviewToCalendar(interview: InterviewForSync): Promise<void> {
  if (!interview.scheduledAt) return;
  const auth = await getValidAuth(interview.tenantId);
  if (!auth) return;

  const start = interview.scheduledAt;
  const end = new Date(start.getTime() + (interview.durationMinutes ?? 60) * 60000);
  const timeZone = interview.timezone || "UTC";
  const summary = `Interview: ${interview.submission.candidate.name} — ${interview.interviewType}`;
  const description = [
    interview.submission.requirement?.jobTitle && `Role: ${interview.submission.requirement.jobTitle}`,
    interview.clientCompany && `Client: ${interview.clientCompany}`,
    interview.mode && `Mode: ${interview.mode}`,
  ]
    .filter(Boolean)
    .join("\n");
  const attendeeEmail = interview.submission.candidate.email;

  try {
    if (auth.provider === "google") {
      const body = {
        summary,
        description,
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : undefined,
      };
      const existingId = interview.googleEventId;
      const url = existingId
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingId}`
        : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
      const res = await fetch(`${url}?sendUpdates=all`, {
        method: existingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok && !existingId) {
        const data = await res.json();
        await getTenantDbFor(interview.tenantId).interview.update({
          where: { id: interview.id },
          data: { googleEventId: data.id },
        });
      }
    } else if (auth.provider === "microsoft") {
      const body = {
        subject: summary,
        body: { contentType: "text", content: description },
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
        attendees: attendeeEmail
          ? [
              {
                emailAddress: { address: attendeeEmail, name: interview.submission.candidate.name },
                type: "required",
              },
            ]
          : undefined,
      };
      const existingId = interview.outlookEventId;
      const url = existingId
        ? `https://graph.microsoft.com/v1.0/me/events/${existingId}`
        : "https://graph.microsoft.com/v1.0/me/events";
      const res = await fetch(url, {
        method: existingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok && !existingId) {
        const data = await res.json();
        await getTenantDbFor(interview.tenantId).interview.update({
          where: { id: interview.id },
          data: { outlookEventId: data.id },
        });
      }
    }
  } catch {
    // swallow — see function comment
  }
}

export async function deleteInterviewCalendarEvent(interview: InterviewForSync): Promise<void> {
  const auth = await getValidAuth(interview.tenantId);
  if (!auth) return;

  try {
    if (auth.provider === "google" && interview.googleEventId) {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${interview.googleEventId}?sendUpdates=all`,
        { method: "DELETE", headers: { Authorization: `Bearer ${auth.accessToken}` } }
      );
    } else if (auth.provider === "microsoft" && interview.outlookEventId) {
      await fetch(`https://graph.microsoft.com/v1.0/me/events/${interview.outlookEventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
    }
  } catch {
    // swallow — see syncInterviewToCalendar's comment
  }
}
