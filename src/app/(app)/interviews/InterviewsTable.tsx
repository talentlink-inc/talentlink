"use client";

import { useMemo, useState } from "react";
import { InterviewModal } from "./InterviewModal";
import { formatDateTime } from "@/lib/format";
import { INTERVIEW_STATUSES, INTERVIEW_TYPES } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useOpenParam((id) => {
    const found = interviews.find((i) => i.id === id);
    if (found) setModal({ mode: "view", interview: found });
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return interviews.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (typeFilter && i.interviewType !== typeFilter) return false;
      if (q) {
        const haystack = `${i.submission.candidate.name} ${i.clientCompany ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [interviews, search, statusFilter, typeFilter]);

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

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search candidate, company..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Types</option>
          {INTERVIEW_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
            {filtered.map((i) => (
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {interviews.length === 0 ? "No interviews yet." : "No interviews match your filters."}
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
