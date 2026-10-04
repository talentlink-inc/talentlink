"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updatePlacement } from "./actions";
import { SUBMISSION_STATUSES, REJECT_REASON_OPTIONS, isRejectedStatus } from "@/lib/recruitment";
import { NotesSection } from "../notes/NotesSection";
import { formatDate } from "@/lib/format";
import { RecordPanel, panelFooterClass } from "@/components/ui/RecordPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { useUi } from "@/components/ui/UiProvider";
import { toolbarInputClass } from "@/components/ui/table";
import { statusLabel } from "@/lib/statusLabels";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import type { SerializedSubmission } from "../submissions/types";

const inputClass = `${toolbarInputClass} w-full`;
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
  const { toast } = useUi();
  const [status, setStatus] = useState(placement.status);
  const [billRate, setBillRate] = useState(placement.billRate ?? "");
  const [billRateCurrency, setBillRateCurrency] = useState(placement.billRateCurrency ?? "USD");
  const [payRate, setPayRate] = useState(placement.payRate ?? "");
  const [payRateCurrency, setPayRateCurrency] = useState(placement.payRateCurrency ?? "USD");
  const [commission, setCommission] = useState(placement.commission ?? "");

  const grossMargin = billRate !== "" && payRate !== "" ? Number(billRate) - Number(payRate) : null;
  const netMargin = grossMargin !== null ? grossMargin - Number(commission || 0) : null;

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) {
      toast({ message: "Placement saved", tone: "success" });
      onClose();
    }
    wasSubmitting.current = pending;
  }, [pending, state, onClose, toast]);

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2">{value ?? "—"}</dd>
    </div>
  );

  const details = (
    <div>
      <dl className="divide-y divide-black/5 dark:divide-white/5">
        {row("Client", placement.requirement?.clientName)}
        {row("Requirement", placement.requirement?.jobTitle)}
        {row("Selected", placement.selectedDate && formatDate(placement.selectedDate))}
        {row("Start date (DOJ)", placement.doj && formatDate(placement.doj))}
        {row("Bill rate", placement.billRate && `${placement.billRateCurrency} ${placement.billRate}`)}
        {row("Pay rate", placement.payRate && `${placement.payRateCurrency} ${placement.payRate}`)}
        {row("Sales fee", placement.commission)}
        {row("Sales by", placement.salesBy)}
        {row(
          "Gross margin",
          placement.billRate && placement.payRate ? (Number(placement.billRate) - Number(placement.payRate)).toFixed(2) : null,
        )}
        {row(
          "Net margin",
          placement.billRate && placement.payRate
            ? (Number(placement.billRate) - Number(placement.payRate) - Number(placement.commission ?? 0)).toFixed(2)
            : null,
        )}
      </dl>
      {canEdit && (
        <div className={panelFooterClass}>
          <button type="button" onClick={() => setEditing(true)} className={buttonClass("primary")}>
            Edit
          </button>
        </div>
      )}
    </div>
  );

  return (
    <RecordPanel
      title={editing ? `Edit placement — ${placement.candidate.name}` : placement.candidate.name}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          {placement.placementId && <span className="font-mono text-xs">{placement.placementId}</span>}
          {!editing && <StatusChip status={placement.status} />}
          <span>{placement.requirement?.jobTitle ?? placement.requirementJobIdRaw}</span>
        </span>
      }
      onClose={onClose}
      tabs={
        editing
          ? undefined
          : [
              { key: "details", label: "Details", content: details },
              {
                key: "notes",
                label: "Notes",
                content: <NotesSection module="submission" recordId={placement.id} currentUserId={currentUserId} />,
              },
            ]
      }
    >
      {editing && (
        <form action={formAction} className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Status</label>
            <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              {SUBMISSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          {isRejectedStatus(status) && (
            <div>
              <label className={labelClass}>Reject Reason *</label>
              <select name="rejectReason" defaultValue={placement.rejectReason ?? ""} required className={inputClass}>
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
            <div className="flex gap-1">
              <select
                name="billRateCurrency"
                value={billRateCurrency}
                onChange={(e) => setBillRateCurrency(e.target.value)}
                className={inputClass.replace("w-full", "w-24 shrink-0")}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                name="billRate"
                value={billRate}
                onChange={(e) => setBillRate(e.target.value)}
                className={inputClass.replace("w-full", "min-w-0 flex-1")}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Pay Rate</label>
            <div className="flex gap-1">
              <select
                name="payRateCurrency"
                value={payRateCurrency}
                onChange={(e) => setPayRateCurrency(e.target.value)}
                className={inputClass.replace("w-full", "w-24 shrink-0")}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                name="payRate"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                className={inputClass.replace("w-full", "min-w-0 flex-1")}
              />
            </div>
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

          {state.error && (
            <p role="alert" className="col-span-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <div className={`${panelFooterClass} col-span-2`}>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("secondary")}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </RecordPanel>
  );
}
