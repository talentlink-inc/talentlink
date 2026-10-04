"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Mirrors GAS PageBenchSales.html's tab bar, in the same order.
const TABS = [
  { href: "/bench/consultants", label: "Consultants" },
  { href: "/bench/submissions", label: "Submissions" },
  { href: "/bench/placements", label: "Placements" },
  { href: "/bench/hotlist", label: "Hotlist" },
  { href: "/bench/interviews", label: "Interviews" },
  { href: "/bench/notes", label: "Notes" },
];

export function BenchTabs() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  // Keep the current tab visible when the bar is scrolled on a phone.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    // On phones the tabs scroll sideways; the fade on the right edge hints
    // that there are more of them.
    <div className="relative -mr-5">
      <nav
        ref={navRef}
        aria-label="Bench Sales sections"
        className="-mb-px flex gap-1 overflow-x-auto pr-8 [scrollbar-width:none] md:pr-5 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`border-b-[3px] px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
                active ? "border-brand font-medium text-white" : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ink to-transparent md:hidden"
      />
    </div>
  );
}
