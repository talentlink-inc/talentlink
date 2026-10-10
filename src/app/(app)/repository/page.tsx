import type { Prisma } from "@/generated/prisma/client";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { EXPERIENCE_BANDS, parseRepositoryQuery, REPOSITORY_PAGE_SIZE } from "@/lib/repository";
import { RepositoryTable, type RepositoryRow } from "./RepositoryTable";

export const dynamic = "force-dynamic";

// Repository (GAS PageRepository.html): the verified resume pool. Filtering,
// sorting and paging run in the database — the pool is thousands of resumes,
// too many to ship to the browser.
export default async function RepositoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [tenant, user, params] = await Promise.all([getCurrentTenant(), getCurrentUser(), searchParams]);
  const query = parseRepositoryQuery(params);
  const db = await getTenantDb();

  const and: Prisma.CandidateWhereInput[] = [];
  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { name: contains },
        { currentTitle: contains },
        { skills: contains },
        { currentLocation: contains },
        ...(user.canViewEmail ? [{ email: contains }] : []),
        ...(user.canViewPhone ? [{ phone: contains }] : []),
      ],
    });
  }
  if (query.visa) and.push({ visaStatus: { equals: query.visa, mode: "insensitive" } });
  if (query.exp) {
    const band = EXPERIENCE_BANDS.find((b) => b.value === query.exp)!;
    and.push({ totalExperienceYears: { gte: band.min, lte: band.max + 0.9 } });
  }
  if (query.country) and.push(query.country === "Other" ? { OR: [{ country: "Other" }, { country: null }] } : { country: query.country });

  const where: Prisma.CandidateWhereInput = { tenantId: tenant.id, deletedAt: null, inRepository: true, AND: and };
  const sorts: Record<string, Prisma.CandidateOrderByWithRelationInput[]> = {
    "added-desc": [{ repositoryReceivedAt: { sort: "desc", nulls: "last" } }],
    "added-asc": [{ repositoryReceivedAt: { sort: "asc", nulls: "last" } }],
    "name-asc": [{ name: "asc" }],
    "name-desc": [{ name: "desc" }],
    "location-asc": [{ currentLocation: { sort: "asc", nulls: "last" } }],
    "country-asc": [{ country: { sort: "asc", nulls: "last" } }],
    "years-desc": [{ totalExperienceYears: { sort: "desc", nulls: "last" } }],
    "years-asc": [{ totalExperienceYears: { sort: "asc", nulls: "last" } }],
  };
  const orderBy = sorts[query.sort] ?? sorts["added-desc"];

  const [total, poolSize, candidates] = await Promise.all([
    db.candidate.count({ where }),
    db.candidate.count({ where: { tenantId: tenant.id, deletedAt: null, inRepository: true } }),
    db.candidate.findMany({
      where,
      orderBy: [...orderBy, { id: "asc" }],
      skip: (query.page - 1) * REPOSITORY_PAGE_SIZE,
      take: REPOSITORY_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        currentTitle: true,
        skills: true,
        visaStatus: true,
        totalExperienceYears: true,
        currentLocation: true,
        country: true,
        repositoryReceivedAt: true,
        resumes: { where: { deletedAt: null }, select: { id: true, fileName: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const rows: RepositoryRow[] = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.currentTitle,
    skills: c.skills,
    visa: c.visaStatus,
    years: c.totalExperienceYears ? Number(c.totalExperienceYears.toString()) : null,
    location: c.currentLocation,
    country: c.country,
    receivedAt: c.repositoryReceivedAt,
    resumeId: c.resumes[0]?.id ?? null,
    fileName: c.resumes[0]?.fileName ?? null,
  }));

  return (
    <RepositoryTable
      rows={rows}
      total={total}
      poolSize={poolSize}
      query={query}
      permissions={{ canViewResume: user.canViewResume, canDownloadResume: user.canDownloadResume }}
    />
  );
}
