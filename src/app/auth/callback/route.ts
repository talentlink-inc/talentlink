import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's own /auth/v1/verify endpoint validates the invite/magic-link
// token server-side, then redirects here with a PKCE `code` to exchange for
// a real session — this route is that exchange step.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/auth/set-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
