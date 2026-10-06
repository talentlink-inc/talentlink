"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarCheck, Download, Eye, FileText, Paperclip, Plus } from "lucide-react";
import { SubmissionModal } from "./SubmissionModal";
import { formatDate } from "@/lib/format";
import { VISA_STATUSES, SUBMISSION_EMPLOYMENT_TYPES, parseEmploymentTypes } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass } from "@/components/ui/table";
import type { DataPermissions } from "@/lib/users";
import { getSubmissionDetail } from "./actions";
import { SubmissionPanelLoader } from "./SubmissionPanelLoader";
import { useDetailLoader } from "@/components/ui/useDetailLoader";
import type { RequirementSummary, SubmissionListRow } from "./types";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { idClass, JobIdChip, VisaChip } from "@/components/ui/Chips";
import { rowClass } from "@/components/ui/table";
import { SUBMISSION_STATUSES } from "@/lib/recruitment";
import { statusLabel } from "@/lib/statusLabels";

export function SubmissionsTable({
  stats,
  submissions,
  requirements,
  currentUserId,
  canEdit,
  isAdmin,
  permissions,
}: {
  stats: { total: number; today: number; week: number; withResume: number };
  submissions: SubmissionListRow[];
  requirements: RequirementSummary[];
  currentUserId: string;
  canEdit: boolean;
  isAdmin: boolean;
  permissions: DataPermissions;
}) {
  // The list holds slim rows; an opened submission's full record is fetched
  // (and prefetched on row hover) by id.
  const [modal, setModal] = useState<{ mode: "create" | "view"; id: string | null } | null>(null);
  const detail = useDetailLoader(getSubmissionDetail, submissions);
  const [search, setSearch] = useState("");
  const [visaFilter, setVisaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cell = useCellClass();
  const open = (s: SubmissionListRow) => {
    setSelectedId(s.id);
    setModal({ mode: "view", id: s.id });
  };
  const warm = (s: SubmissionListRow) => () => void detail.prefetch(s.id);

  // Deep links (?open=id from search, Insights, notifications) open by id,
  // even for a submission outside the rows listed here.
  useOpenParam((id) => {
    setSelectedId(id);
    setModal({ mode: "view", id });
  });

  usePageShortcuts({
    onNew: canEdit ? () => setModal({ mode: "create", id: null }) : undefined,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (visaFilter && s.candidate.visaStatus !== visaFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (empTypeFilter && !parseEmploymentTypes(s.employmentType).includes(empTypeFilter)) return false;
      if (q) {
        const haystack = `${s.submissionId ?? ""} ${s.candidate.name} ${s.candidate.email ?? ""} ${s.candidate.phone ?? ""} ${
          s.candidate.currentLocation ?? ""
        } ${s.requirement?.jobId ?? s.requirementJobIdRaw ?? ""} ${s.recruiter ?? ""} ${s.role ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, visaFilter, statusFilter, empTypeFilter]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);

  return (
    <div>
      <StatGrid>
        <StatCard icon={FileText} tone="blue" value={stats.total} label="Total submissions" />
        <StatCard icon={CalendarCheck} tone="green" value={stats.today} label="Submitted today" />
        <StatCard icon={CalendarDays} tone="orange" value={stats.week} label="This week" />
        <StatCard icon={Paperclip} tone="purple" value={stats.withResume} label="Resumes uploaded" />
      </StatGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search submissions"
          placeholder="Search name, email, phone, job ID…"
          className={`${toolbarInputClass} min-w-[200px] flex-1 md:max-w-xs`}
        />
        <select aria-label="Filter by visa" value={visaFilter} onChange={(e) => setVisaFilter(e.target.value)} className={toolbarInputClass}>
          <option value="">All visas</option>
          {VISA_STATUSES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={toolbarInputClass}>
          <option value="">All statuses</option>
          {SUBMISSION_STATUSES.map((st) => (
            <option key={st} value={st}>
              {statusLabel(st)}
            </option>
          ))}
        </select>
        <select aria-label="Filter by employment type" value={empTypeFilter} onChange={(e) => setEmpTypeFilter(e.target.value)} className={toolbarInputClass}>
          <option value="">All emp. types</option>
          {SUBMISSION_EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          {canEdit && (
            <button type="button" onClick={() => setModal({ mode: "create", id: null })} className={buttonClass("primary")}>
              <Plus size={16} aria-hidden /> Submit candidate
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Submissions">
        {paged.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => open(s)}
              onTouchStart={warm(s)}
              onFocus={warm(s)}
              className={`w-full rounded-[10px] border border-line bg-white p-3 text-left shadow-sm dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(s.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-text-strong dark:text-white">{s.candidate.name}</span>
                <StatusChip status={s.status} />
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                {s.requirement?.jobTitle ?? s.requirementJobIdRaw ?? "No requirement"}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span className={idClass}>{s.submissionId ?? "—"}</span>
                <VisaChip visa={s.candidate.visaStatus} />
                <span>{s.submissionDate ? formatDate(s.submissionDate) : "No date"}</span>
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className={emptyCellClass}>{submissions.length === 0 ? "No submissions yet." : "No submissions match your filters."}</li>
        )}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[1150px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Date</th>
              <th className={cell}>Sub ID</th>
              <th className={cell}>Job ID</th>
              <th className={cell}>Recruiter</th>
              <th className={cell}>Candidate</th>
              <th className={cell}>Location</th>
              <th className={cell}>Exp.</th>
              <th className={cell}>Visa</th>
              <th className={cell}>Emp. type</th>
              <th className={cell}>Role / skills</th>
              <th className={cell}>Status</th>
              <th className={cell}>Resume</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => (
              <tr
                key={s.id}
                onClick={() => open(s)}
                onMouseEnter={warm(s)}
                className={`cursor-pointer ${rowClass} ${rowSelectClass(s.id === selectedId)}`}
              >
                <td className={`${cell} whitespace-nowrap text-text-secondary`} title={s.submissionDate ? formatDate(s.submissionDate) : undefined}>
                  {s.submissionDate ? formatDate(s.submissionDate).replace(/, \d{4}$/, "") : "—"}
                </td>
                <td className={cell}>
                  <span className={idClass}>{s.submissionId ?? "—"}</span>
                </td>
                <td className={cell} title={s.requirement?.jobTitle}>
                  <JobIdChip jobId={s.requirement?.jobId ?? s.requirementJobIdRaw} />
                </td>
                <td className={`${cell} max-w-[110px] truncate text-text-secondary`}>{s.recruiter?.split(" ")[0] || "—"}</td>
                <td className={`${cell} max-w-[170px] truncate font-semibold text-text-strong dark:text-white`} title={s.candidate.name}>
                  {s.candidate.name}
                </td>
                <td className={`${cell} max-w-[140px] truncate text-text-secondary`} title={s.candidate.currentLocation ?? undefined}>
                  {s.candidate.currentLocation || "—"}
                </td>
                <td className={`${cell} whitespace-nowrap text-text-secondary`}>{s.candidate.experience || "—"}</td>
                <td className={cell}>
                  <VisaChip visa={s.candidate.visaStatus} />
                </td>
                <td className={`${cell} max-w-[110px] truncate text-[12px] text-text-secondary`}>{s.employmentType || "—"}</td>
                <td className={`${cell} max-w-[180px] truncate text-text-secondary`} title={s.role ?? undefined}>
                  {s.role || "—"}
                </td>
                <td className={cell}>
                  <StatusChip status={s.status} />
                </td>
                <td className={`${cell} whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                  {s.resumeId && permissions.canViewResume ? (
                    <span className="inline-flex items-center gap-1">
                      <a
                        href={`/api/resumes/${s.resumeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View resume"
                        aria-label={`View ${s.candidate.name}'s resume`}
                        className="rounded p-1 text-primary hover:bg-primary-soft"
                      >
                        <Eye size={16} />
                      </a>
                      {permissions.canDownloadResume && (
                        <a
                          href={`/api/resumes/${s.resumeId}?download=1`}
                          title="Download resume"
                          aria-label={`Download ${s.candidate.name}'s resume`}
                          className="rounded p-1 text-primary hover:bg-primary-soft"
                        >
                          <Download size={16} />
                        </a>
                      )}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className={emptyCellClass}>
                  {submissions.length === 0 ? "No submissions yet." : "No submissions match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal?.mode === "create" && (
        <SubmissionModal
          key="create"
          mode="create"
          submission={null}
          requirements={requirements}
          currentUserId={currentUserId}
          canEdit={canEdit}
          isAdmin={isAdmin}
          permissions={permissions}
          onClose={() => setModal(null)}
          onOpenExisting={(id) => setModal({ mode: "view", id })}
        />
      )}
      {modal?.mode === "view" && modal.id && (
        <SubmissionPanelLoader
          key={modal.id}
          id={modal.id}
          row={submissions.find((s) => s.id === modal.id)}
          load={detail.load}
          mode="view"
          requirements={requirements}
          currentUserId={currentUserId}
          canEdit={canEdit}
          isAdmin={isAdmin}
          permissions={permissions}
          onClose={() => setModal(null)}
          onOpenExisting={(id) => setModal({ mode: "view", id })}
        />
      )}
    </div>
  );
}
