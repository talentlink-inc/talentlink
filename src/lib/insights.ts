// Insights (Dashboard + Reports, merged — see the design proposal): every
// number's definition lives here as a pure function so it can be tested and
// reads the same wherever it's shown.
//
// Two kinds of number:
// - "Now" figures (Overview): today / this week / upcoming, in the business
//   timezone.
// - "Period" figures (report tabs): for the period the viewer picked, with the
//   previous period of the same length for comparison.

import { utcToZonedLocal, zonedLocalToUtc } from "./timezone";

// Staffing desk runs on US Eastern (GAS used New York time for its reports).
export const BUSINESS_TIME_ZONE = "America/New_York";

export const PERIOD_KEYS = ["today", "week", "month", "last_month", "quarter", "custom"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];
export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  last_month: "Last month",
  quarter: "This quarter",
  custom: "Custom",
};

export type Period = {
  key: PeriodKey;
  start: Date; // inclusive
  end: Date; // exclusive
  prevStart: Date;
  prevEnd: Date;
  label: string; // "Oct 1 – Oct 31, 2026"
  from: string; // YYYY-MM-DD, first day
  to: string; // YYYY-MM-DD, last day (inclusive)
};

// --- calendar-date helpers (YYYY-MM-DD strings, no timezone) ---------------

type Ymd = { y: number; m: number; d: number }; // m is 1-12
const pad = (n: number) => String(n).padStart(2, "0");
const toStr = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;
function parseYmd(s: string): Ymd | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const v = { y: +m[1], m: +m[2], d: +m[3] };
  const check = new Date(Date.UTC(v.y, v.m - 1, v.d));
  return check.getUTCMonth() === v.m - 1 && check.getUTCDate() === v.d ? v : null;
}
function addDays(v: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(v.y, v.m - 1, v.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function addMonths(v: Ymd, months: number): Ymd {
  const t = new Date(Date.UTC(v.y, v.m - 1 + months, 1));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: 1 };
}
function daysBetween(a: Ymd, b: Ymd): number {
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}
/** Midnight at the start of a calendar day in the business timezone. */
function startOfDay(v: Ymd, tz: string): Date {
  return zonedLocalToUtc(`${toStr(v)}T00:00`, tz)!;
}
/** Today's calendar date in the business timezone. */
export function businessToday(now: Date, tz = BUSINESS_TIME_ZONE): string {
  return utcToZonedLocal(now, tz).slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function rangeLabel(first: Ymd, last: Ymd): string {
  const f = `${MONTHS[first.m - 1]} ${first.d}`;
  const l = `${MONTHS[last.m - 1]} ${last.d}, ${last.y}`;
  if (toStr(first) === toStr(last)) return l;
  return first.y === last.y ? `${f} – ${l}` : `${f}, ${first.y} – ${l}`;
}

/**
 * The period a report covers. Weeks start on Monday (as GAS's status report
 * did). An invalid or reversed custom range falls back to this month. A
 * custom range is capped at 366 days.
 */
export function resolvePeriod(
  key: string | undefined,
  now: Date,
  opts: { from?: string; to?: string; tz?: string } = {}
): Period {
  const tz = opts.tz ?? BUSINESS_TIME_ZONE;
  const today = parseYmd(businessToday(now, tz))!;
  const k: PeriodKey = (PERIOD_KEYS as readonly string[]).includes(key ?? "") ? (key as PeriodKey) : "month";

  let first: Ymd;
  let afterLast: Ymd; // first day after the period
  let prevFirst: Ymd;

  switch (k) {
    case "today":
      first = today;
      afterLast = addDays(today, 1);
      prevFirst = addDays(today, -1);
      break;
    case "week": {
      const dow = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay(); // 0 = Sunday
      first = addDays(today, dow === 0 ? -6 : 1 - dow);
      afterLast = addDays(first, 7);
      prevFirst = addDays(first, -7);
      break;
    }
    case "last_month":
      first = addMonths(today, -1);
      afterLast = addMonths(today, 0);
      prevFirst = addMonths(today, -2);
      break;
    case "quarter": {
      const qStartMonth = Math.floor((today.m - 1) / 3) * 3 + 1;
      first = { y: today.y, m: qStartMonth, d: 1 };
      afterLast = addMonths(first, 3);
      prevFirst = addMonths(first, -3);
      break;
    }
    case "custom": {
      const from = opts.from ? parseYmd(opts.from) : null;
      const to = opts.to ? parseYmd(opts.to) : null;
      if (from && to && daysBetween(from, to) >= 0 && daysBetween(from, to) <= 365) {
        first = from;
        afterLast = addDays(to, 1);
        prevFirst = addDays(first, -daysBetween(first, afterLast));
        break;
      }
      return resolvePeriod("month", now, { tz });
    }
    default:
      first = addMonths(today, 0);
      afterLast = addMonths(today, 1);
      prevFirst = addMonths(today, -1);
  }

  const last = addDays(afterLast, -1);
  return {
    key: k,
    start: startOfDay(first, tz),
    end: startOfDay(afterLast, tz),
    prevStart: startOfDay(prevFirst, tz),
    prevEnd: startOfDay(first, tz),
    label: rangeLabel(first, last),
    from: toStr(first),
    to: toStr(last),
  };
}

/** Today, this week (Monday start) and this month, for the Overview. */
export function nowWindows(now: Date, tz = BUSINESS_TIME_ZONE) {
  return {
    today: resolvePeriod("today", now, { tz }),
    week: resolvePeriod("week", now, { tz }),
    month: resolvePeriod("month", now, { tz }),
  };
}

export const inRange = (d: Date | string | null | undefined, start: Date, end: Date) => {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= start.getTime() && t < end.getTime();
};

/** % change vs the previous period; null when there's nothing to compare. */
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

// --- pipeline stages ---------------------------------------------------------

// How far a submission got. Only the current status is stored (no history), so
// a reject counts as having reached the stage it was rejected at — a client
// reject did reach the client — and any submission with an interview record
// reached the interview stage.
export const FUNNEL_STAGES = [
  { stage: 0, label: "Submitted" },
  { stage: 2, label: "Sent to vendor / client" },
  { stage: 3, label: "With client" },
  { stage: 4, label: "Interviewed" },
  { stage: 5, label: "Selected" },
  { stage: 6, label: "Started" },
] as const;

const STAGE: Record<string, number> = {
  New_Resume: 0,
  Duplicate: 0,
  Submitted: 1, // legacy bench status
  Internal_Submission: 1,
  Internal_Reject: 1,
  Blocklist: 1,
  Position_Closed: 1,
  On_Hold: 1,
  Vender_Submission: 2,
  Vender_Reject: 2,
  Online_Test: 2,
  Client_Submission: 3,
  Client_Reject: 3,
  L1_Interview: 4,
  L2_Interview: 4,
  L1_Reject: 4,
  L2_Reject: 4,
  Client_Selected: 5,
  Background_Check: 5,
  Onboarding: 5,
  BGV_Failed: 5,
  Client_Withdrawn_Offer: 5,
  Candidate_Backs_Out: 5,
  Started_Billable: 6,
};

export function stageOf(status: string, hasInterview = false): number {
  return Math.max(STAGE[status] ?? 0, hasInterview ? 4 : 0);
}

export function funnel(rows: { status: string; hasInterview?: boolean }[]) {
  const stages = rows.map((r) => stageOf(r.status, r.hasInterview));
  return FUNNEL_STAGES.map(({ stage, label }) => ({
    label,
    count: stages.filter((s) => s >= stage).length,
  }));
}

// Where active work sits right now (Overview): rejected / on-hold / duplicate
// submissions are out of the pipeline.
const OUT_OF_PIPELINE = new Set([
  "On_Hold",
  "Duplicate",
  "Internal_Reject",
  "Vender_Reject",
  "Client_Reject",
  "Blocklist",
  "BGV_Failed",
  "Client_Withdrawn_Offer",
  "Candidate_Backs_Out",
  "Position_Closed",
  "L1_Reject",
  "L2_Reject",
  "Started_Billable",
]);
export const PIPELINE_BUCKETS = [
  { label: "New / internal", stages: [0, 1] },
  { label: "With vendor", stages: [2] },
  { label: "With client", stages: [3] },
  { label: "Interviewing", stages: [4] },
  { label: "Selected", stages: [5] },
] as const;

export function pipelineNow(rows: { status: string }[]) {
  const active = rows.filter((r) => !OUT_OF_PIPELINE.has(r.status));
  return PIPELINE_BUCKETS.map((b) => ({
    label: b.label,
    count: active.filter((r) => (b.stages as readonly number[]).includes(stageOf(r.status))).length,
  }));
}

// --- breakdowns -------------------------------------------------------------

export type Count = { label: string; count: number };

/** Group and count, biggest first; blanks become `blankLabel`. */
export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined, blankLabel = "Not set"): Count[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const raw = key(r)?.toString().trim();
    const label = raw ? raw : blankLabel;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Top skills across consultants — the free-text skills field split on , ; / | */
export function topSkills(skillFields: string[], limit = 15): Count[] {
  const map = new Map<string, { label: string; count: number }>();
  for (const field of skillFields) {
    const seen = new Set<string>();
    for (const part of field.split(/[,;/|\n]+/)) {
      const label = part.trim().replace(/\s+/g, " ");
      if (label.length < 2 || label.length > 40) continue;
      const k = label.toLowerCase();
      if (seen.has(k)) continue; // count each consultant once per skill
      seen.add(k);
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { label, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

/** Submissions per calendar month (business timezone), oldest first. */
export function monthlyCounts(dates: (Date | string | null)[], now: Date, months = 6, tz = BUSINESS_TIME_ZONE): Count[] {
  const today = parseYmd(businessToday(now, tz))!;
  const buckets = Array.from({ length: months }, (_, i) => addMonths(today, i - months + 1));
  const keys = buckets.map((b) => `${b.y}-${pad(b.m)}`);
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const d of dates) {
    if (!d) continue;
    const k = utcToZonedLocal(new Date(d), tz).slice(0, 7);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return buckets.map((b, i) => ({ label: `${MONTHS[b.m - 1]} ${String(b.y).slice(2)}`, count: counts.get(keys[i])! }));
}

// --- team performance --------------------------------------------------------

export type PersonRow = {
  name: string;
  submissions: number;
  interviews: number;
  placements: number;
  interviewRate: number; // % of their period submissions that reached interview
};

/**
 * Per person, for a period: submissions they made, interviews held for their
 * candidates, and placements (selections) of their candidates.
 */
export function teamPerformance(input: {
  submissions: { owner: string | null; date: Date | string | null; status: string; hasInterview: boolean }[];
  interviews: { owner: string | null; date: Date | string | null; status: string }[];
  placements: { owner: string | null; date: Date | string | null }[];
  start: Date;
  end: Date;
}): PersonRow[] {
  const rows = new Map<string, PersonRow & { reached: number }>();
  const get = (owner: string | null) => {
    const name = owner?.trim() || "Unassigned";
    let r = rows.get(name);
    if (!r) {
      r = { name, submissions: 0, interviews: 0, placements: 0, interviewRate: 0, reached: 0 };
      rows.set(name, r);
    }
    return r;
  };
  for (const s of input.submissions) {
    if (!inRange(s.date, input.start, input.end)) continue;
    const r = get(s.owner);
    r.submissions++;
    if (stageOf(s.status, s.hasInterview) >= 4) r.reached++;
  }
  for (const i of input.interviews) {
    if (i.status === "Cancelled" || !inRange(i.date, input.start, input.end)) continue;
    get(i.owner).interviews++;
  }
  for (const p of input.placements) {
    if (inRange(p.date, input.start, input.end)) get(p.owner).placements++;
  }
  return [...rows.values()]
    .map(({ reached, ...r }) => ({ ...r, interviewRate: pct(reached, r.submissions) }))
    .sort((a, b) => b.submissions - a.submissions || b.interviews - a.interviews || a.name.localeCompare(b.name));
}

// --- CSV ------------------------------------------------------------------------

/** RFC 4180 CSV, with spreadsheet-formula injection neutralised. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
