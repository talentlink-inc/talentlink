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
import { RecordPanel, panelFooterClass } from "@/components/ui/RecordPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { useUi } from "@/components/ui/UiProvider";
import { Field, FieldSelect, FieldTextarea, inputClass, labelClass } from "../FormFields";
import type { SerializedConsultant } from "./types";

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
  const { toast } = useUi();

  // The record disappeared underneath an open view (deleted) — nothing to show.
  useEffect(() => {
    if (mode !== "create" && !consultant) onClose();
  }, [mode, consultant, onClose]);
  if (mode !== "create" && !consultant) return null;

  if (mode === "view" && consultant) {
    return (
      <RecordPanel
        title={consultant.consultantName}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{consultant.consultantCode}</span>
            <StatusChip status={consultant.status} />
            {consultant.onHotlist && <span className="text-xs text-amber-700 dark:text-amber-400">★ On hotlist</span>}
          </span>
        }
        onClose={onClose}
        tabs={[
          {
            key: "details",
            label: "Details",
            content: <ViewConsultant consultant={consultant} viewer={viewer} onEdit={() => setMode("edit")} onDeleted={onClose} />,
          },
          {
            key: "notes",
            label: "Notes",
            content: <NotesSection module="bench_consultant" recordId={consultant.id} currentUserId={viewer.id} />,
          },
        ]}
      />
    );
  }

  return (
    <RecordPanel
      title={mode === "create" ? "Add bench consultant" : `Edit ${consultant!.consultantName}`}
      subtitle={mode === "edit" ? consultant!.consultantCode : undefined}
      onClose={onClose}
    >
      <ConsultantForm
        consultant={mode === "edit" ? consultant : null}
        viewer={viewer}
        onCancel={() => (mode === "edit" ? setMode("view") : onClose())}
        onSaved={() => {
          toast({ message: mode === "edit" ? "Consultant saved" : "Consultant added", tone: "success" });
          if (mode === "edit") setMode("view");
          else onClose();
        }}
      />
    </RecordPanel>
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
  const { toast } = useUi();
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

  // Runs a quick change and confirms it with a toast; reversible changes
  // get an Undo instead of an "are you sure?" (design review 3C).
  async function run(fn: () => Promise<unknown>, done?: { message: string; undo?: () => Promise<unknown> }) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (done) toast({ message: done.message, tone: "success", undo: done.undo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const userName = (id: string | null) =>
    !id ? "Unassigned" : users.find((u) => u.id === id)?.name ?? (id === c.assignedToUserId ? c.assignedToNameRaw : null) ?? "user";

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 border-b border-black/5 py-2 text-sm dark:border-white/5">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2 break-words">{value || "—"}</dd>
    </div>
  );
  const linkClass = "font-medium text-brand-strong underline-offset-2 hover:underline dark:text-brand";
  const quickSelectClass = "w-full rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm dark:border-white/15 dark:bg-transparent";

  return (
    <div>
      {/* Fixed grid so the bar doesn't re-wrap when the assignee list loads. */}
      <div className="mb-4 grid grid-cols-1 items-end gap-3 rounded-lg bg-brand-soft/60 p-3 sm:grid-cols-[1fr_1fr_auto] dark:bg-white/[0.04]">
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="font-medium text-black/55 dark:text-white/55">Status</span>
          <select
            value={c.status}
            disabled={busy}
            onChange={(e) => {
              const previous = c.status;
              const next = e.target.value;
              run(() => updateBenchConsultantStatus(c.id, next), {
                message: `Status changed to ${next}`,
                undo: () => updateBenchConsultantStatus(c.id, previous),
              });
            }}
            className={quickSelectClass}
          >
            {BENCH_CONSULTANT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="font-medium text-black/55 dark:text-white/55">Assigned to</span>
          <select
            value={c.assignedToUserId ?? ""}
            disabled={busy}
            onChange={(e) => {
              const previous = c.assignedToUserId;
              const next = e.target.value || null;
              run(() => assignBenchConsultant(c.id, next), {
                message: next ? `Assigned to ${userName(next)}` : "Unassigned",
                undo: () => assignBenchConsultant(c.id, previous),
              });
            }}
            className={quickSelectClass}
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
          aria-pressed={c.onHotlist}
          onClick={() => {
            const next = !c.onHotlist;
            run(() => setBenchConsultantHotlist(c.id, next), {
              message: next ? "Added to hotlist" : "Removed from hotlist",
              undo: () => setBenchConsultantHotlist(c.id, !next),
            });
          }}
          className={
            c.onHotlist
              ? buttonClass("secondary", "md", "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300")
              : buttonClass("secondary")
          }
        >
          {c.onHotlist ? "★ Remove from hotlist" : "☆ Add to hotlist"}
        </button>
      </div>

      <dl>
        {row("Role", c.role)}
        {row("Technology / Skills", <span className="whitespace-pre-wrap">{c.technologySkills}</span>)}
        {row("Visa", c.visaStatus)}
        {row("Relocation", relocationLabel(c.relocation))}
        {row("Experience", c.experience)}
        {row("Location", c.location)}
        {row("Availability", c.availability)}
        {row("Pay rate", c.payRate)}
        {row("Marketing rate", c.marketingRate)}
        {row("Marketer", c.marketerNameRaw)}
        {row(
          "LinkedIn",
          c.linkedinUrl && (
            <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
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
              <a href={`/api/bench/resume/${c.id}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                View
              </a>
              {canDownload && (
                <a href={`/api/bench/resume/${c.id}?download=1`} className={linkClass}>
                  Download
                </a>
              )}
            </span>
          )
        )}
      </dl>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className={panelFooterClass}>
        {canDelete && (
          <ConfirmButton
            label="Delete"
            confirmText={`Delete ${c.consultantName}?`}
            body="They'll be removed from the bench and the hotlist. Consultants with submissions can't be deleted."
            className={buttonClass("dangerSoft", "md", "mr-auto")}
            onConfirm={async () => {
              const result = await deleteBenchConsultant(c.id);
              if (result.error) throw new Error(result.error);
              toast({ message: `${c.consultantName} deleted`, tone: "success" });
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

// Keep a legacy value selectable (e.g. an imported "H4 EAD") instead of the
// select silently falling back to its first option on edit.
function withCurrent(options: readonly string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options];
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
