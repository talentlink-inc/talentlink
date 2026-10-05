"use client";

import { useEffect, useState } from "react";
import { RecordPanel } from "@/components/ui/RecordPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { RequirementModal } from "./RequirementModal";
import type { RequirementListRow, SerializedRequirement } from "./types";

// Opens a requirement (or the source of a clone) from a slim list row: the
// panel appears at once with what the row knows, then the full record —
// usually already prefetched on hover.
export function RequirementPanelLoader({
  id,
  purpose,
  row,
  load,
  currentUserId,
  canEdit,
  onClose,
  onClone,
}: {
  id: string;
  purpose: "view" | "clone";
  row: RequirementListRow | undefined;
  load: (id: string) => Promise<SerializedRequirement | null>;
  currentUserId: string;
  canEdit: boolean;
  onClose: () => void;
  onClone: (source: SerializedRequirement) => void;
}) {
  const [full, setFull] = useState<SerializedRequirement | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    load(id).then(
      (r) => live && setFull(r),
      () => live && setFull(null)
    );
    return () => {
      live = false;
    };
  }, [id, load]);

  if (full === undefined) {
    return (
      <RecordPanel
        wide
        title={purpose === "clone" ? `New requirement (cloned from ${row?.jobId ?? "…"})` : (row?.jobTitle ?? "Loading…")}
        subtitle={
          row &&
          purpose === "view" && (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{row.jobId}</span>
              <StatusChip status={row.status} />
              {row.clientName && <span>{row.clientName}</span>}
            </span>
          )
        }
        onClose={onClose}
      >
        <div className="space-y-3 pt-1" role="status" aria-label="Loading requirement">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <div className="tl-skeleton h-3.5 w-24" />
              <div className="tl-skeleton col-span-2 h-3.5" style={{ width: `${55 + ((i * 23) % 40)}%` }} />
            </div>
          ))}
        </div>
      </RecordPanel>
    );
  }
  if (full === null) {
    return (
      <RecordPanel title="Requirement not found" onClose={onClose}>
        <p className="text-sm text-black/60 dark:text-white/60">It may have been deleted. Close this panel and refresh the list.</p>
      </RecordPanel>
    );
  }
  return purpose === "clone" ? (
    <RequirementModal
      key={`clone-${full.id}`}
      mode="create"
      requirement={null}
      cloneFrom={full}
      currentUserId={currentUserId}
      canEdit={canEdit}
      onClose={onClose}
    />
  ) : (
    <RequirementModal
      key={`view-${full.id}`}
      mode="view"
      requirement={full}
      currentUserId={currentUserId}
      canEdit={canEdit}
      onClose={onClose}
      onClone={onClone}
    />
  );
}
