import { headers } from "next/headers";
import { hasRootDomainConfigured, isLocalDevHost, rootDomain } from "@/lib/subdomain";
import { SignupForm } from "./SignupForm";

// Self-serve signup is only meaningful once tenants can actually reach their
// own subdomain: either a custom root domain is attached in production, or
// we're in local dev (testable via *.localhost right now, with no domain
// owned yet). Otherwise there's nowhere for a new workspace to live.
export default async function SignupPage() {
  const host = (await headers()).get("host");
  const signupOpen = hasRootDomainConfigured() || isLocalDevHost(host);

  if (!signupOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-3 text-center">
          <div className="mb-2 flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
            <img src="/logo-icon-light.png" alt="TalentLink" width={48} height={34} />
            <h1 className="text-xl font-semibold">
              Talent<span className="text-orange-500">Link</span>
            </h1>
          </div>
          <p className="text-sm text-black/60 dark:text-white/60">
            Self-serve sign-up isn&apos;t open yet. Contact us to get your company set up.
          </p>
        </div>
      </div>
    );
  }

  const domainSuffix = isLocalDevHost(host) ? "localhost:3000" : (rootDomain() ?? "");

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <SignupForm domainSuffix={domainSuffix} />
    </div>
  );
}
