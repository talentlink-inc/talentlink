"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function verifyMfaLogin(_prevState: string | null, formData: FormData) {
  const code = String(formData.get("code") ?? "");

  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !factors) return listError?.message ?? "Could not look up your two-factor method.";

  const factorId = factors.totp[0]?.id;
  if (!factorId) return "No two-factor method found on this account.";

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return error.message;

  redirect("/requirements");
}
