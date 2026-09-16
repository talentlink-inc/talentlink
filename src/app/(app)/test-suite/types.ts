// Client-side shapes after the JSON round-trip in page.tsx (Dates become
// ISO strings; the JSON `definition`/`details`/`results` fields keep their
// plain-object shape since JSON.stringify/parse is a no-op on those).
import type { ApiDefinition, SanityDefinition } from "./runners";

export type SerializedTestCase = {
  id: string;
  tenantId: string;
  category: string;
  kind: string;
  name: string;
  description: string | null;
  definition: ApiDefinition | SanityDefinition;
  isActive: boolean;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedCiSnapshot = {
  id: string;
  category: string;
  status: string;
  passCount: number;
  failCount: number;
  totalCount: number;
  commitSha: string | null;
  runUrl: string | null;
  details: { name: string; status: string; message?: string }[] | null;
  updatedAt: string;
};

export type SerializedRunBatch = {
  id: string;
  tenantId: string;
  scope: string;
  triggeredByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  passCount: number;
  failCount: number;
  results: { testCaseId: string; name: string; status: string; message: string; durationMs: number }[];
};
