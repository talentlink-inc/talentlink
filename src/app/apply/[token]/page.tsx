import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { ApplyForm } from "./ApplyForm";
import type { ScreeningQuestion } from "@/lib/recruitment";

export const dynamic = "force-dynamic";

export default async function ApplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();

  const requirement = await db.requirement.findFirst({
    where: { tenantId: tenant.id, publicApplyToken: token, deletedAt: null },
    select: {
      id: true,
      jobTitle: true,
      jobDescription: true,
      clientName: true,
      employmentType: true,
      workLocation: true,
      isRemote: true,
      status: true,
      screeningQuestions: true,
    },
  });

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10 dark:bg-neutral-950">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
          <img src="/logo-icon-dark.png" alt={tenant.name} width={32} height={23} />
          <span className="text-lg font-semibold">
            Talent<span className="text-orange-500">Link</span>
          </span>
          <span className="text-sm text-black/40 dark:text-white/40">by {tenant.name}</span>
        </div>

        {!requirement ? (
          <div className="rounded-lg border border-black/10 bg-white p-6 text-center dark:border-white/10 dark:bg-black">
            <p className="text-sm text-black/60 dark:text-white/60">
              This application link is invalid or has expired.
            </p>
          </div>
        ) : requirement.status === "Closed" || requirement.status === "Filled" ? (
          <div className="rounded-lg border border-black/10 bg-white p-6 text-center dark:border-white/10 dark:bg-black">
            <h1 className="mb-2 text-lg font-semibold">{requirement.jobTitle}</h1>
            <p className="text-sm text-black/60 dark:text-white/60">
              This position is no longer accepting applications.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-black">
            <h1 className="mb-1 text-lg font-semibold">{requirement.jobTitle}</h1>
            <p className="mb-4 text-sm text-black/50 dark:text-white/50">
              {[requirement.clientName, requirement.employmentType, requirement.isRemote ? "Remote" : requirement.workLocation]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {requirement.jobDescription && (
              <div
                className="prose-sm mb-6 max-w-none border-b border-black/10 pb-6 text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 dark:border-white/10"
                dangerouslySetInnerHTML={{ __html: requirement.jobDescription }}
              />
            )}
            <ApplyForm
              token={token}
              questions={(requirement.screeningQuestions as unknown as ScreeningQuestion[] | null) ?? []}
            />
          </div>
        )}
      </div>
    </div>
  );
}
