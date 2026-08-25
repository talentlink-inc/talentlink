import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const tenant = await getCurrentTenant();
  const interviews = await prisma.interview.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { submission: { include: { candidate: true } } },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Interviews</h1>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Scheduled</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((i) => (
              <tr key={i.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-4 py-2">{i.submission.candidate.name}</td>
                <td className="px-4 py-2">{i.interviewType}</td>
                <td className="px-4 py-2">
                  {i.scheduledAt?.toLocaleString() ?? "—"}
                </td>
                <td className="px-4 py-2">{i.mode ?? "—"}</td>
                <td className="px-4 py-2">{i.clientCompany ?? "—"}</td>
                <td className="px-4 py-2">{i.status}</td>
              </tr>
            ))}
            {interviews.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  No interviews yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
