"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type PageShortcuts = {
  onNew?: () => void;
  onFocusSearch?: () => void;
  onClearSearch?: () => void;
};

type GlobalSearchShortcuts = {
  onFocus: () => void;
  onClear: () => void;
};

type ShortcutsContextValue = {
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  registerPage: (shortcuts: PageShortcuts) => () => void;
  registerGlobalSearch: (shortcuts: GlobalSearchShortcuts) => () => void;
};

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// One page's table is ever "active" at a time in this app, so a plain ref
// (rather than something keyed by route) is enough — each table page
// registers its own onNew/onFocusSearch/onClearSearch on mount and clears
// it on unmount via usePageShortcuts below.
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const pageRef = useRef<PageShortcuts>({});
  const globalSearchRef = useRef<GlobalSearchShortcuts | null>(null);
  const router = useRouter();

  const registerPage = useCallback((shortcuts: PageShortcuts) => {
    pageRef.current = shortcuts;
    return () => {
      pageRef.current = {};
    };
  }, []);

  const registerGlobalSearch = useCallback((shortcuts: GlobalSearchShortcuts) => {
    globalSearchRef.current = shortcuts;
    return () => {
      globalSearchRef.current = null;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K opens the global search from anywhere, even mid-typing —
      // matches the "works anywhere" convention (GitHub, Linear, etc).
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        globalSearchRef.current?.onFocus();
        return;
      }

      // Escape always clears search (closing the topmost modal is handled
      // independently by each modal's own useEscapeToClose listener).
      if (e.key === "Escape") {
        globalSearchRef.current?.onClear();
        pageRef.current.onClearSearch?.();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === "?") {
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        if (pageRef.current.onFocusSearch) pageRef.current.onFocusSearch();
        else globalSearchRef.current?.onFocus();
        return;
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        pageRef.current.onNew?.();
        return;
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        router.refresh();
        return;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <ShortcutsContext.Provider value={{ helpOpen, setHelpOpen, registerPage, registerGlobalSearch }}>
      {children}
    </ShortcutsContext.Provider>
  );
}

function useShortcutsContext() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error("Must be used within ShortcutsProvider");
  return ctx;
}

export function useShortcutsHelp() {
  const { helpOpen, setHelpOpen } = useShortcutsContext();
  return { helpOpen, setHelpOpen };
}

export function usePageShortcuts(shortcuts: PageShortcuts) {
  const { registerPage } = useShortcutsContext();
  const { onNew, onFocusSearch, onClearSearch } = shortcuts;
  useEffect(
    () => registerPage({ onNew, onFocusSearch, onClearSearch }),
    [registerPage, onNew, onFocusSearch, onClearSearch]
  );
}

export function useGlobalSearchShortcuts(shortcuts: GlobalSearchShortcuts) {
  const { registerGlobalSearch } = useShortcutsContext();
  const { onFocus, onClear } = shortcuts;
  useEffect(
    () => registerGlobalSearch({ onFocus, onClear }),
    [registerGlobalSearch, onFocus, onClear]
  );
}
