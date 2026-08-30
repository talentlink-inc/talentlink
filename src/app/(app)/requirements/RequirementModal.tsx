"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createRequirement, updateRequirement, deleteRequirement } from "./actions";
import { REQUIREMENT_STATUSES } from "@/lib/recruitment";
import type { Requirement } from "@/generated/prisma/client";

type Mode = "create" | "view" | "edit";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

export function RequirementModal({
  mode: initialMode,
  requirement,
  onClose,
}: {
  mode: Mode;
  requirement: Requirement | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isForm = mode === "create" || mode === "edit";

  const action = requirement ? updateRequirement.bind(null, requirement.id) : createRequirement;
  const [error, formAction, pending] = useActionState(action, null);

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !error) {
      onClose();
    }
    wasSubmitting.current = pending;
  }, [pending, error, onClose]);

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
              ? "Add Requirement"
              : mode === "edit"
                ? "Edit Requirement"
                : requirement?.jobTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {mode === "view" && requirement && (
          <ViewRequirement
            requirement={requirement}
            onEdit={() => setMode("edit")}
            onDelete={async () => {
              if (confirm(`Delete requirement "${requirement.jobId}"?`)) {
                await deleteRequirement(requirement.id);
                onClose();
              }
            }}
          />
        )}

        {isForm && (
          <form action={formAction} className="grid grid-cols-2 gap-4">
            <Field label="Job ID" name="jobId" defaultValue={requirement?.jobId} required />
            <Field label="Job Title" name="jobTitle" defaultValue={requirement?.jobTitle} required />
            <Field label="Client Name" name="clientName" defaultValue={requirement?.clientName ?? ""} />
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" defaultValue={requirement?.status ?? "Open"} className={inputClass}>
                {REQUIREMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority (0–5)</label>
              <input
                type="number"
                name="priority"
                min={0}
                max={5}
                defaultValue={requirement?.priority ?? 0}
                className={inputClass}
              />
            </div>
            <Field label="Employment Type" name="employmentType" defaultValue={requirement?.employmentType ?? ""} />
            <Field label="Duration" name="duration" defaultValue={requirement?.duration ?? ""} />
            <Field label="Visa" name="visa" defaultValue={requirement?.visa ?? ""} />
            <Field label="Work Location" name="workLocation" defaultValue={requirement?.workLocation ?? ""} />
            <Field label="Country" name="country" defaultValue={requirement?.country ?? ""} />
            <Field
              label="Bill Rate"
              name="billRate"
              type="number"
              step="0.01"
              defaultValue={requirement?.billRate?.toString() ?? ""}
            />
            <Field
              label="Pay Rate"
              name="payRate"
              type="number"
              step="0.01"
              defaultValue={requirement?.payRate?.toString() ?? ""}
            />
            <Field label="CPOC" name="cpocRaw" defaultValue={requirement?.cpocRaw ?? ""} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isRemote" defaultChecked={requirement?.isRemote ?? false} />
              Remote
            </label>
            <div className="col-span-2">
              <label className={labelClass}>Mandatory Skills</label>
              <textarea
                name="mandatorySkills"
                defaultValue={requirement?.mandatorySkills ?? ""}
                rows={2}
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Job Description</label>
              <textarea
                name="jobDescription"
                defaultValue={requirement?.jobDescription ?? ""}
                rows={5}
                className={inputClass}
              />
            </div>

            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => (requirement ? setMode("view") : onClose())}
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

function ViewRequirement({
  requirement,
  onEdit,
  onDelete,
}: {
  requirement: Requirement;
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
        {row("Job ID", requirement.jobId)}
        {row("Client", requirement.clientName)}
        {row("Status", requirement.status)}
        {row("Priority", requirement.priority)}
        {row("Employment Type", requirement.employmentType)}
        {row("Duration", requirement.duration)}
        {row("Visa", requirement.visa)}
        {row("Work Location", requirement.workLocation)}
        {row("Country", requirement.country)}
        {row("Remote", requirement.isRemote ? "Yes" : "No")}
        {row("Bill Rate", requirement.billRate?.toString())}
        {row("Pay Rate", requirement.payRate?.toString())}
        {row("CPOC", requirement.cpocRaw)}
        {row("Mandatory Skills", requirement.mandatorySkills)}
        {row(
          "Job Description",
          requirement.jobDescription && (
            <p className="whitespace-pre-wrap">{requirement.jobDescription}</p>
          )
        )}
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
