import { describe, expect, it } from "vitest";
import {
  changePct,
  countBy,
  funnel,
  monthlyCounts,
  pipelineNow,
  resolvePeriod,
  stageOf,
  teamPerformance,
  toCsv,
  topSkills,
} from "./insights";
import { SUBMISSION_STATUSES } from "./recruitment";

// Wed Oct 14 2026, 10:00 New York time (EDT, UTC-4).
const NOW = new Date("2026-10-14T14:00:00Z");

describe("[unit] report periods (business timezone, America/New_York)", () => {
  it("this month runs from the 1st to the last day, compared with last month", () => {
    const p = resolvePeriod("month", NOW);
    expect([p.from, p.to]).toEqual(["2026-10-01", "2026-10-31"]);
    expect(p.start.toISOString()).toBe("2026-10-01T04:00:00.000Z"); // midnight EDT
    expect(p.end.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(p.prevStart.toISOString()).toBe("2026-09-01T04:00:00.000Z");
    expect(p.prevEnd.getTime()).toBe(p.start.getTime());
    expect(p.label).toBe("Oct 1 – Oct 31, 2026");
  });

  it("weeks start on Monday; a Sunday belongs to the week that started six days earlier", () => {
    expect(resolvePeriod("week", NOW).from).toBe("2026-10-12");
    const sunday = new Date("2026-10-18T16:00:00Z");
    expect(resolvePeriod("week", sunday)).toMatchObject({ from: "2026-10-12", to: "2026-10-18" });
  });

  it("today is the New York calendar day, not UTC's", () => {
    // 11:30 PM New York on Oct 14 is already Oct 15 in UTC.
    const lateEvening = new Date("2026-10-15T03:30:00Z");
    expect(resolvePeriod("today", lateEvening)).toMatchObject({ from: "2026-10-14", to: "2026-10-14", label: "Oct 14, 2026" });
  });

  it("last month and this quarter cross year boundaries correctly", () => {
    const jan = new Date("2026-01-10T15:00:00Z");
    expect(resolvePeriod("last_month", jan)).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(resolvePeriod("quarter", jan)).toMatchObject({ from: "2026-01-01", to: "2026-03-31" });
    expect(resolvePeriod("quarter", jan).prevStart.toISOString()).toBe("2025-10-01T04:00:00.000Z");
  });

  it("handles the DST change inside a period (EDT → EST in November)", () => {
    const p = resolvePeriod("month", new Date("2026-11-20T15:00:00Z"));
    expect(p.start.toISOString()).toBe("2026-11-01T04:00:00.000Z"); // still EDT at midnight Nov 1
    expect(p.end.toISOString()).toBe("2026-12-01T05:00:00.000Z"); // EST
  });

  it("a custom range includes its last day and compares with the same number of days before", () => {
    const p = resolvePeriod("custom", NOW, { from: "2026-09-10", to: "2026-09-19" });
    expect(p).toMatchObject({ key: "custom", from: "2026-09-10", to: "2026-09-19" });
    expect(p.end.toISOString()).toBe("2026-09-20T04:00:00.000Z");
    expect(p.prevStart.toISOString()).toBe("2026-08-31T04:00:00.000Z"); // 10 days earlier
  });

  it("[negative] reversed, malformed, impossible or over-long custom ranges fall back to this month", () => {
    for (const [from, to] of [
      ["2026-09-19", "2026-09-10"],
      ["2026-9-1", "2026-09-10"],
      ["2026-02-30", "2026-03-02"],
      ["2024-01-01", "2026-01-01"],
      [undefined, undefined],
    ]) {
      expect(resolvePeriod("custom", NOW, { from, to }).key).toBe("month");
    }
    expect(resolvePeriod("nonsense", NOW).key).toBe("month");
    expect(resolvePeriod(undefined, NOW).key).toBe("month");
  });
});

describe("[unit] pipeline stages and funnel", () => {
  it("every submission status maps to a stage", () => {
    for (const s of SUBMISSION_STATUSES) expect(stageOf(s)).toBeGreaterThanOrEqual(0);
    expect(stageOf("Client_Reject")).toBe(3); // a client reject did reach the client
    expect(stageOf("Started_Billable")).toBe(6);
    expect(stageOf("Internal_Submission", true)).toBe(4); // has an interview record
  });

  it("the funnel is cumulative and never increases down the stages", () => {
    const f = funnel([
      { status: "New_Resume" },
      { status: "Vender_Submission" },
      { status: "Client_Reject" },
      { status: "L1_Interview" },
      { status: "Client_Selected" },
      { status: "Started_Billable" },
    ]);
    expect(f.map((s) => s.count)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("pipeline now leaves out rejected, on-hold and already-started submissions", () => {
    const p = pipelineNow([
      { status: "Internal_Submission" },
      { status: "Vender_Submission" },
      { status: "L2_Interview" },
      { status: "Client_Reject" },
      { status: "On_Hold" },
      { status: "Started_Billable" },
    ]);
    expect(p.reduce((n, b) => n + b.count, 0)).toBe(3);
    expect(p.find((b) => b.label === "Interviewing")!.count).toBe(1);
  });
});

describe("[unit] breakdowns", () => {
  it("countBy groups blanks together and sorts biggest first", () => {
    expect(countBy([{ v: "H1B" }, { v: " " }, { v: "GC" }, { v: "H1B" }, { v: null }], (r) => r.v)).toEqual([
      { label: "H1B", count: 2 },
      { label: "Not set", count: 2 },
      { label: "GC", count: 1 },
    ]);
  });

  it("topSkills counts each consultant once per skill, case-insensitively", () => {
    expect(topSkills(["Java, Spring, java", "JAVA; AWS", "AWS/Azure"])).toEqual([
      { label: "AWS", count: 2 }, // ties sort alphabetically
      { label: "Java", count: 2 },
      { label: "Azure", count: 1 },
      { label: "Spring", count: 1 },
    ]);
  });

  it("monthlyCounts buckets by New York month and keeps empty months", () => {
    const m = monthlyCounts(["2026-10-01T03:00:00Z", "2026-10-02T12:00:00Z", "2026-08-15T12:00:00Z", null], NOW, 3);
    // Oct 1 03:00 UTC is still Sep 30 in New York.
    expect(m).toEqual([
      { label: "Aug 26", count: 1 },
      { label: "Sep 26", count: 1 },
      { label: "Oct 26", count: 1 },
    ]);
  });

  it("changePct compares periods and refuses to divide by zero", () => {
    expect(changePct(12, 10)).toBe(20);
    expect(changePct(5, 10)).toBe(-50);
    expect(changePct(3, 0)).toBeNull();
  });
});

describe("[unit] team performance", () => {
  const { start, end } = resolvePeriod("month", NOW);
  it("counts submissions, interviews and placements per person inside the period only", () => {
    const rows = teamPerformance({
      start,
      end,
      submissions: [
        { owner: "Asha", date: "2026-10-05T15:00:00Z", status: "L1_Interview", hasInterview: true },
        { owner: "Asha", date: "2026-10-06T15:00:00Z", status: "Internal_Submission", hasInterview: false },
        { owner: "Ravi", date: "2026-10-07T15:00:00Z", status: "New_Resume", hasInterview: false },
        { owner: "Ravi", date: "2026-09-29T15:00:00Z", status: "New_Resume", hasInterview: false }, // last month
        { owner: null, date: "2026-10-08T15:00:00Z", status: "New_Resume", hasInterview: false },
      ],
      interviews: [
        { owner: "Asha", date: "2026-10-09T15:00:00Z", status: "Scheduled" },
        { owner: "Asha", date: "2026-10-10T15:00:00Z", status: "Cancelled" }, // not counted
      ],
      placements: [{ owner: "Ravi", date: "2026-10-11T15:00:00Z" }],
    });
    expect(rows).toEqual([
      { name: "Asha", submissions: 2, interviews: 1, placements: 0, interviewRate: 50 },
      { name: "Ravi", submissions: 1, interviews: 0, placements: 1, interviewRate: 0 },
      { name: "Unassigned", submissions: 1, interviews: 0, placements: 0, interviewRate: 0 },
    ]);
  });
});

describe("[security] CSV export", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["a", "b"], [['x,y', 'say "hi"'], ["line\nbreak", 3]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",3');
  });

  it("neutralises spreadsheet formulas in text but leaves numbers alone", () => {
    expect(toCsv(["v"], [["=HYPERLINK(\"x\")"], ["+1"], ["@SUM"], [-5]])).toBe("v\r\n\"'=HYPERLINK(\"\"x\"\")\"\r\n'+1\r\n'@SUM\r\n-5");
  });
});
