"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { createInterview, updateInterview, deleteInterview } from "./actions";
import { INTERVIEW_STATUSES, INTERVIEW_MODES, INTERVIEW_TYPES } from "@/lib/recruitment";
import { NotesSection } from "../../notes/NotesSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDateTime } from "@/lib/format";
import { isValidTimeZone, timeZoneOptions, utcToZonedLocal } from "@/lib/timezone";
import { RecordPanel, panelFooterClass } from "@/components/ui/RecordPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { useUi } from "@/components/ui/UiProvider";
import { toolbarInputClass } from "@/components/ui/table";
import { statusLabel } from "@/lib/statusLabels";
import type { SerializedInterview } from "./types";
import type { InterviewSubmissionSummary } from "./types";

type Mode = "create" | "view" | "edit";

const inputClass = `${toolbarInputClass} w-full`;
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

// Pre-fills in the interview's own timezone (the same one the server reads
// the value back in), not the browser's — otherwise every re-save of an
// edit shifted the time by the difference between the two.
function toDatetimeLocalValue(date: Date | null | undefined, timeZone: string | null | undefined): string {
  if (!date) return "";
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone;
  return utcToZonedLocal(new Date(date), tz);
}

export function InterviewModal({
  mode: initialMode,
  interview,
  eligibleSubmissions,
  currentUserId,
  canEdit,
  onClose,
}: {
  mode: Mode;
  interview: SerializedInterview | null;
  eligibleSubmissions: InterviewSubmissionSummary[];
  currentUserId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isForm = mode === "create" || mode === "edit";
  const { toast } = useUi();

  const action = interview ? updateInterview.bind(null, interview.id) : createInterview;
  const [state, formAction, pending] = useActionState(action, { error: null });

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) {
      toast({ message: interview ? "Interview saved" : "Interview scheduled", tone: "success" });
      onClose();
    }
    wasSubmitting.current = pending;
  }, [pending, state, onClose, toast, interview]);

  return (
    <RecordPanel
      title={
        mode === "create"
          ? "Schedule interview"
          : mode === "edit"
            ? "Edit interview"
            : `${interview?.submission.candidate.name} — ${statusLabel(interview?.interviewType)}`
      }
      subtitle={
        interview && (
          <span className="inline-flex flex-wrap items-center gap-2">
            {mode === "view" && <StatusChip status={interview.status} />}
            <span>{interview.submission.requirement?.jobTitle ?? interview.clientCompany}</span>
          </span>
        )
      }
      onClose={onClose}
      tabs={
        mode === "view" && interview
          ? [
              {
                key: "details",
                label: "Details",
                content: (
                  <ViewInterview
                    interview={interview}
                    canEdit={canEdit}
                    onEdit={() => setMode("edit")}
                    onDelete={async () => {
                      await deleteInterview(interview.id);
                      toast({ message: "Interview deleted", tone: "success" });
                      onClose();
                    }}
                  />
                ),
              },
              {
                key: "notes",
                label: "Notes",
                content: <NotesSection module="interview" recordId={interview.id} currentUserId={currentUserId} />,
              },
            ]
          : undefined
      }
    >
      {isForm && (
        <form
          // Dispatched by hand rather than via <form action>: React resets an
          // action form's uncontrolled fields after every submit, so a single
          // validation error used to wipe everything the recruiter had typed.
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            startTransition(() => formAction(formData));
          }}
          className="grid grid-cols-2 gap-4"
        >
          <div className="col-span-2">
            <label className={labelClass}>Candidate submission *</label>
            <select name="submissionId" defaultValue={interview?.submissionId ?? ""} required className={inputClass}>
              <option value="" disabled>
                Select a submission
              </option>
              {/* The interview's own submission stays selectable even after its
                  status has moved past the interview stage — otherwise editing
                  it fell back to the empty option and Save failed validation. */}
              {(interview && !eligibleSubmissions.some((s) => s.id === interview.submissionId)
                ? [interview.submission, ...eligibleSubmissions]
                : eligibleSubmissions
              ).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.candidate.name} — {s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "—"} ({statusLabel(s.status)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Round *</label>
            <select name="interviewType" defaultValue={interview?.interviewType ?? "L1"} required className={inputClass}>
              {INTERVIEW_TYPES.map((t) => (
                <option key={t} value={t}>
                  {statusLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Mode</label>
            <select name="mode" defaultValue={interview?.mode ?? "video"} className={inputClass}>
              {INTERVIEW_MODES.map((m) => (
                <option key={m} value={m}>
                  {statusLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Date & time *</label>
            <input
              type="datetime-local"
              name="scheduledAt"
              defaultValue={toDatetimeLocalValue(interview?.scheduledAt, interview?.timezone)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Duration (min)</label>
            <input
              type="number"
              name="durationMinutes"
              min={1}
              step={1}
              defaultValue={interview?.durationMinutes ?? 60}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Timezone *</label>
            <select
              name="timezone"
              defaultValue={interview?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
              required
              className={inputClass}
            >
              {timeZoneOptions(interview?.timezone).map((o) => (
                <option key={o.zone} value={o.zone}>
                  {o.label === o.zone ? o.zone : `${o.label} — ${o.zone}`}
                </option>
              ))}
            </select>
          </div>
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
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Feedback</label>
                <textarea name="feedback" defaultValue={interview?.feedback ?? ""} rows={3} className={inputClass} />
              </div>
            </>
          )}

          {state.error && !pending && (
            <p role="alert" className="col-span-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <div className={`${panelFooterClass} col-span-2`}>
            <button type="button" onClick={() => (interview ? setMode("view") : onClose())} className={buttonClass("secondary")}>
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

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input name={name} defaultValue={defaultValue} className={inputClass} />
    </div>
  );
}

function ViewInterview({
  interview,
  canEdit,
  onEdit,
  onDelete,
}: {
  interview: SerializedInterview;
  canEdit: boolean;
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
        {row("Round", statusLabel(interview.interviewType))}
        {row("Scheduled", interview.scheduledAt && formatDateTime(interview.scheduledAt, interview.timezone ?? undefined))}
        {row("Timezone", interview.timezone)}
        {row("Mode", interview.mode && statusLabel(interview.mode))}
        {row("Duration", interview.durationMinutes && `${interview.durationMinutes} min`)}
        {row("Client", interview.clientCompany)}
        {row("Scheduled by", interview.scheduledByNameRaw)}
        {row("Feedback", interview.feedback && <p className="whitespace-pre-wrap">{interview.feedback}</p>)}
      </dl>
      {canEdit && (
        <div className={panelFooterClass}>
          <ConfirmButton
            onConfirm={onDelete}
            confirmText={`Delete this interview for ${interview.submission.candidate.name}?`}
            body="This can't be undone."
            className={buttonClass("dangerSoft", "md", "mr-auto")}
          />
          <button type="button" onClick={onEdit} className={buttonClass("primary")}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
