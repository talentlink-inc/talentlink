"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  type UserFormState,
} from "./actions";
import { USER_ROLES, USER_STATUSES } from "@/lib/users";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDateTime } from "@/lib/format";
import type { User } from "@/generated/prisma/client";

type Mode = "create" | "view" | "edit";

const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

export function UserModal({
  mode: initialMode,
  user,
  currentUserId,
  canEdit,
  onClose,
}: {
  mode: Mode;
  user: User | null;
  currentUserId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isForm = mode === "create" || mode === "edit";
  // Only set for the imperative reset-password flow (below) — the create
  // flow's generated password comes straight from action state instead, so
  // the auto-close effect never needs to setState from within itself.
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const action = user ? updateUser.bind(null, user.id) : createUser;
  const [state, formAction, formPending] = useActionState<UserFormState, FormData>(action, {
    error: null,
  });

  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (wasSubmitting.current && !formPending && !state.error && !state.generatedPassword) {
      onClose();
    }
    wasSubmitting.current = formPending;
  }, [formPending, state, onClose]);

  const shownPassword = state.generatedPassword ?? revealedPassword;
  if (shownPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-black">
          <h2 className="mb-2 text-lg font-semibold">Save this password</h2>
          <p className="mb-4 text-sm text-black/60 dark:text-white/60">
            This is shown once. Share it securely with the user — they can change it after signing in.
          </p>
          <div className="mb-4 flex items-center gap-2 rounded-md border border-black/15 bg-black/5 px-3 py-2 font-mono text-sm dark:border-white/15 dark:bg-white/5">
            <span className="flex-1 select-all">{shownPassword}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(shownPassword)}
              className="rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/15"
            >
              Copy
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Add User" : mode === "edit" ? "Edit User" : user?.name}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {mode === "view" && user && (
          <ViewUser
            user={user}
            isSelf={user.id === currentUserId}
            canEdit={canEdit}
            actionError={actionError}
            pending={pending}
            onEdit={() => setMode("edit")}
            onToggleStatus={() =>
              startTransition(async () => {
                const res = await toggleUserStatus(user.id);
                setActionError(res.error);
              })
            }
            onResetPassword={() =>
              startTransition(async () => {
                const res = await resetUserPassword(user.id);
                if (res.error) setActionError(res.error);
                else if (res.password) setRevealedPassword(res.password);
              })
            }
            onDelete={async () => {
              const res = await deleteUser(user.id);
              if (res.error) setActionError(res.error);
              else onClose();
            }}
          />
        )}

        {isForm && (
          <form action={formAction} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Full Name *</label>
              <input name="name" defaultValue={user?.name} required className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Email *</label>
              <input name="email" type="email" defaultValue={user?.email} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Role *</label>
              <select name="role" defaultValue={user?.role ?? "Recruiter"} className={inputClass}>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" defaultValue={user?.status ?? "active"} className={inputClass}>
                {USER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Phone</label>
              <input name="phone" defaultValue={user?.phone ?? ""} className={inputClass} />
            </div>

            <div className="col-span-2 rounded-md border border-black/10 p-3 dark:border-white/10">
              <p className="mb-2 text-xs font-medium text-black/60 dark:text-white/60">
                Candidate data visibility
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="canViewResume"
                    defaultChecked={user?.canViewResume ?? true}
                  />
                  View resumes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="canDownloadResume"
                    defaultChecked={user?.canDownloadResume ?? true}
                  />
                  Download resumes
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="canViewPhone" defaultChecked={user?.canViewPhone ?? true} />
                  View phone numbers
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="canViewEmail" defaultChecked={user?.canViewEmail ?? true} />
                  View email addresses
                </label>
              </div>
            </div>

            {state.error && <p className="col-span-2 text-sm text-red-600">{state.error}</p>}

            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => (user ? setMode("view") : onClose())}
                className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formPending}
                className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {formPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ViewUser({
  user,
  isSelf,
  canEdit,
  actionError,
  pending,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete,
}: {
  user: User;
  isSelf: boolean;
  canEdit: boolean;
  actionError: string | null;
  pending: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-black/50 dark:text-white/50">{label}</dt>
      <dd className="col-span-2">{value ?? "—"}</dd>
    </div>
  );

  return (
    <div>
      <dl className="divide-y divide-black/5 dark:divide-white/5">
        {row("Email", user.email)}
        {row("Phone", user.phone)}
        {row("Role", user.role)}
        {row(
          "Status",
          <span
            className={
              user.status === "active"
                ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            }
          >
            {user.status}
          </span>
        )}
        {row("Created", formatDateTime(user.createdAt))}
        {isSelf && row("This is you", "—")}
      </dl>

      {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}

      {canEdit && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <ConfirmButton
            onConfirm={onDelete}
            confirmText={`Delete user "${user.name}"?`}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          />
          <button
            type="button"
            disabled={pending}
            onClick={onResetPassword}
            className="rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15"
          >
            Reset Password
          </button>
          <button
            type="button"
            disabled={pending || isSelf}
            onClick={onToggleStatus}
            title={isSelf ? "You cannot deactivate your own account" : undefined}
            className="rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15"
          >
            {user.status === "active" ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={onEdit}
            className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
