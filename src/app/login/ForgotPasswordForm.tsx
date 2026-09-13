"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { error: null, sent: false };

export function ForgotPasswordForm({
  initialEmail,
  onBack,
}: {
  initialEmail: string;
  onBack: () => void;
}) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  const [email, setEmail] = useState(initialEmail);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="mb-2 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
        <img src="/logo-icon-light.png" alt="TalentLink" width={48} height={34} />
        <h1 className="text-xl font-semibold">Reset your password</h1>
      </div>

      {state.sent ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          If an account exists for that email, a password reset link is on its way — check your
          inbox.
        </p>
      ) : (
        <>
          <p className="text-sm text-black/50 dark:text-white/50">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-black/50 hover:underline dark:text-white/50"
      >
        Back to Sign In
      </button>
    </form>
  );
}
