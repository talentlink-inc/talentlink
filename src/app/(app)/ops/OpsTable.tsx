"use client";

import { useMemo, useState, useTransition } from "react";
import { toggleTenantStatus } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDate } from "@/lib/format";
import type { TenantWithStats } from "./types";

export function OpsTable({ tenants }: { tenants: TenantWithStats[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(
    () => ({
      total: tenants.length,
      active: tenants.filter((t) => t.status === "active").length,
      suspended: tenants.filter((t) => t.status === "suspended").length,
    }),
    [tenants]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (q && !`${t.name} ${t.subdomain}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tenants, search, statusFilter]);

  function handleToggle(tenantId: string) {
    setPendingId(tenantId);
    startTransition(async () => {
      await toggleTenantStatus(tenantId);
      setPendingId(null);
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Platform Ops</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Every workspace on TalentLink — visible only to Digital Links Inc staff.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-md">
        <div className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/10">
          <div className="text-lg font-semibold tabular-nums">{stats.total}</div>
          <div className="text-xs text-black/50 dark:text-white/50">Total</div>
        </div>
        <div className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/10">
          <div className="text-lg font-semibold tabular-nums text-green-700 dark:text-green-400">
            {stats.active}
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">Active</div>
        </div>
        <div className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/10">
          <div className="text-lg font-semibold tabular-nums text-red-700 dark:text-red-400">
            {stats.suspended}
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">Suspended</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company or subdomain..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Users</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-4 py-2">
                  <div className="font-medium">{t.name}</div>
                  <div className="font-mono text-xs text-black/40 dark:text-white/40">{t.subdomain}</div>
                </td>
                <td className="px-4 py-2">{t.plan}</td>
                <td className="px-4 py-2 tabular-nums">{t.userCount}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.status === "suspended"
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-2">{formatDate(t.createdAt)}</td>
                <td className="px-4 py-2 text-right">
                  {t.status === "suspended" ? (
                    <button
                      onClick={() => handleToggle(t.id)}
                      disabled={isPending && pendingId === t.id}
                      className="rounded-md border border-black/15 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-white/15"
                    >
                      {isPending && pendingId === t.id ? "Reactivating…" : "Reactivate"}
                    </button>
                  ) : (
                    <ConfirmButton
                      onConfirm={() => handleToggle(t.id)}
                      label="Suspend"
                      confirmLabel="Yes, suspend"
                      confirmText={`Suspend ${t.name}? Every user there is redirected to a "workspace suspended" page immediately.`}
                      className="rounded-md border border-black/15 px-3 py-1.5 text-xs text-red-700 dark:border-white/15 dark:text-red-400"
                    />
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {tenants.length === 0 ? "No workspaces yet." : "No workspaces match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
