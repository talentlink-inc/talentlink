"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createBenchInterview, updateBenchInterview, deleteBenchInterview } from "./actions";
import { INTERVIEW_MODES, INTERVIEW_STATUSES, INTERVIEW_TYPES } from "@/lib/recruitment";
import { formatDateTime } from "@/lib/format";
import { isValidTimeZone, timeZoneOptions, utcToZonedLocal } from "@/lib/timezone";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { PaginationControls } from "@/components/PaginationControls";
import { ConfirmButton } from "@/components/ConfirmButton";
import { rowSelectClass } from "@/lib/tableRow";
import { NotesSection } from "../../notes/NotesSection";
import { Field, FieldTextarea, inputClass, labelClass } from "../FormFields";
import type { BenchInterview } from "@/generated/prisma/client";
import type { BenchConsultantSummary } from "../submissions/types";

type SubmissionPick = {
  id: string;
  submissionCode: string;
  companyName: string;
  status: string;
  consultant: BenchConsultantSummary;
};
type Interview = Omit<BenchInterview, "tenantId"> & { submission: SubmissionPick };
type Viewer = { id: string; name: string; canDeleteAny: boolean };

const submissionLabel = (s: SubmissionPick) =>
  `${s.consultant.consultantName} → ${s.companyName} (${s.submissionCode}, ${s.status})`;

export function BenchInterviewsTable({
  interviews,
  eligibleSubmissions,
  currentUser,
}: {
  interviews: Interview[];
  eligibleSubmissions: SubmissionPick[];
  currentUser: Viewer;
}) {
  const [modal, setModal] = useState<{ mode: "create" | "view"; id: string | null } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const open = (id: string) => {
    setSelectedId(id);
    setModal({ mode: "view", id });
  };
  useOpenParam((id) => {
    if (interviews.some((i) => i.id === id)) open(id);
  });
  usePageShortcuts({
    onNew: () => setModal({ mode: "create", id: null }),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return interviews.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (q && !`${i.submission.consultant.consultantName} ${i.submission.companyName} ${i.clientCompany ?? ""}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [interviews, search, statusFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);
  const current = modal?.id ? interviews.find((i) => i.id === modal.id) ?? null : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search consultant, company..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setModal({ mode: "create", id: null })}
          className="ml-auto rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          + Schedule Interview
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2">Consultant</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Round</th>
              <th className="px-3 py-2">Scheduled</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Scheduled By</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((i) => (
              <tr
                key={i.id}
                onClick={() => open(i.id)}
                className={`cursor-pointer border-t border-black/10 dark:border-white/10 ${rowSelectClass(i.id === selectedId)}`}
              >
                <td className="px-3 py-2 font-medium">{i.submission.consultant.consultantName}</td>
                <td className="px-3 py-2">{i.clientCompany ?? i.submission.companyName}</td>
                <td className="px-3 py-2">{i.interviewType}</td>
                <td className="px-3 py-2 whitespace-nowrap">{i.scheduledAt ? formatDateTime(i.scheduledAt, i.timezone ?? undefined) : "—"}</td>
                <td className="px-3 py-2">{i.mode ?? "—"}</td>
                <td className="px-3 py-2">{i.status}</td>
                <td className="px-3 py-2 whitespace-nowrap">{i.scheduledByNameRaw ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {interviews.length === 0 ? "No bench interviews yet." : "No interviews match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal && (
        <InterviewModal
          key={`${modal.mode}-${modal.id ?? "new"}`}
          initialMode={modal.mode}
          interview={modal.mode === "create" ? null : current}
          eligibleSubmissions={eligibleSubmissions}
          viewer={currentUser}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function InterviewModal({
  initialMode,
  interview,
  eligibleSubmissions,
  viewer,
  onClose,
}: {
  initialMode: "create" | "view";
  interview: Interview | null;
  eligibleSubmissions: SubmissionPick[];
  viewer: Viewer;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"create" | "view" | "edit">(initialMode);
  const [error, setError] = useState<string | null>(null);
  useEscapeToClose(onClose);
  useEffect(() => {
    if (mode !== "create" && !interview) onClose();
  }, [mode, interview, onClose]);
  if (mode !== "create" && !interview) return null;

  const canDelete =
    !!interview && (viewer.canDeleteAny || interview.scheduledByUserId === viewer.id);
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 border-b border-black/5 py-2 text-sm dark:border-white/5">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2 break-words">{value || "—"}</dd>
    </div>
  );

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
              ? "Schedule Bench Interview"
              : mode === "edit"
                ? "Edit Bench Interview"
                : `${interview!.submission.consultant.consultantName} — ${interview!.interviewType}`}
          </h2>
          <button onClick={onClose} className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white" aria-label="Close">
            ×
          </button>
        </div>

        {mode === "view" && interview && (
          <>
            <dl>
              {row("Submission", submissionLabel(interview.submission))}
              {row("Round", interview.interviewType)}
              {row("Scheduled", interview.scheduledAt && formatDateTime(interview.scheduledAt, interview.timezone ?? undefined))}
              {row("Timezone", interview.timezone)}
              {row("Mode", interview.mode)}
              {row("Duration", interview.durationMinutes ? `${interview.durationMinutes} min` : null)}
              {row("Client", interview.clientCompany)}
              {row("Status", interview.status)}
              {row("Scheduled By", interview.scheduledByNameRaw)}
              {row("Feedback", interview.feedback && <span className="whitespace-pre-wrap">{interview.feedback}</span>)}
            </dl>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              {canDelete && (
                <ConfirmButton
                  label="Delete"
                  confirmText="Delete this interview?"
                  onConfirm={async () => {
                    const result = await deleteBenchInterview(interview.id);
                    if (result.error) setError(result.error);
                    else onClose();
                  }}
                />
              )}
              <button type="button" onClick={() => setMode("edit")} className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
                Edit
              </button>
            </div>
            <NotesSection module="bench_interview" recordId={interview.id} currentUserId={viewer.id} />
          </>
        )}

        {(mode === "create" || mode === "edit") && (
          <InterviewForm
            interview={mode === "edit" ? interview : null}
            eligibleSubmissions={eligibleSubmissions}
            onCancel={() => (mode === "edit" ? setMode("view") : onClose())}
            onSaved={() => (mode === "edit" ? setMode("view") : onClose())}
          />
        )}
      </div>
    </div>
  );
}

function InterviewForm({
  interview,
  eligibleSubmissions,
  onCancel,
  onSaved,
}: {
  interview: Interview | null;
  eligibleSubmissions: SubmissionPick[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const action = interview ? updateBenchInterview.bind(null, interview.id) : createBenchInterview;
  const [state, formAction, pending] = useActionState(action, { error: null });
  const ids = { sub: useId(), type: useId(), mode: useId(), when: useId(), tz: useId(), status: useId() };
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) onSaved();
    wasSubmitting.current = pending;
  }, [pending, state, onSaved]);

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tz = interview?.timezone && isValidTimeZone(interview.timezone) ? interview.timezone : browserTz;
  // The interview's own submission stays selectable even if its status has moved on.
  const submissionOptions =
    interview && !eligibleSubmissions.some((s) => s.id === interview.benchSubmissionId)
      ? [interview.submission, ...eligibleSubmissions]
      : eligibleSubmissions;

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
        <label htmlFor={ids.sub} className={labelClass}>
          Consultant Submission *
        </label>
        <select id={ids.sub} name="benchSubmissionId" defaultValue={interview?.benchSubmissionId ?? ""} required className={inputClass}>
          <option value="" disabled>
            {submissionOptions.length ? "Select a submission" : "No submissions at L1_Interview / L2_Interview"}
          </option>
          {submissionOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {submissionLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.type} className={labelClass}>
          Round *
        </label>
        <select id={ids.type} name="interviewType" defaultValue={interview?.interviewType ?? "L1"} className={inputClass}>
          {(INTERVIEW_TYPES as readonly string[]).includes(interview?.interviewType ?? "L1") ? null : (
            <option value={interview!.interviewType}>{interview!.interviewType}</option>
          )}
          {INTERVIEW_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.mode} className={labelClass}>
          Mode *
        </label>
        <select id={ids.mode} name="mode" defaultValue={interview?.mode ?? "video"} required className={inputClass}>
          {INTERVIEW_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.when} className={labelClass}>
          Date &amp; Time *
        </label>
        <input
          id={ids.when}
          type="datetime-local"
          name="scheduledAt"
          defaultValue={interview?.scheduledAt ? utcToZonedLocal(new Date(interview.scheduledAt), tz) : ""}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={ids.tz} className={labelClass}>
          Timezone *
        </label>
        <select id={ids.tz} name="timezone" defaultValue={tz} required className={inputClass}>
          {timeZoneOptions(interview?.timezone).map((o) => (
            <option key={o.zone} value={o.zone}>
              {o.label === o.zone ? o.zone : `${o.label} — ${o.zone}`}
            </option>
          ))}
        </select>
      </div>
      <Field label="Duration (min)" name="durationMinutes" type="number" defaultValue={String(interview?.durationMinutes ?? 60)} />
      <Field label="Client Company" name="clientCompany" defaultValue={interview?.clientCompany} />
      {interview && (
        <>
          <div>
            <label htmlFor={ids.status} className={labelClass}>
              Status
            </label>
            <select id={ids.status} name="status" defaultValue={interview.status} className={inputClass}>
              {INTERVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <FieldTextarea label="Feedback" name="feedback" defaultValue={interview.feedback} />
          </div>
        </>
      )}

      {state.error && !pending && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
