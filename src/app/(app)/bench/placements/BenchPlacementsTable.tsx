"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { updateBenchPlacement } from "../submissions/actions";
import { formatDate } from "@/lib/format";
import { QUALIFYING_PLACEMENT_STATUSES, REJECT_REASON_OPTIONS, SUBMISSION_STATUSES, isRejectedStatus } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import { NotesSection } from "../../notes/NotesSection";
import { Field, inputClass, labelClass } from "../FormFields";
import { SubmissionStatusBadge } from "../submissions/BenchSubmissionsTable";
import type { SerializedBenchSubmission } from "../submissions/types";

const FELL_THROUGH = "__fell_through__";

// <input type="date"> wants YYYY-MM-DD; DOJ is a calendar date stored at UTC
// midnight, so read it back in UTC to avoid an off-by-one-day shift.
const toDateInput = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function BenchPlacementsTable({
  placements,
  currentUserId,
}: {
  placements: SerializedBenchSubmission[];
  currentUserId: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const open = (id: string) => {
    setSelectedId(id);
    setOpenId(id);
  };
  useOpenParam((id) => {
    if (placements.some((p) => p.id === id)) open(id);
  });
  usePageShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return placements.filter((p) => {
      if (statusFilter === FELL_THROUGH) {
        if (!isRejectedStatus(p.status)) return false;
      } else if (statusFilter && p.status !== statusFilter) return false;
      if (q && !`${p.placementId} ${p.consultant.consultantName} ${p.companyName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [placements, search, statusFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);
  const current = openId ? placements.find((p) => p.id === openId) ?? null : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search placement ID, consultant, company"
          placeholder="Search placement ID, consultant, company..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          aria-label="Filter by status"
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
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2">Placement ID</th>
              <th className="px-3 py-2">Consultant</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Selected</th>
              <th className="px-3 py-2">DOJ</th>
              <th className="px-3 py-2">Bill Rate</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr
                key={p.id}
                onClick={() => open(p.id)}
                className={`cursor-pointer border-t border-black/10 dark:border-white/10 ${rowSelectClass(p.id === selectedId)}`}
              >
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.placementId}</td>
                <td className="px-3 py-2 font-medium">{p.consultant.consultantName}</td>
                <td className="px-3 py-2">{p.companyName}</td>
                <td className="px-3 py-2">
                  <SubmissionStatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{p.selectedDate ? formatDate(p.selectedDate) : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{p.doj ? formatDate(p.doj) : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{p.billRate ?? p.rate ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {placements.length === 0 ? "No bench placements yet." : "No placements match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {current && <PlacementModal placement={current} currentUserId={currentUserId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PlacementModal({
  placement: p,
  currentUserId,
  onClose,
}: {
  placement: SerializedBenchSubmission;
  currentUserId: string;
  onClose: () => void;
}) {
  useEscapeToClose(onClose);
  const [state, formAction, pending] = useActionState(updateBenchPlacement.bind(null, p.id), { error: null });
  const [status, setStatus] = useState(p.status);
  const statusId = useId();
  const reasonId = useId();
  const dojId = useId();
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) onClose();
    wasSubmitting.current = pending;
  }, [pending, state, onClose]);

  const statusOptions = (SUBMISSION_STATUSES as readonly string[]).includes(p.status)
    ? [...SUBMISSION_STATUSES]
    : [p.status, ...SUBMISSION_STATUSES];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {p.placementId} — {p.consultant.consultantName}
          </h2>
          <button onClick={onClose} className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white" aria-label="Close">
            ×
          </button>
        </div>
        <p className="mb-4 text-sm text-black/60 dark:text-white/60">
          {p.companyName} · {p.submissionCode} · submitted {p.submissionDate ? formatDate(p.submissionDate) : "—"}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            startTransition(() => formAction(formData));
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <label htmlFor={statusId} className={labelClass}>
              Status
            </label>
            <select id={statusId} name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {isRejectedStatus(status) && (
            <div>
              <label htmlFor={reasonId} className={labelClass}>
                Reject Reason *
              </label>
              <select id={reasonId} name="rejectReason" defaultValue={p.rejectReason ?? ""} required className={inputClass}>
                <option value="" disabled>
                  Select a reason
                </option>
                {REJECT_REASON_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor={dojId} className={labelClass}>
              Date of Joining
            </label>
            <input id={dojId} type="date" name="doj" defaultValue={toDateInput(p.doj)} className={inputClass} />
          </div>
          <Field label="Bill Rate" name="billRate" defaultValue={p.billRate ?? p.rate} placeholder="e.g. $85/hr C2C" />

          {state.error && !pending && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" onClick={onClose} className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
        <NotesSection module="bench_submission" recordId={p.id} currentUserId={currentUserId} />
      </div>
    </div>
  );
}
