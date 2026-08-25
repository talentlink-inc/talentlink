import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { QUALIFYING_PLACEMENT_STATUSES } from "@/lib/recruitment";

export const dynamic = "force-dynamic";

// Placements aren't a separate entity — they're submissions that reached a
// qualifying status (Client_Selected / Background_Check / Onboarding /
// Started_Billable), matching QUALIFYING_PLACEMENT_STATUSES in the source
// app's Recruitment.js.
export default async function PlacementsPage() {
  const tenant = await getCurrentTenant();
  const placements = await prisma.submission.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: { in: [...QUALIFYING_PLACEMENT_STATUSES] },
    },
    include: { candidate: true, requirement: true },
    orderBy: { selectedDate: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Placements</h1>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Placement ID</th>
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Requirement</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Selected</th>
              <th className="px-4 py-2">DOJ</th>
              <th className="px-4 py-2">Bill Rate</th>
            </tr>
          </thead>
          <tbody>
            {placements.map((p) => (
              <tr key={p.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-4 py-2 font-mono text-xs">{p.placementId ?? "—"}</td>
                <td className="px-4 py-2">{p.candidate.name}</td>
                <td className="px-4 py-2">
                  {p.requirement?.jobTitle ?? p.requirementJobIdRaw ?? "—"}
                </td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">{p.selectedDate?.toLocaleDateString() ?? "—"}</td>
                <td className="px-4 py-2">{p.doj?.toLocaleDateString() ?? "—"}</td>
                <td className="px-4 py-2">{p.billRate?.toString() ?? "—"}</td>
              </tr>
            ))}
            {placements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  No placements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
