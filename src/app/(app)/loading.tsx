// Next.js shows this automatically while a nested page's Server Component is
// still fetching data — covers "no loading state while switching tabs"
// (rapid repeated clicks just keep landing on this same skeleton until the
// latest navigation's data resolves; the router itself discards stale
// in-flight navigations rather than racing them onto the screen).
// Shaped like the real page — slate header, toolbar, table card — so the
// layout doesn't jump when the data arrives.
export default function AppLoading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-5 rounded-xl bg-ink px-5 py-4 shadow-sm">
        <div className="h-5 w-40 rounded bg-white/20" />
        <div className="mt-2 h-3.5 w-64 max-w-full rounded bg-white/10" />
      </div>
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
