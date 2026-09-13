// Next.js shows this automatically while a nested page's Server Component is
// still fetching data — covers "no loading state while switching tabs"
// (rapid repeated clicks just keep landing on this same skeleton until the
// latest navigation's data resolves; the router itself discards stale
// in-flight navigations rather than racing them onto the screen).
export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded bg-black/10 dark:bg-white/10" />
      <div className="h-9 w-full max-w-md rounded bg-black/10 dark:bg-white/10" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded bg-black/5 dark:bg-white/5" />
        ))}
      </div>
    </div>
  );
}
