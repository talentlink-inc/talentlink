"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { UserMenu } from "./UserMenu";

// The page title lives in the top bar, as in GAS: a section's first tab shows
// just the section ("Recruitment"); its other tabs show a breadcrumb
// ("Recruitment › Submissions").
type Crumb = { section: string; sectionHref: string; tab?: string };
const ROUTES: [string, Crumb][] = [
  ["/insights/recruitment", { section: "Insights", sectionHref: "/insights", tab: "Recruitment" }],
  ["/insights/bench", { section: "Insights", sectionHref: "/insights", tab: "Bench Sales" }],
  ["/insights/team", { section: "Insights", sectionHref: "/insights", tab: "Team" }],
  ["/insights", { section: "Insights", sectionHref: "/insights" }],
  ["/requirements", { section: "Recruitment", sectionHref: "/requirements" }],
  ["/submissions", { section: "Recruitment", sectionHref: "/requirements", tab: "Submissions" }],
  ["/interviews", { section: "Recruitment", sectionHref: "/requirements", tab: "Interviews" }],
  ["/placements", { section: "Recruitment", sectionHref: "/requirements", tab: "Placements" }],
  ["/team-notes", { section: "Recruitment", sectionHref: "/requirements", tab: "Notes" }],
  ["/bench/consultants", { section: "Bench Sales", sectionHref: "/bench/consultants" }],
  ["/bench/submissions", { section: "Bench Sales", sectionHref: "/bench/consultants", tab: "Submissions" }],
  ["/bench/placements", { section: "Bench Sales", sectionHref: "/bench/consultants", tab: "Placements" }],
  ["/bench/hotlist", { section: "Bench Sales", sectionHref: "/bench/consultants", tab: "Hotlist" }],
  ["/bench/interviews", { section: "Bench Sales", sectionHref: "/bench/consultants", tab: "Interviews" }],
  ["/bench/notes", { section: "Bench Sales", sectionHref: "/bench/consultants", tab: "Notes" }],
  ["/bench", { section: "Bench Sales", sectionHref: "/bench/consultants" }],
  ["/repository", { section: "Repository", sectionHref: "/repository" }],
  ["/users", { section: "User Management", sectionHref: "/users" }],
  ["/settings", { section: "Settings", sectionHref: "/settings" }],
  ["/test-suite", { section: "Test Suite", sectionHref: "/test-suite" }],
  ["/help", { section: "Help Center", sectionHref: "/help" }],
  ["/account", { section: "My Account", sectionHref: "/account" }],
  ["/onboarding", { section: "Getting Started", sectionHref: "/onboarding" }],
  ["/ops", { section: "Platform Ops", sectionHref: "/ops" }],
];

export function crumbFor(pathname: string): Crumb {
  return ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? { section: "TalentLink", sectionHref: "/insights" };
}

export function Header({ user }: { user: { name: string; email: string; role: string } }) {
  const crumb = crumbFor(usePathname() ?? "");
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-white px-4 md:px-7 dark:border-white/10 dark:bg-black">
      <div className="hidden min-w-0 shrink-0 items-center gap-1.5 text-lg font-semibold text-text-strong md:flex md:w-72 dark:text-white">
        {crumb.tab ? (
          <>
            <Link href={crumb.sectionHref} className="truncate hover:text-primary dark:hover:text-white/80">
              {crumb.section}
            </Link>
            <ChevronRight size={16} className="shrink-0 text-text-muted" aria-hidden />
            <span className="truncate">{crumb.tab}</span>
          </>
        ) : (
          <span className="truncate">{crumb.section}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 justify-center">
        <GlobalSearch />
      </div>
      <UserMenu user={user} />
    </header>
  );
}
