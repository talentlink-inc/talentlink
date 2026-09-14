"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createSubmission,
  updateSubmission,
  deleteSubmission,
  getRecruiterOptions,
  parseResumeWithAI,
} from "./actions";
import {
  SUBMISSION_STATUSES,
  REJECT_REASON_OPTIONS,
  VISA_STATUSES,
  SUBMISSION_EMPLOYMENT_TYPES,
  parseEmploymentTypes,
  toggleEmploymentType,
  isRejectedStatus,
} from "@/lib/recruitment";
import { SUPPORTED_REGIONS } from "@/lib/regions";
import { SUPPORTED_CURRENCIES, defaultCurrencyForRegions } from "@/lib/currency";
import { NotesSection } from "../notes/NotesSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import type { DataPermissions } from "@/lib/users";
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
  canEdit,
  isAdmin,
  permissions,
  onClose,
  onOpenExisting,
}: {
  mode: Mode;
  submission: SerializedSubmission | null;
  requirements: SerializedRequirement[];
  currentUserId: string;
  canEdit: boolean;
  isAdmin: boolean;
  permissions: DataPermissions;
  onClose: () => void;
  onOpenExisting: (id: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isForm = mode === "create" || mode === "edit";
  useEscapeToClose(onClose);

  // A Closed/Filled requirement shouldn't take new submissions — but if this
  // submission is already assigned to one (closed after the fact), keep it
  // selectable here so editing doesn't make it vanish from its own dropdown.
  const eligibleRequirements = requirements.filter(
    (r) => (r.status !== "Closed" && r.status !== "Filled") || r.id === submission?.requirementId
  );

  const action = submission ? updateSubmission.bind(null, submission.id) : createSubmission;
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    needsConfirmation: false,
    warningMessage: null,
  });

  // Every text field here is controlled — a validation error (or the
  // duplicate-submission error) is a normal outcome, not just the "confirm?"
  // case below, and React clears uncontrolled fields after every action
  // dispatch regardless of which kind of result comes back. (The resume
  // file input is the one exception — browsers won't let JS set a file
  // input's value at all, controlled or not, so that one has to be
  // re-selected after any failed submit.)
  const [values, setValues] = useState({
    requirementId: submission?.requirementId ?? "",
    candidateName: submission?.candidate.name ?? "",
    email: submission?.candidate.email ?? "",
    phone: submission?.candidate.phone ?? "",
    country: submission?.country ?? "",
    currentLocation: submission?.candidate.currentLocation ?? "",
    totalExperienceYears: submission?.candidate.totalExperienceYears?.toString() ?? "",
    visaStatus: submission?.candidate.visaStatus ?? "",
    linkedinUrl: submission?.candidate.linkedinUrl ?? "",
    employmentType: submission?.employmentType ?? "",
    billRate: submission?.billRate?.toString() ?? "",
    billRateCurrency: submission?.billRateCurrency ?? "USD",
    payRate: submission?.payRate?.toString() ?? "",
    payRateCurrency: submission?.payRateCurrency ?? "USD",
    roleWithSkills: submission?.roleWithSkills ?? "",
    rejectReason: submission?.rejectReason ?? "",
    recruiterUserId: submission?.recruiterUserId ?? "",
  });
  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // Pay Rate's currency defaults from the candidate's own country the first
  // time it's set on a brand-new submission — mirrors the same "first-set
  // wins, always overridable" rule used for Requirement's Bill/Pay Rate.
  const payCurrencyTouched = useRef(submission !== null);
  function handleCountryChange(next: string) {
    set("country", next);
    if (!payCurrencyTouched.current) set("payRateCurrency", defaultCurrencyForRegions(next));
  }

  // Bill Rate's currency defaults from the *requirement's* country (the
  // client being billed), separately from Pay Rate's candidate-country
  // default — handles "UK requirement, USD bill rate, India-based
  // candidate paid in INR" all at once.
  const billCurrencyTouched = useRef(submission !== null);

  // ---- Recruiter reassignment (Admin only) ----
  const [recruiters, setRecruiters] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (isAdmin) getRecruiterOptions().then(setRecruiters);
  }, [isAdmin]);

  // ---- AI resume-parse autofill ----
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  async function handleParseResumeWithAi() {
    const file = resumeInputRef.current?.files?.[0];
    if (!file) {
      setAiError("Choose a resume file first, then click Parse with AI.");
      return;
    }
    setAiParsing(true);
    setAiError(null);
    try {
      const fd = new FormData();
      fd.set("resume", file);
      const parsed = await parseResumeWithAI(fd);
      setValues((v) => ({
        ...v,
        candidateName: v.candidateName || parsed.candidateName || v.candidateName,
        email: v.email || parsed.email || v.email,
        phone: v.phone || parsed.phone || v.phone,
        country: v.country || parsed.country || v.country,
        currentLocation: v.currentLocation || parsed.currentLocation || v.currentLocation,
        linkedinUrl: v.linkedinUrl || parsed.linkedinUrl || v.linkedinUrl,
        totalExperienceYears:
          v.totalExperienceYears || (parsed.totalExperienceYears ? String(parsed.totalExperienceYears) : "") || v.totalExperienceYears,
        visaStatus: v.visaStatus || parsed.visaStatus || v.visaStatus,
        roleWithSkills: v.roleWithSkills || parsed.roleWithSkills || v.roleWithSkills,
      }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI parsing failed.");
    } finally {
      setAiParsing(false);
    }
  }

  // ---- Resume drag-and-drop ----
  const [dragOver, setDragOver] = useState(false);
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && resumeInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      resumeInputRef.current.files = dt.files;
    }
  }

  // Requirement picker is a search-as-you-type combobox (matching the
  // original app's Select Requirement popup) rather than a plain <select>,
  // since scrolling a native dropdown to find one of 49+ requirements by Job
  // ID/Title/Client is exactly what that popup's search box was for.
  const [reqQuery, setReqQuery] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const reqBoxRef = useRef<HTMLDivElement>(null);
  const selectedRequirement = eligibleRequirements.find((r) => r.id === values.requirementId) ?? null;
  const reqFiltered = eligibleRequirements.filter((r) => {
    const q = reqQuery.trim().toLowerCase();
    if (!q) return true;
    return `${r.jobId} ${r.jobTitle} ${r.clientName ?? ""}`.toLowerCase().includes(q);
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (reqBoxRef.current && !reqBoxRef.current.contains(e.target as Node)) setReqOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
                : submission?.submissionId
                  ? `${submission.submissionId} — ${submission.candidate.name}`
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
              permissions={permissions}
              canEdit={canEdit}
              onEdit={() => setMode("edit")}
              onDelete={async () => {
                await deleteSubmission(submission.id);
                onClose();
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
            <div className="relative col-span-2" ref={reqBoxRef}>
              <label className={labelClass}>Requirement *</label>
              <input type="hidden" name="requirementId" value={values.requirementId} />
              <input
                type="text"
                value={reqOpen ? reqQuery : selectedRequirement ? `${selectedRequirement.jobId} — ${selectedRequirement.jobTitle}` : ""}
                onChange={(e) => {
                  setReqQuery(e.target.value);
                  setReqOpen(true);
                }}
                onFocus={() => {
                  setReqQuery("");
                  setReqOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && reqOpen) {
                    e.stopPropagation();
                    setReqOpen(false);
                  }
                }}
                required={!values.requirementId}
                placeholder="Search Job ID / Job Title / Client..."
                className={inputClass}
              />
              {reqOpen && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900">
                  {reqFiltered.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-black/50 dark:text-white/50">No matching requirements.</p>
                  ) : (
                    reqFiltered.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          set("requirementId", r.id);
                          setReqOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <span className="font-mono text-xs text-black/60 dark:text-white/60">{r.jobId}</span>{" "}
                        {r.jobTitle}
                        {r.clientName && <span className="text-black/40 dark:text-white/40"> — {r.clientName}</span>}
                        {(r.status === "Closed" || r.status === "Filled") && (
                          <span className="ml-1 text-black/40 dark:text-white/40">({r.status})</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <Field
              label="Candidate Name"
              name="candidateName"
              value={values.candidateName}
              onChange={(v) => set("candidateName", v)}
              required
            />
            <Field
              label="Email"
              name="email"
              type="email"
              value={values.email}
              onChange={(v) => set("email", v)}
              required
            />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              value={values.phone}
              onChange={(v) => set("phone", v)}
              required
            />
            <div>
              <label className={labelClass}>Country</label>
              <select
                name="country"
                value={values.country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {SUPPORTED_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Current Location"
              name="currentLocation"
              value={values.currentLocation}
              onChange={(v) => set("currentLocation", v)}
              required
            />
            <Field
              label="Total Experience (yrs)"
              name="totalExperienceYears"
              type="number"
              step="0.1"
              min="0"
              value={values.totalExperienceYears}
              onChange={(v) => set("totalExperienceYears", v)}
              required
            />
            <div>
              <label className={labelClass}>Visa Status *</label>
              <select
                name="visaStatus"
                value={values.visaStatus}
                onChange={(e) => set("visaStatus", e.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Select visa status
                </option>
                {VISA_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="LinkedIn URL"
              name="linkedinUrl"
              value={values.linkedinUrl}
              onChange={(v) => set("linkedinUrl", v)}
            />
            <div className="col-span-2">
              <label className={labelClass}>Employment Type *</label>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {SUBMISSION_EMPLOYMENT_TYPES.map((opt) => (
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
              <input type="hidden" name="employmentType" value={values.employmentType} />
            </div>
            <RateField
              label="Bill Rate"
              rateName="billRate"
              currencyName="billRateCurrency"
              rate={values.billRate}
              currency={values.billRateCurrency}
              onRateChange={(v) => set("billRate", v)}
              onCurrencyChange={(v) => {
                billCurrencyTouched.current = true;
                set("billRateCurrency", v);
              }}
            />
            <RateField
              label="Pay Rate"
              rateName="payRate"
              currencyName="payRateCurrency"
              rate={values.payRate}
              currency={values.payRateCurrency}
              onRateChange={(v) => set("payRate", v)}
              onCurrencyChange={(v) => {
                payCurrencyTouched.current = true;
                set("payRateCurrency", v);
              }}
              required
            />
            {isAdmin && mode === "edit" && (
              <div className="col-span-2">
                <label className={labelClass}>Recruiter</label>
                <select
                  name="recruiterUserId"
                  value={values.recruiterUserId}
                  onChange={(e) => set("recruiterUserId", e.target.value)}
                  className={inputClass}
                >
                  {recruiters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className={labelClass}>Role with Skills *</label>
              <textarea
                name="roleWithSkills"
                value={values.roleWithSkills}
                onChange={(e) => set("roleWithSkills", e.target.value)}
                rows={3}
                required
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass + " mb-0"}>
                  Resume {submission?.resume && "(replace)"}
                  {!submission && " *"}
                </label>
                <button
                  type="button"
                  onClick={handleParseResumeWithAi}
                  disabled={aiParsing}
                  className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
                >
                  {aiParsing ? "Parsing…" : "✨ Parse with AI"}
                </button>
              </div>
              {aiError && <p className="mb-1 text-xs text-red-600">{aiError}</p>}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`rounded-md border border-dashed p-3 text-center transition-colors ${
                  dragOver
                    ? "border-black/40 bg-black/5 dark:border-white/40 dark:bg-white/10"
                    : "border-black/15 dark:border-white/15"
                }`}
              >
                <input
                  ref={resumeInputRef}
                  type="file"
                  name="resume"
                  accept=".pdf,.doc,.docx"
                  required={!submission}
                  className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm dark:file:bg-white/10"
                />
                <p className="mt-1 text-xs text-black/40 dark:text-white/40">or drag and drop a file here</p>
              </div>
            </div>

            <div className="col-span-2">
              <label className={labelClass}>
                Visa &amp; Other Documents {submission?.additionalDocName && "(replace)"}
              </label>
              <input
                type="file"
                name="additionalDoc"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm dark:file:bg-white/10"
              />
              {submission?.additionalDocName && (
                <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                  Currently: {submission.additionalDocName}
                </p>
              )}
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
                      value={values.rejectReason}
                      onChange={(e) => set("rejectReason", e.target.value)}
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

            {state.error && (
              <div className="col-span-2 flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 dark:bg-red-950">
                <p className="text-sm text-red-600">{state.error}</p>
                {state.duplicateSubmissionId && (
                  <button
                    type="button"
                    onClick={() => onOpenExisting(state.duplicateSubmissionId!)}
                    className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900"
                  >
                    Edit Existing Submission
                  </button>
                )}
              </div>
            )}
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

function RateField({
  label,
  rateName,
  currencyName,
  rate,
  currency,
  onRateChange,
  onCurrencyChange,
  required,
}: {
  label: string;
  rateName: string;
  currencyName: string;
  rate: string;
  currency: string;
  onRateChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && " *"}
      </label>
      <div className="flex gap-1">
        <select
          name={currencyName}
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className={inputClass + " w-24 shrink-0"}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          name={rateName}
          type="number"
          step="0.01"
          min="0"
          value={rate}
          onChange={(e) => onRateChange(e.target.value)}
          required={required}
          className={inputClass}
        />
      </div>
    </div>
  );
}

function ViewSubmission({
  submission,
  permissions,
  canEdit,
  onEdit,
  onDelete,
}: {
  submission: SerializedSubmission;
  permissions: DataPermissions;
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
        {row("Submission ID", submission.submissionId)}
        {row("Requirement", submission.requirement?.jobTitle ?? submission.requirementJobIdRaw)}
        {row("Email", permissions.canViewEmail ? submission.candidate.email : "Restricted")}
        {row("Phone", permissions.canViewPhone ? submission.candidate.phone : "Restricted")}
        {row("Country", submission.country)}
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
        {row("Bill Rate", submission.billRate && `${submission.billRateCurrency} ${submission.billRate}`)}
        {row("Pay Rate", submission.payRate && `${submission.payRateCurrency} ${submission.payRate}`)}
        {row("Recruiter", submission.recruiterNameRaw)}
        {row("Status", submission.status)}
        {row("Reject Reason", submission.rejectReason)}
        {row("Placement ID", submission.placementId)}
        {row(
          "Resume",
          !submission.resume ? (
            <span className="text-black/40 dark:text-white/40">No resume uploaded</span>
          ) : !permissions.canViewResume ? (
            "Restricted"
          ) : (
            <div className="flex items-center gap-3">
              <span>{submission.resume.fileName}</span>
              <a
                href={`/api/resumes/${submission.resume.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                View
              </a>
              {permissions.canDownloadResume && (
                <a
                  href={`/api/resumes/${submission.resume.id}?download=1`}
                  className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Download
                </a>
              )}
            </div>
          )
        )}
        {row(
          "Visa & Other Documents",
          submission.additionalDocName && permissions.canViewResume && (
            <a
              href={`/api/resumes/document?path=${encodeURIComponent(submission.additionalDocUrl ?? "")}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              {submission.additionalDocName}
            </a>
          )
        )}
        {row("Role/Skills", submission.roleWithSkills && <p className="whitespace-pre-wrap">{submission.roleWithSkills}</p>)}
      </dl>
      {canEdit && (
        <div className="mt-4 flex justify-end gap-2">
          <ConfirmButton
            onConfirm={onDelete}
            confirmText={`Delete this submission for "${submission.candidate.name}"?`}
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
