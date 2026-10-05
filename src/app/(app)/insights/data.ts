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
