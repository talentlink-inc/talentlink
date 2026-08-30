import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { getSupabaseAdmin, RESUME_BUCKET } from "@/lib/supabase/admin";

// The resumes bucket is private, so files aren't reachable by a plain public
// URL — this route checks tenant ownership, then redirects to a short-lived
// signed URL from Supabase Storage.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();

  const resume = await prisma.resume.findUnique({ where: { id } });
  if (!resume || resume.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await getSupabaseAdmin()
    .storage.from(RESUME_BUCKET)
    .createSignedUrl(resume.fileUrl, 60);

  if (error || !data) {
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
