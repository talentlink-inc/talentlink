"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { updateBenchPlacement } from "../submissions/actions";
import { formatDate } from "@/lib/format";
import { QUALIFYING_PLACEMENT_STATUSES, REJECT_REASON_OPTIONS, SUBMISSION_STATUSES, isRejectedStatus } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import { NotesSection } from "../../notes/NotesSection";
import { Field, inputClass, labelClass } from "../FormFields";
import { StatusChip } from "@/components/ui/StatusChip";
import { statusLabel } from "@/lib/statusLabels";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass, useUi } from "@/components/ui/UiProvider";
import { RecordPanel, panelFooterClass } from "@/components/ui/RecordPanel";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass } from "@/components/ui/table";
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
  const cell = useCellClass();

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
  const current = openId ? (placements.find((p) => p.id === openId) ?? null) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search placement ID, consultant, company"
          placeholder="Search placement ID, consultant, company…"
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
        <span className="ml-auto hidden md:inline-flex">
          <DensityToggle />
        </span>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Placements">
        {paged.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => open(p.id)}
              className={`w-full rounded-lg border border-black/10 bg-white p-3 text-left dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(p.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{p.consultant.consultantName}</span>
                <StatusChip status={p.status} />
              </div>
              <div className="mt-1 text-sm text-black/60 dark:text-white/60">{p.companyName}</div>
              <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                {p.placementId} · Starts {p.doj ? formatDate(p.doj) : "—"} · {p.billRate ?? p.rate ?? "No rate"}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className={emptyCellClass}>
            {placements.length === 0 ? "No bench placements yet." : "No placements match your filters."}
          </li>
        )}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[840px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Placement ID</th>
              <th className={cell}>Consultant</th>
              <th className={cell}>Company</th>
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
                onClick={() => open(p.id)}
                className={`cursor-pointer border-t border-black/5 dark:border-white/10 ${rowSelectClass(p.id === selectedId)}`}
              >
                <td className={`${cell} font-mono text-xs whitespace-nowrap text-black/55 dark:text-white/55`}>
                  {p.placementId}
                </td>
                <td className={`${cell} font-medium`}>{p.consultant.consultantName}</td>
                <td className={cell}>{p.companyName}</td>
                <td className={cell}>
                  <StatusChip status={p.status} />
                </td>
                <td className={`${cell} whitespace-nowrap`}>{p.selectedDate ? formatDate(p.selectedDate) : "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{p.doj ? formatDate(p.doj) : "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{p.billRate ?? p.rate ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className={emptyCellClass}>
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
  const { toast } = useUi();
  const [state, formAction, pending] = useActionState(updateBenchPlacement.bind(null, p.id), { error: null });
  const [status, setStatus] = useState(p.status);
  const statusId = useId();
  const reasonId = useId();
  const dojId = useId();
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) {
      toast({ message: "Placement saved", tone: "success" });
      onClose();
    }
    wasSubmitting.current = pending;
  }, [pending, state, onClose, toast]);

  const statusOptions = (SUBMISSION_STATUSES as readonly string[]).includes(p.status)
    ? [...SUBMISSION_STATUSES]
    : [p.status, ...SUBMISSION_STATUSES];

  return (
    <RecordPanel
      title={`${p.consultant.consultantName} → ${p.companyName}`}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{p.placementId}</span>
          <StatusChip status={p.status} />
        </span>
      }
      onClose={onClose}
      tabs={[
        {
          key: "details",
          label: "Details",
          content: (
            <>
              <p className="mb-4 text-sm text-black/60 dark:text-white/60">
                {p.submissionCode} · submitted {p.submissionDate ? formatDate(p.submissionDate) : "—"}
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
                  <select
                    id={statusId}
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={inputClass}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                {isRejectedStatus(status) && (
                  <div>
                    <label htmlFor={reasonId} className={labelClass}>
                      Reject reason *
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
                    Start date (DOJ)
                  </label>
                  <input id={dojId} type="date" name="doj" defaultValue={toDateInput(p.doj)} className={inputClass} />
                </div>
                <Field label="Bill rate" name="billRate" defaultValue={p.billRate ?? p.rate} placeholder="e.g. $85/hr C2C" />

                {state.error && !pending && (
                  <p role="alert" className="text-sm text-red-600 sm:col-span-2">
                    {state.error}
                  </p>
                )}
                <div className={`${panelFooterClass} sm:col-span-2`}>
                  <button type="button" onClick={onClose} className={buttonClass("secondary")}>
                    Cancel
                  </button>
                  <button type="submit" disabled={pending} className={buttonClass("primary")}>
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </>
          ),
        },
        {
          key: "notes",
          label: "Notes",
          content: <NotesSection module="bench_submission" recordId={p.id} currentUserId={currentUserId} />,
        },
      ]}
    />
  );
}
