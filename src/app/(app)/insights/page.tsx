import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench } from "@/lib/users";
import { formatDate, formatDateTime } from "@/lib/format";
import { inRange, nowWindows, pipelineNow } from "@/lib/insights";
import { statusLabel } from "@/lib/statusLabels";
import { StatusChip } from "@/components/ui/StatusChip";
import { loadBenchRows, loadRecruitmentRows } from "./data";
import { BarList, Kpi, KpiGrid, Panel, TwoCol } from "./ui";

export const dynamic = "force-dynamic";

// Overview — "what needs my attention now": today, this week, upcoming. No
// period picker; the report tabs cover chosen periods.
export default async function InsightsOverviewPage() {
  const user = await getCurrentUser();
  const benchOk = canAccessBench(user.role);
  const [rec, bench] = await Promise.all([loadRecruitmentRows(), benchOk ? loadBenchRows() : null]);
  const now = new Date();
  const { today, week, month } = nowWindows(now);
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const live = (s: string) => s !== "Cancelled";

  const openReqs = rec.requirements.filter((r) => r.status === "Open");
  const highPriority = openReqs.filter((r) => r.priority >= 4).length;

  const subsIn = (w: { start: Date; end: Date }) => rec.submissions.filter((s) => inRange(s.submissionDate, w.start, w.end)).length;
  const benchSubsIn = (w: { start: Date; end: Date }) =>
    bench ? bench.submissions.filter((s) => inRange(s.submissionDate, w.start, w.end)).length : 0;

  // Interviews from both modules (bench only for roles that can see it).
  const interviews = [
    ...rec.interviews.map((i) => ({
      id: i.id,
      module: "Recruitment" as const,
      href: `/interviews?open=${i.id}`,
      who: i.submission.candidate.name,
      round: i.interviewType,
      client: i.clientCompany,
      at: i.scheduledAt,
      tz: i.timezone,
      status: i.status,
    })),
    ...(bench?.interviews ?? []).map((i) => ({
      id: i.id,
      module: "Bench" as const,
      href: `/bench/interviews?open=${i.id}`,
      who: i.submission.consultant.consultantName,
      round: i.interviewType,
      client: i.clientCompany ?? i.submission.companyName,
      at: i.scheduledAt,
      tz: i.timezone,
      status: i.status,
    })),
  ];
  const intIn = (w: { start: Date; end: Date }) => interviews.filter((i) => live(i.status) && inRange(i.at, w.start, w.end)).length;
  const upcoming = interviews
    .filter((i) => live(i.status) && i.at && i.at >= now)
    .sort((a, b) => a.at!.getTime() - b.at!.getTime());
  const nextWeek = upcoming.filter((i) => i.at! < in7Days);

  const recent = [
    ...rec.submissions.map((s) => ({
      id: s.id,
      code: s.submissionId,
      href: `/submissions?open=${s.id}`,
      who: s.candidate.name,
      what: s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "—",
      status: s.status,
      at: s.createdAt,
      date: s.submissionDate,
    })),
    ...(bench?.submissions ?? []).map((s) => ({
      id: s.id,
      code: s.submissionCode,
      href: `/bench/submissions?open=${s.id}`,
      who: s.consultant.consultantName,
      what: s.companyName,
      status: s.status,
      at: s.createdAt,
      date: s.submissionDate,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const available = bench?.consultants.filter((c) => c.status === "Available").length ?? 0;
  const marketing = bench?.consultants.filter((c) => c.status === "Marketing").length ?? 0;
  const hotlistActive = bench?.consultants.filter((c) => c.onHotlist && (c.hotlistStatus ?? "Active") === "Active").length ?? 0;
  const placementsThisMonth = rec.submissions.filter((s) => s.placementId && inRange(s.selectedDate, month.start, month.end)).length;

  return (
    <div>
      <KpiGrid>
        <Kpi label="Open requirements" value={openReqs.length} detail={`${highPriority} at priority 4–5`} href="/requirements" />
        <Kpi
          label="Submissions this week"
          value={subsIn(week)}
          detail={`${subsIn(today)} today · ${subsIn(month)} this month`}
          href="/submissions"
        />
        <Kpi
          label="Interviews this week"
          value={intIn(week)}
          detail={`${intIn(today)} today · ${upcoming.length} upcoming`}
          href="/interviews"
        />
        {bench ? (
          <Kpi
            label="Bench available"
            value={available}
            detail={`${marketing} marketing · ${hotlistActive} on hotlist · ${benchSubsIn(week)} subs this week`}
            href="/bench/consultants"
          />
        ) : (
          <Kpi label="Placements this month" value={placementsThisMonth} detail="Selected candidates" href="/placements" />
        )}
      </KpiGrid>

      <TwoCol>
        <Panel title="Upcoming interviews" note="Next 7 days, soonest first">
          {nextWeek.length === 0 ? (
            <p className="py-4 text-center text-sm text-black/45 dark:text-white/45">No interviews in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {nextWeek.slice(0, 8).map((i) => (
                <li key={`${i.module}-${i.id}`}>
                  <Link href={i.href} className="-mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-brand-soft/40">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{i.who}</span>
                      <span className="block truncate text-xs text-black/55 dark:text-white/55">
                        {statusLabel(i.round)}
                        {i.client ? ` · ${i.client}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-medium tabular-nums">{formatDateTime(i.at!, i.tz ?? undefined)}</span>
                      <span className="block text-[11px] text-black/45 dark:text-white/45">{i.module}</span>
                    </span>
                  </Link>
                </li>
              ))}
              {nextWeek.length > 8 && (
                <li className="pt-2 text-xs text-black/45">
                  + {nextWeek.length - 8} more ·{" "}
                  <Link href="/interviews" className="font-medium text-brand-strong hover:underline">
                    all interviews
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Panel>
        <Panel title="Recruitment pipeline now" note="Active submissions by stage (rejected, on hold and started are left out)">
          <BarList items={pipelineNow(rec.submissions)} empty="No active submissions." />
          {bench && (
            <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
              <h3 className="mb-3 text-sm font-semibold">Bench pipeline now</h3>
              <BarList items={pipelineNow(bench.submissions)} empty="No active bench submissions." />
            </div>
          )}
        </Panel>
      </TwoCol>

      <Panel title="Recent activity" note="Latest submissions added">
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-black/45">No submissions yet.</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {recent.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 hover:bg-brand-soft/40">
                  <span className="w-20 shrink-0 font-mono text-xs text-black/50 dark:text-white/50">{r.code ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{r.who}</span>
                    <span className="text-black/50 dark:text-white/50"> → {r.what}</span>
                  </span>
                  <StatusChip status={r.status} />
                  <span className="w-24 shrink-0 text-right text-xs text-black/50 tabular-nums dark:text-white/50">
                    {r.date ? formatDate(r.date) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
