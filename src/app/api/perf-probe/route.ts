// TEMPORARY (performance audit, 2026-10-04): times each per-request step from
// inside Vercel. Platform-admin only; removed after the audit.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDbFor } from "@/lib/tenantDb";
import { isPlatformAdmin } from "@/lib/platformAdmin";

export const dynamic = "force-dynamic";

async function time<T>(fn: () => Promise<T>) {
  const t = performance.now();
  await fn();
  return Math.round(performance.now() - t);
}

export async function GET() {
  if (!(await isPlatformAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const tenant = await getCurrentTenant();
  const supabase = await createClient();
  const db = getTenantDbFor(tenant.id);
  const out: Record<string, number[]> = {};
  const steps: Record<string, () => Promise<unknown>> = {
    rawSelect1: () => prisma.$queryRaw`SELECT 1`,
    tenantFindUnique: () => prisma.tenant.findUnique({ where: { id: tenant.id } }),
    supabaseGetUser: () => supabase.auth.getUser(),
    supabaseGetClaims: () => supabase.auth.getClaims(),
    supabaseMfaAal: () => supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    scopedFindFirst: () => db.requirement.findFirst({ where: { tenantId: tenant.id } }),
    scopedRequirementsList: () => db.requirement.findMany({ where: { tenantId: tenant.id, deletedAt: null } }),
    scopedSubmissionsWithJoins: () =>
      db.submission.findMany({ where: { tenantId: tenant.id, deletedAt: null }, include: { candidate: true, requirement: true, resume: true }, take: 500 }),
    plainTxBatch3: () => prisma.$transaction([prisma.$queryRaw`SELECT 1`, prisma.$queryRaw`SELECT 1`]),
  };
  for (const [k, fn] of Object.entries(steps)) {
    out[k] = [];
    for (let i = 0; i < 3; i++) out[k].push(await time(fn));
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? "local", out });
}
