"use server";

import { getCurrentUser } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDb } from "@/lib/tenantDb";

export type RepositoryCandidate = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  country: string | null;
  visa: string | null;
  years: string | null;
  skills: string | null;
  linkedinUrl: string | null;
  receivedAt: Date | null;
  addedBy: string | null;
  resume: { id: string; fileName: string | null } | null;
};

/** One repository candidate, loaded when opened; contact details per permission. */
export async function getRepositoryCandidate(id: string): Promise<RepositoryCandidate | null> {
  const user = await getCurrentUser();
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const c = await db.candidate.findFirst({
    where: { id, tenantId: tenant.id, deletedAt: null, inRepository: true },
    include: { resumes: { where: { deletedAt: null }, select: { id: true, fileName: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    title: c.currentTitle,
    email: user.canViewEmail ? c.email : null,
    phone: user.canViewPhone ? c.phone : null,
    location: c.currentLocation,
    country: c.country,
    visa: c.visaStatus,
    years: c.totalExperienceYears?.toString() ?? null,
    skills: c.skills,
    // Imported LinkedIn fields sometimes hold an email — treat like email.
    linkedinUrl: !user.canViewEmail && c.linkedinUrl?.includes("@") ? null : c.linkedinUrl,
    receivedAt: c.repositoryReceivedAt,
    addedBy: c.repositoryAddedBy,
    resume: c.resumes[0] ?? null,
  };
}
