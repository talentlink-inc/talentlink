"use client";

import { GlobalSearch } from "./GlobalSearch";
import { UserMenu } from "./UserMenu";

export function Header({ user }: { user: { name: string; email: string; role: string } }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-black/10 bg-white px-4 md:px-6 dark:border-white/10 dark:bg-black">
      {/* The page's own slate header carries its title (design review:
          remove the duplicate title), so the top bar is search + account. */}
      <div className="flex flex-1 justify-center">
        <GlobalSearch />
      </div>
      <UserMenu user={user} />
    </header>
  );
}
