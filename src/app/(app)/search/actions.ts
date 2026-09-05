"use server";

import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canViewUsers } from "@/lib/users";

export type SearchResult = {
  id: string;
  category: string;
  label: string;
  subtitle: string;
  href: string;
};

// Mirrors ITStaffing's Search.js: search across the same fields as each
// page's own inline filter, grouped by category, capped per category so the
// dropdown stays scannable.
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();
  const canSeeUsers = canViewUsers(currentUser.role);

  const insensitive = { contains: q, mode: "insensitive" as const };
  const db = await getTenantDb();

  const [requirements, submissions, interviews, users] = await Promise.all([
    db.requirement.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { jobId: insensitive },
          { jobTitle: insensitive },
          { clientName: insensitive },
          { workLocation: insensitive },
          { mandatorySkills: insensitive },
        ],
      },
      take: 5,
    }),
    db.submission.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { candidate: { name: insensitive } },
          { candidate: { email: insensitive } },
          { candidate: { phone: insensitive } },
          { candidate: { currentLocation: insensitive } },
          { roleWithSkills: insensitive },
        ],
      },
      include: { candidate: true, requirement: true },
      take: 8,
    }),
    db.interview.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [{ clientCompany: insensitive }, { submission: { candidate: { name: insensitive } } }],
      },
      include: { submission: { include: { candidate: true, requirement: true } } },
      take: 5,
    }),
    canSeeUsers
      ? db.user.findMany({
          where: {
            tenantId: tenant.id,
            OR: [{ name: insensitive }, { email: insensitive }, { role: insensitive }],
          },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [];

  for (const r of requirements) {
    results.push({
      id: r.id,
      category: "Requirements",
      label: `${r.jobId} — ${r.jobTitle}`,
      subtitle: `${r.clientName ?? "—"} · ${r.status}`,
      href: `/requirements?open=${r.id}`,
    });
  }

  for (const s of submissions) {
    const isPlacement = !!s.placementId;
    results.push({
      id: s.id,
      category: isPlacement ? "Placements" : "Submissions",
      label: s.candidate.name,
      subtitle: `${s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "—"} · ${s.status}`,
      href: isPlacement ? `/placements?open=${s.id}` : `/submissions?open=${s.id}`,
    });
  }

  for (const i of interviews) {
    results.push({
      id: i.id,
      category: "Interviews",
      label: i.submission.candidate.name,
      subtitle: `${i.interviewType} · ${i.clientCompany ?? i.submission.requirement?.jobTitle ?? "—"}`,
      href: `/interviews?open=${i.id}`,
    });
  }

  for (const u of users) {
    results.push({
      id: u.id,
      category: "Users",
      label: u.name,
      subtitle: `${u.email} · ${u.role}`,
      href: `/users?open=${u.id}`,
    });
  }

  return results;
}
