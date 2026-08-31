"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updatePlacement } from "./actions";
import { SUBMISSION_STATUSES, REJECT_REASON_OPTIONS, isRejectedStatus } from "@/lib/recruitment";
import { NotesSection } from "../notes/NotesSection";
import { formatDate } from "@/lib/format";
import type { SerializedSubmission } from "../submissions/types";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function PlacementModal({
  placement,
  currentUserId,
  canEdit,
  onClose,
}: {
  placement: SerializedSubmission;
  currentUserId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updatePlacement.bind(null, placement.id), {
    error: null,
  });
  const [status, setStatus] = useState(placement.status);
  const [billRate, setBillRate] = useState(placement.billRate ?? "");
  const [payRate, setPayRate] = useState(placement.payRate ?? "");
  const [commission, setCommission] = useState(placement.commission ?? "");

  const grossMargin =
    billRate !== "" && payRate !== "" ? Number(billRate) - Number(payRate) : null;
  const netMargin = grossMargin !== null ? grossMargin - Number(commission || 0) : null;

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) {
      onClose();
    }
    wasSubmitting.current = pending;
  }, [pending, state, onClose]);

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2">{value ?? "—"}</dd>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {placement.placementId} — {placement.candidate.name}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!editing ? (
          <div>
            <dl className="divide-y divide-black/5 dark:divide-white/5">
              {row("Client", placement.requirement?.clientName)}
              {row("Requirement", placement.requirement?.jobTitle)}
              {row("Status", placement.status)}
              {row("Selected Date", placement.selectedDate && formatDate(placement.selectedDate))}
              {row("DOJ", placement.doj && formatDate(placement.doj))}
              {row("Bill Rate", placement.billRate)}
              {row("Pay Rate", placement.payRate)}
              {row("Sales Fee", placement.commission)}
              {row("Sales By", placement.salesBy)}
              {row(
                "Gross Margin",
                placement.billRate && placement.payRate
                  ? (Number(placement.billRate) - Number(placement.payRate)).toFixed(2)
                  : null
              )}
              {row(
                "Net Margin",
                placement.billRate && placement.payRate
                  ? (
                      Number(placement.billRate) -
                      Number(placement.payRate) -
                      Number(placement.commission ?? 0)
                    ).toFixed(2)
                  : null
              )}
            </dl>
            {canEdit && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
                >
                  Edit
                </button>
              </div>
            )}
            <NotesSection module="submission" recordId={placement.id} currentUserId={currentUserId} />
          </div>
        ) : (
          <form action={formAction} className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Status</label>
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                {SUBMISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {isRejectedStatus(status) && (
              <div>
                <label className={labelClass}>Reject Reason *</label>
                <select
                  name="rejectReason"
                  defaultValue={placement.rejectReason ?? ""}
                  required
                  className={inputClass}
                >
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
              <label className={labelClass}>Date of Joining</label>
              <input type="date" name="doj" defaultValue={toDateInputValue(placement.doj)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Sales By</label>
              <input name="salesBy" defaultValue={placement.salesBy ?? ""} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Bill Rate</label>
              <input
                type="number"
                step="0.01"
                name="billRate"
                value={billRate}
                onChange={(e) => setBillRate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Pay Rate</label>
              <input
                type="number"
                step="0.01"
                name="payRate"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sales Fee</label>
              <input
                type="number"
                step="0.01"
                name="commission"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="rounded-md bg-black/5 p-3 text-sm dark:bg-white/5">
              <p>Gross margin: {grossMargin !== null ? grossMargin.toFixed(2) : "—"}</p>
              <p>Net margin: {netMargin !== null ? netMargin.toFixed(2) : "—"}</p>
            </div>

            {state.error && <p className="col-span-2 text-sm text-red-600">{state.error}</p>}

            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
