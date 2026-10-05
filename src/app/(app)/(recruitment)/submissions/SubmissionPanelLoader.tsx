"use client";

import { useEffect, useState } from "react";
import { RecordPanel } from "@/components/ui/RecordPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { SubmissionModal } from "./SubmissionModal";
import type { DataPermissions } from "@/lib/users";
import type { RequirementSummary, SerializedSubmission, SubmissionListRow } from "./types";

// Opens a submission from a slim list row: shows the panel straight away with
// what the row already knows (name, ID, status) and placeholder lines, then the
// full record once it arrives (usually already prefetched on hover).
export function SubmissionPanelLoader({
  id,
  row,
  load,
  mode,
  ...modalProps
}: {
  id: string;
  row: SubmissionListRow | undefined;
  load: (id: string) => Promise<SerializedSubmission | null>;
  mode: "view" | "edit";
  requirements: RequirementSummary[];
  currentUserId: string;
  canEdit: boolean;
  isAdmin: boolean;
  permissions: DataPermissions;
  onClose: () => void;
  onOpenExisting: (id: string) => void;
}) {
  const [full, setFull] = useState<SerializedSubmission | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    load(id).then(
      (s) => live && setFull(s),
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
        title={row?.candidate.name ?? "Loading…"}
        subtitle={
          row && (
            <span className="inline-flex flex-wrap items-center gap-2">
              {row.submissionId && <span className="font-mono text-xs">{row.submissionId}</span>}
              <StatusChip status={row.status} />
              <span>{row.requirement?.jobTitle ?? row.requirementJobIdRaw}</span>
            </span>
          )
        }
        onClose={modalProps.onClose}
      >
        <div className="space-y-3 pt-1" role="status" aria-label="Loading submission">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <div className="tl-skeleton h-3.5 w-24" />
              <div className="tl-skeleton col-span-2 h-3.5" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
            </div>
          ))}
        </div>
      </RecordPanel>
    );
  }
  if (full === null) {
    return (
      <RecordPanel title="Submission not found" onClose={modalProps.onClose}>
        <p className="text-sm text-black/60 dark:text-white/60">It may have been deleted. Close this panel and refresh the list.</p>
      </RecordPanel>
    );
  }
  return <SubmissionModal key={`${mode}-${full.id}`} mode={mode} submission={full} {...modalProps} />;
}
