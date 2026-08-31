"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { globalSearch, type SearchResult } from "@/app/(app)/search/actions";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearch(value);
        setResults(r);
        setOpen(true);
      });
    }, 250);
  }

  function goTo(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="flex items-center gap-2 rounded-md border border-black/15 bg-black/[0.02] px-3 py-2 dark:border-white/15 dark:bg-white/5">
        <Search size={16} className="shrink-0 text-black/40 dark:text-white/40" />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search requirements, candidates, interviews…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-black/10 bg-white py-2 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          {pending ? (
            <p className="px-3 py-2 text-sm text-black/50 dark:text-white/50">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-black/50 dark:text-white/50">No results.</p>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-1">
                <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-black/40 uppercase dark:text-white/40">
                  {category} ({items.length})
                </div>
                {items.map((r) => (
                  <button
                    key={`${r.category}-${r.id}`}
                    type="button"
                    onClick={() => goTo(r.href)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-black/50 dark:text-white/50">{r.subtitle}</div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
