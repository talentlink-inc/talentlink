"use client";

import { useSearchParams } from "next/navigation";
import { BriefcaseBusiness, LayoutDashboard, UserRoundSearch, UsersRound } from "lucide-react";
import { SectionTabs, type SectionTab } from "@/components/ui/SectionTabs";

// Overview · Recruitment · Bench Sales · Team. The chosen period (?period=…)
// carries across the report tabs, so switching tabs doesn't reset it.
export function InsightsTabs({ canAccessBench }: { canAccessBench: boolean }) {
  const params = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["period", "from", "to"]) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  const q = keep.toString() ? `?${keep}` : "";
  const tabs: SectionTab[] = [
    { href: "/insights", label: "Overview", icon: LayoutDashboard },
    { href: "/insights/recruitment", label: "Recruitment", icon: UserRoundSearch },
    ...(canAccessBench ? [{ href: "/insights/bench", label: "Bench Sales", icon: BriefcaseBusiness }] : []),
    { href: "/insights/team", label: "Team", icon: UsersRound },
  ];
  return <SectionTabs tabs={tabs} label="Insights sections" query={q} exact={["/insights"]} />;
}
