import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Named `proxy.ts` (not `middleware.ts`) per the Next.js 16 rename — see
// node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md.
// Refreshes the Supabase session cookie on every request and gates /(app) routes
// behind auth. Phase 1 is single-tenant, so there's no subdomain resolution here
// yet — that gets added when a second tenant is onboarded.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isPublicRoute =
    isAuthRoute ||
    request.nextUrl.pathname.startsWith("/api/health") ||
    request.nextUrl.pathname.startsWith("/auth/"); // invite/callback/set-password — no session yet when these run

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Password-verified but TOTP-enrolled sessions sit at aal1 until the code
  // is verified — without this check they'd otherwise pass the `user` check
  // above and reach protected pages without ever completing the second factor.
  if (user && !isPublicRoute) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/login/verify";
      return NextResponse.redirect(verifyUrl);
    }
  }

  return response;
}

export const config = {
  // Excludes framework internals and static files served from /public (e.g.
  // the logo shown on the login page itself, which must load before any
  // session exists) from the auth gate entirely.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif)$).*)"],
};
