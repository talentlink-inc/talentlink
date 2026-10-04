"use client";

import { usePathname } from "next/navigation";
import { GlobalSearch } from "./GlobalSearch";
import { UserMenu } from "./UserMenu";

// Matched by path prefix, so nested routes (e.g. /bench/hotlist) get their
// section's title. Previously only five exact paths were listed and every
// other page showed a generic "TalentLink".
const PAGE_TITLES: [string, string][] = [
  ["/requirements", "Requirements"],
  ["/submissions", "Submissions"],
  ["/interviews", "Interviews"],
  ["/placements", "Placements"],
  ["/bench", "Bench Sales"],
  ["/users", "User Management"],
  ["/settings", "Settings"],
  ["/test-suite", "Test Suite"],
  ["/help", "Help Center"],
  ["/account", "My Account"],
  ["/onboarding", "Getting Started"],
  ["/ops", "Platform Ops"],
];

function titleFor(pathname: string): string {
  return PAGE_TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? "TalentLink";
}

export function Header({ user }: { user: { name: string; email: string; role: string } }) {
  const pathname = usePathname();
  const title = titleFor(pathname ?? "");

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-black/10 bg-white px-4 md:px-6 dark:border-white/10 dark:bg-black">
      <h1 className="hidden w-56 shrink-0 truncate text-lg font-semibold md:block">{title}</h1>
      <div className="flex flex-1 justify-center">
        <GlobalSearch />
      </div>
      <UserMenu user={user} />
    </header>
  );
}
