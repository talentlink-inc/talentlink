import { PageHeader } from "@/components/ui/PageHeader";
import { RecruitmentTabs } from "./RecruitmentTabs";

// One Recruitment section with tabs, like Bench Sales (and GAS's Recruitment
// page). A route group, so the URLs stay /requirements, /submissions, … and
// existing links and bookmarks keep working.
export default function RecruitmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader title="Recruitment" subtitle="Requirements, candidates and the pipeline to placement">
        <RecruitmentTabs />
      </PageHeader>
      {children}
    </div>
  );
}
