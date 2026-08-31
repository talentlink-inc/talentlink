"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function WorkspaceNotFoundContent() {
  const searchParams = useSearchParams();
  const subdomain = searchParams.get("subdomain");
  const reason = searchParams.get("reason");

  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className="mb-2 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
        <img src="/logo-icon-light.png" alt="TalentLink" width={48} height={34} />
        <h1 className="text-xl font-semibold">
          Talent<span className="text-orange-500">Link</span>
        </h1>
      </div>
      {reason === "no-subdomain" ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Enter your workspace&apos;s address to continue — for example{" "}
          <span className="font-mono">yourcompany.talentlink.com</span>.
        </p>
      ) : (
        <p className="text-sm text-black/60 dark:text-white/60">
          We couldn&apos;t find a workspace
          {subdomain ? (
            <>
              {" "}
              at <span className="font-mono">{subdomain}</span>
            </>
          ) : null}
          . Check the address, or contact your workspace admin for an invite link.
        </p>
      )}
    </div>
  );
}

export default function WorkspaceNotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Suspense>
        <WorkspaceNotFoundContent />
      </Suspense>
    </div>
  );
}
