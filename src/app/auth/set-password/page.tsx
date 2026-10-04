"use client";

import { useActionState } from "react";
import { setPassword } from "./actions";
import { buttonClass } from "@/components/ui/button";
import { toolbarInputClass } from "@/components/ui/table";

export default function SetPasswordPage() {
  const [error, formAction, pending] = useActionState(setPassword, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Set your password</h1>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="New password"
          className={`${toolbarInputClass} w-full`}
        />
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          placeholder="Confirm password"
          className={`${toolbarInputClass} w-full`}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "md", "w-full")}
        >
          {pending ? "Saving…" : "Set password"}
        </button>
      </form>
    </div>
  );
}
