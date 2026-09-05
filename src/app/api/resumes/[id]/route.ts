import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin, RESUME_BUCKET } from "@/lib/supabase/admin";

// The resumes bucket is private, so files aren't reachable by a plain public
// URL — this route checks tenant ownership and the current user's data
// permissions, then redirects to a short-lived signed URL from Supabase
// Storage. ?download=1 forces an attachment disposition instead of inline view.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();

  const isDownload = new URL(request.url).searchParams.get("download") === "1";
  if (isDownload ? !currentUser.canDownloadResume : !currentUser.canViewResume) {
    return NextResponse.json({ error: "You don't have permission to access resumes." }, { status: 403 });
  }

  const db = await getTenantDb();
  const resume = await db.resume.findUnique({ where: { id } });
  if (!resume || resume.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await getSupabaseAdmin()
    .storage.from(RESUME_BUCKET)
    .createSignedUrl(resume.fileUrl, 60, isDownload ? { download: resume.fileName ?? true } : undefined);

  if (error || !data) {
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
