import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin, RESUME_BUCKET } from "@/lib/supabase/admin";

// Same private-bucket-plus-signed-URL pattern as /api/resumes/[id], but for
// the second "Visa & Other Documents" upload slot — those aren't their own
// Resume row (no id to look up), just a raw storage path on the Submission,
// so tenant ownership is checked by requiring the path be prefixed with the
// current tenant's own id (exactly how uploadDocumentIfPresent writes it).
export async function GET(request: Request) {
  const tenant = await getCurrentTenant();
  const currentUser = await getCurrentUser();

  const path = new URL(request.url).searchParams.get("path");
  if (!path || !path.startsWith(`${tenant.id}/documents/`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!currentUser.canViewResume) {
    return NextResponse.json({ error: "You don't have permission to access documents." }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin().storage.from(RESUME_BUCKET).createSignedUrl(path, 60);
  if (error || !data) {
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
