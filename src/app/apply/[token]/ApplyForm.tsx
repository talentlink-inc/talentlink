"use client";

import { useActionState } from "react";
import { submitApplication } from "./actions";
import type { ScreeningQuestion } from "@/lib/recruitment";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

export function ApplyForm({ token, questions }: { token: string; questions: ScreeningQuestion[] }) {
  const [state, formAction, pending] = useActionState(submitApplication.bind(null, token), {
    error: null,
    submitted: false,
  });

  if (state.submitted) {
    return (
      <div className="rounded-md bg-green-50 px-4 py-6 text-center text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
        Thanks for applying! We&apos;ve received your resume and will be in touch if it&apos;s a match.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={labelClass}>Full Name *</label>
        <input name="candidateName" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Email *</label>
        <input name="email" type="email" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Phone *</label>
        <input name="phone" type="tel" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Current Location *</label>
        <input name="currentLocation" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>LinkedIn URL</label>
        <input name="linkedinUrl" className={inputClass} />
      </div>

      {questions.map((q) => (
        <div key={q.id}>
          <label className={labelClass}>
            {q.text}
            {q.required && " *"}
          </label>
          {q.type === "long" ? (
            <textarea name={`question_${q.id}`} required={q.required} rows={3} className={inputClass} />
          ) : q.type === "yesno" ? (
            <select name={`question_${q.id}`} required={q.required} className={inputClass}>
              <option value="">Select…</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          ) : q.type === "rating" ? (
            <select name={`question_${q.id}`} required={q.required} className={inputClass}>
              <option value="">Select…</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <input name={`question_${q.id}`} required={q.required} className={inputClass} />
          )}
        </div>
      ))}

      <div>
        <label className={labelClass}>Resume *</label>
        <input
          type="file"
          name="resume"
          accept=".pdf,.doc,.docx"
          required
          className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm dark:file:bg-white/10"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Submitting…" : "Submit Application"}
      </button>
    </form>
  );
}
