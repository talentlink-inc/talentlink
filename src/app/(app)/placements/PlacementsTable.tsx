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

  useOpenParam((id) => {
    const found = placements.find((p) => p.id === id);
    if (found) {
      setSelectedId(found.id);
      setSelected(found);
    }
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
      <h1 className="mb-6 text-xl font-semibold">Placements</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by candidate, client, role..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          {QUALIFYING_PLACEMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={FELL_THROUGH}>Fell Through</option>
        </select>
        <select
          value={salesByFilter}
          onChange={(e) => setSalesByFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Sales By</option>
          {salesByOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Placement ID</th>
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Requirement</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Selected</th>
              <th className="px-4 py-2">DOJ</th>
              <th className="px-4 py-2">Bill Rate</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id);
                  setSelected(p);
                }}
                className={`cursor-pointer border-t border-black/10 dark:border-white/10 ${rowSelectClass(p.id === selectedId)}`}
              >
                <td className="px-4 py-2 font-mono text-xs">{p.placementId ?? "—"}</td>
                <td className="px-4 py-2">{p.candidate.name}</td>
                <td className="px-4 py-2">{p.requirement?.jobTitle ?? p.requirementJobIdRaw ?? "—"}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">{p.selectedDate ? formatDate(p.selectedDate) : "—"}</td>
                <td className="px-4 py-2">{p.doj ? formatDate(p.doj) : "—"}</td>
                <td className="px-4 py-2">{p.billRate ? `${p.billRateCurrency} ${p.billRate}` : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {placements.length === 0 ? "No placements yet." : "No placements match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {selected && (
        <PlacementModal
          placement={selected}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
