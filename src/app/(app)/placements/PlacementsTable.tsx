"use client";

import { useState } from "react";
import { PlacementModal } from "./PlacementModal";
import { formatDate } from "@/lib/format";
import type { SerializedSubmission } from "../submissions/types";

export function PlacementsTable({
  placements,
  currentUserId,
}: {
  placements: SerializedSubmission[];
  currentUserId: string;
}) {
  const [selected, setSelected] = useState<SerializedSubmission | null>(null);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Placements</h1>
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
            {placements.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelected(p)}
                className="cursor-pointer border-t border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2 font-mono text-xs">{p.placementId ?? "—"}</td>
                <td className="px-4 py-2">{p.candidate.name}</td>
                <td className="px-4 py-2">{p.requirement?.jobTitle ?? p.requirementJobIdRaw ?? "—"}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">{p.selectedDate ? formatDate(p.selectedDate) : "—"}</td>
                <td className="px-4 py-2">{p.doj ? formatDate(p.doj) : "—"}</td>
                <td className="px-4 py-2">{p.billRate ?? "—"}</td>
              </tr>
            ))}
            {placements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  No placements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <PlacementModal placement={selected} currentUserId={currentUserId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
