"use client";

import { useState, useTransition } from "react";
import { startMfaEnrollment, verifyMfaEnrollment, disableMfa } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export function AccountSecurity({
  initialEnrolled,
  initialFactorId,
}: {
  initialEnrolled: boolean;
  initialFactorId: string | null;
}) {
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [factorId, setFactorId] = useState(initialFactorId);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function beginEnroll() {
    setError(null);
    startTransition(async () => {
      const res = await startMfaEnrollment();
      if (res.error || !res.factorId || !res.qrCode || !res.secret) {
        setError(res.error ?? "Could not start enrollment.");
        return;
      }
      setPendingFactorId(res.factorId);
      setQrCode(res.qrCode);
      setSecret(res.secret);
      setEnrolling(true);
    });
  }

  function verify() {
    if (!pendingFactorId) return;
    setError(null);
    startTransition(async () => {
      const res = await verifyMfaEnrollment(pendingFactorId, code);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEnrolled(true);
      setFactorId(pendingFactorId);
      setEnrolling(false);
      setCode("");
    });
  }

  function cancelEnroll() {
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode("");
    setError(null);
  }

  function disable() {
    if (!factorId) return;
    setError(null);
    startTransition(async () => {
      const res = await disableMfa(factorId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEnrolled(false);
      setFactorId(null);
    });
  }

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h2 className="mb-1 text-sm font-semibold">Two-Factor Authentication</h2>
      <p className="mb-3 text-sm text-black/50 dark:text-white/50">
        Adds a 6-digit code from an authenticator app (Google Authenticator, Authy, etc.) at sign-in.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {enrolled ? (
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
            Enabled
          </span>
          <ConfirmButton
            onConfirm={disable}
            label="Disable"
            confirmLabel="Yes, disable"
            confirmText="Disable two-factor authentication?"
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          />
        </div>
      ) : enrolling ? (
        <div>
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URI from Supabase, not an optimizable asset
            <img src={qrCode} alt="Scan this QR code in your authenticator app" width={180} height={180} className="mb-3" />
          )}
          {secret && (
            <p className="mb-3 rounded-md bg-black/5 px-2 py-1 font-mono text-xs break-all dark:bg-white/10">
              {secret}
            </p>
          )}
          <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">
            Enter the 6-digit code from your app
          </label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              className="w-32 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
            />
            <button
              onClick={verify}
              disabled={pending || code.length !== 6}
              className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {pending ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={cancelEnroll}
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={beginEnroll}
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Enable Two-Factor Authentication
        </button>
      )}
    </div>
  );
}
