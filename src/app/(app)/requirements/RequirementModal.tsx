"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createRequirement,
  updateRequirement,
  deleteRequirement,
  parseJobDescriptionWithAI,
  getAccountManagerSuggestions,
} from "./actions";
import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_EMPLOYMENT_TYPES,
  parseEmploymentTypes,
  toggleEmploymentType,
  SCREENING_QUESTION_TYPE_LABELS,
  type ScreeningQuestion,
  type ScreeningQuestionType,
} from "@/lib/recruitment";
import { SUPPORTED_REGIONS, parseRegionsCsv, toggleRegion } from "@/lib/regions";
import { SUPPORTED_CURRENCIES, defaultCurrencyForRegions } from "@/lib/currency";
import { NotesSection } from "../notes/NotesSection";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import type { SerializedRequirement } from "./types";

type Mode = "create" | "view" | "edit";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

function screeningQuestionsOf(requirement: SerializedRequirement | null): ScreeningQuestion[] {
  const raw = requirement?.screeningQuestions;
  return Array.isArray(raw) ? (raw as unknown as ScreeningQuestion[]) : [];
}

export function RequirementModal({
  mode: initialMode,
  requirement,
  cloneFrom,
  currentUserId,
  canEdit,
  onClose,
  onClone,
}: {
  mode: Mode;
  requirement: SerializedRequirement | null;
  // Set only when opened via "Clone" — seeds a fresh create form from an
  // existing requirement's values, title suffixed "(Copy)", without making
  // this a real edit (requirement itself stays null so a new Job ID and
  // record get created).
  cloneFrom?: SerializedRequirement | null;
  currentUserId: string;
  canEdit: boolean;
  onClose: () => void;
  onClone?: (source: SerializedRequirement) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isForm = mode === "create" || mode === "edit";
  useEscapeToClose(onClose);

  const seed = requirement ?? cloneFrom ?? null;

  // Every field here is controlled (rather than defaultValue) so a failed
  // save — a validation error is just as likely as a duplicate-ID error —
  // doesn't wipe what the user typed. React clears uncontrolled fields after
  // every action dispatch, error or not; controlled state is immune to that
  // since the rendered value always comes from here, not the DOM node.
  const [values, setValues] = useState({
    jobTitle: seed?.jobTitle ? (cloneFrom ? `${seed.jobTitle} (Copy)` : seed.jobTitle) : "",
    clientName: seed?.clientName ?? "",
    status: requirement?.status ?? "Open",
    priority: seed?.priority?.toString() ?? "0",
    employmentType: seed?.employmentType ?? "",
    duration: seed?.duration ?? "",
    visa: seed?.visa ?? "",
    workLocation: seed?.workLocation ?? "",
    country: seed?.country ?? "",
    isRemote: seed?.isRemote ?? false,
    billRate: seed?.billRate?.toString() ?? "",
    billRateCurrency: seed?.billRateCurrency ?? "USD",
    payRate: seed?.payRate?.toString() ?? "",
    payRateCurrency: seed?.payRateCurrency ?? "USD",
    accountManagerRaw: seed?.accountManagerRaw ?? "",
    mandatorySkills: seed?.mandatorySkills ?? "",
    jobDescription: seed?.jobDescription ?? "",
  });
  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const [questions, setQuestions] = useState<ScreeningQuestion[]>(screeningQuestionsOf(seed));

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

  // Currency defaults follow Country the first time it's set on a brand-new
  // requirement — never overrides a value the user (or a clone/edit source)
  // already has.
  const currencyTouched = useRef(seed !== null);
  function handleCountryChange(next: string) {
    set("country", next);
    if (!currencyTouched.current) {
      const currency = defaultCurrencyForRegions(next);
      setValues((v) => ({ ...v, billRateCurrency: currency, payRateCurrency: currency }));
    }
  }

  // ---- Job Description rich-text editor ----
  // A plain contenteditable div, not a React-controlled input — form-reset-
  // on-action-dispatch only touches real form controls, so this survives a
  // failed submit without any special handling. The hidden input below is
  // what actually posts jobDescription; `values.jobDescription` state (kept
  // in sync via onInput) is the single source of truth for both that hidden
  // input and for anything that needs to *set* the editor's content
  // programmatically (AI parse, clone-seeding on mount).
  const jdEditorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (jdEditorRef.current) jdEditorRef.current.innerHTML = values.jobDescription;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function exec(command: string) {
    jdEditorRef.current?.focus();
    document.execCommand(command);
    if (jdEditorRef.current) set("jobDescription", jdEditorRef.current.innerHTML);
  }

  // ---- AI JD parsing ----
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  async function handleParseWithAi() {
    if (!jdEditorRef.current || !jdEditorRef.current.innerText.trim()) {
      setAiError("Paste a job description into the field below first, then click Parse with AI.");
      return;
    }
    setAiParsing(true);
    setAiError(null);
    try {
      const parsed = await parseJobDescriptionWithAI(jdEditorRef.current.innerText);
      setValues((v) => ({
        ...v,
        jobTitle: v.jobTitle || parsed.jobTitle || v.jobTitle,
        visa: v.visa || parsed.visa || v.visa,
        mandatorySkills: v.mandatorySkills || parsed.mandatorySkills || v.mandatorySkills,
        isRemote: v.isRemote || parsed.isRemote || v.isRemote,
        workLocation: v.workLocation || parsed.workLocation || v.workLocation,
        country: v.country || parsed.country || v.country,
      }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI parsing failed.");
    } finally {
      setAiParsing(false);
    }
  }

  // ---- Account Manager autocomplete ----
  const [amSuggestions, setAmSuggestions] = useState<string[]>([]);
  const [amOpen, setAmOpen] = useState(false);
  const amBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    getAccountManagerSuggestions().then(setAmSuggestions);
  }, []);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (amBoxRef.current && !amBoxRef.current.contains(e.target as Node)) setAmOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const amFiltered = amSuggestions.filter(
    (n) => !values.accountManagerRaw || n.toLowerCase().includes(values.accountManagerRaw.toLowerCase())
  );

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
              ? cloneFrom
                ? `New Requirement (cloned from ${cloneFrom.jobId})`
                : "New Requirement"
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
              onClone={onClone ? () => onClone(requirement) : undefined}
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
              <label className={labelClass}>Priority</label>
              <StarRating value={Number(values.priority)} onChange={(n) => set("priority", String(n))} />
              <input type="hidden" name="priority" value={values.priority} />
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
              <label className={labelClass}>Country *</label>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {SUPPORTED_REGIONS.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={parseRegionsCsv(values.country).includes(r)}
                      onChange={() => handleCountryChange(toggleRegion(values.country, r))}
                    />
                    {r}
                  </label>
                ))}
              </div>
              <input type="hidden" name="country" value={values.country} required />
            </div>

            <RateField
              label="Bill Rate"
              rateName="billRate"
              currencyName="billRateCurrency"
              rate={values.billRate}
              currency={values.billRateCurrency}
              onRateChange={(v) => set("billRate", v)}
              onCurrencyChange={(v) => {
                currencyTouched.current = true;
                set("billRateCurrency", v);
              }}
              required
            />
            <RateField
              label="Pay Rate"
              rateName="payRate"
              currencyName="payRateCurrency"
              rate={values.payRate}
              currency={values.payRateCurrency}
              onRateChange={(v) => set("payRate", v)}
              onCurrencyChange={(v) => {
                currencyTouched.current = true;
                set("payRateCurrency", v);
              }}
            />

            <div className="relative col-span-2" ref={amBoxRef}>
              <label className={labelClass}>Account Manager</label>
              <input
                name="accountManagerRaw"
                value={values.accountManagerRaw}
                onChange={(e) => set("accountManagerRaw", e.target.value)}
                onFocus={() => setAmOpen(true)}
                autoComplete="off"
                className={inputClass}
              />
              {amOpen && amFiltered.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900">
                  {amFiltered.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        set("accountManagerRaw", name);
                        setAmOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass + " mb-0"}>Job Description *</label>
                <button
                  type="button"
                  onClick={handleParseWithAi}
                  disabled={aiParsing}
                  className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
                >
                  {aiParsing ? "Parsing…" : "✨ Parse with AI"}
                </button>
              </div>
              {aiError && <p className="mb-1 text-xs text-red-600">{aiError}</p>}
              <div className="mb-1 flex gap-1 rounded-t-md border border-b-0 border-black/15 bg-black/[0.02] px-2 py-1 dark:border-white/15 dark:bg-white/[0.03]">
                <button type="button" onClick={() => exec("bold")} className="rounded px-2 py-0.5 text-xs font-bold hover:bg-black/10 dark:hover:bg-white/10">
                  B
                </button>
                <button type="button" onClick={() => exec("italic")} className="rounded px-2 py-0.5 text-xs italic hover:bg-black/10 dark:hover:bg-white/10">
                  I
                </button>
                <button type="button" onClick={() => exec("underline")} className="rounded px-2 py-0.5 text-xs underline hover:bg-black/10 dark:hover:bg-white/10">
                  U
                </button>
                <span className="mx-1 w-px bg-black/15 dark:bg-white/15" />
                <button type="button" onClick={() => exec("insertUnorderedList")} className="rounded px-2 py-0.5 text-xs hover:bg-black/10 dark:hover:bg-white/10">
                  • List
                </button>
                <button type="button" onClick={() => exec("insertOrderedList")} className="rounded px-2 py-0.5 text-xs hover:bg-black/10 dark:hover:bg-white/10">
                  1. List
                </button>
              </div>
              <div
                ref={jdEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => set("jobDescription", e.currentTarget.innerHTML)}
                className={inputClass + " min-h-[120px] rounded-t-none"}
              />
              <input type="hidden" name="jobDescription" value={values.jobDescription} required />
            </div>

            <ScreeningQuestionsBuilder questions={questions} onChange={setQuestions} />

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

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 py-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          aria-label={`Priority ${n}`}
          className={`text-xl leading-none ${n <= value ? "text-amber-400" : "text-black/15 dark:text-white/15"}`}
        >
          ★
        </button>
      ))}
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

function ScreeningQuestionsBuilder({
  questions,
  onChange,
}: {
  questions: ScreeningQuestion[];
  onChange: (q: ScreeningQuestion[]) => void;
}) {
  function update(i: number, patch: Partial<ScreeningQuestion>) {
    onChange(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function remove(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...questions, { id: `q${Date.now()}`, text: "", type: "short", required: false }]);
  }

  return (
    <div className="col-span-2">
      <div className="mb-1 flex items-center justify-between">
        <label className={labelClass + " mb-0"}>
          Screening Questions{" "}
          <span className="font-normal text-black/40 dark:text-white/40">
            (shown to candidates on the public apply link)
          </span>
        </label>
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          + Add Question
        </button>
      </div>
      {questions.length > 0 && (
        <div className="space-y-2 rounded-md border border-black/10 p-2 dark:border-white/10">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-center gap-2">
              <input
                value={q.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder="Question text"
                className={inputClass + " flex-1"}
              />
              <select
                value={q.type}
                onChange={(e) => update(i, { type: e.target.value as ScreeningQuestionType })}
                className={inputClass + " w-32 shrink-0"}
              >
                {Object.entries(SCREENING_QUESTION_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <label className="flex shrink-0 items-center gap-1 text-xs text-black/60 dark:text-white/60">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 text-black/40 hover:text-red-600 dark:text-white/40"
                aria-label="Remove question"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <input type="hidden" name="screeningQuestions" value={JSON.stringify(questions.filter((q) => q.text.trim()))} />
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
  onClone,
  onDelete,
}: {
  requirement: SerializedRequirement;
  canEdit: boolean;
  onEdit: () => void;
  onClone?: () => void;
  onDelete: () => void;
}) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2">{value ?? "—"}</dd>
    </div>
  );

  const [copied, setCopied] = useState(false);
  const applyUrl =
    requirement.publicApplyToken && typeof window !== "undefined"
      ? `${window.location.origin}/apply/${requirement.publicApplyToken}`
      : null;

  return (
    <div>
      <dl className="divide-y divide-black/5 dark:divide-white/5">
        {row("Job ID", requirement.jobId)}
        {row("Client", requirement.clientName)}
        {row("Status", requirement.status)}
        {row("Priority", "★".repeat(requirement.priority) || "—")}
        {row("Employment Type", requirement.employmentType)}
        {row("Duration", requirement.duration)}
        {row("Visa", requirement.visa)}
        {row("Work Location", requirement.workLocation)}
        {row("Country", requirement.country)}
        {row("Remote", requirement.isRemote ? "Yes" : "No")}
        {row("Bill Rate", requirement.billRate && `${requirement.billRateCurrency} ${requirement.billRate}`)}
        {row("Pay Rate", requirement.payRate && `${requirement.payRateCurrency} ${requirement.payRate}`)}
        {row("Account Manager", requirement.accountManagerRaw)}
        {row("Mandatory Skills", requirement.mandatorySkills)}
        {row(
          "Job Description",
          requirement.jobDescription && (
            <div
              className="prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: requirement.jobDescription }}
            />
          )
        )}
        {row(
          "Apply Link",
          applyUrl && (
            <div className="flex items-center gap-2">
              <code className="truncate text-xs">{applyUrl}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(applyUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="shrink-0 rounded-md border border-black/15 px-2 py-0.5 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
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
          {onClone && (
            <button
              onClick={onClone}
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
            >
              Clone
            </button>
          )}
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
