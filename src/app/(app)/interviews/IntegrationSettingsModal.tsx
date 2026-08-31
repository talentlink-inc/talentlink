"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveIntegrationCredentials,
  disconnectIntegration,
  getIntegrationStatus,
} from "./integration-actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import type { IntegrationStatus } from "./integration-actions";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

export function IntegrationSettingsModal({
  status,
  connectError,
  onClose,
}: {
  status: IntegrationStatus;
  connectError: string | null;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<"google" | "microsoft">(status.provider ?? "google");
  const [localStatus, setLocalStatus] = useState(status);
  const [state, formAction, pending] = useActionState(saveIntegrationCredentials, { error: null });
  const [disconnecting, setDisconnecting] = useState(false);

  const wasSaving = useRef(false);
  useEffect(() => {
    if (wasSaving.current && !pending && !state.error) {
      getIntegrationStatus().then(setLocalStatus);
    }
    wasSaving.current = pending;
  }, [pending, state]);

  async function handleDisconnect() {
    setDisconnecting(true);
    await disconnectIntegration();
    setDisconnecting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Calendar Integration</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-sm text-black/60 dark:text-white/60">
          Connect a Microsoft or Google account so scheduling an interview automatically creates a
          calendar event and emails the candidate an invite.
        </p>

        {connectError && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950">
            Connection failed: {connectError}
          </p>
        )}

        {localStatus.isConnected ? (
          <div className="mb-4 rounded-md border border-black/10 p-3 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Connected
                </span>
                <p className="mt-1 text-sm">
                  {localStatus.provider === "google" ? "Google" : "Microsoft"}
                  {localStatus.connectedEmail && ` — ${localStatus.connectedEmail}`}
                </p>
              </div>
              <ConfirmButton
                onConfirm={handleDisconnect}
                label="Disconnect"
                confirmLabel="Yes, disconnect"
                confirmText="Disconnect this calendar account?"
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
              />
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <label className={labelClass}>Provider</label>
              <select
                name="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as "google" | "microsoft")}
                className={inputClass}
              >
                <option value="google">Google</option>
                <option value="microsoft">Microsoft</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Client ID</label>
              <input name="clientId" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Client Secret</label>
              <input name="clientSecret" type="password" required className={inputClass} />
            </div>
            {provider === "microsoft" && (
              <div>
                <label className={labelClass}>Tenant ID</label>
                <input name="microsoftTenantId" required className={inputClass} />
              </div>
            )}

            {state.error && <p className="text-sm text-red-600">{state.error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {localStatus.hasCredentials && !localStatus.isConnected && (
          <a
            href={`/api/integrations/${localStatus.provider ?? provider}/authorize`}
            className="inline-block rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Connect {localStatus.provider === "microsoft" ? "Microsoft" : "Google"} Account
          </a>
        )}

        {disconnecting && <p className="mt-3 text-sm text-black/50 dark:text-white/50">Disconnecting…</p>}
      </div>
    </div>
  );
}
