"use client";

import { useMemo, useRef, useState } from "react";
import { BenchSubmissionModal } from "./BenchSubmissionModal";
import { formatDate } from "@/lib/format";
import { submissionStatusBucket } from "@/lib/bench";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import type { BenchConsultantSummary, SerializedBenchSubmission } from "./types";

const BUCKET_STYLES = {
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
} as const;

export function SubmissionStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${BUCKET_STYLES[submissionStatusBucket(status)]}`}>
      {status}
    </span>
  );
}

export function BenchSubmissionsTable({
  submissions,
  consultants,
  currentUserId,
  canDelete,
}: {
  submissions: SerializedBenchSubmission[];
  consultants: BenchConsultantSummary[];
  currentUserId: string;
  canDelete: boolean;
}) {
  const [modal, setModal] = useState<{ mode: "create" | "view"; id: string | null } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [submittedByFilter, setSubmittedByFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const open = (id: string) => {
    setSelectedId(id);
    setModal({ mode: "view", id });
  };
  useOpenParam((id) => {
    if (submissions.some((s) => s.id === id)) open(id);
  });
  usePageShortcuts({
    onNew: () => setModal({ mode: "create", id: null }),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const statusOptions = useMemo(() => Array.from(new Set(submissions.map((s) => s.status))).sort(), [submissions]);
  const submitterOptions = useMemo(
    () => Array.from(new Set(submissions.map((s) => s.submittedByNameRaw).filter((v): v is string => !!v))).sort(),
    [submissions]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (submittedByFilter && s.submittedByNameRaw !== submittedByFilter) return false;
      if (q) {
        const haystack = `${s.submissionCode} ${s.consultant.consultantName} ${s.companyName} ${s.contactPerson ?? ""} ${
          s.email ?? ""
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, statusFilter, submittedByFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);
  const current = modal?.id ? submissions.find((s) => s.id === modal.id) ?? null : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search consultant, company, contact..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by submitted by"
          value={submittedByFilter}
          onChange={(e) => setSubmittedByFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Submitted By</option>
          {submitterOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setModal({ mode: "create", id: null })}
          className="ml-auto rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          + Add Submission
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Consultant</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => (
              <tr
                key={s.id}
                onClick={() => open(s.id)}
                className={`cursor-pointer border-t border-black/10 dark:border-white/10 ${rowSelectClass(s.id === selectedId)}`}
              >
                <td className="px-3 py-2 font-mono text-xs">{s.submissionCode}</td>
                <td className="px-3 py-2 font-medium">{s.consultant.consultantName}</td>
                <td className="px-3 py-2">{s.companyName}</td>
                <td className="px-3 py-2">{s.contactPerson ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.rate ?? "—"}</td>
                <td className="px-3 py-2">
                  <SubmissionStatusBadge status={s.status} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{s.submissionDate ? formatDate(s.submissionDate) : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{s.submittedByNameRaw ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {submissions.length === 0 ? "No bench submissions yet." : "No submissions match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal && (
        <BenchSubmissionModal
          initialMode={modal.mode}
          submission={modal.mode === "create" ? null : current}
          consultants={consultants}
          currentUserId={currentUserId}
          canDelete={canDelete}
          onClose={() => setModal(null)}
          onOpenExisting={open}
        />
      )}
    </div>
  );
}
