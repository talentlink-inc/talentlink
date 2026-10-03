import type { getTenantDbFor } from "@/lib/tenantDb";
import { isUniqueConstraintError, nextSequenceId } from "@/lib/sequenceIds";

type TenantDb = ReturnType<typeof getTenantDbFor>;

// Same max-based, retry-on-collision scheme as src/lib/recruitmentIds.ts —
// deleted rows included, since a soft-deleted record still holds its code.

async function nextConsultantCode(db: TenantDb, tenantId: string): Promise<string> {
  const rows = await db.benchConsultant.findMany({ where: { tenantId }, select: { consultantCode: true } });
  return nextSequenceId("BC", rows.map((r) => r.consultantCode));
}

async function nextBenchSubmissionCode(db: TenantDb, tenantId: string): Promise<string> {
  const rows = await db.benchSubmission.findMany({ where: { tenantId }, select: { submissionCode: true } });
  return nextSequenceId("BSUB", rows.map((r) => r.submissionCode));
}

export async function nextBenchPlacementId(db: TenantDb, tenantId: string): Promise<string> {
  const rows = await db.benchSubmission.findMany({
    where: { tenantId, placementId: { startsWith: "BPLC-" } },
    select: { placementId: true },
  });
  return nextSequenceId("BPLC", rows.map((r) => r.placementId));
}

async function withNewCode<T>(next: () => Promise<string>, create: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const code = await next();
    try {
      return await create(code);
    } catch (err) {
      if (!isUniqueConstraintError(err) || attempt >= 4) throw err;
    }
  }
}

export function withNewConsultantCode<T>(db: TenantDb, tenantId: string, create: (code: string) => Promise<T>) {
  return withNewCode(() => nextConsultantCode(db, tenantId), create);
}

export function withNewBenchSubmissionCode<T>(db: TenantDb, tenantId: string, create: (code: string) => Promise<T>) {
  return withNewCode(() => nextBenchSubmissionCode(db, tenantId), create);
}
