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
import { StatusChip } from "@/components/ui/StatusChip";
import { StatCard, StatGrid, type StatTone } from "@/components/ui/StatCard";
import { VisaChip } from "@/components/ui/Chips";
import { Megaphone, PauseCircle, Star, UserCheck, type LucideIcon } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass, rowClass } from "@/components/ui/table";
import type { SerializedConsultant } from "./types";
import { idClass } from "@/components/ui/Chips";

// Stat card per consultant status (GAS Bench Sales cards); click to filter.
const STAT_CARDS: Record<string, { icon: LucideIcon; tone: StatTone; label: string }> = {
  Available: { icon: UserCheck, tone: "green", label: "Available" },
  Marketing: { icon: Megaphone, tone: "blue", label: "Actively marketing" },
  Placed: { icon: Star, tone: "purple", label: "Placed" },
  "On Hold": { icon: PauseCircle, tone: "orange", label: "On hold" },
};

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
  const cell = useCellClass();

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
  // Keep the open panel showing fresh data after a save revalidates the page.
  const liveModalConsultant = modal?.consultant ? consultants.find((c) => c.id === modal.consultant!.id) ?? null : null;

  return (
    <div>
      <StatGrid>
        {BENCH_CONSULTANT_STATUSES.map((s) => (
          <StatCard
            key={s}
            icon={STAT_CARDS[s].icon}
            tone={STAT_CARDS[s].tone}
            value={counts[s] ?? 0}
            label={STAT_CARDS[s].label}
            pressed={statusFilter === s}
            onClick={() => setStatusFilter((cur) => (cur === s ? "" : s))}
          />
        ))}
      </StatGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search consultants"
          placeholder="Search name, role, skills, location, marketer…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={toolbarInputClass}>
          <option value="">All statuses</option>
          {BENCH_CONSULTANT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select aria-label="Filter by visa" value={visaFilter} onChange={(e) => setVisaFilter(e.target.value)} className={toolbarInputClass}>
          <option value="">All visas</option>
          {visaOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 px-1 text-sm">
          <input type="checkbox" checked={hotlistOnly} onChange={(e) => setHotlistOnly(e.target.checked)} className="accent-brand" />
          On hotlist
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          <button type="button" onClick={() => setModal({ mode: "create", consultant: null })} className={buttonClass("primary")}>
            + Add consultant
          </button>
        </div>
      </div>

      {/* Phones: one card per consultant with the facts that matter (design review 5A). */}
      <ul className="space-y-2 md:hidden" aria-label="Consultants">
        {paged.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => open(c)}
              className={`w-full rounded-[10px] border border-line bg-white p-3 text-left shadow-sm dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(c.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {c.consultantName}
                  {c.onHotlist && <span className="ml-1.5 text-amber-600" title="On hotlist">★</span>}
                </span>
                <StatusChip status={c.status} />
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                {c.role} · {c.visaStatus} · {c.location}
              </div>
              <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                {c.consultantCode} · {c.payRate ?? "No rate"} · {c.submissionCount} submission{c.submissionCount === 1 ? "" : "s"}
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className={emptyCellClass}>{consultants.length === 0 ? "No bench consultants yet." : "No consultants match your filters."}</li>}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[1100px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Added</th>
              <th className={cell}>ID</th>
              <th className={cell}>Consultant</th>
              <th className={`${cell} text-center`}>Subs</th>
              <th className={cell}>Status</th>
              <th className={cell}>Role</th>
              <th className={cell}>Skills</th>
              <th className={cell}>Visa</th>
              <th className={cell}>Relocation</th>
              <th className={cell}>Exp.</th>
              <th className={cell}>Location</th>
              <th className={cell}>Availability</th>
              <th className={cell}>Pay rate</th>
              <th className={cell}>Marketer</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((c) => (
              <tr
                key={c.id}
                onClick={() => open(c)}
                className={`cursor-pointer ${rowClass} ${rowSelectClass(c.id === selectedId)}`}
              >
                <td className={`${cell} whitespace-nowrap text-black/60 dark:text-white/60`}>{formatDate(c.addedDate)}</td>
                <td className={`${cell} ${idClass}`}>{c.consultantCode}</td>
                <td className={`${cell} font-semibold text-text-strong dark:text-white`}>
                  {c.consultantName}
                  {c.onHotlist && (
                    <span title="On hotlist" className="ml-1.5 text-amber-600">
                      ★
                    </span>
                  )}
                </td>
                <td className={`${cell} text-center`}>
                  {c.submissionCount > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1565c0] px-1 text-[10px] font-bold text-white">
                      {c.submissionCount}
                    </span>
                  ) : (
                    <span className="text-text-muted">–</span>
                  )}
                </td>
                <td className={cell}>
                  <StatusChip status={c.status} />
                </td>
                <td className={`${cell} max-w-[200px] truncate`} title={c.role}>
                  {c.role}
                </td>
                <td className={`${cell} max-w-[220px] truncate`} title={c.technologySkills}>
                  {c.technologySkills}
                </td>
                <td className={cell}>
                  <VisaChip visa={c.visaStatus} />
                </td>
                <td className={cell}>{relocationLabel(c.relocation)}</td>
                <td className={`${cell} whitespace-nowrap`}>{c.experience}</td>
                <td className={cell}>{c.location}</td>
                <td className={cell}>{c.availability}</td>
                <td className={`${cell} whitespace-nowrap`}>{c.payRate ?? "—"}</td>
                <td className={`${cell} whitespace-nowrap`}>{c.marketerNameRaw ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={14} className={emptyCellClass}>
                  {consultants.length === 0 ? (
                    <>
                      No bench consultants yet.{" "}
                      <button type="button" onClick={() => setModal({ mode: "create", consultant: null })} className="font-medium text-brand-strong underline">
                        Add the first one
                      </button>
                    </>
                  ) : (
                    "No consultants match your filters."
                  )}
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
