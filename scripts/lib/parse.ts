import { createHash } from "node:crypto";

// The source spreadsheet's locale is en_GB and its timezone America/New_York,
// so FORMATTED_VALUE dates come back as "DD/MM/YYYY HH:MM:SS" wall-clock
// time in New York. The first migration run fed these straight to
// `new Date()`, which reads them as MM/DD — every day > 12 failed to parse
// and every other date had its day and month swapped.
const SHEET_TIME_ZONE = "America/New_York";
const SHEET_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

export function parseSheetDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(SHEET_DATE_PATTERN);
  if (!match) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [, day, month, year, hour = "0", minute = "0", second = "0"] = match;
  const wallClockAsUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  if (new Date(wallClockAsUtc).getUTCDate() !== +day) return null; // e.g. 31/02
  return new Date(wallClockAsUtc - timeZoneOffsetMs(wallClockAsUtc, SHEET_TIME_ZONE));
}

// Offset (zone wall-clock minus UTC) at the given instant. Evaluated at the
// wall-clock-as-UTC instant, which is only off within a DST transition hour.
function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const zoned = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return zoned - utcMs;
}

// Rate columns in the source sheet are free text and occasionally contain
// garbage (e.g. a mis-columned timestamp) — stripping non-numeric chars from
// something like "2/08/2026 10:50:53" produces a 14-digit number that
// overflows the DB column. Anything above a generous real-world rate ceiling
// is treated as bad data rather than truncated/rejected by Postgres.
const MAX_PLAUSIBLE_RATE = 1_000_000;

export function parseDecimal(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (Number.isNaN(num) || Math.abs(num) >= MAX_PLAUSIBLE_RATE) return null;
  return num.toFixed(2);
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

// Some legacy text fields carry raw HTML pasted into the GAS app (e.g. from
// Teams — `<span data-teams="true">...`). Only fields containing a
// recognizable tag are touched, not any stray "<"/">" in ordinary text.
export const HTML_TAG_PATTERN = /<\/?(?:span|div|br|p|b|i|u|ul|ol|li|a|strong|em|table|tr|td|font)\b[^>]*>/i;

export function stripHtml(input: string): string {
  let text = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'");
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
