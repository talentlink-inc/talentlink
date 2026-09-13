"use client";

import { Keyboard } from "lucide-react";
import { useShortcutsHelp } from "@/lib/keyboardShortcuts";
import { useEscapeToClose } from "@/lib/useEscapeToClose";

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["⌘ K", "Ctrl + K"], description: "Open the global search (works anywhere)" },
  { keys: ["/"], description: "Focus the search box on the current page" },
  { keys: ["n", "Ctrl + N"], description: "New record (uses the current page / tab)" },
  { keys: ["r"], description: "Refresh current table" },
  { keys: ["Esc"], description: "Close the topmost modal / clear search" },
  { keys: ["?"], description: "Toggle this help overlay" },
];

export function KeyboardShortcutsModal() {
  const { helpOpen, setHelpOpen } = useShortcutsHelp();
  const onClose = () => setHelpOpen(false);
  useEscapeToClose(onClose);

  if (!helpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-black/10 px-6 py-5 dark:border-white/10">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
            style={{ background: "#1a237e" }}
          >
            <Keyboard size={20} />
          </span>
          <h2 className="flex-1 text-lg font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <dl className="divide-y divide-black/5 dark:divide-white/5">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center gap-4 px-6 py-3.5">
              <dt className="flex w-32 shrink-0 flex-wrap items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-md border border-black/15 bg-black/5 px-2 py-1 text-xs font-semibold whitespace-nowrap text-black/70 dark:border-white/15 dark:bg-white/10 dark:text-white/70"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-sm text-black/80 dark:text-white/80">{s.description}</dd>
            </div>
          ))}
        </dl>

        <p className="px-6 pt-3 pb-1 text-xs text-black/40 dark:text-white/40">
          Shortcuts are disabled while typing in a text field.
        </p>

        <div className="flex justify-end border-t border-black/10 px-6 py-4 dark:border-white/10">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ background: "#1a237e" }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
