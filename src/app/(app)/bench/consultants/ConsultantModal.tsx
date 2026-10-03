"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import {
  createBenchConsultant,
  updateBenchConsultant,
  deleteBenchConsultant,
  setBenchConsultantHotlist,
  updateBenchConsultantStatus,
  assignBenchConsultant,
  getBenchUserOptions,
} from "./actions";
import { BENCH_CONSULTANT_STATUSES, BENCH_RELOCATION_OPTIONS, relocationLabel } from "@/lib/bench";
import { VISA_STATUSES } from "@/lib/recruitment";
import { formatDate } from "@/lib/format";
import { NotesSection } from "../../notes/NotesSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { StatusBadge } from "./ConsultantsTable";
import type { SerializedConsultant } from "./types";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

export type ConsultantViewer = {
  id: string;
  name: string;
  canDeleteAny: boolean;
  canViewResume: boolean;
  canDownloadResume: boolean;
};

export function ConsultantModal({
  initialMode,
  consultant,
  viewer,
  onClose,
}: {
  initialMode: "create" | "view";
  consultant: SerializedConsultant | null;
  viewer: ConsultantViewer;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"create" | "view" | "edit">(initialMode);
  useEscapeToClose(onClose);

  // The record disappeared underneath an open view (deleted) — nothing to show.
  useEffect(() => {
    if (mode !== "create" && !consultant) onClose();
  }, [mode, consultant, onClose]);
  if (mode !== "create" && !consultant) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {mode === "create"
              ? "Add Bench Consultant"
              : mode === "edit"
                ? `Edit ${consultant!.consultantName}`
                : `${consultant!.consultantCode} — ${consultant!.consultantName}`}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {mode === "view" && consultant && (
          <>
            <ViewConsultant consultant={consultant} viewer={viewer} onEdit={() => setMode("edit")} onDeleted={onClose} />
            <NotesSection module="bench_consultant" recordId={consultant.id} currentUserId={viewer.id} />
          </>
        )}

        {(mode === "create" || mode === "edit") && (
          <ConsultantForm
            consultant={mode === "edit" ? consultant : null}
            viewer={viewer}
            onCancel={() => (mode === "edit" ? setMode("view") : onClose())}
            onSaved={() => (mode === "edit" ? setMode("view") : onClose())}
          />
        )}
      </div>
    </div>
  );
}

function ViewConsultant({
  consultant: c,
  viewer,
  onEdit,
  onDeleted,
}: {
  consultant: SerializedConsultant;
  viewer: ConsultantViewer;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    getBenchUserOptions().then(setUsers).catch(() => setUsers([]));
  }, []);

  const isOwn = c.marketerUserId === viewer.id;
  const canDelete = viewer.canDeleteAny || isOwn;
  const canView = isOwn || viewer.canViewResume;
  const canDownload = isOwn || viewer.canDownloadResume;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 border-b border-black/5 py-2 text-sm dark:border-white/5">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2 break-words">{value || "—"}</dd>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-black/[0.03] p-3 dark:bg-white/[0.04]">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-black/50 dark:text-white/50">Status</span>
          <select
            value={c.status}
            disabled={busy}
            onChange={(e) => run(() => updateBenchConsultantStatus(c.id, e.target.value))}
            className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
          >
            {BENCH_CONSULTANT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-black/50 dark:text-white/50">Assigned to</span>
          <select
            value={c.assignedToUserId ?? ""}
            disabled={busy}
            onChange={(e) => run(() => assignBenchConsultant(c.id, e.target.value || null))}
            className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
          >
            <option value="">— Unassigned —</option>
            {c.assignedToUserId && !users.some((u) => u.id === c.assignedToUserId) && (
              <option value={c.assignedToUserId}>{c.assignedToNameRaw ?? "Current assignee"}</option>
            )}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => setBenchConsultantHotlist(c.id, !c.onHotlist))}
          className={`ml-auto rounded-md border px-3 py-1 text-sm disabled:opacity-50 ${
            c.onHotlist
              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
              : "border-black/15 dark:border-white/15"
          }`}
        >
          {c.onHotlist ? "★ On hotlist — remove" : "☆ Add to hotlist"}
        </button>
      </div>

      <dl>
        {row("Status", <StatusBadge status={c.status} />)}
        {row("Role", c.role)}
        {row("Technology / Skills", <span className="whitespace-pre-wrap">{c.technologySkills}</span>)}
        {row("Visa", c.visaStatus)}
        {row("Relocation", relocationLabel(c.relocation))}
        {row("Experience", c.experience)}
        {row("Location", c.location)}
        {row("Availability", c.availability)}
        {row("Pay Rate", c.payRate)}
        {row("Marketing Rate", c.marketingRate)}
        {row("Marketer", c.marketerNameRaw)}
        {row(
          "LinkedIn",
          c.linkedinUrl && (
            <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline dark:text-sky-400">
              {c.linkedinUrl}
            </a>
          )
        )}
        {row("Added", formatDate(c.addedDate))}
        {row("Submissions", String(c.submissionCount))}
        {row(
          "Resume",
          !c.hasResume ? (
            "No resume uploaded"
          ) : !canView ? (
            "Restricted"
          ) : (
            <span className="flex flex-wrap gap-3">
              <span>{c.resumeFileName ?? "Resume"}</span>
              <a href={`/api/bench/resume/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline dark:text-sky-400">
                View
              </a>
              {canDownload && (
                <a href={`/api/bench/resume/${c.id}?download=1`} className="text-sky-700 underline dark:text-sky-400">
                  Download
                </a>
              )}
            </span>
          )
        )}
      </dl>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        {canDelete && (
          <ConfirmButton
            label="Delete"
            confirmText={`Delete ${c.consultantName}?`}
            onConfirm={() =>
              run(async () => {
                const result = await deleteBenchConsultant(c.id);
                if (result.error) throw new Error(result.error);
                onDeleted();
              })
            }
          />
        )}
        <button type="button" onClick={onEdit} className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
          Edit
        </button>
      </div>
    </div>
  );
}

function ConsultantForm({
  consultant,
  viewer,
  onCancel,
  onSaved,
}: {
  consultant: SerializedConsultant | null;
  viewer: ConsultantViewer;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const action = consultant ? updateBenchConsultant.bind(null, consultant.id) : createBenchConsultant;
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    getBenchUserOptions().then(setUsers).catch(() => setUsers([]));
  }, []);

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) onSaved();
    wasSubmitting.current = pending;
  }, [pending, state, onSaved]);

  // Controlled: its options arrive asynchronously, and an uncontrolled select
  // would jump to whatever option is first once they do — silently changing
  // the marketer on the next save.
  const [marketerId, setMarketerId] = useState(consultant ? consultant.marketerUserId ?? "" : viewer.id);
  const marketerSelectId = useId();

  return (
    <form
      // Dispatched by hand so a validation error doesn't wipe the form
      // (React resets uncontrolled fields after an action-form submit).
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <Field label="Consultant Name" name="consultantName" defaultValue={consultant?.consultantName} required />
      <Field label="Role" name="role" defaultValue={consultant?.role} required />
      <div className="sm:col-span-2">
        <FieldTextarea label="Technology / Skills" name="technologySkills" defaultValue={consultant?.technologySkills} required />
      </div>
      <FieldSelect
        label="Visa Status"
        name="visaStatus"
        defaultValue={consultant?.visaStatus ?? ""}
        required
        options={[
          { value: "", label: "Select visa status", disabled: true },
          ...withCurrent(VISA_STATUSES, consultant?.visaStatus).map((v) => ({ value: v, label: v })),
        ]}
      />
      <FieldSelect
        label="Relocation"
        name="relocation"
        defaultValue={consultant?.relocation ?? "No"}
        options={BENCH_RELOCATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />
      <Field label="Experience" name="experience" defaultValue={consultant?.experience} placeholder="e.g. 8 Years" required />
      <Field label="Location" name="location" defaultValue={consultant?.location} placeholder="City, State" required />
      <Field label="Availability" name="availability" defaultValue={consultant?.availability} placeholder="e.g. Immediate, 2 weeks" required />
      <FieldSelect
        label="Status"
        name="status"
        defaultValue={consultant?.status ?? "Available"}
        options={BENCH_CONSULTANT_STATUSES.map((s) => ({ value: s, label: s }))}
      />
      <Field label="Pay Rate" name="payRate" defaultValue={consultant?.payRate ?? ""} placeholder="e.g. $65/hr C2C" required />
      <Field label="Marketing Rate" name="marketingRate" defaultValue={consultant?.marketingRate ?? ""} placeholder="e.g. $80/hr C2C" />
      <Field label="LinkedIn URL" name="linkedinUrl" type="url" defaultValue={consultant?.linkedinUrl ?? ""} />
      <div>
        <label htmlFor={marketerSelectId} className={labelClass}>
          Marketer
        </label>
        <select
          id={marketerSelectId}
          name="marketerUserId"
          value={marketerId}
          onChange={(e) => setMarketerId(e.target.value)}
          className={inputClass}
        >
          {marketerId === "" && (
            <option value="">
              {consultant?.marketerNameRaw ? `${consultant.marketerNameRaw} (not linked to a user)` : "— Unassigned —"}
            </option>
          )}
          {marketerId && !users.some((u) => u.id === marketerId) && (
            <option value={marketerId}>{consultant?.marketerNameRaw ?? viewer.name}</option>
          )}
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <FileField
          label={consultant?.hasResume ? `Resume (replace — current: ${consultant.resumeFileName ?? "on file"})` : "Resume"}
          name="resume"
        />
      </div>

      {state.error && !pending && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

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

// Keep a legacy value selectable (e.g. an imported "H4 EAD") instead of the
// select silently falling back to its first option on edit.
function withCurrent(options: readonly string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options];
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && " *"}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className={inputClass}
      />
    </div>
  );
}

function FieldTextarea({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && " *"}
      </label>
      <textarea id={id} name={name} rows={3} defaultValue={defaultValue ?? ""} required={required} className={inputClass} />
    </div>
  );
}

function FieldSelect({
  label,
  name,
  defaultValue,
  required,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && " *"}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} required={required} className={inputClass}>
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FileField({ label, name }: { label: string; name: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept=".pdf,.doc,.docx"
        className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm dark:file:bg-white/10"
      />
    </div>
  );
}
