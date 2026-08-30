"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createSubmission, updateSubmission, deleteSubmission } from "./actions";
import {
  SUBMISSION_STATUSES,
  REJECT_REASON_OPTIONS,
  VISA_STATUSES,
  isRejectedStatus,
} from "@/lib/recruitment";
import { NotesSection } from "../notes/NotesSection";
import type { SerializedSubmission } from "./types";
import type { SerializedRequirement } from "../requirements/types";

type Mode = "create" | "view" | "edit";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

export function SubmissionModal({
  mode: initialMode,
  submission,
  requirements,
  currentUserId,
  onClose,
}: {
  mode: Mode;
  submission: SerializedSubmission | null;
  requirements: SerializedRequirement[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isForm = mode === "create" || mode === "edit";

  const action = submission ? updateSubmission.bind(null, submission.id) : createSubmission;
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    needsConfirmation: false,
    warningMessage: null,
  });

  // React resets uncontrolled form fields after every action dispatch, even
  // when our own action just returns a soft "confirm?" state rather than
  // throwing — so by the time the user sees the warning and clicks "Submit
  // Anyway", the visible fields are already blank. Capturing FormData at
  // submit time (before that reset) and resubmitting the SAME data with
  // force=true avoids silently sending an empty form.
  const lastFormData = useRef<FormData | null>(null);
  const [, startTransition] = useTransition();

  const [status, setStatus] = useState(submission?.status ?? "New_Resume");

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error && !state.needsConfirmation) {
      onClose();
    }
    wasSubmitting.current = pending;
  }, [pending, state, onClose]);

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
            {mode === "create"
              ? "Submit Candidate"
              : mode === "edit"
                ? "Edit Submission"
                : submission?.candidate.name}
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
            <ViewSubmission
              submission={submission}
              onEdit={() => setMode("edit")}
              onDelete={async () => {
                if (confirm(`Delete this submission for "${submission.candidate.name}"?`)) {
                  await deleteSubmission(submission.id);
                  onClose();
                }
              }}
            />
            <NotesSection module="submission" recordId={submission.id} currentUserId={currentUserId} />
          </>
        )}

        {isForm && (
          <form
            action={formAction}
            onSubmit={(e) => {
              lastFormData.current = new FormData(e.currentTarget);
            }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="col-span-2">
              <label className={labelClass}>Requirement *</label>
              <select
                name="requirementId"
                defaultValue={submission?.requirementId ?? ""}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Select a requirement
                </option>
                {requirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.jobId} — {r.jobTitle}
                  </option>
                ))}
              </select>
            </div>

            <Field label="Candidate Name" name="candidateName" defaultValue={submission?.candidate.name} required />
            <Field label="Email" name="email" type="email" defaultValue={submission?.candidate.email ?? ""} />
            <Field label="Phone" name="phone" defaultValue={submission?.candidate.phone ?? ""} />
            <Field
              label="Current Location"
              name="currentLocation"
              defaultValue={submission?.candidate.currentLocation ?? ""}
            />
            <Field
              label="Total Experience (yrs)"
              name="totalExperienceYears"
              type="number"
              step="0.1"
              defaultValue={submission?.candidate.totalExperienceYears ?? ""}
            />
            <div>
              <label className={labelClass}>Visa Status</label>
              <select
                name="visaStatus"
                defaultValue={submission?.candidate.visaStatus ?? ""}
                className={inputClass}
              >
                <option value="">—</option>
                {VISA_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <Field label="LinkedIn URL" name="linkedinUrl" defaultValue={submission?.candidate.linkedinUrl ?? ""} />
            <Field label="Employment Type" name="employmentType" defaultValue={submission?.employmentType ?? ""} />
            <Field label="Bill Rate" name="billRate" type="number" step="0.01" defaultValue={submission?.billRate ?? ""} />
            <Field label="Pay Rate" name="payRate" type="number" step="0.01" defaultValue={submission?.payRate ?? ""} />

            <div className="col-span-2">
              <label className={labelClass}>Role with Skills</label>
              <textarea
                name="roleWithSkills"
                defaultValue={submission?.roleWithSkills ?? ""}
                rows={3}
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Resume {submission?.resume && "(replace)"}</label>
              <input
                type="file"
                name="resume"
                accept=".pdf,.doc,.docx"
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm dark:file:bg-white/10"
              />
            </div>

            {mode === "edit" && (
              <>
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
                      defaultValue={submission?.rejectReason ?? ""}
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
              </>
            )}

            {state.error && <p className="col-span-2 text-sm text-red-600">{state.error}</p>}
            {state.needsConfirmation && (
              <p className="col-span-2 text-sm text-amber-600">{state.warningMessage}</p>
            )}

            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => (submission ? setMode("view") : onClose())}
                className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
              >
                Cancel
              </button>
              {state.needsConfirmation ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const fd = lastFormData.current;
                    if (!fd) return;
                    fd.set("force", "true");
                    startTransition(() => formAction(fd));
                  }}
                  className="rounded-md bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Submit Anyway
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && " *"}
      </label>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className={inputClass}
      />
    </div>
  );
}

function ViewSubmission({
  submission,
  onEdit,
  onDelete,
}: {
  submission: SerializedSubmission;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2">{value ?? "—"}</dd>
    </div>
  );

  return (
    <div>
      <dl className="divide-y divide-black/5 dark:divide-white/5">
        {row("Requirement", submission.requirement?.jobTitle ?? submission.requirementJobIdRaw)}
        {row("Email", submission.candidate.email)}
        {row("Phone", submission.candidate.phone)}
        {row("Location", submission.candidate.currentLocation)}
        {row("Experience", submission.candidate.totalExperienceYears && `${submission.candidate.totalExperienceYears} yrs`)}
        {row("Visa", submission.candidate.visaStatus)}
        {row(
          "LinkedIn",
          submission.candidate.linkedinUrl && (
            <a href={submission.candidate.linkedinUrl} target="_blank" className="text-blue-600 underline">
              Profile
            </a>
          )
        )}
        {row("Employment Type", submission.employmentType)}
        {row("Bill Rate", submission.billRate)}
        {row("Pay Rate", submission.payRate)}
        {row("Status", submission.status)}
        {row("Reject Reason", submission.rejectReason)}
        {row("Placement ID", submission.placementId)}
        {row(
          "Resume",
          submission.resume && (
            <a
              href={`/api/resumes/${submission.resume.id}`}
              target="_blank"
              className="text-blue-600 underline"
            >
              {submission.resume.fileName}
            </a>
          )
        )}
        {row("Role/Skills", submission.roleWithSkills && <p className="whitespace-pre-wrap">{submission.roleWithSkills}</p>)}
      </dl>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onDelete}
          className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
        >
          Delete
        </button>
        <button
          onClick={onEdit}
          className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
