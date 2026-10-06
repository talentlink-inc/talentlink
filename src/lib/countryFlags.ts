import { parseRegionsCsv } from "./regions";

// Flags shown before a requirement's title, as in GAS (_reqCountryFlag_):
// up to two, for the requirement's regions.
const FLAGS: Record<string, string> = {
  USA: "🇺🇸",
  "United States": "🇺🇸",
  Canada: "🇨🇦",
  India: "🇮🇳",
  UK: "🇬🇧",
  "United Kingdom": "🇬🇧",
  Mexico: "🇲🇽",
  UAE: "🇦🇪",
  Europe: "🇪🇺",
  "South America": "🌎",
  APAC: "🌏",
  Other: "🌐",
};

export function countryFlags(regionsCsv: string | null | undefined, max = 2): string {
  const flags: string[] = [];
  for (const region of parseRegionsCsv(regionsCsv)) {
    const f = FLAGS[region] ?? "🌐";
    if (!flags.includes(f)) flags.push(f);
  }
  return flags.slice(0, max).join("");
}
