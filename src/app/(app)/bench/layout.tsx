import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench } from "@/lib/users";
import { PageHeader } from "@/components/ui/PageHeader";
import { BenchTabs } from "./BenchTabs";

// Bench Sales is hidden from Recruiters/HR entirely (GAS viewBenchSales) —
// enforced here for every /bench page, not just by hiding the menu item.
export default async function BenchLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) redirect("/insights");

  return (
    <div>
      <PageHeader title="Bench Sales" subtitle="Our consultants, marketed to vendors and clients">
        <BenchTabs />
      </PageHeader>
      {children}
    </div>
  );
}
