"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createRequirement, updateRequirement, deleteRequirement } from "./actions";
import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_EMPLOYMENT_TYPES,
  parseEmploymentTypes,
  toggleEmploymentType,
} from "@/lib/recruitment";
import { NotesSection } from "../notes/NotesSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import type { SerializedRequirement } from "./types";

type Mode = "create" | "view" | "edit";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

export function RequirementModal({
  mode: initialMode,
  requirement,
  currentUserId,
  canEdit,
  onClose,
}: {
  mode: Mode;
  requirement: SerializedRequirement | null;
  currentUserId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isForm = mode === "create" || mode === "edit";
  useEscapeToClose(onClose);

  // Every field here is controlled (rather than defaultValue) so a failed
  // save — a validation error is just as likely as a duplicate-ID error —
  // doesn't wipe what the user typed. React clears uncontrolled fields after
  // every action dispatch, error or not; controlled state is immune to that
  // since the rendered value always comes from here, not the DOM node.
  const [values, setValues] = useState({
    jobTitle: requirement?.jobTitle ?? "",
    clientName: requirement?.clientName ?? "",
    status: requirement?.status ?? "Open",
    priority: requirement?.priority?.toString() ?? "0",
    employmentType: requirement?.employmentType ?? "",
    duration: requirement?.duration ?? "",
    visa: requirement?.visa ?? "",
    workLocation: requirement?.workLocation ?? "",
    country: requirement?.country ?? "",
    isRemote: requirement?.isRemote ?? false,
    billRate: requirement?.billRate?.toString() ?? "",
    payRate: requirement?.payRate?.toString() ?? "",
    cpocRaw: requirement?.cpocRaw ?? "",
    mandatorySkills: requirement?.mandatorySkills ?? "",
    jobDescription: requirement?.jobDescription ?? "",
  });
  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // Visa is only mandatory for USA roles, and Work Location is only
  // mandatory when the role isn't Remote — mirrors the original app's
  // conditional validation.
  const visaRequired = values.country.toUpperCase().includes("USA");
  const workLocationRequired = !values.isRemote;

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
              ? "New Requirement"
              : mode === "edit"
                ? `Edit Requirement - ${requirement?.jobId}`
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
          <>
            <ViewRequirement
              requirement={requirement}
              canEdit={canEdit}
              onEdit={() => setMode("edit")}
              onDelete={async () => {
                await deleteRequirement(requirement.id);
                onClose();
              }}
            />
            <NotesSection module="requirement" recordId={requirement.id} currentUserId={currentUserId} />
          </>
        )}

        {isForm && (
          <form action={formAction} className="grid grid-cols-2 gap-4">
            <Field
              label="Job Title"
              name="jobTitle"
              value={values.jobTitle}
              onChange={(v) => set("jobTitle", v)}
              required
            />
            <Field
              label="Client Name"
              name="clientName"
              value={values.clientName}
              onChange={(v) => set("clientName", v)}
              required
            />
            <div>
              <label className={labelClass}>Status</label>
              <select
                name="status"
                value={values.status}
                onChange={(e) => set("status", e.target.value)}
                className={inputClass}
              >
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
                value={values.priority}
                onChange={(e) => set("priority", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Employment Type *</label>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {REQUIREMENT_EMPLOYMENT_TYPES.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={parseEmploymentTypes(values.employmentType).includes(opt.value)}
                      onChange={() => set("employmentType", toggleEmploymentType(values.employmentType, opt.value))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {/* Hidden mirror so the checkbox group still posts one comma-joined
                  value under the field name the server action expects. */}
              <input type="hidden" name="employmentType" value={values.employmentType} />
            </div>
            <Field
              label="Duration"
              name="duration"
              value={values.duration}
              onChange={(v) => set("duration", v)}
              required
            />
            <Field
              label="Visa"
              name="visa"
              value={values.visa}
              onChange={(v) => set("visa", v)}
              required={visaRequired}
            />
            <div>
              <label className={labelClass}>
                Work Location
                {workLocationRequired && " *"}
              </label>
              <input
                name="workLocation"
                value={values.workLocation}
                onChange={(e) => set("workLocation", e.target.value)}
                required={workLocationRequired}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Country *</label>
              <input
                name="country"
                value={values.country}
                onChange={(e) => set("country", e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <Field
              label="Bill Rate"
              name="billRate"
              type="number"
              step="0.01"
              min="0"
              value={values.billRate}
              onChange={(v) => set("billRate", v)}
              required
            />
            <Field
              label="Pay Rate"
              name="payRate"
              type="number"
              step="0.01"
              min="0"
              value={values.payRate}
              onChange={(v) => set("payRate", v)}
            />
            <Field
              label="CPOC"
              name="cpocRaw"
              value={values.cpocRaw}
              onChange={(v) => set("cpocRaw", v)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isRemote"
                checked={values.isRemote}
                onChange={(e) => set("isRemote", e.target.checked)}
              />
              Remote
            </label>
            <div className="col-span-2">
              <label className={labelClass}>Mandatory Skills *</label>
              <textarea
                name="mandatorySkills"
                value={values.mandatorySkills}
                onChange={(e) => set("mandatorySkills", e.target.value)}
                rows={2}
                required
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Job Description *</label>
              <textarea
                name="jobDescription"
                value={values.jobDescription}
                onChange={(e) => set("jobDescription", e.target.value)}
                rows={5}
                required
                maxLength={20000}
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
  value,
  onChange,
  required,
  type = "text",
  step,
  min,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  step?: string;
  min?: string;
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
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={inputClass}
      />
    </div>
  );
}

function ViewRequirement({
  requirement,
  canEdit,
  onEdit,
  onDelete,
}: {
  requirement: SerializedRequirement;
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
      {canEdit && (
        <div className="mt-4 flex justify-end gap-2">
          <ConfirmButton
            onConfirm={onDelete}
            confirmText={`Delete requirement "${requirement.jobId}"?`}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          />
          <button
            onClick={onEdit}
            className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
