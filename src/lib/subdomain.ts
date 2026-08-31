// Pure Host-header parsing — no I/O, so it's cheap to call on every request
// from proxy.ts and easy to unit test on its own.
//
// NEXT_PUBLIC_ROOT_DOMAIN is unset until a real custom domain is attached in
// Vercel. Until then this always returns null, and callers fall back to the
// single-tenant DEFAULT_TENANT_SUBDOMAIN behavior — so wiring this in is a
// zero-risk change for the current production deployment.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

/**
 * Extracts the workspace subdomain from a request's Host header.
 * Returns null when the request isn't addressed to a specific workspace:
 * the bare root domain, `www`, the Vercel-assigned `*.vercel.app` domain, or
 * plain `localhost` with no subdomain.
 */
export function extractSubdomain(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();

  // Local dev convenience: `acme.localhost:3000` resolves to 127.0.0.1 in
  // every browser with no /etc/hosts edit, so subdomain routing is testable
  // right now without owning a domain yet.
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub && sub !== "www" ? sub : null;
  }

  if (ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    return sub && sub !== "www" ? sub : null;
  }

  return null;
}

/** True once a real custom root domain has been configured for the app. */
export function hasRootDomainConfigured(): boolean {
  return Boolean(ROOT_DOMAIN);
}

export function rootDomain(): string | undefined {
  return ROOT_DOMAIN;
}
