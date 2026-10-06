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
      <div className="mb-5 flex gap-6 border-b border-line pb-3">
        <div className="tl-skeleton h-5 w-28" />
        <div className="tl-skeleton h-5 w-28" />
        <div className="tl-skeleton h-5 w-24" />
      </div>
      <TableSkeleton />
    </div>
  );
}
