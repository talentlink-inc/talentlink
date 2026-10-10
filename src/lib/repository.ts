// Repository (GAS PageRepository.html): resume pool filters, sorting and the
// country heuristic, kept pure so the page, the migration and tests agree.

// GAS _rdbDeriveCountry: free-text location → USA / India / Canada / UK / Other.
const US_STATES =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)\b/i;

export const REPOSITORY_COUNTRIES = ["USA", "India", "Canada", "UK", "Other"] as const;
export type RepositoryCountry = (typeof REPOSITORY_COUNTRIES)[number];

export function deriveCountry(location: string | null | undefined): RepositoryCountry {
  if (!location) return "Other";
  const s = location.toLowerCase();
  if (/\b(india|bangalore|bengaluru|hyderabad|chennai|mumbai|delhi|pune|kolkata|noida|gurgaon|gurugram)\b/.test(s)) return "India";
  if (/\b(canada|toronto|montreal|vancouver|ottawa|calgary)\b/.test(s)) return "Canada";
  if (/\b(uk|united kingdom|london|england|scotland|britain)\b/.test(s)) return "UK";
  if (/\b(usa|u\.s\.a\.|united states|u\.s\.|america)\b/.test(s)) return "USA";
  if (US_STATES.test(location)) return "USA";
  return "Other";
}

// Visa filter options, as GAS.
export const REPOSITORY_VISAS = ["USC", "GC", "GC-EAD", "H1B", "H4-EAD", "OPT", "STEM-OPT", "L1", "L2-EAD", "TN", "O1"] as const;

export const EXPERIENCE_BANDS = [
  { value: "0-2", label: "0–2 yrs", min: 0, max: 2 },
  { value: "3-5", label: "3–5 yrs", min: 3, max: 5 },
  { value: "6-10", label: "6–10 yrs", min: 6, max: 10 },
  { value: "11-99", label: "11+ yrs", min: 11, max: 99 },
] as const;

export const REPOSITORY_SORTS = [
  { value: "added-desc", label: "Newest first" },
  { value: "added-asc", label: "Oldest first" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "location-asc", label: "Location A–Z" },
  { value: "country-asc", label: "Country A–Z" },
  { value: "years-desc", label: "Years (most first)" },
  { value: "years-asc", label: "Years (least first)" },
] as const;

export const REPOSITORY_PAGE_SIZE = 50;

export type RepositoryQuery = {
  q: string;
  visa: string;
  exp: string;
  country: string;
  sort: string;
  page: number;
};

/** Parse and sanitize the URL's filter params (anything unknown is dropped). */
export function parseRepositoryQuery(p: Record<string, string | string[] | undefined>): RepositoryQuery {
  const one = (k: string) => {
    const v = p[k];
    return (Array.isArray(v) ? v[0] : v)?.toString().trim() ?? "";
  };
  const visa = one("visa");
  const exp = one("exp");
  const country = one("country");
  const sort = one("sort");
  const page = Math.max(1, Math.min(10_000, Math.trunc(Number(one("page"))) || 1));
  return {
    q: one("q").slice(0, 100),
    visa: (REPOSITORY_VISAS as readonly string[]).includes(visa) ? visa : "",
    exp: EXPERIENCE_BANDS.some((b) => b.value === exp) ? exp : "",
    country: (REPOSITORY_COUNTRIES as readonly string[]).includes(country) ? country : "",
    sort: REPOSITORY_SORTS.some((s) => s.value === sort) ? sort : "added-desc",
    page,
  };
}

/** "today", "3d", "5w", "4mo", "2y" — GAS's Resume Age column. */
export function resumeAge(date: Date | string | null | undefined, now = new Date()): string {
  if (!date) return "—";
  const days = Math.floor((now.getTime() - new Date(date).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  if (days < 730) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}
