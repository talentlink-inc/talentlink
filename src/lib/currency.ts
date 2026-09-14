import { parseRegionsCsv } from "./regions";

// A UK requirement can bill in USD; an India-based candidate's pay rate can
// still be quoted in USD too — the region only supplies a sensible default,
// never a constraint. Currency is always a separate, independently editable
// field next to each rate.
export const SUPPORTED_CURRENCIES = ["USD", "GBP", "EUR", "INR", "CAD", "AUD", "MXN", "AED", "SGD"] as const;

const REGION_DEFAULT_CURRENCY: Record<string, string> = {
  USA: "USD",
  India: "INR",
  Canada: "CAD",
  UK: "GBP",
  Europe: "EUR",
  APAC: "USD", // multi-currency region — USD is the common billing fallback
  Mexico: "MXN",
  "South America": "USD", // multi-currency region — same fallback
  UAE: "AED",
  Other: "USD",
};

// `regionsCsv` is a Requirement.country or Candidate/Submission country
// value (comma-joined SUPPORTED_REGIONS entries) — the first region present
// picks the default; multi-region requirements just default off whichever
// was selected first, same as any other "first wins" default.
export function defaultCurrencyForRegions(regionsCsv: string | null | undefined): string {
  const first = parseRegionsCsv(regionsCsv)[0];
  return (first && REGION_DEFAULT_CURRENCY[first]) || "USD";
}
