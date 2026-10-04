// Slate page header carrying the page's title and main actions (design
// review 1B). The page title now lives only here — the top bar no longer
// repeats it.
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  // Optional row under the title (e.g. Bench Sales' tab bar).
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-xl bg-ink text-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-white/65">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="px-5">{children}</div>}
    </div>
  );
}
