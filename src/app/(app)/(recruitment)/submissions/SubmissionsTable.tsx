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
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass } from "@/components/ui/table";
import type { DataPermissions } from "@/lib/users";
import { getSubmissionDetail } from "./actions";
import { SubmissionPanelLoader } from "./SubmissionPanelLoader";
import { useDetailLoader } from "@/components/ui/useDetailLoader";
import type { RequirementSummary, SubmissionListRow } from "./types";

export function SubmissionsTable({
  submissions,
  requirements,
  currentUserId,
  canEdit,
  isAdmin,
  permissions,
}: {
  submissions: SubmissionListRow[];
  requirements: RequirementSummary[];
  currentUserId: string;
  canEdit: boolean;
  isAdmin: boolean;
  permissions: DataPermissions;
}) {
  // The list holds slim rows; an opened submission's full record is fetched
  // (and prefetched on row hover) by id.
  const [modal, setModal] = useState<{ mode: "create" | "view"; id: string | null } | null>(null);
  const detail = useDetailLoader(getSubmissionDetail, submissions);
  const [search, setSearch] = useState("");
  const [visaFilter, setVisaFilter] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cell = useCellClass();
  const open = (s: SubmissionListRow) => {
    setSelectedId(s.id);
    setModal({ mode: "view", id: s.id });
  };
  const warm = (s: SubmissionListRow) => () => void detail.prefetch(s.id);

  // Deep links (?open=id from search, Insights, notifications) open by id,
  // even for a submission outside the rows listed here.
  useOpenParam((id) => {
    setSelectedId(id);
    setModal({ mode: "view", id });
  });

  usePageShortcuts({
    onNew: canEdit ? () => setModal({ mode: "create", id: null }) : undefined,
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search name, email, phone, location"
          placeholder="Search ID, name, email, phone, location…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select
          aria-label="Filter by visa"
          value={visaFilter}
          onChange={(e) => setVisaFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All visas</option>
          {VISA_STATUSES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by employment type"
          value={empTypeFilter}
          onChange={(e) => setEmpTypeFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All employment types</option>
          {SUBMISSION_EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setModal({ mode: "create", id: null })}
              className={buttonClass("primary")}
            >
              + Submit candidate
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Submissions">
        {paged.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => open(s)}
              onTouchStart={warm(s)}
              onFocus={warm(s)}
              className={`w-full rounded-lg border border-black/10 bg-white p-3 text-left dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(s.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{s.candidate.name}</span>
                <StatusChip status={s.status} />
              </div>
              <div className="mt-1 text-sm text-black/60 dark:text-white/60">
                {s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "No requirement"}
              </div>
              <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                {s.submissionId ?? "—"} · {s.submissionDate ? formatDate(s.submissionDate) : "No date"}
                {s.billRate ? ` · ${s.billRateCurrency} ${s.billRate}` : ""}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className={emptyCellClass}>
            {submissions.length === 0 ? "No submissions yet." : "No submissions match your filters."}
          </li>
        )}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[840px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>ID</th>
              <th className={cell}>Candidate</th>
              <th className={cell}>Requirement</th>
              <th className={cell}>Status</th>
              <th className={cell}>Submitted</th>
              <th className={cell}>Bill rate</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => (
              <tr
                key={s.id}
                onClick={() => open(s)}
                onMouseEnter={warm(s)}
                className={`cursor-pointer border-t border-black/5 dark:border-white/10 ${rowSelectClass(s.id === selectedId)}`}
              >
                <td className={`${cell} font-mono text-xs whitespace-nowrap text-black/55 dark:text-white/55`}>
                  {s.submissionId ?? "—"}
                </td>
                <td className={`${cell} font-medium`}>{s.candidate.name}</td>
                <td className={cell}>{s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "—"}</td>
                <td className={cell}>
                  <StatusChip status={s.status} />
                </td>
                <td className={`${cell} whitespace-nowrap`}>{s.submissionDate ? formatDate(s.submissionDate) : "—"}</td>
                <td className={cell}>{s.billRate ? `${s.billRateCurrency} ${s.billRate}` : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className={emptyCellClass}>
                  {submissions.length === 0 ? "No submissions yet." : "No submissions match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal?.mode === "create" && (
        <SubmissionModal
          key="create"
          mode="create"
          submission={null}
          requirements={requirements}
          currentUserId={currentUserId}
          canEdit={canEdit}
          isAdmin={isAdmin}
          permissions={permissions}
          onClose={() => setModal(null)}
          onOpenExisting={(id) => setModal({ mode: "view", id })}
        />
      )}
      {modal?.mode === "view" && modal.id && (
        <SubmissionPanelLoader
          key={modal.id}
          id={modal.id}
          row={submissions.find((s) => s.id === modal.id)}
          load={detail.load}
          mode="view"
          requirements={requirements}
          currentUserId={currentUserId}
          canEdit={canEdit}
          isAdmin={isAdmin}
          permissions={permissions}
          onClose={() => setModal(null)}
          onOpenExisting={(id) => setModal({ mode: "view", id })}
        />
      )}
    </div>
  );
}
