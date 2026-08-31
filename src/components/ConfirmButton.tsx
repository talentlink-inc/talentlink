"use client";

import { useState } from "react";

export function ConfirmButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Yes, delete",
  confirmText = "Delete this? This can't be undone.",
  className = "",
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  confirmText?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600">{confirmText}</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-3 py-2 text-sm text-white"
        >
          {confirmLabel}
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
