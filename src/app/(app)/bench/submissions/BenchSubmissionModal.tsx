"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { createBenchSubmission, updateBenchSubmission, deleteBenchSubmission } from "./actions";
import { REJECT_REASON_OPTIONS, SUBMISSION_STATUSES, isRejectedStatus } from "@/lib/recruitment";
import { formatDate } from "@/lib/format";
import { NotesSection } from "../../notes/NotesSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { Field, FieldTextarea, inputClass, labelClass } from "../FormFields";
import { SubmissionStatusBadge } from "./BenchSubmissionsTable";
import type { BenchConsultantSummary, SerializedBenchSubmission } from "./types";

export function BenchSubmissionModal({
  initialMode,
  submission,
  consultants,
  currentUserId,
  canDelete,
  onClose,
  onOpenExisting,
}: {
  initialMode: "create" | "view";
  submission: SerializedBenchSubmission | null;
  consultants: BenchConsultantSummary[];
  currentUserId: string;
  canDelete: boolean;
  onClose: () => void;
  onOpenExisting: (id: string) => void;
}) {
  const [mode, setMode] = useState<"create" | "view" | "edit">(initialMode);
  useEscapeToClose(onClose);
  useEffect(() => {
    if (mode !== "create" && !submission) onClose();
  }, [mode, submission, onClose]);
  if (mode !== "create" && !submission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {mode === "create"
              ? "Add Bench Submission"
              : mode === "edit"
                ? `Edit ${submission!.submissionCode}`
                : `${submission!.submissionCode} — ${submission!.consultant.consultantName} → ${submission!.companyName}`}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {mode === "view" && submission && (
          <>
            <ViewSubmission submission={submission} canDelete={canDelete} onEdit={() => setMode("edit")} onDeleted={onClose} />
            <NotesSection module="bench_submission" recordId={submission.id} currentUserId={currentUserId} />
          </>
        )}
        {(mode === "create" || mode === "edit") && (
          <SubmissionForm
            submission={mode === "edit" ? submission : null}
            consultants={consultants}
            onCancel={() => (mode === "edit" ? setMode("view") : onClose())}
            onSaved={() => (mode === "edit" ? setMode("view") : onClose())}
            onOpenExisting={onOpenExisting}
          />
        )}
      </div>
    </div>
  );
}

function ViewSubmission({
  submission: s,
  canDelete,
  onEdit,
  onDeleted,
}: {
  submission: SerializedBenchSubmission;
  canDelete: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 border-b border-black/5 py-2 text-sm dark:border-white/5">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2 break-words">{value || "—"}</dd>
    </div>
  );
  return (
    <div>
      <dl>
        {row("Consultant", `${s.consultant.consultantCode} — ${s.consultant.consultantName} (${s.consultant.role})`)}
        {row("Company", s.companyName)}
        {row("Contact Person", s.contactPerson)}
        {row("Contact Number", s.contactNumber)}
        {row("Email", s.email)}
        {row("Rate", s.rate)}
        {row("Status", <SubmissionStatusBadge status={s.status} />)}
        {isRejectedStatus(s.status) && row("Reject Reason", s.rejectReason)}
        {row("Placement ID", s.placementId)}
        {row("Submitted", s.submissionDate ? formatDate(s.submissionDate) : null)}
        {row("Submitted By", s.submittedByNameRaw)}
        {row("Interviews", String(s.interviewCount))}
        {row("Notes", s.notes && <span className="whitespace-pre-wrap">{s.notes}</span>)}
      </dl>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        {canDelete && (
          <ConfirmButton
            label="Delete"
            confirmText={`Delete ${s.submissionCode}?`}
            onConfirm={async () => {
              const result = await deleteBenchSubmission(s.id);
              if (result.error) setError(result.error);
              else onDeleted();
            }}
          />
        )}
        <button type="button" onClick={onEdit} className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
          Edit
        </button>
      </div>
    </div>
  );
}

function SubmissionForm({
  submission,
  consultants,
  onCancel,
  onSaved,
  onOpenExisting,
}: {
  submission: SerializedBenchSubmission | null;
  consultants: BenchConsultantSummary[];
  onCancel: () => void;
  onSaved: () => void;
  onOpenExisting: (id: string) => void;
}) {
  const action = submission ? updateBenchSubmission.bind(null, submission.id) : createBenchSubmission;
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [status, setStatus] = useState(submission?.status ?? "Vender_Submission");
  const consultantId = useId();
  const statusId = useId();
  const reasonId = useId();

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) onSaved();
    wasSubmitting.current = pending;
  }, [pending, state, onSaved]);

  // Keep a legacy imported status (e.g. "Submitted") selectable rather than
  // letting the select silently fall back to the first option.
  const statusOptions =
    submission && !(SUBMISSION_STATUSES as readonly string[]).includes(submission.status)
      ? [submission.status, ...SUBMISSION_STATUSES]
      : [...SUBMISSION_STATUSES];
  // A consultant that's since been deleted stays visible on its own record.
  const consultantOptions =
    submission && !consultants.some((c) => c.id === submission.benchConsultantId)
      ? [submission.consultant, ...consultants]
      : consultants;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label htmlFor={consultantId} className={labelClass}>
          Bench Consultant *
        </label>
        <select id={consultantId} name="benchConsultantId" defaultValue={submission?.benchConsultantId ?? ""} required className={inputClass}>
          <option value="" disabled>
            Select a consultant
          </option>
          {consultantOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.consultantCode} — {c.consultantName} ({c.role}, {c.status})
            </option>
          ))}
        </select>
      </div>
      <Field label="Client / Vendor Company" name="companyName" defaultValue={submission?.companyName} required />
      <Field label="Rate" name="rate" defaultValue={submission?.rate} placeholder="e.g. $75/hr C2C" />
      <Field label="Contact Person" name="contactPerson" defaultValue={submission?.contactPerson} />
      <Field label="Contact Number" name="contactNumber" type="tel" defaultValue={submission?.contactNumber} />
      <Field label="Contact Email" name="email" type="email" defaultValue={submission?.email} />
      <div>
        <label htmlFor={statusId} className={labelClass}>
          Status *
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
          <select id={reasonId} name="rejectReason" defaultValue={submission?.rejectReason ?? ""} required className={inputClass}>
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
      <div className="sm:col-span-2">
        <FieldTextarea label="Notes" name="notes" defaultValue={submission?.notes} />
      </div>

      {state.error && !pending && (
        <p className="text-sm text-red-600 sm:col-span-2">
          {state.error}{" "}
          {state.duplicateId && (
            <button type="button" onClick={() => onOpenExisting(state.duplicateId!)} className="underline">
              Open existing submission
            </button>
          )}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
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
  );
}
