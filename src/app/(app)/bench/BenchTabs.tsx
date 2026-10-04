"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <nav aria-label="Bench Sales sections" className="-mb-px flex gap-1 overflow-x-auto">
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
  );
}
