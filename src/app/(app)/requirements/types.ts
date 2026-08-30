import type { Requirement } from "@/generated/prisma/client";

// Prisma's Decimal isn't a plain object, so it can't cross the Server->Client
// Component boundary (or a server action's return value) without an explicit
// conversion — Next.js otherwise falls back to Decimal's toJSON() with a dev
// warning rather than a real error, so this is easy to miss.
export type SerializedRequirement = Omit<Requirement, "billRate" | "payRate"> & {
  billRate: string | null;
  payRate: string | null;
};

export function serializeRequirement(r: Requirement): SerializedRequirement {
  return {
    ...r,
    billRate: r.billRate?.toString() ?? null,
    payRate: r.payRate?.toString() ?? null,
  };
}
