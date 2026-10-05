import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench } from "@/lib/users";
import { formatDate } from "@/lib/format";
import { changePct, countBy, funnel, inRange, monthlyCounts, pct, topSkills } from "@/lib/insights";
import { statusLabel } from "@/lib/statusLabels";
import { loadBenchRows } from "../data";
import { periodFromParams, type InsightsSearchParams } from "../period";
import { PeriodPicker } from "../PeriodPicker";
import { ReportList, type ReportColumn, type ReportRow } from "../ReportList";
import { BarList, ColumnChart, Kpi, KpiGrid, Panel, TwoCol } from "../ui";

export const dynamic = "force-dynamic";

// Bench Sales report (GAS Reports → Bench / Hotlist + Bench Submissions, one
// tab). Hidden from roles without Bench Sales, like everywhere else.
export default async function BenchReportPage({ searchParams }: { searchParams: InsightsSearchParams }) {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) redirect("/insights");
  const [period, bench] = await Promise.all([periodFromParams(searchParams), loadBenchRows()]);
  const { start, end, prevStart, prevEnd } = period;

  const subs = bench.submissions.filter((s) => inRange(s.submissionDate, start, end));
  const prevSubs = bench.submissions.filter((s) => inRange(s.submissionDate, prevStart, prevEnd)).length;
  const live = (i: { status: string }) => i.status !== "Cancelled";
  const interviews = bench.interviews.filter((i) => live(i) && inRange(i.scheduledAt, start, end)).length;
  const prevInterviews = bench.interviews.filter((i) => live(i) && inRange(i.scheduledAt, prevStart, prevEnd)).length;
  const placements = bench.submissions.filter((s) => s.placementId && inRange(s.selectedDate, start, end));
  const prevPlacements = bench.submissions.filter((s) => s.placementId && inRange(s.selectedDate, prevStart, prevEnd)).length;

  const consultants = bench.consultants;
  const available = consultants.filter((c) => c.status === "Available").length;
  const marketing = consultants.filter((c) => c.status === "Marketing").length;
  const onHotlist = consultants.filter((c) => c.onHotlist);

  const stages = funnel(subs.map((s) => ({ status: s.status, hasInterview: s._count.interviews > 0 })));
  const reachedInterview = stages.find((s) => s.label === "Interviewed")!.count;

  const subColumns: ReportColumn[] = [
    { key: "code", label: "ID", mono: true, nowrap: true },
    { key: "consultant", label: "Consultant" },
    { key: "company", label: "Company" },
    { key: "rate", label: "Rate", nowrap: true },
    { key: "status", label: "Status", status: true },
    { key: "by", label: "Submitted by", nowrap: true },
    { key: "date", label: "Submitted", nowrap: true },
  ];
  const subRows: ReportRow[] = subs.map((s) => ({
    id: s.id,
    href: `/bench/submissions?open=${s.id}`,
    code: s.submissionCode,
    consultant: s.consultant.consultantName,
    company: s.companyName,
    rate: s.rate,
    status: s.status,
    by: s.submittedByNameRaw,
    date: s.submissionDate ? formatDate(s.submissionDate) : null,
  }));

  const conColumns: ReportColumn[] = [
    { key: "code", label: "ID", mono: true, nowrap: true },
    { key: "name", label: "Consultant" },
    { key: "role", label: "Role" },
    { key: "visa", label: "Visa", nowrap: true },
    { key: "location", label: "Location" },
    { key: "experience", label: "Exp.", nowrap: true },
    { key: "status", label: "Status", status: true },
    { key: "marketer", label: "Marketer", nowrap: true },
    { key: "hotlist", label: "Hotlist", nowrap: true },
    { key: "added", label: "Added", nowrap: true },
  ];
  const conRows: ReportRow[] = consultants.map((c) => ({
    id: c.id,
    href: `/bench/consultants?open=${c.id}`,
    code: c.consultantCode,
    name: c.consultantName,
    role: c.role,
    visa: c.visaStatus,
    location: c.location,
    experience: c.experience,
    status: c.status,
    marketer: c.marketerNameRaw,
    hotlist: c.onHotlist ? (c.hotlistStatus ?? "Active") : "—",
    added: formatDate(c.addedDate),
  }));

  return (
    <div>
      <PeriodPicker key={`${period.key}-${period.from}-${period.to}`} current={period.key} from={period.from} to={period.to} label={period.label} />

      <KpiGrid>
        <Kpi label="Bench submissions" value={subs.length} change={changePct(subs.length, prevSubs)} href="/bench/submissions" />
        <Kpi
          label="Bench interviews"
          value={interviews}
          change={changePct(interviews, prevInterviews)}
          detail={`${pct(reachedInterview, subs.length)}% of submissions reached interview`}
          href="/bench/interviews"
        />
        <Kpi label="Bench placements" value={placements.length} change={changePct(placements.length, prevPlacements)} href="/bench/placements" />
        <Kpi
          label="Available now"
          value={available}
          detail={`${marketing} marketing · ${consultants.length} on bench`}
          href="/bench/consultants"
        />
      </KpiGrid>

      <TwoCol>
        <Panel title="Funnel" note="How far this period's bench submissions got">
          <BarList items={stages} showPctOf={subs.length} limit={10} empty="No bench submissions in this period." />
        </Panel>
        <Panel title="Bench submissions per month" note="Last 6 months, whatever period is picked">
          <ColumnChart items={monthlyCounts(bench.submissions.map((s) => s.submissionDate), new Date())} />
        </Panel>
      </TwoCol>

      <TwoCol>
        <Panel title="Submissions by status">
          <BarList items={countBy(subs, (s) => statusLabel(s.status))} />
        </Panel>
        <Panel title="Submissions by marketer">
          <BarList items={countBy(subs, (s) => s.submittedByNameRaw, "Unassigned")} />
        </Panel>
      </TwoCol>

      <TwoCol>
        <Panel title="Top companies" note="Who this period's consultants were submitted to">
          <BarList items={countBy(subs, (s) => s.companyName)} />
        </Panel>
        <Panel title="Hotlist" note="Right now">
          <BarList
            items={[
              ...countBy(onHotlist, (c) => c.hotlistStatus ?? "Active").map((c) => ({ ...c, label: `On hotlist · ${c.label}` })),
              { label: "Not on hotlist", count: consultants.length - onHotlist.length },
            ]}
            empty="No consultants."
          />
        </Panel>
      </TwoCol>

      <h2 className="mt-2 mb-3 text-xs font-semibold tracking-wide text-black/50 uppercase dark:text-white/50">Bench right now</h2>
      <TwoCol>
        <Panel title="Consultants by status">
          <BarList items={countBy(consultants, (c) => c.status)} empty="No consultants." />
        </Panel>
        <Panel title="Consultants by marketer">
          <BarList items={countBy(consultants, (c) => c.marketerNameRaw, "Unassigned")} empty="No consultants." />
        </Panel>
      </TwoCol>
      <TwoCol>
        <Panel title="By visa">
          <BarList items={countBy(consultants, (c) => c.visaStatus)} empty="No consultants." />
        </Panel>
        <Panel title="By location">
          <BarList items={countBy(consultants, (c) => c.location)} empty="No consultants." />
        </Panel>
      </TwoCol>
      <Panel title="Top skills" note="Across all consultants, each counted once per skill" className="mb-5">
        <BarList items={topSkills(consultants.map((c) => c.technologySkills))} limit={15} empty="No skills recorded." />
      </Panel>

      <ReportList
        title="Bench submissions in this period"
        columns={subColumns}
        rows={subRows}
        csvName={`bench-submissions-${period.from}-to-${period.to}`}
        emptyText="No bench submissions in this period."
      />
      <ReportList title="All consultants" columns={conColumns} rows={conRows} csvName="bench-consultants" emptyText="No consultants yet." />
    </div>
  );
}
