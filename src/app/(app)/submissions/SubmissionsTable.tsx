"use client";

import { useState } from "react";
import { SubmissionModal } from "./SubmissionModal";
import { formatDate } from "@/lib/format";
import type { SerializedSubmission } from "./types";
import type { SerializedRequirement } from "../requirements/types";

export function SubmissionsTable({
  submissions,
  requirements,
  currentUserId,
}: {
  submissions: SerializedSubmission[];
  requirements: SerializedRequirement[];
  currentUserId: string;
}) {
  const [modal, setModal] = useState<{
    mode: "create" | "view" | "edit";
    submission: SerializedSubmission | null;
  } | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Submissions</h1>
        <button
          onClick={() => setModal({ mode: "create", submission: null })}
          className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          + Submit Candidate
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Requirement</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Submitted</th>
              <th className="px-4 py-2">Bill Rate</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr
                key={s.id}
                onClick={() => setModal({ mode: "view", submission: s })}
                className="cursor-pointer border-t border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2">{s.candidate.name}</td>
                <td className="px-4 py-2">{s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "—"}</td>
                <td className="px-4 py-2">{s.status}</td>
                <td className="px-4 py-2">{s.submissionDate ? formatDate(s.submissionDate) : "—"}</td>
                <td className="px-4 py-2">{s.billRate ?? "—"}</td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <SubmissionModal
          mode={modal.mode}
          submission={modal.submission}
          requirements={requirements}
          currentUserId={currentUserId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
