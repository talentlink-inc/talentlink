import type { Interview } from "@/generated/prisma/client";
import { serializeSubmission, type RequirementSummary, type ResumeSummary, type SerializedSubmission } from "../submissions/types";
import type { Submission, Candidate } from "@/generated/prisma/client";

export type SerializedInterview = Interview & {
  submission: SerializedSubmission;
};

export function serializeInterview(
  i: Interview & {
    submission: Submission & {
      candidate: Candidate;
      requirement: RequirementSummary | null;
      resume: ResumeSummary | null;
    };
  }
): SerializedInterview {
  return {
    ...i,
    submission: serializeSubmission(i.submission),
  };
}
