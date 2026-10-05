"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PERIOD_KEYS, PERIOD_LABELS, type PeriodKey } from "@/lib/insights";
import { buttonClass } from "@/components/ui/button";
import { toolbarInputClass } from "@/components/ui/table";

// One period for every report tab (GAS had three separate date filters).
// Kept in the URL, so a report can be bookmarked or shared as-is.
export function PeriodPicker({ current, from, to, label }: { current: PeriodKey; from: string; to: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(current === "custom");
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const go = (params: Record<string, string>) =>
    startTransition(() => router.push(`${pathname}?${new URLSearchParams(params)}`, { scroll: false }));

  const customValid = customFrom && customTo && customFrom <= customTo;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2" aria-busy={pending}>
      <div role="group" aria-label="Report period" className="flex flex-wrap gap-1 rounded-lg border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-neutral-950">
        {PERIOD_KEYS.map((k) => {
          const on = k === "custom" ? customOpen || current === "custom" : current === k && !customOpen;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (k === "custom") setCustomOpen(true);
                else {
                  setCustomOpen(false);
                  go({ period: k });
                }
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                on ? "bg-ink text-white" : "text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              }`}
            >
              {PERIOD_LABELS[k]}
            </button>
          );
        })}
      </div>
      {customOpen && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (customValid) go({ period: "custom", from: customFrom, to: customTo });
          }}
        >
          <input type="date" aria-label="From" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className={toolbarInputClass} />
          <span className="text-sm text-black/50">to</span>
          <input type="date" aria-label="To" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className={toolbarInputClass} />
          <button type="submit" disabled={!customValid} className={buttonClass("primary")}>
            Apply
          </button>
        </form>
      )}
      <span className="ml-auto text-sm font-medium text-black/60 dark:text-white/60">
        {pending ? "Updating…" : label}
      </span>
    </div>
  );
}
