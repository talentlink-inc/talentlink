"use client";

import { useActionState } from "react";
import { signUp } from "./actions";
import type { SignupFormState } from "./actions";

const initialState: SignupFormState = { error: null };

export function SignupForm({ domainSuffix }: { domainSuffix: string }) {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="mb-2 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size local icon, no need for next/image's optimizer */}
        <img src="/logo-icon-light.png" alt="TalentLink" width={48} height={34} />
        <h1 className="text-xl font-semibold">
          Create your Talent<span className="text-orange-500">Link</span> workspace
        </h1>
      </div>

      <input
        name="companyName"
        required
        placeholder="Company name"
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />

      <div>
        <div className="flex items-stretch overflow-hidden rounded-md border border-black/15 text-sm dark:border-white/15">
          <input
            name="subdomain"
            required
            placeholder="yourcompany"
            pattern="[a-z0-9][a-z0-9-]{1,61}[a-z0-9]"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
          />
          <span className="flex items-center whitespace-nowrap bg-black/5 px-3 text-black/50 dark:bg-white/10 dark:text-white/50">
            .{domainSuffix}
          </span>
        </div>
        <p className="mt-1 text-xs text-black/40 dark:text-white/40">
          This is your workspace&apos;s address — lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      <input
        name="name"
        required
        placeholder="Your name"
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="Work email"
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="Password (min. 8 characters)"
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>

      <p className="text-center text-xs text-black/40 dark:text-white/40">
        Already have a workspace?{" "}
        <a href="/login" className="underline">
          Sign in
        </a>
      </p>
    </form>
  );
}
