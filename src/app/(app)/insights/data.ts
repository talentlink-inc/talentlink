import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";

// Raw rows for Insights, one query per table with only the columns the
// metrics in lib/insights.ts need. Bench tables load only for roles that can
// see Bench Sales.

export async function loadRecruitmentRows() {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const live = { tenantId: tenant.id, deletedAt: null };
  const [requirements, submissions, interviews] = await Promise.all([
    db.requirement.findMany({
      where: live,
      select: { id: true, jobId: true, jobTitle: true, clientName: true, status: true, priority: true, createdAt: true },
    }),
    db.submission.findMany({
      where: live,
      select: {
        id: true,
        submissionId: true,
        status: true,
        submissionDate: true,
        createdAt: true,
        selectedDate: true,
        placementId: true,
        recruiterNameRaw: true,
        requirementJobIdRaw: true,
        candidate: { select: { name: true, email: true, phone: true, visaStatus: true, currentLocation: true } },
        requirement: { select: { jobTitle: true, clientName: true } },
        _count: { select: { interviews: { where: { deletedAt: null } } } },
      },
      orderBy: { submissionDate: "desc" },
    }),
    db.interview.findMany({
      where: live,
      select: {
        id: true,
        interviewType: true,
        scheduledAt: true,
        timezone: true,
        status: true,
        clientCompany: true,
        submission: { select: { recruiterNameRaw: true, candidate: { select: { name: true } } } },
      },
    }),
  ]);
  return { requirements, submissions, interviews };
}

export async function loadBenchRows() {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const live = { tenantId: tenant.id, deletedAt: null };
  const [consultants, submissions, interviews] = await Promise.all([
    db.benchConsultant.findMany({
      where: live,
      select: {
        id: true,
        consultantCode: true,
        consultantName: true,
        role: true,
        technologySkills: true,
        visaStatus: true,
        location: true,
        experience: true,
        status: true,
        marketerNameRaw: true,
        onHotlist: true,
        hotlistStatus: true,
        addedDate: true,
      },
      orderBy: { addedDate: "desc" },
    }),
    db.benchSubmission.findMany({
      where: live,
      select: {
        id: true,
        submissionCode: true,
        companyName: true,
        rate: true,
        status: true,
        submissionDate: true,
        createdAt: true,
        selectedDate: true,
        placementId: true,
        submittedByNameRaw: true,
        consultant: { select: { consultantName: true } },
        _count: { select: { interviews: { where: { deletedAt: null } } } },
      },
      orderBy: { submissionDate: "desc" },
    }),
    db.benchInterview.findMany({
      where: live,
      select: {
        id: true,
        interviewType: true,
        scheduledAt: true,
        timezone: true,
        status: true,
        clientCompany: true,
        submission: { select: { submittedByNameRaw: true, companyName: true, consultant: { select: { consultantName: true } } } },
      },
    }),
  ]);
  return { consultants, submissions, interviews };
}

export type RecruitmentRows = Awaited<ReturnType<typeof loadRecruitmentRows>>;
export type BenchRows = Awaited<ReturnType<typeof loadBenchRows>>;

// The Overview only needs counts, the current pipeline, the next interviews
// and the latest few submissions — so it asks the database for exactly that
// (counts and small selects in parallel) instead of loading every row.
export async function loadOverviewData(opts: {
  includeBench: boolean;
  today: { start: Date; end: Date };
  week: { start: Date; end: Date };
  month: { start: Date; end: Date };
  now: Date;
}) {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const live = { tenantId: tenant.id, deletedAt: null };
  const between = (w: { start: Date; end: Date }) => ({ gte: w.start, lt: w.end });
  const notCancelled = { not: "Cancelled" };
  const interviewSince = opts.week.start < opts.today.start ? opts.week.start : opts.today.start;

  const rec = Promise.all([
    db.requirement.count({ where: { ...live, status: "Open" } }),
    db.requirement.count({ where: { ...live, status: "Open", priority: { gte: 4 } } }),
    db.submission.count({ where: { ...live, submissionDate: between(opts.today) } }),
    db.submission.count({ where: { ...live, submissionDate: between(opts.week) } }),
    db.submission.count({ where: { ...live, submissionDate: between(opts.month) } }),
    db.submission.count({ where: { ...live, placementId: { not: null }, selectedDate: between(opts.month) } }),
    db.submission.findMany({ where: live, select: { status: true } }),
    db.submission.findMany({
      where: live,
      select: {
        id: true,
        submissionId: true,
        status: true,
        submissionDate: true,
        createdAt: true,
        requirementJobIdRaw: true,
        candidate: { select: { name: true } },
        requirement: { select: { jobTitle: true } },
      },
      orderBy: [{ submissionDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 8,
    }),
    db.interview.findMany({
      where: { ...live, status: notCancelled, scheduledAt: { gte: interviewSince } },
      select: {
        id: true,
        interviewType: true,
        scheduledAt: true,
        timezone: true,
        status: true,
        clientCompany: true,
        submission: { select: { candidate: { select: { name: true } } } },
      },
    }),
  ]);

  const bench = opts.includeBench
    ? Promise.all([
        db.benchConsultant.findMany({ where: live, select: { status: true, onHotlist: true, hotlistStatus: true } }),
        db.benchSubmission.count({ where: { ...live, submissionDate: between(opts.week) } }),
        db.benchSubmission.findMany({ where: live, select: { status: true } }),
        db.benchSubmission.findMany({
          where: live,
          select: {
            id: true,
            submissionCode: true,
            companyName: true,
            status: true,
            submissionDate: true,
            createdAt: true,
            consultant: { select: { consultantName: true } },
          },
          orderBy: [{ submissionDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
          take: 8,
        }),
        db.benchInterview.findMany({
          where: { ...live, status: notCancelled, scheduledAt: { gte: interviewSince } },
          select: {
            id: true,
            interviewType: true,
            scheduledAt: true,
            timezone: true,
            status: true,
            clientCompany: true,
            submission: { select: { companyName: true, consultant: { select: { consultantName: true } } } },
          },
        }),
      ])
    : Promise.resolve(null);

  const [
    [openReqs, highPriority, subsToday, subsWeek, subsMonth, placementsMonth, subStatuses, recentSubs, interviews],
    benchData,
  ] = await Promise.all([rec, bench]);

  return {
    openReqs,
    highPriority,
    subsToday,
    subsWeek,
    subsMonth,
    placementsMonth,
    subStatuses,
    recentSubs,
    interviews,
    bench: benchData
      ? {
          consultants: benchData[0],
          subsWeek: benchData[1],
          subStatuses: benchData[2],
          recentSubs: benchData[3],
          interviews: benchData[4],
        }
      : null,
  };
}
