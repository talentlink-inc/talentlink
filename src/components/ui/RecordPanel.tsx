"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

// Side panel for viewing/editing a record (design review 2B). It slides in
// from the right without a blocking backdrop, so the list stays visible and
// clicking another row simply swaps the record shown. Full screen on phones.
export type PanelTab = { key: string; label: string; content: React.ReactNode };

// Sticky action bar for the bottom of a panel's body — Edit/Delete/Save stay
// reachable however long the record is.
export const panelFooterClass =
  "sticky bottom-0 -mx-5 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-black/10 bg-white/95 px-5 py-3 backdrop-blur dark:border-white/10 dark:bg-neutral-950/95";

export function RecordPanel({
  title,
  subtitle,
  onClose,
  tabs,
  wide = false,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  tabs?: PanelTab[];
  wide?: boolean;
  children?: React.ReactNode;
}) {
  useEscapeToClose(onClose);
  const titleId = useId();
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus into the panel when it opens so keyboard and screen-reader
  // users land on the record, not behind it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const current = tabs?.find((t) => t.key === activeTab) ?? tabs?.[0];

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={`fixed inset-0 z-50 flex flex-col bg-white shadow-2xl motion-safe:animate-[tl-slide-in_.18s_ease-out] md:inset-y-0 md:right-0 md:left-auto md:border-l md:border-black/10 dark:bg-neutral-950 dark:md:border-white/10 ${
        wide ? "md:w-[min(760px,92vw)]" : "md:w-[min(600px,92vw)]"
      }`}
    >
      <div className="flex items-start gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-base font-semibold break-words outline-none md:text-lg">
            {title}
          </h2>
          {subtitle && <div className="mt-0.5 text-sm text-black/55 dark:text-white/55">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 rounded-md p-1.5 text-xl leading-none text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
        >
          ×
        </button>
      </div>

      {tabs && tabs.length > 1 && (
        <div role="tablist" aria-label="Record sections" className="flex gap-5 border-b border-black/10 px-5 dark:border-white/10">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={current?.key === t.key}
              onClick={() => setActiveTab(t.key)}
              className={`-mb-px border-b-2 py-2.5 text-sm ${
                current?.key === t.key
                  ? "border-brand font-medium text-brand-strong dark:text-brand"
                  : "border-transparent text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div role={tabs ? "tabpanel" : undefined} className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
        {tabs ? current?.content : children}
        <div className="h-4" aria-hidden />
      </div>
    </aside>
  );
}
