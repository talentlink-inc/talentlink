import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { changePct, countBy, funnel, inRange, monthlyCounts, pct } from "@/lib/insights";
import { statusLabel } from "@/lib/statusLabels";
import { loadRecruitmentRows } from "../data";
import { periodFromParams, type InsightsSearchParams } from "../period";
import { PeriodPicker } from "../PeriodPicker";
import { ReportList, type ReportColumn, type ReportRow } from "../ReportList";
import { BarList, ColumnChart, Kpi, KpiGrid, Panel, TwoCol } from "../ui";

export const dynamic = "force-dynamic";

// Recruitment report for the chosen period (GAS Reports → Recruitment, plus
// the Dashboard's recruitment charts, without the duplicates).
export default async function RecruitmentReportPage({ searchParams }: { searchParams: InsightsSearchParams }) {
  const [user, period, rec] = await Promise.all([getCurrentUser(), periodFromParams(searchParams), loadRecruitmentRows()]);
  const { start, end, prevStart, prevEnd } = period;

  const subs = rec.submissions.filter((s) => inRange(s.submissionDate, start, end));
  const prevSubs = rec.submissions.filter((s) => inRange(s.submissionDate, prevStart, prevEnd)).length;
  const live = (i: { status: string }) => i.status !== "Cancelled";
  const interviews = rec.interviews.filter((i) => live(i) && inRange(i.scheduledAt, start, end)).length;
  const prevInterviews = rec.interviews.filter((i) => live(i) && inRange(i.scheduledAt, prevStart, prevEnd)).length;
  const placements = rec.submissions.filter((s) => s.placementId && inRange(s.selectedDate, start, end));
  const prevPlacements = rec.submissions.filter((s) => s.placementId && inRange(s.selectedDate, prevStart, prevEnd)).length;
  const newReqs = rec.requirements.filter((r) => inRange(r.createdAt, start, end)).length;
  const prevNewReqs = rec.requirements.filter((r) => inRange(r.createdAt, prevStart, prevEnd)).length;
  const openReqs = rec.requirements.filter((r) => r.status === "Open").length;

  const stages = funnel(subs.map((s) => ({ status: s.status, hasInterview: s._count.interviews > 0 })));
  const reachedInterview = stages.find((s) => s.label === "Interviewed")!.count;

  const columns: ReportColumn[] = [
    { key: "code", label: "ID", mono: true, nowrap: true },
    { key: "candidate", label: "Candidate" },
    { key: "requirement", label: "Requirement" },
    { key: "client", label: "Client" },
    { key: "recruiter", label: "Recruiter", nowrap: true },
    { key: "visa", label: "Visa", nowrap: true },
    { key: "location", label: "Location" },
    { key: "status", label: "Status", status: true },
    { key: "date", label: "Submitted", nowrap: true },
    ...(user.canViewEmail ? [{ key: "email", label: "Email" }] : []),
    ...(user.canViewPhone ? [{ key: "phone", label: "Phone", nowrap: true }] : []),
  ];
  // Contact details only for people allowed to see them (GAS exported emails to everyone).
  const rows: ReportRow[] = subs.map((s) => ({
    id: s.id,
    href: `/submissions?open=${s.id}`,
    code: s.submissionId ?? "—",
    candidate: s.candidate.name,
    requirement: s.requirement?.jobTitle ?? s.requirementJobIdRaw,
    client: s.requirement?.clientName,
    recruiter: s.recruiterNameRaw,
    visa: s.candidate.visaStatus,
    location: s.candidate.currentLocation,
    status: s.status,
    date: s.submissionDate ? formatDate(s.submissionDate) : null,
    ...(user.canViewEmail ? { email: s.candidate.email } : {}),
    ...(user.canViewPhone ? { phone: s.candidate.phone } : {}),
  }));

  const priorityLabel = (p: number) => (p > 0 ? `Priority ${p} ${"★".repeat(p)}` : "No priority");

  return (
    <div>
      <PeriodPicker key={`${period.key}-${period.from}-${period.to}`} current={period.key} from={period.from} to={period.to} label={period.label} />

      <KpiGrid>
        <Kpi label="Submissions" value={subs.length} change={changePct(subs.length, prevSubs)} href="/submissions" />
        <Kpi
          label="Interviews"
          value={interviews}
          change={changePct(interviews, prevInterviews)}
          detail={`${pct(reachedInterview, subs.length)}% of submissions reached interview`}
          href="/interviews"
        />
        <Kpi
          label="Placements"
          value={placements.length}
          change={changePct(placements.length, prevPlacements)}
          detail={`${placements.filter((p) => p.status === "Started_Billable").length} started billing`}
          href="/placements"
        />
        <Kpi label="New requirements" value={newReqs} change={changePct(newReqs, prevNewReqs)} detail={`${openReqs} open now`} href="/requirements" />
      </KpiGrid>

      <TwoCol>
        <Panel title="Funnel" note="How far this period's submissions got, as % of all submitted">
          <BarList items={stages.map((s) => ({ label: s.label, count: s.count }))} showPctOf={subs.length} limit={10} empty="No submissions in this period." />
        </Panel>
        <Panel title="Submissions per month" note="Last 6 months, whatever period is picked">
          <ColumnChart items={monthlyCounts(rec.submissions.map((s) => s.submissionDate), new Date())} />
        </Panel>
      </TwoCol>

      <TwoCol>
        <Panel title="By status" note="Current status of this period's submissions">
          <BarList items={countBy(subs, (s) => statusLabel(s.status))} />
        </Panel>
        <Panel title="By recruiter">
          <BarList items={countBy(subs, (s) => s.recruiterNameRaw, "Unassigned")} />
        </Panel>
      </TwoCol>

      <TwoCol>
        <Panel title="By visa">
          <BarList items={countBy(subs, (s) => s.candidate.visaStatus)} />
        </Panel>
        <Panel title="By client">
          <BarList items={countBy(subs, (s) => s.requirement?.clientName, "No client")} />
        </Panel>
      </TwoCol>

      <TwoCol>
        <Panel title="Requirements by status" note="All requirements, right now">
          <BarList items={countBy(rec.requirements, (r) => r.status)} empty="No requirements." />
        </Panel>
        <Panel title="Requirements by priority" note="Open requirements, right now">
          <BarList
            items={countBy(
              rec.requirements.filter((r) => r.status === "Open"),
              (r) => priorityLabel(r.priority)
            ).sort((a, b) => b.label.localeCompare(a.label))}
            empty="No open requirements."
          />
        </Panel>
      </TwoCol>

      <ReportList
        title="Submissions in this period"
        columns={columns}
        rows={rows}
        csvName={`recruitment-submissions-${period.from}-to-${period.to}`}
        emptyText="No submissions in this period."
      />
    </div>
  );
}
