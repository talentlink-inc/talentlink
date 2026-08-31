"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";

function LoginForm() {
  const [error, formAction, pending] = useActionState(signIn, null);
  const searchParams = useSearchParams();
  const deactivated = searchParams.get("deactivated") === "1";

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="mb-2 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
        <img src="/logo-icon-light.png" alt="TalentLink" width={48} height={34} />
        <h1 className="text-xl font-semibold">
          Sign in to Talent<span className="text-orange-500">Link</span>
        </h1>
        <p className="text-xs text-black/40 dark:text-white/40">by Digital Links Inc</p>
      </div>
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="Password"
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />
      {deactivated && (
        <p className="text-sm text-red-600">Your account has been deactivated. Contact an admin for access.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
