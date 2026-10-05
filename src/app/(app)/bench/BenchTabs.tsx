"use client";

import { BadgeCheck, CalendarClock, Flame, Send, StickyNote, Users } from "lucide-react";
import { SectionTabs, type SectionTab } from "@/components/ui/SectionTabs";

// Mirrors GAS PageBenchSales.html's tab bar, in the same order.
const TABS: SectionTab[] = [
  { href: "/bench/consultants", label: "Consultants", icon: Users },
  { href: "/bench/submissions", label: "Submissions", icon: Send },
  { href: "/bench/placements", label: "Placements", icon: BadgeCheck },
  { href: "/bench/hotlist", label: "Hotlist", icon: Flame },
  { href: "/bench/interviews", label: "Interviews", icon: CalendarClock },
  { href: "/bench/notes", label: "Notes", icon: StickyNote },
];

export function BenchTabs() {
  return <SectionTabs tabs={TABS} label="Bench Sales sections" />;
}
