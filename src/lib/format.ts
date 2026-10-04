import { isValidTimeZone } from "@/lib/timezone";

// Always pass an explicit locale (and timeZone for date-only values) so the
// string is identical whether it's produced during SSR (server's default
// ICU locale/TZ, e.g. UTC on Vercel) or during client hydration (browser's
// locale/TZ) — relying on the environment default causes a React hydration
// mismatch, and for date-only values can shift the displayed calendar day.

export function formatDateTime(date: Date | string, timeZone?: string): string {
  return new Date(date).toLocaleString("en-US", {
    // An unrecognized zone (Timezone used to be unvalidated free text) makes
    // toLocaleString throw a RangeError, which took down the whole page.
    timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Jul 13, 2026" — one unambiguous format everywhere (design review): the
// old 7/13/2026 read as 13 July or 7 December depending on who was looking.
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}
