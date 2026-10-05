import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench } from "@/lib/users";
import { PageHeader } from "@/components/ui/PageHeader";
import { InsightsTabs } from "./InsightsTabs";

// GAS's Dashboard and Reports, merged (see the Insights proposal): Overview is
// "what needs attention now"; the report tabs are "how did a period go".
export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div>
      <PageHeader title="Insights" subtitle="What needs attention now, and how each period went">
        <Suspense>
          <InsightsTabs canAccessBench={canAccessBench(user.role)} />
        </Suspense>
      </PageHeader>
      {children}
    </div>
  );
}
