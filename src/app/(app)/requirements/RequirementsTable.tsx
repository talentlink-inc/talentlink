"use client";

import { useState } from "react";
import { RequirementModal } from "./RequirementModal";
import type { SerializedRequirement } from "./types";

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
            {requirements.map((r) => (
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
            {requirements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  No requirements yet. Add one, or run the migration script to pull recent JDs in.
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
