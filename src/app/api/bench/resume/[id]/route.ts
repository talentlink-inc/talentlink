import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBench } from "@/lib/users";
import { getSupabaseAdmin, RESUME_BUCKET } from "@/lib/supabase/admin";

// Bench consultant resume — same private-bucket + short-lived signed URL
// pattern as /api/resumes/[id]. Permission mirrors GAS
// getBenchResumeForView/downloadBenchResume: the consultant's own marketer
// always can; anyone else needs the canViewResume/canDownloadResume flag.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const user = await getCurrentUser();
  if (!canAccessBench(user.role)) {
    return NextResponse.json({ error: "You don't have access to Bench Sales." }, { status: 403 });
  }

  const db = await getTenantDb();
  const consultant = await db.benchConsultant.findFirst({ where: { id, tenantId: tenant.id, deletedAt: null } });
  if (!consultant?.resumeFileUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isDownload = new URL(request.url).searchParams.get("download") === "1";
  const isOwn = consultant.marketerUserId === user.id;
  const allowed = isOwn || (isDownload ? user.canDownloadResume : user.canViewResume);
  if (!allowed) return NextResponse.json({ error: "You don't have permission to access resumes." }, { status: 403 });

  const { data, error } = await getSupabaseAdmin()
    .storage.from(RESUME_BUCKET)
    .createSignedUrl(consultant.resumeFileUrl, 60, isDownload ? { download: consultant.resumeFileName ?? true } : undefined);
  if (error || !data) return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
