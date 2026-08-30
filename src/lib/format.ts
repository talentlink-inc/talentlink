// Always pass an explicit locale (and timeZone for date-only values) so the
// string is identical whether it's produced during SSR (server's default
// ICU locale/TZ, e.g. UTC on Vercel) or during client hydration (browser's
// locale/TZ) — relying on the environment default causes a React hydration
// mismatch, and for date-only values can shift the displayed calendar day.

export function formatDateTime(date: Date | string, timeZone?: string): string {
  return new Date(date).toLocaleString("en-US", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { timeZone: "UTC" });
}
