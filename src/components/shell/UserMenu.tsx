"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, UserCog } from "lucide-react";
import { signOut } from "@/app/login/actions";

export function UserMenu({ user }: { user: { name: string; email: string; role: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a237e] text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium">{user.name}</span>
          <span className="block text-xs leading-tight text-black/50 dark:text-white/50">{user.role}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-md border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          <div className="border-b border-black/10 px-3 py-2 text-xs text-black/50 dark:border-white/10 dark:text-white/50">
            {user.email}
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <UserCog size={14} />
            My Account
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
