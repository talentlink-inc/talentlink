import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";
import { listTestCases, getCiSnapshots, listRunBatches } from "./actions";
import { TestSuiteBoard } from "./TestSuiteBoard";

export const dynamic = "force-dynamic";

export default async function TestSuitePage() {
  const currentUser = await getCurrentUser();
  if (!canManageUsers(currentUser.role)) redirect("/requirements");

  const [testCases, ciSnapshots, recentRuns] = await Promise.all([
    listTestCases(),
    getCiSnapshots(),
    listRunBatches(5),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Test Suite</h1>
      <p className="mb-6 text-sm text-black/50 dark:text-white/50">
        Every test category the app tracks — code-based suites run in CI, admin-defined checks run live.
      </p>
      <TestSuiteBoard
        initialTestCases={JSON.parse(JSON.stringify(testCases))}
        initialCiSnapshots={JSON.parse(JSON.stringify(ciSnapshots))}
        initialRecentRuns={JSON.parse(JSON.stringify(recentRuns))}
      />
    </div>
  );
}
