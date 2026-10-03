// Human-readable "SUB-0001" / "PLC-0001" style IDs. Derived from the highest
// number already on record (not a row count) so they're never reused: a
// count drops whenever a placement is un-assigned (shouldClearPlacementId)
// and doesn't account for gaps in imported legacy data, and either way
// count + 1 can land on an ID that's still taken. Same approach as
// generateJobId in requirements/actions.ts.
export function nextSequenceId(prefix: string, existingIds: Iterable<string | null>): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const id of existingIds) {
    const match = id?.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function isUniqueConstraintError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ((err as { code?: unknown }).code === "P2002") return true;
  return err instanceof Error && err.message.includes("Unique constraint");
}
