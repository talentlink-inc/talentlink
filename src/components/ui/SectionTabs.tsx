"use client";

import { IntentLink as Link } from "@/components/ui/IntentLink";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

export type SectionTab = { href: string; label: string; icon: LucideIcon };

// The sub-feature tabs of a section (Recruitment, Bench Sales, Insights),
// as in GAS's .rec-tabs: icon + bold label on the page, indigo text and
// underline for the current one, a hairline under the row.
export function SectionTabs({
  tabs,
  label,
  query = "",
  exact = [],
}: {
  tabs: SectionTab[];
  label: string;
  // Appended to every tab link (e.g. "?period=month" so a filter carries over).
  query?: string;
  // Tabs that match only their exact path (a section's index tab, whose path
  // prefixes all the others).
  exact?: string[];
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // On phones the strip scrolls sideways: keep the current tab in view.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <div className="relative">
      <nav
        ref={navRef}
        aria-label={label}
        className="flex overflow-x-auto border-b border-line [scrollbar-width:none] dark:border-white/10 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map(({ href, label: text, icon: Icon }) => {
          const active = pathname === href || (!exact.includes(href) && pathname?.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={`${href}${query}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[15px] font-semibold whitespace-nowrap transition-colors ${
                active
                  ? "border-primary text-primary dark:border-brand dark:text-brand"
                  : "border-transparent text-text-muted hover:text-primary dark:text-white/55 dark:hover:text-white"
              }`}
            >
              <Icon size={18} aria-hidden className="shrink-0" />
              {text}
            </Link>
          );
        })}
      </nav>
      {/* Fade on the right edge hints there are more tabs to scroll to. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-page to-transparent md:hidden dark:from-neutral-950"
      />
    </div>
  );
}
