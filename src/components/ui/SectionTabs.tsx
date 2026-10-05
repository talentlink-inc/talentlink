"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

export type SectionTab = { href: string; label: string; icon: LucideIcon };

// The sub-feature tabs of a section (Recruitment, Bench Sales), on a white
// strip under the slate PageHeader — icon + bold label, teal underline for the
// current one, as in GAS's .rec-tabs. Sits apart from the title so it reads
// as navigation, not as a second line of heading text.
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
        className="flex overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map(({ href, label: text, icon: Icon }) => {
          const active = pathname === href || (!exact.includes(href) && pathname?.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={`${href}${query}`}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-[3px] px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? "border-brand bg-brand-soft/50 text-brand-strong dark:bg-white/5 dark:text-brand"
                  : "border-transparent text-black/55 hover:bg-brand-soft/40 hover:text-brand-strong dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
              }`}
            >
              <Icon size={17} aria-hidden className="shrink-0" />
              {text}
            </Link>
          );
        })}
      </nav>
      {/* Fade on the right edge hints there are more tabs to scroll to. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent md:hidden dark:from-neutral-950"
      />
    </div>
  );
}
