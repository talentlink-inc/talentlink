"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createBenchInterview, updateBenchInterview, deleteBenchInterview } from "./actions";
import { INTERVIEW_MODES, INTERVIEW_STATUSES, INTERVIEW_TYPES } from "@/lib/recruitment";
import { formatDateTime } from "@/lib/format";
import { isValidTimeZone, timeZoneOptions, utcToZonedLocal } from "@/lib/timezone";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { ConfirmButton } from "@/components/ConfirmButton";
import { rowSelectClass } from "@/lib/tableRow";
import { NotesSection } from "../../notes/NotesSection";
import { Field, FieldTextarea, inputClass, labelClass } from "../FormFields";
import { StatusChip } from "@/components/ui/StatusChip";
import { statusLabel } from "@/lib/statusLabels";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass, useUi } from "@/components/ui/UiProvider";
import { RecordPanel, panelFooterClass } from "@/components/ui/RecordPanel";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass, rowClass } from "@/components/ui/table";
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
  `${s.consultant.consultantName} → ${s.companyName} (${s.submissionCode}, ${statusLabel(s.status)})`;

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
  const cell = useCellClass();

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
      if (
        q &&
        !`${i.submission.consultant.consultantName} ${i.submission.companyName} ${i.clientCompany ?? ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [interviews, search, statusFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);
  const current = modal?.id ? (interviews.find((i) => i.id === modal.id) ?? null) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search consultant, company"
          placeholder="Search consultant, company…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All statuses</option>
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          <button type="button" onClick={() => setModal({ mode: "create", id: null })} className={buttonClass("primary")}>
            + Schedule interview
          </button>
        </div>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Interviews">
        {paged.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => open(i.id)}
              className={`w-full rounded-[10px] border border-line bg-white p-3 text-left shadow-sm dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(i.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{i.submission.consultant.consultantName}</span>
                <StatusChip status={i.status} />
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                {i.clientCompany ?? i.submission.companyName} · {statusLabel(i.interviewType)}
              </div>
              <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                {i.scheduledAt ? formatDateTime(i.scheduledAt, i.timezone ?? undefined) : "Not scheduled"}
                {i.mode ? ` · ${statusLabel(i.mode)}` : ""}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className={emptyCellClass}>
            {interviews.length === 0 ? "No bench interviews yet." : "No interviews match your filters."}
          </li>
        )}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[900px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Consultant</th>
              <th className={cell}>Company</th>
              <th className={cell}>Round</th>
              <th className={cell}>Scheduled</th>
              <th className={cell}>Mode</th>
              <th className={cell}>Status</th>
              <th className={cell}>Scheduled by</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((i) => (
              <tr
                key={i.id}
                onClick={() => open(i.id)}
                className={`cursor-pointer ${rowClass} ${rowSelectClass(i.id === selectedId)}`}
              >
                <td className={`${cell} font-semibold text-text-strong dark:text-white`}>{i.submission.consultant.consultantName}</td>
                <td className={cell}>{i.clientCompany ?? i.submission.companyName}</td>
                <td className={cell}>{statusLabel(i.interviewType)}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  {i.scheduledAt ? formatDateTime(i.scheduledAt, i.timezone ?? undefined) : "—"}
                </td>
                <td className={cell}>{i.mode ? statusLabel(i.mode) : "—"}</td>
                <td className={cell}>
                  <StatusChip status={i.status} />
                </td>
                <td className={`${cell} whitespace-nowrap`}>{i.scheduledByNameRaw ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className={emptyCellClass}>
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
  const { toast } = useUi();
  useEffect(() => {
    if (mode !== "create" && !interview) onClose();
  }, [mode, interview, onClose]);
  if (mode !== "create" && !interview) return null;

  if (mode === "view" && interview) {
    const canDelete = viewer.canDeleteAny || interview.scheduledByUserId === viewer.id;
    const row = (label: string, value: React.ReactNode) => (
      <div className="grid grid-cols-3 gap-2 border-b border-black/5 py-2 text-sm dark:border-white/5">
        <dt className="text-black/50 dark:text-white/50">{label}</dt>
        <dd className="col-span-2 break-words">{value || "—"}</dd>
      </div>
    );
    return (
      <RecordPanel
        title={`${interview.submission.consultant.consultantName} — ${statusLabel(interview.interviewType)}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{interview.clientCompany ?? interview.submission.companyName}</span>
            <StatusChip status={interview.status} />
          </span>
        }
        onClose={onClose}
        tabs={[
          {
            key: "details",
            label: "Details",
            content: (
              <>
                <dl>
                  {row("Submission", submissionLabel(interview.submission))}
                  {row("Round", statusLabel(interview.interviewType))}
                  {row(
                    "Scheduled",
                    interview.scheduledAt && formatDateTime(interview.scheduledAt, interview.timezone ?? undefined),
                  )}
                  {row("Timezone", interview.timezone)}
                  {row("Mode", interview.mode && statusLabel(interview.mode))}
                  {row("Duration", interview.durationMinutes ? `${interview.durationMinutes} min` : null)}
                  {row("Client", interview.clientCompany)}
                  {row("Scheduled by", interview.scheduledByNameRaw)}
                  {row("Feedback", interview.feedback && <span className="whitespace-pre-wrap">{interview.feedback}</span>)}
                </dl>
                <div className={panelFooterClass}>
                  {canDelete && (
                    <ConfirmButton
                      label="Delete"
                      confirmText="Delete this interview?"
                      body="This can't be undone."
                      className={buttonClass("dangerSoft", "md", "mr-auto")}
                      onConfirm={async () => {
                        const result = await deleteBenchInterview(interview.id);
                        if (result.error) throw new Error(result.error);
                        toast({ message: "Interview deleted", tone: "success" });
                        onClose();
                      }}
                    />
                  )}
                  <button type="button" onClick={() => setMode("edit")} className={buttonClass("primary")}>
                    Edit
                  </button>
                </div>
              </>
            ),
          },
          {
            key: "notes",
            label: "Notes",
            content: <NotesSection module="bench_interview" recordId={interview.id} currentUserId={viewer.id} />,
          },
        ]}
      />
    );
  }

  return (
    <RecordPanel
      title={mode === "create" ? "Schedule bench interview" : "Edit bench interview"}
      subtitle={mode === "edit" ? interview!.submission.consultant.consultantName : undefined}
      onClose={onClose}
    >
      <InterviewForm
        interview={mode === "edit" ? interview : null}
        eligibleSubmissions={eligibleSubmissions}
        onCancel={() => (mode === "edit" ? setMode("view") : onClose())}
        onSaved={() => {
          toast({ message: mode === "edit" ? "Interview saved" : "Interview scheduled", tone: "success" });
          if (mode === "edit") setMode("view");
          else onClose();
        }}
      />
    </RecordPanel>
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
          Consultant submission *
        </label>
        <select
          id={ids.sub}
          name="benchSubmissionId"
          defaultValue={interview?.benchSubmissionId ?? ""}
          required
          className={inputClass}
        >
          <option value="" disabled>
            {submissionOptions.length ? "Select a submission" : "No submissions at the L1 or L2 interview stage"}
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
              {statusLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.when} className={labelClass}>
          Date &amp; time *
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
      <Field
        label="Duration (min)"
        name="durationMinutes"
        type="number"
        defaultValue={String(interview?.durationMinutes ?? 60)}
      />
      <Field label="Client company" name="clientCompany" defaultValue={interview?.clientCompany} />
      {interview && (
        <>
          <div>
            <label htmlFor={ids.status} className={labelClass}>
              Status
            </label>
            <select id={ids.status} name="status" defaultValue={interview.status} className={inputClass}>
              {INTERVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <FieldTextarea label="Feedback" name="feedback" defaultValue={interview.feedback} />
          </div>
        </>
      )}

      {state.error && !pending && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">
          {state.error}
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
