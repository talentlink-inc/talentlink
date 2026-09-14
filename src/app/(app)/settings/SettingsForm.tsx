"use client";

import { useActionState, useState } from "react";
import { updateTenantSettings, type TenantSettings } from "./actions";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

const LOGO_STYLES = [
  { value: "people", label: "Icon only" },
  { value: "wordmark", label: "Wordmark only" },
  { value: "full", label: "Icon + wordmark (default)" },
] as const;

export function SettingsForm({ initialSettings }: { initialSettings: TenantSettings }) {
  const [state, formAction, pending] = useActionState(updateTenantSettings, { error: null, saved: false });
  const [aiProvider, setAiProvider] = useState(initialSettings.aiProvider);
  const [logoStyle, setLogoStyle] = useState(initialSettings.logoStyle);
  const [clearKey, setClearKey] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
      <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-1 text-sm font-semibold">AI-Assisted Parsing</h2>
        <p className="mb-4 text-xs text-black/50 dark:text-white/50">
          Powers &ldquo;Parse with AI&rdquo; on Job Descriptions and resumes. Nothing is called until a key is set here.
        </p>

        <div className="mb-3">
          <label className={labelClass}>Provider</label>
          <select
            name="aiProvider"
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value)}
            className={inputClass}
          >
            <option value="groq">Groq (fast, default)</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>API Key</label>
          <input
            name="aiApiKey"
            type="password"
            placeholder={initialSettings.hasAiApiKey ? "•••••••• (saved — leave blank to keep)" : "Not set"}
            disabled={clearKey}
            className={inputClass + " disabled:opacity-50"}
          />
          {initialSettings.hasAiApiKey && (
            <label className="mt-2 flex items-center gap-2 text-xs text-black/60 dark:text-white/60">
              <input
                type="checkbox"
                name="clearAiApiKey"
                checked={clearKey}
                onChange={(e) => setClearKey(e.target.checked)}
              />
              Remove the saved key
            </label>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-1 text-sm font-semibold">Branding</h2>
        <p className="mb-4 text-xs text-black/50 dark:text-white/50">
          Which logo variant shows in the sidebar and on the sign-in page.
        </p>
        <label className={labelClass}>Logo Style</label>
        <select name="logoStyle" value={logoStyle} onChange={(e) => setLogoStyle(e.target.value)} className={inputClass}>
          {LOGO_STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !state.error && <p className="text-sm text-green-600">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Save Settings"}
      </button>
    </form>
  );
}
