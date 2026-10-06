// Page heading, GAS style: the visible title is in the top bar (Header.tsx),
// so on desktop this renders the section's tabs straight on the page and
// keeps the h1 for screen readers. On phones the top bar has no room for the
// title, so it shows here instead.
export function PageHeader({
  title,
  actions,
  children,
}: {
  title: string;
  // Kept for callers; not shown (GAS pages carry no subtitle line).
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  // Sub-navigation (SectionTabs).
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap items-center gap-3 md:mb-0">
        <h1 className="text-lg font-semibold text-text-strong md:sr-only dark:text-white">{title}</h1>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2 md:mb-4">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
