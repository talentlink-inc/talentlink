import type { BenchConsultant, BenchSubmission } from "@/generated/prisma/client";

export type BenchConsultantSummary = Pick<BenchConsultant, "id" | "consultantCode" | "consultantName" | "role" | "status">;

export const BENCH_CONSULTANT_SUMMARY_SELECT = {
  id: true,
  consultantCode: true,
  consultantName: true,
  role: true,
  status: true,
} as const;

export type SerializedBenchSubmission = Omit<BenchSubmission, "tenantId"> & {
  consultant: BenchConsultantSummary;
  interviewCount: number;
};

export function serializeBenchSubmission(
  s: BenchSubmission & { consultant: BenchConsultantSummary; _count: { interviews: number } }
): SerializedBenchSubmission {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tenantId, _count, ...rest } = s;
  return { ...rest, interviewCount: _count.interviews };
}
