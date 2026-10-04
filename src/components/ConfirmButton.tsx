"use client";

import { useUi } from "@/components/ui/UiProvider";
import { buttonClass } from "@/components/ui/button";

// A button that asks first, in a proper dialog (design review 3C) instead
// of the old inline prompt that shifted the layout and ran off-screen in
// table cells. Same props as before, so every caller upgraded at once.
export function ConfirmButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Yes, delete",
  confirmText = "Delete this? This can't be undone.",
  body,
  className = buttonClass("dangerSoft"),
}: {
  // May return a promise: the dialog stays open showing "Please wait…"
  // until it settles, so there's no silent wait and no double-submit.
  onConfirm: () => void | Promise<unknown>;
  label?: string;
  confirmLabel?: string;
  confirmText?: string;
  body?: string;
  className?: string;
}) {
  const { confirm } = useUi();
  return (
    <button
      type="button"
      onClick={() =>
        confirm({
          title: confirmText,
          body,
          // "Yes, delete" → "Delete": a dialog button names the action itself.
          confirmLabel: confirmLabel.replace(/^Yes,\s*/i, "").replace(/^\w/, (c) => c.toUpperCase()),
          action: async () => {
            await onConfirm();
          },
        })
      }
      className={className}
    >
      {label}
    </button>
  );
}
