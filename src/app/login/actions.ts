"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDbFor } from "@/lib/tenantDb";
import { authErrorMessage } from "@/lib/authErrors";

// Mirrors the original app's Auth.js lockout: 5 failed attempts locks the
// account for 15 minutes. Durable in Postgres (failedLoginCount/lockedUntil
// on User) instead of Auth.js's CacheService entry, since a serverless
// deploy has no shared in-memory cache across instances.
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function minutesRemaining(lockedUntil: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
}

export async function signIn(_prevState: string | null, formData: FormData) {
  // Copy-pasting a password often carries an accidental leading/trailing
  // space along, which then fails auth even though the "real" password is
  // right — trim both before they ever reach Supabase.
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  const tenant = await getCurrentTenant();
  const db = getTenantDbFor(tenant.id);
  const existingUser = await db.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (existingUser?.lockedUntil && existingUser.lockedUntil.getTime() > Date.now()) {
    return `Account locked due to too many failed attempts. Try again in ${minutesRemaining(existingUser.lockedUntil)} minute(s).`;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (existingUser) {
      const failCount = existingUser.failedLoginCount + 1;
      const locked = failCount >= MAX_LOGIN_ATTEMPTS;
      await db.user.update({
        where: { id: existingUser.id, tenantId: tenant.id },
        data: {
          failedLoginCount: locked ? 0 : failCount,
          lockedUntil: locked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      if (locked) {
        return "Account locked due to too many failed attempts. Try again in 15 minutes.";
      }
      const attemptsLeft = MAX_LOGIN_ATTEMPTS - failCount;
      if (attemptsLeft <= 2) {
        return `${authErrorMessage(error)} ${attemptsLeft} attempt(s) remaining before lockout.`;
      }
    }
    return authErrorMessage(error);
  }

  if (existingUser && (existingUser.failedLoginCount > 0 || existingUser.lockedUntil)) {
    await db.user.update({
      where: { id: existingUser.id, tenantId: tenant.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  // Password verified — but if this account has TOTP enrolled, the session
  // is only aal1 until the 6-digit code is verified too.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    redirect("/login/verify");
  }

  redirect("/requirements");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type ForgotPasswordState = { error: string | null; sent: boolean };

// Original app's "Forgot Password?" (Auth.js) emails a typed 6-digit OTP;
// this uses Supabase's own recovery-link flow instead (auth/callback ->
// /auth/set-password already exists for exactly this, since it's the same
// "prove you own this inbox, then set a new password" mechanism Supabase
// uses for invites) — same self-service outcome, a link instead of a code.
// Always reports success either way, so this can't be used to enumerate
// which emails have accounts.
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required.", sent: false };

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/auth/callback?next=/auth/set-password`,
  });
  if (error) return { error: authErrorMessage(error), sent: false };

  return { error: null, sent: true };
}
