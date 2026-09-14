"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RequirementModal } from "./RequirementModal";
import { updateRequirementPriority } from "./actions";
import { REQUIREMENT_STATUSES, REQUIREMENT_EMPLOYMENT_TYPES, parseEmploymentTypes } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
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
    if (found) setModal({ mode: "view", requirement: found });
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Requirements</h1>
        {canEdit && (
          <button
            onClick={() => setModal({ mode: "create", requirement: null })}
            className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            + New Requirement
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job title, client..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          {REQUIREMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={empTypeFilter}
          onChange={(e) => setEmpTypeFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Employment Type</option>
          {REQUIREMENT_EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Job ID</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Bill Rate</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr
                key={r.id}
                onClick={() => setModal({ mode: "view", requirement: r })}
                className="cursor-pointer border-t border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2 font-mono text-xs">{r.jobId}</td>
                <td className="px-4 py-2">{r.jobTitle}</td>
                <td className="px-4 py-2">{r.clientName ?? "—"}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">
                  {canEdit ? (
                    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleStarClick(r, n)}
                          aria-label={`Priority ${n}`}
                          className={`text-sm leading-none ${
                            n <= (priorityOverrides[r.id] ?? r.priority)
                              ? "text-amber-400"
                              : "text-black/15 dark:text-white/15"
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
                <td className="px-4 py-2">
                  {r.billRate ? `${r.billRateCurrency} ${r.billRate}` : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {requirements.length === 0
                    ? "No requirements yet. Add one, or run the migration script to pull recent JDs in."
                    : "No requirements match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal && (
        <RequirementModal
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
