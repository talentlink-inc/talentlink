"use client";

import { useMemo, useRef, useState } from "react";
import { UserModal } from "./UserModal";
import { USER_ROLES } from "@/lib/users";
import { formatDate } from "@/lib/format";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { rowSelectClass } from "@/lib/tableRow";
import { StatusChip } from "@/components/ui/StatusChip";
import { SoftChip } from "@/components/ui/Chips";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass, rowClass } from "@/components/ui/table";
import type { User } from "@/generated/prisma/client";

export function UsersTable({ users, currentUserId, canEdit }: { users: User[]; currentUserId: string; canEdit: boolean }) {
  // Stores the id, not the row object — actions like toggle-status/reset
  // password mutate server-side and revalidate without closing the modal, so
  // the modal must look the user up fresh from `users` on every render
  // rather than hold a stale snapshot from when it was opened.
  const [modal, setModal] = useState<{ mode: "create" | "view" | "edit"; userId: string | null } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cell = useCellClass();
  const open = (u: User) => {
    setSelectedId(u.id);
    setModal({ mode: "view", userId: u.id });
  };

  useOpenParam((id) => {
    const found = users.find((u) => u.id === id);
    if (found) open(found);
  });

  usePageShortcuts({
    onNew: canEdit ? () => setModal({ mode: "create", userId: null }) : undefined,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search by name, email, or role"
          placeholder="Search name, email, role…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          {canEdit && (
            <button type="button" onClick={() => setModal({ mode: "create", userId: null })} className={buttonClass("primary")}>
              + Add user
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Users">
        {filtered.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => open(u)}
              className={`w-full rounded-[10px] border border-line bg-white p-3 text-left shadow-sm dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(u.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-1 text-xs font-normal text-black/40 dark:text-white/40">(you)</span>
                  )}
                </span>
                <StatusChip status={u.status} />
              </div>
              <div className="mt-1 truncate text-sm text-text-secondary">{u.email}</div>
              <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                {u.role} · Added {formatDate(u.createdAt)}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className={emptyCellClass}>{users.length === 0 ? "No users yet." : "No users match your filters."}</li>
        )}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[720px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Name</th>
              <th className={cell}>Email</th>
              <th className={cell}>Role</th>
              <th className={cell}>Status</th>
              <th className={cell}>Added</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => open(u)}
                className={`cursor-pointer ${rowClass} ${rowSelectClass(u.id === selectedId)}`}
              >
                <td className={`${cell} font-semibold text-text-strong dark:text-white`}>
                  {u.name}
                  {u.id === currentUserId && <span className="ml-1 text-xs text-black/40 dark:text-white/40">(you)</span>}
                </td>
                <td className={cell}>{u.email}</td>
                <td className={cell}>
                  <SoftChip>{u.role}</SoftChip>
                </td>
                <td className={cell}>
                  <StatusChip status={u.status} />
                </td>
                <td className={`${cell} whitespace-nowrap`}>{formatDate(u.createdAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className={emptyCellClass}>
                  {users.length === 0 ? "No users yet." : "No users match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal
          key={`${modal.mode}-${modal.userId ?? "new"}`}
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
