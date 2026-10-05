import type { Interview } from "@/generated/prisma/client";
import { serializeSubmission, type RequirementSummary, type SerializedSubmission } from "../submissions/types";
import type { Submission, Candidate, Resume } from "@/generated/prisma/client";

export type SerializedInterview = Interview & {
  submission: SerializedSubmission;
};

export function serializeInterview(
  i: Interview & {
    submission: Submission & {
      candidate: Candidate;
      requirement: RequirementSummary | null;
      resume: Resume | null;
    };
  }
): SerializedInterview {
  return {
    ...i,
    submission: serializeSubmission(i.submission),
  };
}
