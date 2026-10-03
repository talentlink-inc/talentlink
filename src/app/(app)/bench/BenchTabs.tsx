"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mirrors GAS PageBenchSales.html's tab bar. Tabs are added here as each
// stage of the port ships.
const TABS = [{ href: "/bench/consultants", label: "Consultants" }];

export function BenchTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-black/10 dark:border-white/10">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm whitespace-nowrap ${
              active
                ? "border-[#00acc1] font-medium text-black dark:text-white"
                : "border-transparent text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
