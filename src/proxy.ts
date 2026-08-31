import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { extractSubdomain, hasRootDomainConfigured } from "@/lib/subdomain";

// Named `proxy.ts` (not `middleware.ts`) per the Next.js 16 rename — see
// node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md.
// Proxy defaults to the Node.js runtime in this Next.js version (stable
// since v15.5), so a direct Prisma/pg query here — used below to resolve the
// tenant by subdomain — is fully supported.
//
// Resolves the tenant from the request's Host header, then refreshes the
// Supabase session cookie and gates /(app) routes behind auth + 2FA.
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // These render before any tenant is known (or after a tenant lookup has
  // already failed), so they must never be re-entered into tenant resolution
  // themselves — that would loop.
  const isWorkspaceStatusRoute =
    pathname.startsWith("/workspace-not-found") || pathname.startsWith("/workspace-suspended");

  if (!isWorkspaceStatusRoute) {
    const host = request.headers.get("host");
    const subdomain = extractSubdomain(host);

    let tenantSubdomain: string | null = subdomain;
    if (!tenantSubdomain) {
      if (!hasRootDomainConfigured()) {
        // No custom domain attached yet — behave exactly like today's
        // single-tenant deployment. This is what keeps this change zero-risk
        // for the current production Vercel domain.
        tenantSubdomain = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";
      } else {
        // A custom root domain IS configured, but this request has no
        // workspace subdomain (bare root domain or `www`) — there's nowhere
        // to resolve a tenant yet since self-serve signup doesn't exist.
        const url = request.nextUrl.clone();
        url.pathname = "/workspace-not-found";
        url.search = "?reason=no-subdomain";
        return NextResponse.redirect(url);
      }
    }

    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: tenantSubdomain },
      select: { id: true, status: true },
    });

    if (!tenant) {
      const url = request.nextUrl.clone();
      url.pathname = "/workspace-not-found";
      url.search = `?subdomain=${encodeURIComponent(tenantSubdomain)}`;
      return NextResponse.redirect(url);
    }

    if (tenant.status === "suspended") {
      const url = request.nextUrl.clone();
      url.pathname = "/workspace-suspended";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Mutated in place, same as the cookie handling below — every
    // NextResponse.next({ request }) call downstream picks this up.
    request.headers.set("x-tenant-id", tenant.id);
  }

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

  const isAuthRoute = pathname.startsWith("/login");
  const isPublicRoute =
    isAuthRoute ||
    isWorkspaceStatusRoute ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/auth/"); // invite/callback/set-password — no session yet when these run

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
