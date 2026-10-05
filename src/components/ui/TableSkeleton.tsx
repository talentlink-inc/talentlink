// Toolbar + table placeholder. Used on its own when switching tabs inside a
// section (the section header stays put), and under a header skeleton for
// full page loads.
export function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="tl-skeleton h-9 min-w-[220px] flex-1" />
        <div className="tl-skeleton h-9 w-32" />
        <div className="tl-skeleton h-9 w-36" />
      </div>
      <div className="overflow-hidden rounded-lg border border-black/10 border-t-[3px] border-t-brand bg-white shadow-sm dark:border-white/10 dark:bg-neutral-950">
        <div className="h-9 bg-slate-50 dark:bg-white/5" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-black/5 px-3 py-2.5 dark:border-white/10">
            <div className="tl-skeleton h-3.5 w-16" />
            <div className="tl-skeleton h-3.5 flex-1" />
            <div className="tl-skeleton h-3.5 w-24" />
            <div className="tl-skeleton h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
