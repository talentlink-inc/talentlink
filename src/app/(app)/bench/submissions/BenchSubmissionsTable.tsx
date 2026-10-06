"use client";

import { useMemo, useRef, useState } from "react";
import { BenchSubmissionModal } from "./BenchSubmissionModal";
import { formatDate } from "@/lib/format";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import { StatusChip } from "@/components/ui/StatusChip";
import { statusLabel } from "@/lib/statusLabels";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass, rowClass } from "@/components/ui/table";
import type { BenchConsultantSummary, SerializedBenchSubmission } from "./types";
import { idClass } from "@/components/ui/Chips";

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
  const cell = useCellClass();

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
          aria-label="Search consultant, company, contact"
          placeholder="Search consultant, company, contact…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by submitted by"
          value={submittedByFilter}
          onChange={(e) => setSubmittedByFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">Anyone</option>
          {submitterOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          <button type="button" onClick={() => setModal({ mode: "create", id: null })} className={buttonClass("primary")}>
            + Add submission
          </button>
        </div>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Submissions">
        {paged.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => open(s.id)}
              className={`w-full rounded-[10px] border border-line bg-white p-3 text-left shadow-sm dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(s.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{s.consultant.consultantName}</span>
                <StatusChip status={s.status} />
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                {s.companyName}
                {s.contactPerson ? ` · ${s.contactPerson}` : ""}
              </div>
              <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                {s.submissionCode} · {s.submissionDate ? formatDate(s.submissionDate) : "No date"} · {s.rate ?? "No rate"}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className={emptyCellClass}>{submissions.length === 0 ? "No bench submissions yet." : "No submissions match your filters."}</li>}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[960px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>ID</th>
              <th className={cell}>Consultant</th>
              <th className={cell}>Company</th>
              <th className={cell}>Contact</th>
              <th className={cell}>Rate</th>
              <th className={cell}>Status</th>
              <th className={cell}>Submitted</th>
              <th className={cell}>By</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => (
              <tr
                key={s.id}
                onClick={() => open(s.id)}
                className={`cursor-pointer ${rowClass} ${rowSelectClass(s.id === selectedId)}`}
              >
                <td className={`${cell} ${idClass}`}>{s.submissionCode}</td>
                <td className={`${cell} font-semibold whitespace-nowrap text-text-strong dark:text-white`}>{s.consultant.consultantName}</td>
                <td className={cell}>{s.companyName}</td>
                <td className={cell}>{s.contactPerson ?? "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{s.rate ?? "—"}</td>
                <td className={cell}>
                  <StatusChip status={s.status} />
                </td>
                <td className={`${cell} whitespace-nowrap`}>{s.submissionDate ? formatDate(s.submissionDate) : "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{s.submittedByNameRaw ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className={emptyCellClass}>
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
          // Keyed so switching records/modes (e.g. "Open existing submission"
          // from the duplicate error) remounts with the new initialMode
          // instead of keeping the old dialog's internal mode.
          key={`${modal.mode}-${modal.id ?? "new"}`}
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
