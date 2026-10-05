"use client";

import { useMemo, useRef, useState } from "react";
import { PlacementModal } from "./PlacementModal";
import { formatDate } from "@/lib/format";
import { QUALIFYING_PLACEMENT_STATUSES, isRejectedStatus } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import { StatusChip } from "@/components/ui/StatusChip";
import { statusLabel } from "@/lib/statusLabels";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass } from "@/components/ui/table";
import type { SerializedSubmission } from "../submissions/types";

const FELL_THROUGH = "__fell_through__";

export function PlacementsTable({
  placements,
  currentUserId,
  canEdit,
}: {
  placements: SerializedSubmission[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<SerializedSubmission | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [salesByFilter, setSalesByFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cell = useCellClass();
  const open = (p: SerializedSubmission) => {
    setSelectedId(p.id);
    setSelected(p);
  };

  useOpenParam((id) => {
    const found = placements.find((p) => p.id === id);
    if (found) open(found);
  });

  // No onNew here — placements aren't created directly, they fall out of a
  // Submission's status change (see the README's "not a separate table" note).
  usePageShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const salesByOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of placements) if (p.salesBy) set.add(p.salesBy);
    return Array.from(set).sort();
  }, [placements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return placements.filter((p) => {
      if (statusFilter === FELL_THROUGH) {
        if (!isRejectedStatus(p.status)) return false;
      } else if (statusFilter && p.status !== statusFilter) {
        return false;
      }
      if (salesByFilter && p.salesBy !== salesByFilter) return false;
      if (q) {
        const haystack = `${p.candidate.name} ${p.requirement?.jobTitle ?? p.requirementJobIdRaw ?? ""} ${
          p.requirement?.clientName ?? ""
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [placements, search, statusFilter, salesByFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search by candidate, client, role"
          placeholder="Search candidate, client, role…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All statuses</option>
          {QUALIFYING_PLACEMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
          <option value={FELL_THROUGH}>Fell through</option>
        </select>
        <select
          aria-label="Filter by salesperson"
          value={salesByFilter}
          onChange={(e) => setSalesByFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All salespeople</option>
          {salesByOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="ml-auto hidden md:inline-flex">
          <DensityToggle />
        </span>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Placements">
        {paged.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => open(p)}
              className={`w-full rounded-lg border border-black/10 bg-white p-3 text-left dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(p.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{p.candidate.name}</span>
                <StatusChip status={p.status} />
              </div>
              <div className="mt-1 text-sm text-black/60 dark:text-white/60">
                {p.requirement?.jobTitle ?? p.requirementJobIdRaw ?? "No requirement"}
              </div>
              <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                {p.placementId ?? "—"} · Starts {p.doj ? formatDate(p.doj) : "—"}
                {p.billRate ? ` · ${p.billRateCurrency} ${p.billRate}` : ""}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className={emptyCellClass}>
            {placements.length === 0 ? "No placements yet." : "No placements match your filters."}
          </li>
        )}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[840px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Placement ID</th>
              <th className={cell}>Candidate</th>
              <th className={cell}>Requirement</th>
              <th className={cell}>Status</th>
              <th className={cell}>Selected</th>
              <th className={cell}>Start date</th>
              <th className={cell}>Bill rate</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr
                key={p.id}
                onClick={() => open(p)}
                className={`cursor-pointer border-t border-black/5 dark:border-white/10 ${rowSelectClass(p.id === selectedId)}`}
              >
                <td className={`${cell} font-mono text-xs whitespace-nowrap text-black/55 dark:text-white/55`}>
                  {p.placementId ?? "—"}
                </td>
                <td className={`${cell} font-medium`}>{p.candidate.name}</td>
                <td className={cell}>{p.requirement?.jobTitle ?? p.requirementJobIdRaw ?? "—"}</td>
                <td className={cell}>
                  <StatusChip status={p.status} />
                </td>
                <td className={`${cell} whitespace-nowrap`}>{p.selectedDate ? formatDate(p.selectedDate) : "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{p.doj ? formatDate(p.doj) : "—"}</td>
                <td className={cell}>{p.billRate ? `${p.billRateCurrency} ${p.billRate}` : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className={emptyCellClass}>
                  {placements.length === 0 ? "No placements yet." : "No placements match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {selected && (
        <PlacementModal placement={selected} currentUserId={currentUserId} canEdit={canEdit} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
