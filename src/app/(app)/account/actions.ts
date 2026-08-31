"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getMfaStatus(): Promise<{ enrolled: boolean; factorId: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return { enrolled: false, factorId: null };
  const totp = data.totp[0];
  return { enrolled: !!totp, factorId: totp?.id ?? null };
}

export async function startMfaEnrollment(): Promise<{
  error: string | null;
  factorId?: string;
  qrCode?: string;
  secret?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "TalentLink",
  });
  if (error || !data) return { error: error?.message ?? "Could not start enrollment." };
  if (data.type !== "totp") return { error: "Unexpected factor type." };

  return {
    error: null,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyMfaEnrollment(
  factorId: string,
  code: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: error.message };
  revalidatePath("/account");
  return { error: null };
}

export async function disableMfa(factorId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };
  revalidatePath("/account");
  return { error: null };
}
