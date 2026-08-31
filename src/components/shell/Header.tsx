"use client";

import { usePathname } from "next/navigation";
import { GlobalSearch } from "./GlobalSearch";
import { UserMenu } from "./UserMenu";

const PAGE_TITLES: Record<string, string> = {
  "/requirements": "Requirements",
  "/submissions": "Submissions",
  "/interviews": "Interviews",
  "/placements": "Placements",
  "/users": "User Management",
};

export function Header({ user }: { user: { name: string; email: string; role: string } }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname ?? ""] ?? "TalentLink";

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-black/10 bg-white px-6 dark:border-white/10 dark:bg-black">
      <h1 className="w-56 shrink-0 truncate text-lg font-semibold">{title}</h1>
      <div className="flex flex-1 justify-center">
        <GlobalSearch />
      </div>
      <UserMenu user={user} />
    </header>
  );
}
