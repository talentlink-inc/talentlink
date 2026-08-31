"use client";

import { useMemo, useState } from "react";
import { RequirementModal } from "./RequirementModal";
import { REQUIREMENT_STATUSES } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import type { SerializedRequirement } from "./types";

const EMPLOYMENT_TYPES = ["FTE", "W2", "1099", "C2C", "C2H"];

export function RequirementsTable({
  requirements,
  currentUserId,
}: {
  requirements: SerializedRequirement[];
  currentUserId: string;
}) {
  const [modal, setModal] = useState<{
    mode: "create" | "view" | "edit";
    requirement: SerializedRequirement | null;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");

  useOpenParam((id) => {
    const found = requirements.find((r) => r.id === id);
    if (found) setModal({ mode: "view", requirement: found });
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requirements.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (empTypeFilter && r.employmentType !== empTypeFilter) return false;
      if (q) {
        const haystack = `${r.jobId} ${r.jobTitle} ${r.clientName ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requirements, search, statusFilter, empTypeFilter]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Requirements</h1>
        <button
          onClick={() => setModal({ mode: "create", requirement: null })}
          className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          + Add Requirement
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
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
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
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
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => setModal({ mode: "view", requirement: r })}
                className="cursor-pointer border-t border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2 font-mono text-xs">{r.jobId}</td>
                <td className="px-4 py-2">{r.jobTitle}</td>
                <td className="px-4 py-2">{r.clientName ?? "—"}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">{r.priority}</td>
                <td className="px-4 py-2">{r.billRate?.toString() ?? "—"}</td>
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

      {modal && (
        <RequirementModal
          mode={modal.mode}
          requirement={modal.requirement}
          currentUserId={currentUserId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
