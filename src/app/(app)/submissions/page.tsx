import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const tenant = await getCurrentTenant();
  const submissions = await prisma.submission.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { candidate: true, requirement: true },
    orderBy: { submissionDate: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Submissions</h1>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Requirement</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Submitted</th>
              <th className="px-4 py-2">Bill Rate</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-4 py-2">{s.candidate.name}</td>
                <td className="px-4 py-2">
                  {s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "—"}
                </td>
                <td className="px-4 py-2">{s.status}</td>
                <td className="px-4 py-2">
                  {s.submissionDate?.toLocaleDateString() ?? "—"}
                </td>
                <td className="px-4 py-2">{s.billRate?.toString() ?? "—"}</td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  No submissions yet. Run the migration script to pull the recent 100 in.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
