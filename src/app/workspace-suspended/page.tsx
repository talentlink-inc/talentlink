export default function WorkspaceSuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mb-2 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
          <img src="/logo-icon-light.png" alt="TalentLink" width={48} height={34} />
          <h1 className="text-xl font-semibold">
            Talent<span className="text-orange-500">Link</span>
          </h1>
        </div>
        <p className="text-sm text-black/60 dark:text-white/60">
          This workspace has been suspended. Contact your workspace admin or billing owner to
          restore access.
        </p>
      </div>
    </div>
  );
}
