"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings, Table as TableIcon, Calendar as CalendarIcon, CalendarCheck, CalendarClock, CalendarDays, CalendarPlus } from "lucide-react";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { inRange, nowWindows } from "@/lib/insights";
import { InterviewModal } from "./InterviewModal";
import { InterviewCalendar } from "./InterviewCalendar";
import { IntegrationSettingsModal } from "./IntegrationSettingsModal";
import { formatDateTime } from "@/lib/format";
import { INTERVIEW_STATUSES, INTERVIEW_TYPES } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import { StatusChip } from "@/components/ui/StatusChip";
import { statusLabel } from "@/lib/statusLabels";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass, rowClass } from "@/components/ui/table";
import type { SerializedInterview } from "./types";
import type { InterviewSubmissionSummary } from "./types";
import type { IntegrationStatus } from "./integration-actions";

export function InterviewsTable({
  interviews,
  eligibleSubmissions,
  currentUserId,
  canEdit,
  canManageIntegration,
  integrationStatus,
  integrationConnected,
  integrationError,
}: {
  interviews: SerializedInterview[];
  eligibleSubmissions: InterviewSubmissionSummary[];
  currentUserId: string;
  canEdit: boolean;
  canManageIntegration: boolean;
  integrationStatus: IntegrationStatus | null;
  integrationConnected: boolean;
  integrationError: string | null;
}) {
  const [modal, setModal] = useState<{
    mode: "create" | "view" | "edit";
    interview: SerializedInterview | null;
  } | null>(null);
  const [view, setView] = useState<"table" | "calendar">("table");
  const [showIntegrationSettings, setShowIntegrationSettings] = useState(integrationConnected || !!integrationError);
  // Captured once at mount — the cleanup effect below strips the query param
  // (via router.replace) right after mount, which would otherwise re-run
  // page.tsx without it and null out the live `integrationError` prop before
  // the banner ever became visible.
  const [capturedError] = useState(integrationError);
  const [capturedConnected] = useState(integrationConnected);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (integrationConnected || integrationError) {
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cell = useCellClass();
  const open = (i: SerializedInterview) => {
    setSelectedId(i.id);
    setModal({ mode: "view", interview: i });
  };

  useOpenParam((id) => {
    const found = interviews.find((i) => i.id === id);
    if (found) open(found);
  });

  usePageShortcuts({
    onNew: canEdit ? () => setModal({ mode: "create", interview: null }) : undefined,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return interviews.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (typeFilter && i.interviewType !== typeFilter) return false;
      if (q) {
        const haystack = `${i.submission.candidate.name} ${i.clientCompany ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [interviews, search, statusFilter, typeFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);

  const stats = useMemo(() => {
    const now = new Date();
    const { today, week } = nowWindows(now);
    const live = interviews.filter((i) => i.status !== "Cancelled");
    return {
      total: interviews.length,
      today: live.filter((i) => inRange(i.scheduledAt, today.start, today.end)).length,
      week: live.filter((i) => inRange(i.scheduledAt, week.start, week.end)).length,
      upcoming: live.filter((i) => i.scheduledAt && new Date(i.scheduledAt) >= now).length,
    };
  }, [interviews]);

  return (
    <div>
      <StatGrid>
        <StatCard icon={CalendarClock} tone="blue" value={stats.total} label="Total interviews" />
        <StatCard icon={CalendarCheck} tone="green" value={stats.today} label="Today" />
        <StatCard icon={CalendarDays} tone="orange" value={stats.week} label="This week" />
        <StatCard icon={CalendarPlus} tone="purple" value={stats.upcoming} label="Upcoming" />
      </StatGrid>
      {capturedConnected && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Calendar account connected.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search candidate, company"
          placeholder="Search candidate, company…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All statuses</option>
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All rounds</option>
          {INTERVIEW_TYPES.map((t) => (
            <option key={t} value={t}>
              {statusLabel(t)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {view === "table" && (
            <span className="hidden md:inline-flex">
              <DensityToggle />
            </span>
          )}
          <div
            className="flex rounded-md border border-black/15 bg-white dark:border-white/15 dark:bg-transparent"
            role="group"
            aria-label="View"
          >
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label="Table view"
              aria-pressed={view === "table"}
              className={`flex items-center gap-1 rounded-l-md px-2.5 py-2 text-sm ${
                view === "table" ? "bg-ink text-white" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <TableIcon size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              aria-label="Calendar view"
              aria-pressed={view === "calendar"}
              className={`flex items-center gap-1 rounded-r-md px-2.5 py-2 text-sm ${
                view === "calendar" ? "bg-ink text-white" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <CalendarIcon size={14} />
            </button>
          </div>
          {canManageIntegration && (
            <button
              type="button"
              onClick={() => setShowIntegrationSettings(true)}
              aria-label="Calendar integration settings"
              title="Calendar integration settings"
              className={buttonClass("secondary", "md", "px-2.5")}
            >
              <Settings size={16} />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setModal({ mode: "create", interview: null })}
              className={buttonClass("primary")}
            >
              + Schedule interview
            </button>
          )}
        </div>
      </div>

      {view === "table" ? (
        <>
          <ul className="space-y-2 md:hidden" aria-label="Interviews">
            {paged.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => open(i)}
                  className={`w-full rounded-[10px] border border-line bg-white p-3 text-left shadow-sm dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(i.id === selectedId)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{i.submission.candidate.name}</span>
                    <StatusChip status={i.status} />
                  </div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {statusLabel(i.interviewType)}
                    {i.clientCompany ? ` · ${i.clientCompany}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-black/45 dark:text-white/45">
                    {i.scheduledAt ? formatDateTime(i.scheduledAt, i.timezone ?? undefined) : "Not scheduled"}
                    {i.mode ? ` · ${statusLabel(i.mode)}` : ""}
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className={emptyCellClass}>
                {interviews.length === 0 ? "No interviews yet." : "No interviews match your filters."}
              </li>
            )}
          </ul>
          <div className={`${tableCardClass} hidden md:block`}>
            <table className={`${tableClass} min-w-[840px]`}>
              <thead className={theadClass}>
                <tr>
                  <th className={cell}>Candidate</th>
                  <th className={cell}>Round</th>
                  <th className={cell}>Scheduled</th>
                  <th className={cell}>Mode</th>
                  <th className={cell}>Client</th>
                  <th className={cell}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => open(i)}
                    className={`cursor-pointer ${rowClass} ${rowSelectClass(i.id === selectedId)}`}
                  >
                    <td className={`${cell} font-semibold text-text-strong dark:text-white`}>{i.submission.candidate.name}</td>
                    <td className={cell}>{statusLabel(i.interviewType)}</td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {i.scheduledAt ? formatDateTime(i.scheduledAt, i.timezone ?? undefined) : "—"}
                    </td>
                    <td className={cell}>{i.mode ? statusLabel(i.mode) : "—"}</td>
                    <td className={cell}>{i.clientCompany ?? "—"}</td>
                    <td className={cell}>
                      <StatusChip status={i.status} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className={emptyCellClass}>
                      {interviews.length === 0 ? "No interviews yet." : "No interviews match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />
        </>
      ) : (
        <InterviewCalendar interviews={filtered} onSelect={open} />
      )}

      {modal && (
        <InterviewModal
          key={`${modal.mode}-${modal.interview?.id ?? "new"}`}
          mode={modal.mode}
          interview={modal.interview}
          eligibleSubmissions={eligibleSubmissions}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onClose={() => setModal(null)}
        />
      )}

      {showIntegrationSettings && integrationStatus && (
        <IntegrationSettingsModal
          status={integrationStatus}
          connectError={capturedError}
          onClose={() => setShowIntegrationSettings(false)}
        />
      )}
    </div>
  );
}
