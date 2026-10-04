"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { createBenchSubmission, updateBenchSubmission, deleteBenchSubmission } from "./actions";
import { REJECT_REASON_OPTIONS, SUBMISSION_STATUSES, isRejectedStatus } from "@/lib/recruitment";
import { formatDate } from "@/lib/format";
import { NotesSection } from "../../notes/NotesSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RecordPanel, panelFooterClass } from "@/components/ui/RecordPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { useUi } from "@/components/ui/UiProvider";
import { statusLabel } from "@/lib/statusLabels";
import { Field, FieldTextarea, inputClass, labelClass } from "../FormFields";
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
  const { toast } = useUi();
  useEffect(() => {
    if (mode !== "create" && !submission) onClose();
  }, [mode, submission, onClose]);
  if (mode !== "create" && !submission) return null;

  if (mode === "view" && submission) {
    return (
      <RecordPanel
        title={`${submission.consultant.consultantName} → ${submission.companyName}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{submission.submissionCode}</span>
            <StatusChip status={submission.status} />
          </span>
        }
        onClose={onClose}
        tabs={[
          {
            key: "details",
            label: "Details",
            content: <ViewSubmission submission={submission} canDelete={canDelete} onEdit={() => setMode("edit")} onDeleted={onClose} />,
          },
          {
            key: "notes",
            label: "Notes",
            content: <NotesSection module="bench_submission" recordId={submission.id} currentUserId={currentUserId} />,
          },
        ]}
      />
    );
  }

  return (
    <RecordPanel
      title={mode === "create" ? "Add bench submission" : `Edit ${submission!.submissionCode}`}
      subtitle={mode === "edit" ? `${submission!.consultant.consultantName} → ${submission!.companyName}` : undefined}
      onClose={onClose}
    >
      <SubmissionForm
        submission={mode === "edit" ? submission : null}
        consultants={consultants}
        onCancel={() => (mode === "edit" ? setMode("view") : onClose())}
        onSaved={() => {
          toast({ message: mode === "edit" ? "Submission saved" : "Submission added", tone: "success" });
          if (mode === "edit") setMode("view");
          else onClose();
        }}
        onOpenExisting={onOpenExisting}
      />
    </RecordPanel>
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
  const { toast } = useUi();
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
        {row("Contact person", s.contactPerson)}
        {row("Contact number", s.contactNumber)}
        {row("Email", s.email)}
        {row("Rate", s.rate)}
        {isRejectedStatus(s.status) && row("Reject reason", s.rejectReason)}
        {row("Placement ID", s.placementId)}
        {row("Submitted", s.submissionDate ? formatDate(s.submissionDate) : null)}
        {row("Submitted by", s.submittedByNameRaw)}
        {row("Interviews", String(s.interviewCount))}
        {row("Notes", s.notes && <span className="whitespace-pre-wrap">{s.notes}</span>)}
      </dl>
      <div className={panelFooterClass}>
        {canDelete && (
          <ConfirmButton
            label="Delete"
            confirmText={`Delete ${s.submissionCode}?`}
            body="This can't be undone."
            className={buttonClass("dangerSoft", "md", "mr-auto")}
            onConfirm={async () => {
              // A refusal (e.g. it has interviews) is shown inside the dialog.
              const result = await deleteBenchSubmission(s.id);
              if (result.error) throw new Error(result.error);
              toast({ message: `${s.submissionCode} deleted`, tone: "success" });
              onDeleted();
            }}
          />
        )}
        <button type="button" onClick={onEdit} className={buttonClass("primary")}>
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
      <Field label="Contact person" name="contactPerson" defaultValue={submission?.contactPerson} />
      <Field label="Contact Number" name="contactNumber" type="tel" defaultValue={submission?.contactNumber} />
      <Field label="Contact Email" name="email" type="email" defaultValue={submission?.email} />
      <div>
        <label htmlFor={statusId} className={labelClass}>
          Status *
        </label>
        <select id={statusId} name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
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
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">
          {state.error}{" "}
          {state.duplicateId && (
            <button type="button" onClick={() => onOpenExisting(state.duplicateId!)} className="font-medium underline">
              Open existing submission
            </button>
          )}
        </p>
      )}

      <div className={`${panelFooterClass} sm:col-span-2`}>
        <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
