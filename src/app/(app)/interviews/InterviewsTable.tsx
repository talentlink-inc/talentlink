"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings, Table as TableIcon, Calendar as CalendarIcon } from "lucide-react";
import { InterviewModal } from "./InterviewModal";
import { InterviewCalendar } from "./InterviewCalendar";
import { IntegrationSettingsModal } from "./IntegrationSettingsModal";
import { formatDateTime } from "@/lib/format";
import { INTERVIEW_STATUSES, INTERVIEW_TYPES } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import type { SerializedInterview } from "./types";
import type { SerializedSubmission } from "../submissions/types";
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
  eligibleSubmissions: SerializedSubmission[];
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
  const [showIntegrationSettings, setShowIntegrationSettings] = useState(
    integrationConnected || !!integrationError
  );
  // Captured once at mount — the cleanup effect below strips the query param
  // (via router.replace) right after mount, which would otherwise re-run
  // page.tsx without it and null out the live `integrationError` prop before
  // the banner ever became visible.
  const [capturedError] = useState(integrationError);
  const [capturedConnected] = useState(integrationConnected);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (integrationConnected || integrationError) {
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useOpenParam((id) => {
    const found = interviews.find((i) => i.id === id);
    if (found) setModal({ mode: "view", interview: found });
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Interviews</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-black/15 dark:border-white/15">
            <button
              onClick={() => setView("table")}
              aria-label="Table view"
              className={`flex items-center gap-1 rounded-l-md px-2 py-1.5 text-sm ${
                view === "table" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <TableIcon size={14} />
            </button>
            <button
              onClick={() => setView("calendar")}
              aria-label="Calendar view"
              className={`flex items-center gap-1 rounded-r-md px-2 py-1.5 text-sm ${
                view === "calendar" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <CalendarIcon size={14} />
            </button>
          </div>
          {canManageIntegration && (
            <button
              onClick={() => setShowIntegrationSettings(true)}
              aria-label="Calendar integration settings"
              title="Calendar integration settings"
              className="rounded-md border border-black/15 p-2 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              <Settings size={16} />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setModal({ mode: "create", interview: null })}
              className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              + Schedule Interview
            </button>
          )}
        </div>
      </div>

      {capturedConnected && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Calendar account connected.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search candidate, company..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Status</option>
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All Types</option>
          {INTERVIEW_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {view === "table" ? (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-black/5 dark:bg-white/5">
              <tr>
                <th className="px-4 py-2">Candidate</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Scheduled</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => setModal({ mode: "view", interview: i })}
                  className="cursor-pointer border-t border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2">{i.submission.candidate.name}</td>
                  <td className="px-4 py-2">{i.interviewType}</td>
                  <td className="px-4 py-2">
                    {i.scheduledAt ? formatDateTime(i.scheduledAt, i.timezone ?? undefined) : "—"}
                  </td>
                  <td className="px-4 py-2">{i.mode ?? "—"}</td>
                  <td className="px-4 py-2">{i.clientCompany ?? "—"}</td>
                  <td className="px-4 py-2">{i.status}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                    {interviews.length === 0 ? "No interviews yet." : "No interviews match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <InterviewCalendar interviews={filtered} onSelect={(i) => setModal({ mode: "view", interview: i })} />
      )}

      {modal && (
        <InterviewModal
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
