import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench } from "@/lib/users";
import { BenchTabs } from "./BenchTabs";

// Bench Sales is hidden from Recruiters/HR entirely (GAS viewBenchSales) —
// enforced here for every /bench page, not just by hiding the menu item.
export default async function BenchLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) redirect("/requirements");

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Bench Sales</h1>
      <BenchTabs />
      {children}
    </div>
  );
}
