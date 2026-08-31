"use client";

import { useMemo, useState } from "react";
import { UserModal } from "./UserModal";
import { USER_ROLES } from "@/lib/users";
import { formatDate } from "@/lib/format";
import { useOpenParam } from "@/lib/useOpenParam";
import type { User } from "@/generated/prisma/client";

export function UsersTable({
  users,
  currentUserId,
  canEdit,
}: {
  users: User[];
  currentUserId: string;
  canEdit: boolean;
}) {
  // Stores the id, not the row object — actions like toggle-status/reset
  // password mutate server-side and revalidate without closing the modal, so
  // the modal must look the user up fresh from `users` on every render
  // rather than hold a stale snapshot from when it was opened.
  const [modal, setModal] = useState<{ mode: "create" | "view" | "edit"; userId: string | null } | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useOpenParam((id) => {
    const found = users.find((u) => u.id === id);
    if (found) setModal({ mode: "view", userId: found.id });
  });

  const modalUser = modal?.userId ? (users.find((u) => u.id === modal.userId) ?? null) : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (q) {
        const haystack = `${u.name} ${u.email} ${u.role}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">User Management</h1>
        {canEdit && (
          <button
            onClick={() => setModal({ mode: "create", userId: null })}
            className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            + Add User
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or role..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => setModal({ mode: "view", userId: u.id })}
                className="cursor-pointer border-t border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-1 text-xs text-black/40 dark:text-white/40">(you)</span>
                  )}
                </td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.role}</td>
                <td className="px-4 py-2">{u.status}</td>
                <td className="px-4 py-2">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {users.length === 0 ? "No users yet." : "No users match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal
          mode={modal.mode}
          user={modalUser}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
