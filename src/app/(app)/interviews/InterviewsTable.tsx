"use client";

import { useState } from "react";
import { InterviewModal } from "./InterviewModal";
import { formatDateTime } from "@/lib/format";
import type { SerializedInterview } from "./types";
import type { SerializedSubmission } from "../submissions/types";

export function InterviewsTable({
  interviews,
  eligibleSubmissions,
  currentUserId,
}: {
  interviews: SerializedInterview[];
  eligibleSubmissions: SerializedSubmission[];
  currentUserId: string;
}) {
  const [modal, setModal] = useState<{
    mode: "create" | "view" | "edit";
    interview: SerializedInterview | null;
  } | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Interviews</h1>
        <button
          onClick={() => setModal({ mode: "create", interview: null })}
          className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          + Schedule Interview
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Scheduled</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((i) => (
              <tr
                key={i.id}
                onClick={() => setModal({ mode: "view", interview: i })}
                className="cursor-pointer border-t border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2">{i.submission.candidate.name}</td>
                <td className="px-4 py-2">{i.interviewType}</td>
                <td className="px-4 py-2">
                  {i.scheduledAt ? formatDateTime(i.scheduledAt, i.timezone ?? undefined) : "—"}
                </td>
                <td className="px-4 py-2">{i.mode ?? "—"}</td>
                <td className="px-4 py-2">{i.clientCompany ?? "—"}</td>
                <td className="px-4 py-2">{i.status}</td>
              </tr>
            ))}
            {interviews.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  No interviews yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <InterviewModal
          mode={modal.mode}
          interview={modal.interview}
          eligibleSubmissions={eligibleSubmissions}
          currentUserId={currentUserId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
