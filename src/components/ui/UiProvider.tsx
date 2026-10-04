"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "./button";

// App-wide interaction feedback (design review 3C + 6B):
// - toasts: "Saved", and "Removed · Undo" for reversible actions
// - confirm dialog: for permanent or serious actions, never inline
// - table density: compact (default) or comfortable, remembered per person

type Toast = { id: number; message: string; tone: "success" | "error" | "info"; undo?: () => void | Promise<unknown> };
type ToastInput = Omit<Toast, "id">;
type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  // Runs while the dialog stays open showing "Please wait…"; returning a
  // string (or throwing) shows it as an error inside the dialog instead of closing.
  action: () => Promise<string | null | void> | string | null | void;
};
export type Density = "compact" | "comfortable";

type UiContext = {
  toast: (t: ToastInput) => void;
  confirm: (o: ConfirmOptions) => void;
  density: Density;
  setDensity: (d: Density) => void;
};

const Ctx = createContext<UiContext | null>(null);
const DENSITY_KEY = "talentlink.tableDensity";

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [density, setDensityState] = useState<Density>("compact");
  const nextId = useRef(1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DENSITY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only preference after hydration
      if (saved === "comfortable" || saved === "compact") setDensityState(saved);
    } catch {
      /* storage blocked — keep the default */
    }
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* not persisted — fine */
    }
  }, []);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.undo ? 7000 : 4000);
    },
    [dismiss]
  );

  const confirm = useCallback((o: ConfirmOptions) => {
    setDialogError(null);
    setBusy(false);
    setDialog(o);
  }, []);

  async function runConfirm() {
    if (!dialog) return;
    setBusy(true);
    setDialogError(null);
    try {
      const result = await dialog.action();
      if (typeof result === "string" && result) {
        setDialogError(result);
      } else {
        setDialog(null);
      }
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const value = useMemo(() => ({ toast, confirm, density, setDensity }), [toast, confirm, density, setDensity]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {dialog && (
        <ConfirmDialog
          options={dialog}
          busy={busy}
          error={dialogError}
          onCancel={() => !busy && setDialog(null)}
          onConfirm={runConfirm}
        />
      )}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-md items-center gap-4 rounded-lg bg-ink-strong px-4 py-2.5 text-sm text-white shadow-lg"
          >
            <span className={t.tone === "error" ? "text-red-300" : t.tone === "success" ? "text-white" : "text-white/90"}>
              {t.tone === "success" && <span aria-hidden className="mr-1.5 text-brand">✓</span>}
              {t.message}
            </span>
            {t.undo && (
              <button
                type="button"
                onClick={async () => {
                  dismiss(t.id);
                  try {
                    await t.undo?.();
                    toast({ message: "Undone", tone: "info" });
                  } catch (err) {
                    toast({ message: err instanceof Error ? err.message : "Couldn't undo that.", tone: "error" });
                  }
                }}
                className="font-semibold text-brand hover:text-white"
              >
                Undo
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-white/50 hover:text-white">
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ConfirmDialog({
  options,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tl-confirm-title"
        aria-describedby={options.body ? "tl-confirm-body" : undefined}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="tl-confirm-title" className="text-base font-semibold">
          {options.title}
        </h2>
        {options.body && (
          <p id="tl-confirm-body" className="mt-1.5 text-sm text-black/60 dark:text-white/60">
            {options.body}
          </p>
        )}
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={buttonClass(options.tone === "primary" ? "primary" : "danger")}
          >
            {busy ? "Please wait…" : (options.confirmLabel ?? "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useUi(): UiContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUi must be used inside <UiProvider>.");
  return ctx;
}

/** Cell padding for list tables, by the person's density preference. */
export function useCellClass(): string {
  const { density } = useUi();
  return density === "compact" ? "px-3 py-1.5" : "px-4 py-3";
}

export function DensityToggle() {
  const { density, setDensity } = useUi();
  return (
    <div role="group" aria-label="Table density" className="inline-flex overflow-hidden rounded-md border border-black/15 text-xs dark:border-white/15">
      {(["compact", "comfortable"] as const).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={density === d}
          onClick={() => setDensity(d)}
          className={`px-2.5 py-1.5 capitalize ${density === d ? "bg-ink text-white" : "bg-white text-black/60 hover:bg-black/5 dark:bg-transparent dark:text-white/60"}`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
