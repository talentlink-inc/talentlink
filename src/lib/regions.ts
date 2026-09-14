// Mirrors the original app's Regions.js — single source of truth for the
// countries/regions the portal supports. Drives the Requirement "Country"
// checkboxes and the User "Region" restriction checkboxes.
//
// The original also has per-region country-expansion panels (Europe/APAC/
// UAE/South America -> specific countries) — deliberately not ported, since
// those exist purely to drive per-country Ceipal job-board posting, which
// is out of scope here.
export const SUPPORTED_REGIONS = [
  "USA",
  "India",
  "Canada",
  "UK",
  "Europe",
  "APAC",
  "Mexico",
  "South America",
  "UAE",
  "Other",
] as const;

export type SupportedRegion = (typeof SUPPORTED_REGIONS)[number];

export function parseRegionsCsv(csv: string | null | undefined): string[] {
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Validates a comma-joined region string against the canonical list —
// unknown tokens are dropped, matching the original's _sanitizeRegionsCsv_.
export function sanitizeRegionsCsv(csv: string | null | undefined): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of parseRegionsCsv(csv)) {
    const match = SUPPORTED_REGIONS.find((r) => r.toLowerCase() === tok.toLowerCase());
    if (match && !seen.has(match)) {
      seen.add(match);
      out.push(match);
    }
  }
  return out.join(", ");
}

export function toggleRegion(current: string, value: string): string {
  const set = new Set(parseRegionsCsv(current));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set).join(", ");
}
