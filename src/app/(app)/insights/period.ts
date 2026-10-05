import { resolvePeriod } from "@/lib/insights";

export type InsightsSearchParams = Promise<{ period?: string; from?: string; to?: string }>;

/** The report period from the URL (?period=…&from=…&to=…); defaults to this month. */
export async function periodFromParams(searchParams: InsightsSearchParams) {
  const { period, from, to } = await searchParams;
  return resolvePeriod(period, new Date(), { from, to });
}
