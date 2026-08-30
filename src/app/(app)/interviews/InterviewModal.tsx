"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createInterview, updateInterview, deleteInterview } from "./actions";
import { INTERVIEW_STATUSES, INTERVIEW_MODES, INTERVIEW_TYPES } from "@/lib/recruitment";
import { NotesSection } from "../notes/NotesSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDateTime } from "@/lib/format";
import type { SerializedInterview } from "./types";
import type { SerializedSubmission } from "../submissions/types";

type Mode = "create" | "view" | "edit";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

function toDatetimeLocalValue(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function InterviewModal({
  mode: initialMode,
  interview,
  eligibleSubmissions,
  currentUserId,
  onClose,
}: {
  mode: Mode;
  interview: SerializedInterview | null;
  eligibleSubmissions: SerializedSubmission[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isForm = mode === "create" || mode === "edit";

  const action = interview ? updateInterview.bind(null, interview.id) : createInterview;
  const [state, formAction, pending] = useActionState(action, { error: null });

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) {
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
              ? "Schedule Interview"
              : mode === "edit"
                ? "Edit Interview"
                : `${interview?.submission.candidate.name} — ${interview?.interviewType}`}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {mode === "view" && interview && (
          <>
            <ViewInterview
              interview={interview}
              onEdit={() => setMode("edit")}
              onDelete={async () => {
                await deleteInterview(interview.id);
                onClose();
              }}
            />
            <NotesSection module="interview" recordId={interview.id} currentUserId={currentUserId} />
          </>
        )}

        {isForm && (
          <form action={formAction} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Candidate Submission *</label>
              <select
                name="submissionId"
                defaultValue={interview?.submissionId ?? ""}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Select a submission
                </option>
                {eligibleSubmissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.candidate.name} — {s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "—"} (
                    {s.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Round *</label>
              <select
                name="interviewType"
                defaultValue={interview?.interviewType ?? "L1"}
                required
                className={inputClass}
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Mode</label>
              <select name="mode" defaultValue={interview?.mode ?? "video"} className={inputClass}>
                {INTERVIEW_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Date & Time *</label>
              <input
                type="datetime-local"
                name="scheduledAt"
                defaultValue={toDatetimeLocalValue(interview?.scheduledAt)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Duration (min)</label>
              <input
                type="number"
                name="durationMinutes"
                defaultValue={interview?.durationMinutes ?? 60}
                className={inputClass}
              />
            </div>

            <Field
              label="Timezone"
              name="timezone"
              defaultValue={interview?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
            />
            <Field
              label="Client Company"
              name="clientCompany"
              defaultValue={interview?.clientCompany ?? interview?.submission.requirement?.clientName ?? ""}
            />

            {mode === "edit" && (
              <>
                <div>
                  <label className={labelClass}>Status</label>
                  <select name="status" defaultValue={interview?.status ?? "Scheduled"} className={inputClass}>
                    {INTERVIEW_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Feedback</label>
                  <textarea
                    name="feedback"
                    defaultValue={interview?.feedback ?? ""}
                    rows={3}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {state.error && <p className="col-span-2 text-sm text-red-600">{state.error}</p>}

            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => (interview ? setMode("view") : onClose())}
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

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input name={name} defaultValue={defaultValue} className={inputClass} />
    </div>
  );
}

function ViewInterview({
  interview,
  onEdit,
  onDelete,
}: {
  interview: SerializedInterview;
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
        {row("Candidate", interview.submission.candidate.name)}
        {row("Requirement", interview.submission.requirement?.jobTitle)}
        {row("Round", interview.interviewType)}
        {row(
          "Scheduled",
          interview.scheduledAt && formatDateTime(interview.scheduledAt, interview.timezone ?? undefined)
        )}
        {row("Timezone", interview.timezone)}
        {row("Mode", interview.mode)}
        {row("Duration", interview.durationMinutes && `${interview.durationMinutes} min`)}
        {row("Client", interview.clientCompany)}
        {row("Status", interview.status)}
        {row("Scheduled By", interview.scheduledByNameRaw)}
        {row("Feedback", interview.feedback && <p className="whitespace-pre-wrap">{interview.feedback}</p>)}
      </dl>
      <div className="mt-4 flex justify-end gap-2">
        <ConfirmButton
          onConfirm={onDelete}
          confirmText={`Delete this interview for "${interview.submission.candidate.name}"?`}
          className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
        />
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
