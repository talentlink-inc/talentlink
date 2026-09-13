"use client";

import { useEffect } from "react";

// Shared by every modal/overlay so Escape closes whichever one is on top,
// matching the click-outside-to-close behavior they already have.
export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}
