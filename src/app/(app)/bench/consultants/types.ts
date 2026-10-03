import type { BenchConsultant } from "@/generated/prisma/client";

// Everything a consultant row needs on the client. The storage path stays on
// the server — the UI only needs to know a resume exists (it's fetched via
// /api/bench/resume/[id], which re-checks permission).
export type SerializedConsultant = Omit<BenchConsultant, "resumeFileUrl" | "resumeSourceDriveFileId" | "tenantId"> & {
  hasResume: boolean;
  submissionCount: number;
};

export function serializeConsultant(
  c: BenchConsultant & { _count: { submissions: number } }
): SerializedConsultant {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { resumeFileUrl, resumeSourceDriveFileId, tenantId, _count, ...rest } = c;
  return { ...rest, hasResume: !!resumeFileUrl, submissionCount: _count.submissions };
}
