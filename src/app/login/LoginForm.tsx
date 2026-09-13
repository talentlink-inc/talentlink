"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

function LoginFormInner({ tenantName }: { tenantName: string }) {
  const [error, formAction, pending] = useActionState(signIn, null);
  const searchParams = useSearchParams();
  const deactivated = searchParams.get("deactivated") === "1";

  // Plain (uncontrolled) inputs get wiped by React after every action
  // dispatch, error or not — controlled state is what keeps a failed
  // attempt's email/password on screen so the user can just fix the typo
  // instead of retyping both fields from scratch.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (showForgotPassword) {
    return (
      <ForgotPasswordForm initialEmail={email} onBack={() => setShowForgotPassword(false)} />
    );
  }

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="mb-2 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
        <img src="/logo-icon-light.png" alt="TalentLink" width={48} height={34} />
        <h1 className="text-xl font-semibold">
          Sign in to Talent<span className="text-orange-500">Link</span>
        </h1>
        <p className="text-xs text-black/40 dark:text-white/40">by {tenantName}</p>
      </div>
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />
      <input
        name="password"
        type="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className="text-xs text-black/50 hover:underline dark:text-white/50"
        >
          Forgot Password?
        </button>
      </div>
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

export function LoginForm({ tenantName }: { tenantName: string }) {
  return (
    <Suspense>
      <LoginFormInner tenantName={tenantName} />
    </Suspense>
  );
}
