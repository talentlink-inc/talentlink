import type { Interview } from "@/generated/prisma/client";
import { serializeSubmission, type SerializedSubmission } from "../submissions/types";
import type { Submission, Candidate, Requirement, Resume } from "@/generated/prisma/client";

export type SerializedInterview = Interview & {
  submission: SerializedSubmission;
};

export function serializeInterview(
  i: Interview & {
    submission: Submission & {
      candidate: Candidate;
      requirement: Requirement | null;
      resume: Resume | null;
    };
  }
): SerializedInterview {
  return {
    ...i,
    submission: serializeSubmission(i.submission),
  };
}
