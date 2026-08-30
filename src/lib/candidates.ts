import { createHash } from "node:crypto";

// Mirrors scripts/lib/parse.ts's candidateIdentityHash — kept separate rather
// than shared, since the migration script deliberately doesn't depend on
// app code (it's a one-off tool that should keep working even if app code
// changes shape).
export function candidateIdentityHash(
  email: string | null,
  phone: string | null,
  fallbackSeed: string
): string {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  const normalizedPhone = (phone ?? "").replace(/\D/g, "");
  const key =
    normalizedEmail || normalizedPhone
      ? `${normalizedEmail}|${normalizedPhone}`
      : `no-contact|${fallbackSeed}`;
  return createHash("sha256").update(key).digest("hex");
}
