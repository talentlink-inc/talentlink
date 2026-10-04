"use client";

import { useMemo, useRef, useState } from "react";
import { ConsultantModal, type ConsultantViewer } from "./ConsultantModal";
import { formatDate } from "@/lib/format";
import { BENCH_CONSULTANT_STATUSES, relocationLabel } from "@/lib/bench";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import type { SerializedConsultant } from "./types";

// GAS PageBenchSales.html status colors (statusColors).
const STATUS_STYLES: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Marketing: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  Placed: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300",
  "On Hold": "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/60",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_STYLES[status] ?? STATUS_STYLES["On Hold"]}`}>
      {status}
    </span>
  );
}

export function ConsultantsTable({
  consultants,
  currentUser,
}: {
  consultants: SerializedConsultant[];
  currentUser: ConsultantViewer;
}) {
  const [modal, setModal] = useState<{ mode: "create" | "view"; consultant: SerializedConsultant | null } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [visaFilter, setVisaFilter] = useState("");
  const [hotlistOnly, setHotlistOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const open = (c: SerializedConsultant) => {
    setSelectedId(c.id);
    setModal({ mode: "view", consultant: c });
  };

  useOpenParam((id) => {
    const found = consultants.find((c) => c.id === id);
    if (found) open(found);
  });

  usePageShortcuts({
    onNew: () => setModal({ mode: "create", consultant: null }),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of BENCH_CONSULTANT_STATUSES) c[s] = 0;
    for (const x of consultants) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [consultants]);

  const visaOptions = useMemo(
    () => Array.from(new Set(consultants.map((c) => c.visaStatus).filter(Boolean))).sort(),
    [consultants]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consultants.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (visaFilter && c.visaStatus !== visaFilter) return false;
      if (hotlistOnly && !c.onHotlist) return false;
      if (q) {
        const haystack = `${c.consultantCode} ${c.consultantName} ${c.role} ${c.technologySkills} ${c.location} ${
          c.marketerNameRaw ?? ""
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [consultants, search, statusFilter, visaFilter, hotlistOnly]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);
  // Keep the open modal showing fresh data after a save revalidates the page.
  const liveModalConsultant = modal?.consultant ? consultants.find((c) => c.id === modal.consultant!.id) ?? null : null;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BENCH_CONSULTANT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter((cur) => (cur === s ? "" : s))}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              statusFilter === s
                ? "border-[#00acc1] bg-[#00acc1]/5"
                : "border-black/10 bg-white hover:border-black/20 dark:border-white/10 dark:bg-black"
            }`}
          >
            <div className="text-xs text-black/50 dark:text-white/50">{s}</div>
            <div className="text-2xl font-semibold">{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search name, role, skills, location, marketer"
          placeholder="Search name, role, skills, location, marketer..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          {BENCH_CONSULTANT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by visa"
          value={visaFilter}
          onChange={(e) => setVisaFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Visa</option>
          {visaOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 px-1 text-sm">
          <input type="checkbox" checked={hotlistOnly} onChange={(e) => setHotlistOnly(e.target.checked)} />
          On hotlist
        </label>
        <button
          type="button"
          onClick={() => setModal({ mode: "create", consultant: null })}
          className="ml-auto rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
        >
          + Add Consultant
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Consultant</th>
              <th className="px-3 py-2 text-center">#Subs</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Technology / Skills</th>
              <th className="px-3 py-2">Visa</th>
              <th className="px-3 py-2">Relocation</th>
              <th className="px-3 py-2">Exp.</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Availability</th>
              <th className="px-3 py-2">Pay Rate</th>
              <th className="px-3 py-2">Marketer</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((c) => (
              <tr
                key={c.id}
                onClick={() => open(c)}
                className={`cursor-pointer border-t border-black/10 dark:border-white/10 ${rowSelectClass(c.id === selectedId)}`}
              >
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.addedDate)}</td>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{c.consultantCode}</td>
                <td className="px-3 py-2 font-medium">
                  {c.consultantName}
                  {c.onHotlist && (
                    <span title="On hotlist" className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      HOT
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">{c.submissionCount}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <td className="max-w-[200px] truncate px-3 py-2" title={c.role}>
                  {c.role}
                </td>
                <td className="max-w-[220px] truncate px-3 py-2" title={c.technologySkills}>
                  {c.technologySkills}
                </td>
                <td className="px-3 py-2">{c.visaStatus}</td>
                <td className="px-3 py-2">{relocationLabel(c.relocation)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.experience}</td>
                <td className="px-3 py-2">{c.location}</td>
                <td className="px-3 py-2">{c.availability}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.payRate ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.marketerNameRaw ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {consultants.length === 0 ? "No bench consultants yet." : "No consultants match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal && (
        <ConsultantModal
          key={`${modal.mode}-${modal.consultant?.id ?? "new"}`}
          initialMode={modal.mode}
          consultant={modal.mode === "create" ? null : liveModalConsultant}
          viewer={currentUser}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
