import { getCurrentUser } from "@/lib/auth";
import { canAccessBench } from "@/lib/users";
import { teamPerformance, type PersonRow } from "@/lib/insights";
import { loadBenchRows, loadRecruitmentRows } from "../data";
import { periodFromParams, type InsightsSearchParams } from "../period";
import { PeriodPicker } from "../PeriodPicker";
import { ReportList, type ReportColumn, type ReportRow } from "../ReportList";

export const dynamic = "force-dynamic";

// Per-person performance for the period. Replaces GAS's "Top recruiters"
// chart and "Status Reports" tab (which showed the same people twice) and
// adds placements.
export default async function TeamReportPage({ searchParams }: { searchParams: InsightsSearchParams }) {
  const user = await getCurrentUser();
  const benchOk = canAccessBench(user.role);
  const [period, rec, bench] = await Promise.all([
    periodFromParams(searchParams),
    loadRecruitmentRows(),
    benchOk ? loadBenchRows() : null,
  ]);
  const { start, end } = period;

  const recruiters = teamPerformance({
    start,
    end,
    submissions: rec.submissions.map((s) => ({
      owner: s.recruiterNameRaw,
      date: s.submissionDate,
      status: s.status,
      hasInterview: s._count.interviews > 0,
    })),
    // Interviews count for the recruiter whose candidate it is.
    interviews: rec.interviews.map((i) => ({ owner: i.submission.recruiterNameRaw, date: i.scheduledAt, status: i.status })),
    placements: rec.submissions.filter((s) => s.placementId).map((s) => ({ owner: s.recruiterNameRaw, date: s.selectedDate })),
  });
  const marketers = bench
    ? teamPerformance({
        start,
        end,
        submissions: bench.submissions.map((s) => ({
          owner: s.submittedByNameRaw,
          date: s.submissionDate,
          status: s.status,
          hasInterview: s._count.interviews > 0,
        })),
        interviews: bench.interviews.map((i) => ({ owner: i.submission.submittedByNameRaw, date: i.scheduledAt, status: i.status })),
        placements: bench.submissions.filter((s) => s.placementId).map((s) => ({ owner: s.submittedByNameRaw, date: s.selectedDate })),
      })
    : null;

  const columns = (who: string): ReportColumn[] => [
    { key: "rank", label: "#", nowrap: true },
    { key: "name", label: who },
    { key: "submissions", label: "Submissions", nowrap: true },
    { key: "interviews", label: "Interviews", nowrap: true },
    { key: "placements", label: "Placements", nowrap: true },
    { key: "rate", label: "Reached interview", nowrap: true },
  ];
  const toRows = (people: PersonRow[]): ReportRow[] =>
    people.map((p, i) => ({
      id: p.name,
      rank: i + 1,
      name: p.name,
      submissions: p.submissions,
      interviews: p.interviews,
      placements: p.placements,
      rate: p.submissions ? `${p.interviewRate}%` : "—",
    }));

  return (
    <div>
      <PeriodPicker key={`${period.key}-${period.from}-${period.to}`} current={period.key} from={period.from} to={period.to} label={period.label} />
      <p className="mb-4 max-w-3xl text-sm text-black/55 dark:text-white/55">
        Submissions made in the period, interviews held for each person&apos;s candidates in the period, and placements
        (selections) in the period. &ldquo;Reached interview&rdquo; is the share of their period&apos;s submissions that got to
        an interview.
      </p>
      <ReportList
        title="Recruitment"
        columns={columns("Recruiter")}
        rows={toRows(recruiters)}
        csvName={`team-recruitment-${period.from}-to-${period.to}`}
        emptyText="No recruitment activity in this period."
      />
      {marketers && (
        <ReportList
          title="Bench Sales"
          columns={columns("Marketer")}
          rows={toRows(marketers)}
          csvName={`team-bench-${period.from}-to-${period.to}`}
          emptyText="No bench activity in this period."
        />
      )}
    </div>
  );
}
