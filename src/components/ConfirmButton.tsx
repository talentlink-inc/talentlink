"use client";

import { useState } from "react";

export function ConfirmButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Yes, delete",
  confirmText = "Delete this? This can't be undone.",
  className = "",
}: {
  // May return a promise: while it's pending the buttons are disabled and
  // show progress (no silent multi-second wait, no double-submit), and the
  // prompt closes once it settles — e.g. when the delete was refused and
  // the caller shows an error instead.
  onConfirm: () => void | Promise<unknown>;
  label?: string;
  confirmLabel?: string;
  confirmText?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600">{confirmText}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="rounded-md bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {busy ? "Please wait…" : confirmLabel}
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className={className}>
      {label}
    </button>
  );
}
