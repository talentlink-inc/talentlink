"use client";

import { useActionState } from "react";
import { verifyMfaLogin } from "./actions";

export default function VerifyMfaPage() {
  const [error, formAction, pending] = useActionState(verifyMfaLogin, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Two-Factor Verification</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Enter the 6-digit code from your authenticator app.
        </p>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          placeholder="123456"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-center text-lg tracking-widest dark:border-white/15 dark:bg-transparent"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Verifying…" : "Verify"}
        </button>
      </form>
    </div>
  );
}
