"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { RequirementModal } from "./RequirementModal";
import { updateRequirementPriority } from "./actions";
import { REQUIREMENT_STATUSES, REQUIREMENT_EMPLOYMENT_TYPES, parseEmploymentTypes } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass } from "@/components/ui/table";
import type { SerializedRequirement } from "./types";

export function RequirementsTable({
  requirements,
  currentUserId,
  canEdit,
}: {
  requirements: SerializedRequirement[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [modal, setModal] = useState<{
    mode: "create" | "view" | "edit";
    requirement: SerializedRequirement | null;
    cloneFrom?: SerializedRequirement | null;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cell = useCellClass();

  // Row click opens the record (design review) and also selects the row, so
  // the Clone button keeps working as in GAS.
  const open = (r: SerializedRequirement) => {
    setSelectedId(r.id);
    setModal({ mode: "view", requirement: r });
  };

  function handleStarClick(r: SerializedRequirement, n: number) {
    const current = priorityOverrides[r.id] ?? r.priority;
    const next = n === current ? 0 : n;
    setPriorityOverrides((prev) => ({ ...prev, [r.id]: next }));
    startTransition(async () => {
      await updateRequirementPriority(r.id, next);
      router.refresh();
    });
  }

  useOpenParam((id) => {
    const found = requirements.find((r) => r.id === id);
    if (found) open(found);
  });

  usePageShortcuts({
    onNew: canEdit ? () => setModal({ mode: "create", requirement: null }) : undefined,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requirements.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (empTypeFilter && !parseEmploymentTypes(r.employmentType).includes(empTypeFilter)) return false;
      if (q) {
        const haystack = `${r.jobId} ${r.jobTitle} ${r.clientName ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requirements, search, statusFilter, empTypeFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);

  // Mirrors GAS's Excel-style row select: the Clone icon only shows while
  // exactly one row is genuinely highlighted on the current page — checked
  // against `paged` (what's actually rendered) rather than just trusting
  // `selectedId`, since a filter/search/page change can leave `selectedId`
  // pointing at a row that's no longer visible.
  const selectedRequirement = paged.find((r) => r.id === selectedId) ?? null;
  const emptyMessage =
    requirements.length === 0
      ? "No requirements yet — add the first one with “+ New requirement”."
      : "No requirements match your filters.";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search job title, client"
          placeholder="Search job ID, title, client…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All statuses</option>
          {REQUIREMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
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
          {REQUIREMENT_EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          {canEdit && selectedRequirement && (
            <button
              type="button"
              onClick={() => setModal({ mode: "create", requirement: null, cloneFrom: selectedRequirement })}
              title="Clone selected requirement"
              className={buttonClass("secondary")}
            >
              <Copy size={14} aria-hidden /> Clone
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setModal({ mode: "create", requirement: null })}
              className={buttonClass("primary")}
            >
              + New requirement
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Requirements">
        {paged.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => open(r)}
              className={`w-full rounded-lg border border-black/10 bg-white p-3 text-left dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(r.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{r.jobTitle}</span>
                <StatusChip status={r.status} />
              </div>
              <div className="mt-1 text-sm text-black/60 dark:text-white/60">{r.clientName ?? "No client"}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-black/45 dark:text-white/45">
                <span className="font-mono">{r.jobId}</span>
                {r.billRate ? <span>· {`${r.billRateCurrency} ${r.billRate}`}</span> : null}
                {r.priority > 0 && (
                  <span className="text-amber-500" aria-label={`Priority ${r.priority}`}>
                    · {"★".repeat(r.priority)}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className={emptyCellClass}>{emptyMessage}</li>}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[720px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Job ID</th>
              <th className={cell}>Title</th>
              <th className={cell}>Client</th>
              <th className={cell}>Status</th>
              <th className={cell}>Priority</th>
              <th className={cell}>Bill rate</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr
                key={r.id}
                onClick={() => open(r)}
                className={`cursor-pointer border-t border-black/5 dark:border-white/10 ${rowSelectClass(r.id === selectedId)}`}
              >
                <td className={`${cell} font-mono text-xs whitespace-nowrap text-black/55 dark:text-white/55`}>{r.jobId}</td>
                <td className={`${cell} font-medium`}>{r.jobTitle}</td>
                <td className={cell}>{r.clientName ?? "—"}</td>
                <td className={cell}>
                  <StatusChip status={r.status} />
                </td>
                <td className={cell}>
                  {canEdit ? (
                    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleStarClick(r, n)}
                          aria-label={`Priority ${n}`}
                          className={`text-sm leading-none ${
                            n <= (priorityOverrides[r.id] ?? r.priority) ? "text-amber-400" : "text-black/15 dark:text-white/15"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  ) : (
                    "★".repeat(r.priority) || "—"
                  )}
                </td>
                <td className={cell}>{r.billRate ? `${r.billRateCurrency} ${r.billRate}` : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className={emptyCellClass}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal && (
        <RequirementModal
          key={`${modal.mode}-${modal.requirement?.id ?? "new"}-${modal.cloneFrom?.id ?? "none"}`}
          mode={modal.mode}
          requirement={modal.requirement}
          cloneFrom={modal.cloneFrom}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onClose={() => setModal(null)}
          onClone={(source) => setModal({ mode: "create", requirement: null, cloneFrom: source })}
        />
      )}
    </div>
  );
}
