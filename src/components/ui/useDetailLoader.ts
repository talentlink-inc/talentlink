"use client";

import { useCallback, useEffect, useRef } from "react";

// Lists send slim rows; a record's full detail is fetched when it's opened.
// prefetch(id) starts that fetch early (on row hover / focus / touch) and
// load(id) reuses it, so opening usually feels instant. The cache is dropped
// whenever `version` changes (the list data was refreshed after a save), so a
// panel never shows a stale record.
export function useDetailLoader<T>(fetcher: (id: string) => Promise<T>, version: unknown) {
  const cache = useRef(new Map<string, Promise<T>>());
  useEffect(() => {
    cache.current.clear();
  }, [version]);

  const load = useCallback(
    (id: string) => {
      let p = cache.current.get(id);
      if (!p) {
        p = fetcher(id);
        cache.current.set(id, p);
        // A failed fetch shouldn't stick: the next open tries again.
        p.catch(() => cache.current.delete(id));
      }
      return p;
    },
    [fetcher]
  );
  return { load, prefetch: load };
}
