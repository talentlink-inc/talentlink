"use client";

import { BadgeCheck, BriefcaseBusiness, CalendarClock, FileText, StickyNote } from "lucide-react";
import { SectionTabs, type SectionTab } from "@/components/ui/SectionTabs";

// GAS PageRecruitment.html's tabs (Requirements, Submissions, Interviews,
// Notes), plus Placements, which GAS kept as a separate page.
const TABS: SectionTab[] = [
  { href: "/requirements", label: "Requirements", icon: BriefcaseBusiness },
  { href: "/submissions", label: "Submissions", icon: FileText },
  { href: "/interviews", label: "Interviews", icon: CalendarClock },
  { href: "/placements", label: "Placements", icon: BadgeCheck },
  { href: "/team-notes", label: "Notes", icon: StickyNote },
];

export function RecruitmentTabs() {
  return <SectionTabs tabs={TABS} label="Recruitment sections" />;
}
