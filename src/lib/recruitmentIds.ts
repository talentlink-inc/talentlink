import type { getTenantDbFor } from "@/lib/tenantDb";
import { isUniqueConstraintError, nextSequenceId } from "@/lib/sequenceIds";

type TenantDb = ReturnType<typeof getTenantDbFor>;

async function nextSubmissionId(db: TenantDb, tenantId: string): Promise<string> {
  // Deleted rows included on purpose — a soft-deleted submission still holds
  // its ID, and (tenantId, submissionId) is unique across all of them.
  const rows = await db.submission.findMany({
    where: { tenantId, submissionId: { startsWith: "SUB-" } },
    select: { submissionId: true },
  });
  return nextSequenceId("SUB", rows.map((r) => r.submissionId));
}

export async function nextPlacementId(db: TenantDb, tenantId: string): Promise<string> {
  const rows = await db.submission.findMany({
    where: { tenantId, placementId: { startsWith: "PLC-" } },
    select: { placementId: true },
  });
  return nextSequenceId("PLC", rows.map((r) => r.placementId));
}

// Runs `create` with a freshly generated submission ID, retrying a few times
// if two submissions are created at the same instant and collide on the
// (tenantId, submissionId) unique constraint.
export async function withNewSubmissionId<T>(
  db: TenantDb,
  tenantId: string,
  create: (submissionId: string) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const submissionId = await nextSubmissionId(db, tenantId);
    try {
      return await create(submissionId);
    } catch (err) {
      if (!isUniqueConstraintError(err) || attempt >= 4) throw err;
    }
  }
}
