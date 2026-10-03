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
  Rocket,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LogOut,
  Settings,
  FlaskConical,
  BriefcaseBusiness,
} from "lucide-react";
import { signOut } from "@/app/login/actions";

// How often to poll for a newer deployed version. New builds happen at most
// a few times a day, so this favors keeping the check cheap over near-instant
// detection — a manual page refresh always shows the on-focus check anyway.
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Matches the GAS app's sidebar as the team actually uses it: its
// "pattern-grid" theme (Index.html THEMES) — slate with a faint 48px grid —
// plus GAS's brand accent (#34d399) and active-item bar (--secondary).
const SIDEBAR_GRID_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><path d='M 48 0 L 0 0 0 48' fill='none' stroke='rgba(255,255,255,0.06)' stroke-width='1'/></svg>";
const SIDEBAR_BACKGROUND = `url("data:image/svg+xml;utf8,${encodeURIComponent(SIDEBAR_GRID_SVG)}") repeat, #37474f`;

const RECRUITMENT_NAV = [
  { href: "/requirements", label: "Requirements", icon: FileText },
  { href: "/submissions", label: "Submissions", icon: Users },
  { href: "/interviews", label: "Interviews", icon: CalendarClock },
  { href: "/placements", label: "Placements", icon: Briefcase },
];

export function Sidebar({
  canManageUsers,
  canManageSettings,
  canAccessTestSuite,
  canAccessOps,
  canAccessBench,
  tenantName,
  logoStyle,
  appVersion,
}: {
  canManageUsers: boolean;
  canManageSettings: boolean;
  canAccessTestSuite: boolean;
  canAccessOps: boolean;
  canAccessBench: boolean;
  tenantName: string;
  logoStyle: string;
  appVersion: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Detects a newer deployment the same way the original GAS app's release
  // badge does — poll a version endpoint and compare against what this tab
  // loaded with; a mismatch means the server has redeployed underneath us.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.version && data.version !== appVersion) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or a blip — next interval/focus retries, nothing to show.
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") check();
    }
    check();
    const interval = setInterval(check, VERSION_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [appVersion]);

  // Reads localStorage after mount (not during the lazy useState initializer)
  // so the server-rendered and first-client-render markup match — collapse
  // state only applies once we're safely past hydration.
  useEffect(() => {
    // On a phone-width screen the expanded 230px sidebar took half the
    // viewport, so start collapsed there — without persisting it, so the
    // desktop preference in localStorage is left alone.
    const isNarrow = window.matchMedia("(max-width: 767px)").matches;
    if (isNarrow || localStorage.getItem("sidebarCollapsed") === "true") {
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
          className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
            active ? "bg-white/[0.12] text-white" : "text-white/60 hover:bg-white/[0.08] hover:text-white/90"
          }`}
        >
          {active && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-[3px] bg-[#00acc1]" />}
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
      style={{ background: SIDEBAR_BACKGROUND }}
    >
      <div className="border-b border-white/10 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {logoStyle !== "wordmark" && (
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
              <img src="/logo-icon-dark.png" alt="TalentLink" width={28} height={20} />
              {collapsed && updateAvailable && (
                <span
                  title="An update is available"
                  className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-yellow-400 ring-2 ring-[#37474f]"
                />
              )}
            </div>
          )}
          {!collapsed && logoStyle !== "people" && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] leading-tight font-semibold">
                Talent<span className="text-[#34d399]">Link</span>
              </div>
              <div className="truncate text-[10px] leading-tight text-white/50">{tenantName}</div>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="ml-auto shrink-0 rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        {!collapsed && (
          <div className="mt-1.5 flex items-center justify-end gap-2">
            {updateAvailable && (
              <button
                onClick={() => window.location.reload()}
                title="A new version has been deployed — click to refresh"
                className="flex animate-pulse items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-semibold text-black hover:bg-yellow-300"
              >
                <RefreshCw size={10} />
                Update available
              </button>
            )}
            <span className="truncate font-mono text-[9px] font-bold tracking-wide text-emerald-400">
              v{appVersion}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-0.5 pt-2">{navItem("/onboarding", "Getting Started", Rocket)}</ul>

        {!collapsed && (
          <div className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-white/40">
            RECRUITMENT
          </div>
        )}
        <ul className="space-y-0.5">
          {RECRUITMENT_NAV.map((item) => navItem(item.href, item.label, item.icon))}
        </ul>

        {canAccessBench && (
          <>
            {!collapsed && (
              <div className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-white/40">
                SALES
              </div>
            )}
            <ul className="space-y-0.5">{navItem("/bench", "Bench Sales", BriefcaseBusiness)}</ul>
          </>
        )}

        {(canManageUsers || canManageSettings || canAccessTestSuite) && (
          <>
            {!collapsed && (
              <div className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-white/40">
                ADMIN
              </div>
            )}
            <ul className="space-y-0.5">
              {canManageUsers && navItem("/users", "User Management", ShieldCheck)}
              {canManageSettings && navItem("/settings", "Settings", Settings)}
              {canAccessTestSuite && navItem("/test-suite", "Test Suite", FlaskConical)}
            </ul>
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
        <form action={signOut}>
          <button
            type="submit"
            title={collapsed ? "Sign Out" : undefined}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-300/80 hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </form>
      </div>
    </nav>
  );
}
