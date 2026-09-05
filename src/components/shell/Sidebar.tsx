"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FileText,
  Users,
  CalendarClock,
  Briefcase,
  ShieldCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const RECRUITMENT_NAV = [
  { href: "/requirements", label: "Requirements", icon: FileText },
  { href: "/submissions", label: "Submissions", icon: Users },
  { href: "/interviews", label: "Interviews", icon: CalendarClock },
  { href: "/placements", label: "Placements", icon: Briefcase },
];

export function Sidebar({
  canManageUsers,
  canAccessOps,
}: {
  canManageUsers: boolean;
  canAccessOps: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Reads localStorage after mount (not during the lazy useState initializer)
  // so the server-rendered and first-client-render markup match — collapse
  // state only applies once we're safely past hydration.
  useEffect(() => {
    if (localStorage.getItem("sidebarCollapsed") === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only API, not derivable during SSR
      setCollapsed(true);
    }
    setMounted(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }

  const navItem = (href: string, label: string, Icon: typeof FileText) => {
    const active = pathname?.startsWith(href);
    return (
      <li key={href}>
        <Link
          href={href}
          title={collapsed ? label : undefined}
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
            active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <nav
      className={`flex h-full shrink-0 flex-col text-white ${mounted ? "transition-[width] duration-150" : ""} ${
        collapsed ? "w-[64px]" : "w-[230px]"
      }`}
      style={{ background: "linear-gradient(180deg, #0d1257 0%, #1a237e 50%, #1a237e 100%)" }}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
        <img src="/logo-icon-dark.png" alt="TalentLink" width={28} height={20} className="shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[15px] leading-tight font-semibold">
              Talent<span className="text-orange-400">Link</span>
            </div>
            <div className="truncate text-[10px] leading-tight text-white/50">Digital Links Inc</div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {!collapsed && (
          <div className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-white/40">
            RECRUITMENT
          </div>
        )}
        <ul className="space-y-0.5">
          {RECRUITMENT_NAV.map((item) => navItem(item.href, item.label, item.icon))}
        </ul>

        {canManageUsers && (
          <>
            {!collapsed && (
              <div className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-white/40">
                ADMIN
              </div>
            )}
            <ul className="space-y-0.5">{navItem("/users", "User Management", ShieldCheck)}</ul>
          </>
        )}

        {canAccessOps && (
          <>
            {!collapsed && (
              <div className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-white/40">
                PLATFORM
              </div>
            )}
            <ul className="space-y-0.5">{navItem("/ops", "Platform Ops", Building2)}</ul>
          </>
        )}
      </div>

      <div className="border-t border-white/10 p-2">
        <button
          onClick={toggleCollapsed}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
