"use client";

import { useMemo, useRef, useState } from "react";
import { SubmissionModal } from "./SubmissionModal";
import { formatDate } from "@/lib/format";
import { VISA_STATUSES, SUBMISSION_EMPLOYMENT_TYPES, parseEmploymentTypes } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import type { DataPermissions } from "@/lib/users";
import type { SerializedSubmission } from "./types";
import type { SerializedRequirement } from "../requirements/types";

export function SubmissionsTable({
  submissions,
  requirements,
  currentUserId,
  canEdit,
  isAdmin,
  permissions,
}: {
  submissions: SerializedSubmission[];
  requirements: SerializedRequirement[];
  currentUserId: string;
  canEdit: boolean;
  isAdmin: boolean;
  permissions: DataPermissions;
}) {
  const [modal, setModal] = useState<{
    mode: "create" | "view" | "edit";
    submission: SerializedSubmission | null;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [visaFilter, setVisaFilter] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useOpenParam((id) => {
    const found = submissions.find((s) => s.id === id);
    if (found) {
      setSelectedId(found.id);
      setModal({ mode: "view", submission: found });
    }
  });

  usePageShortcuts({
    onNew: canEdit ? () => setModal({ mode: "create", submission: null }) : undefined,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (visaFilter && s.candidate.visaStatus !== visaFilter) return false;
      if (empTypeFilter && !parseEmploymentTypes(s.employmentType).includes(empTypeFilter)) return false;
      if (q) {
        const haystack = `${s.submissionId ?? ""} ${s.candidate.name} ${s.candidate.email ?? ""} ${
          s.candidate.phone ?? ""
        } ${s.candidate.currentLocation ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, visaFilter, empTypeFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Submissions</h1>
        {canEdit && (
          <button
            onClick={() => setModal({ mode: "create", submission: null })}
            className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            + Submit Candidate
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, location..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          value={visaFilter}
          onChange={(e) => setVisaFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Visa</option>
          {VISA_STATUSES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={empTypeFilter}
          onChange={(e) => setEmpTypeFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Employment Type</option>
          {SUBMISSION_EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Submission ID</th>
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Requirement</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Submitted</th>
              <th className="px-4 py-2">Bill Rate</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => (
              <tr
                key={s.id}
                onClick={() => {
                  setSelectedId(s.id);
                  setModal({ mode: "view", submission: s });
                }}
                className={`cursor-pointer border-t border-black/10 dark:border-white/10 ${rowSelectClass(s.id === selectedId)}`}
              >
                <td className="px-4 py-2 font-mono text-xs">{s.submissionId ?? "—"}</td>
                <td className="px-4 py-2">{s.candidate.name}</td>
                <td className="px-4 py-2">{s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "—"}</td>
                <td className="px-4 py-2">{s.status}</td>
                <td className="px-4 py-2">{s.submissionDate ? formatDate(s.submissionDate) : "—"}</td>
                <td className="px-4 py-2">{s.billRate ? `${s.billRateCurrency} ${s.billRate}` : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {submissions.length === 0 ? "No submissions yet." : "No submissions match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal && (
        <SubmissionModal
          key={`${modal.mode}-${modal.submission?.id ?? "new"}`}
          mode={modal.mode}
          submission={modal.submission}
          requirements={requirements}
          currentUserId={currentUserId}
          canEdit={canEdit}
          isAdmin={isAdmin}
          permissions={permissions}
          onClose={() => setModal(null)}
          onOpenExisting={(id) => {
            const found = submissions.find((s) => s.id === id);
            if (found) setModal({ mode: "view", submission: found });
          }}
        />
      )}
    </div>
  );
}
