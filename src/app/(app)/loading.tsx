// Next.js shows this automatically while a nested page's Server Component is
// still fetching data — covers "no loading state while switching tabs"
// (rapid repeated clicks just keep landing on this same skeleton until the
// latest navigation's data resolves; the router itself discards stale
// in-flight navigations rather than racing them onto the screen).
import { TableSkeleton } from "@/components/ui/TableSkeleton";

// Shaped like the real page — slate header, toolbar, table card — so the
// layout doesn't jump when the data arrives.
export default function AppLoading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-5 rounded-xl bg-ink px-5 py-4 shadow-sm">
        <div className="h-5 w-40 rounded bg-white/20" />
        <div className="mt-2 h-3.5 w-64 max-w-full rounded bg-white/10" />
      </div>
      <TableSkeleton />
    </div>
  );
}
