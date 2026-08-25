import { createHash } from "node:crypto";

export function parseSheetDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDecimal(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num.toFixed(2);
}

export function parseInt10(value: string | undefined | null): number | null {
  if (!value) return null;
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

export function parseBool(value: string | undefined | null): boolean {
  return ["true", "yes", "y", "1"].includes((value ?? "").trim().toLowerCase());
}

// Candidates in the source app only exist embedded inside submission rows —
// there's no separate Candidates sheet — so identity is derived from
// email+phone. Falls back to a name+legacyId hash (not real dedup, just a
// stable, collision-safe key) when neither contact field is present.
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

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
