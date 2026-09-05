import { getCurrentTenant } from "@/lib/tenant";
import { getTenantDb } from "@/lib/tenantDb";
import { getMfaStatus } from "../account/actions";
import { OnboardingChecklist } from "./OnboardingChecklist";

export const dynamic = "force-dynamic";

// Every item here already exists elsewhere in the app — this page just
// surfaces what's already true (or not) about the tenant's own data, so a
// new workspace's progress is visible in one place instead of buried across
// four different pages.
export default async function OnboardingPage() {
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();

  const [userCount, requirementCount, calendarIntegration, mfa] = await Promise.all([
    db.user.count(),
    db.requirement.count({ where: { deletedAt: null } }),
    db.calendarIntegration.findUnique({ where: { tenantId: tenant.id } }),
    getMfaStatus(),
  ]);

  const items = [
    {
      key: "team",
      title: "Invite your team",
      description: "Assign Admin, Manager, Recruiter, Bench Sales, or HR roles",
      done: userCount > 1,
      href: "/users",
      actionLabel: "Invite",
    },
    {
      key: "requirement",
      title: "Add your first requirement",
      description: "Post a job or paste in an existing JD",
      done: requirementCount > 0,
      href: "/requirements",
      actionLabel: "Add",
    },
    {
      key: "calendar",
      title: "Connect your calendar",
      description: "Google or Microsoft — auto-creates interview invites",
      done: !!calendarIntegration?.accessToken,
      href: "/interviews",
      actionLabel: "Connect",
    },
    {
      key: "2fa",
      title: "Turn on two-factor authentication",
      description: "Recommended for every Admin account",
      done: mfa.enrolled,
      href: "/account",
      actionLabel: "Enable",
    },
  ];

  return <OnboardingChecklist tenantName={tenant.name} items={items} />;
}
