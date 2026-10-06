"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Briefcase, CircleCheck, Copy, Plus, Send } from "lucide-react";
import { RequirementModal } from "./RequirementModal";
import { getRequirementDetail, updateRequirementPriority } from "./actions";
import { RequirementPanelLoader } from "./RequirementPanelLoader";
import { useDetailLoader } from "@/components/ui/useDetailLoader";
import { REQUIREMENT_STATUSES, REQUIREMENT_EMPLOYMENT_TYPES, parseEmploymentTypes } from "@/lib/recruitment";
import { useOpenParam } from "@/lib/useOpenParam";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { rowSelectClass } from "@/lib/tableRow";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass } from "@/components/ui/table";
import type { RequirementListRow, SubmissionBuckets } from "./types";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Avatars, idClass } from "@/components/ui/Chips";
import { rowClass } from "@/components/ui/table";
import { countryFlags } from "@/lib/countryFlags";
import { formatDate } from "@/lib/format";

export function RequirementsTable({
  requirements,
  currentUserId,
  canEdit,
}: {
  requirements: RequirementListRow[];
  currentUserId: string;
  canEdit: boolean;
}) {
  // Slim rows here; the full requirement is fetched by id when it's opened or
  // cloned (prefetched on row hover).
  const [modal, setModal] = useState<
    { kind: "new" } | { kind: "view"; id: string } | { kind: "clone"; id: string } | null
  >(null);
  const detail = useDetailLoader(getRequirementDetail, requirements);
  const [search, setSearch] = useState("");
  // Opens on Open requirements, as GAS does — the ones being worked.
  const [statusFilter, setStatusFilter] = useState("Open");
  const [minPriority, setMinPriority] = useState(0);
  const [empTypeFilter, setEmpTypeFilter] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cell = useCellClass();

  // Row click opens the record (design review) and also selects the row, so
  // the Clone button keeps working as in GAS.
  const open = (r: RequirementListRow) => {
    setSelectedId(r.id);
    setModal({ kind: "view", id: r.id });
  };
  const warm = (r: RequirementListRow) => () => void detail.prefetch(r.id);

  function handleStarClick(r: RequirementListRow, n: number) {
    const current = priorityOverrides[r.id] ?? r.priority;
    const next = n === current ? 0 : n;
    setPriorityOverrides((prev) => ({ ...prev, [r.id]: next }));
    startTransition(async () => {
      await updateRequirementPriority(r.id, next);
      router.refresh();
    });
  }

  useOpenParam((id) => {
    setSelectedId(id);
    setModal({ kind: "view", id });
  });

  usePageShortcuts({
    onNew: canEdit ? () => setModal({ kind: "new" }) : undefined,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requirements.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (minPriority && (priorityOverrides[r.id] ?? r.priority) < minPriority) return false;
      if (empTypeFilter && !parseEmploymentTypes(r.employmentType).includes(empTypeFilter)) return false;
      if (q) {
        const haystack = `${r.jobId} ${r.jobTitle} ${r.clientName ?? ""} ${r.mandatorySkills ?? ""} ${r.location ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requirements, search, statusFilter, minPriority, empTypeFilter, priorityOverrides]);

  const stats = useMemo(() => {
    let open = 0, submitted = 0, closed = 0;
    for (const r of requirements) {
      if (r.status === "Open") open++;
      else if (r.status === "Submitted") submitted++;
      else if (r.status === "Closed" || r.status === "Filled") closed++;
    }
    return { total: requirements.length, open, submitted, closed };
  }, [requirements]);

  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);

  // Mirrors GAS's Excel-style row select: the Clone icon only shows while
  // exactly one row is genuinely highlighted on the current page — checked
  // against `paged` (what's actually rendered) rather than just trusting
  // `selectedId`, since a filter/search/page change can leave `selectedId`
  // pointing at a row that's no longer visible.
  const selectedRequirement = paged.find((r) => r.id === selectedId) ?? null;
  const emptyMessage =
    requirements.length === 0
      ? "No requirements yet — add the first one with “+ New requirement”."
      : "No requirements match your filters.";

  return (
    <div>
      <StatGrid>
        <StatCard icon={Briefcase} tone="blue" value={stats.total} label="Total requirements" onClick={() => setStatusFilter("")} pressed={statusFilter === ""} />
        <StatCard icon={CircleCheck} tone="green" value={stats.open} label="Open" onClick={() => setStatusFilter("Open")} pressed={statusFilter === "Open"} />
        <StatCard icon={Send} tone="cyan" value={stats.submitted} label="Submitted" onClick={() => setStatusFilter("Submitted")} pressed={statusFilter === "Submitted"} />
        <StatCard icon={BadgeCheck} tone="purple" value={stats.closed} label="Closed / Filled" onClick={() => setStatusFilter("Closed")} pressed={statusFilter === "Closed"} />
      </StatGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search requirements"
          placeholder="Search job title, client, skills…"
          className={`${toolbarInputClass} min-w-[200px] flex-1 md:max-w-xs`}
        />
        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={toolbarInputClass}>
          <option value="">All statuses</option>
          {REQUIREMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select aria-label="Filter by priority" value={minPriority} onChange={(e) => setMinPriority(Number(e.target.value))} className={toolbarInputClass}>
          <option value={0}>All priorities</option>
          <option value={5}>★★★★★ only</option>
          <option value={4}>★★★★ and up</option>
          <option value={3}>★★★ and up</option>
          <option value={2}>★★ and up</option>
          <option value={1}>★ and up</option>
        </select>
        <select aria-label="Filter by employment type" value={empTypeFilter} onChange={(e) => setEmpTypeFilter(e.target.value)} className={toolbarInputClass}>
          <option value="">All emp. types</option>
          {REQUIREMENT_EMPLOYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          {canEdit && selectedRequirement && (
            <button
              type="button"
              onClick={() => setModal({ kind: "clone", id: selectedRequirement.id })}
              onMouseEnter={() => void detail.prefetch(selectedRequirement.id)}
              title="Clone selected requirement"
              className={buttonClass("secondary")}
            >
              <Copy size={14} aria-hidden /> Clone
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setModal({ kind: "new" })} className={buttonClass("primary")}>
              <Plus size={16} aria-hidden /> New requirement
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Requirements">
        {paged.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => open(r)}
              onTouchStart={warm(r)}
              onFocus={warm(r)}
              className={`w-full rounded-[10px] border border-line bg-white p-3 text-left shadow-sm dark:border-white/10 dark:bg-neutral-950 ${rowSelectClass(r.id === selectedId)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-text-strong dark:text-white">
                  {countryFlags(r.country) && <span className="mr-1.5">{countryFlags(r.country)}</span>}
                  {r.jobTitle}
                </span>
                <StatusChip status={r.status} />
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                {r.clientName ?? "No client"}
                {r.location ? ` · ${r.location}` : ""}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className={idClass}>{r.jobId}</span>
                <CountBubbles buckets={r.buckets} />
                <Stars value={priorityOverrides[r.id] ?? r.priority} />
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className={emptyCellClass}>{emptyMessage}</li>}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[1100px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Date</th>
              <th className={cell}>Job ID</th>
              <th className={cell}>Priority</th>
              <th className={cell}>Job title</th>
              <th className={cell}>Mandatory skills</th>
              <th className={cell}>Visa</th>
              <th className={cell}>Location</th>
              <th className={cell}>Emp. type</th>
              <th className={cell}>Client</th>
              <th className={cell}>Assigned to</th>
              <th className={cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const priority = priorityOverrides[r.id] ?? r.priority;
              const flags = countryFlags(r.country);
              return (
                <tr
                  key={r.id}
                  onClick={() => open(r)}
                  onMouseEnter={warm(r)}
                  className={`cursor-pointer ${rowClass} ${rowSelectClass(r.id === selectedId)}`}
                >
                  <td className={`${cell} whitespace-nowrap text-text-secondary`} title={formatDate(r.createdAt)}>
                    {formatDate(r.createdAt).replace(/, \d{4}$/, "")}
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>
                    <span className={idClass}>{r.jobId}</span>
                    <CountBubbles buckets={r.buckets} />
                  </td>
                  <td className={`${cell} whitespace-nowrap`} onClick={(e) => canEdit && e.stopPropagation()}>
                    {canEdit ? (
                      <span className="inline-flex" role="group" aria-label={`Priority for ${r.jobId}`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleStarClick(r, n)}
                            aria-label={`Priority ${n}`}
                            aria-pressed={n <= priority}
                            className="px-px text-[15px] leading-none transition-transform hover:scale-125"
                            style={{ color: n <= priority ? PRIORITY_COLORS[priority] : "#d6dbe0" }}
                          >
                            ★
                          </button>
                        ))}
                      </span>
                    ) : (
                      <Stars value={priority} />
                    )}
                  </td>
                  <td className={`${cell} max-w-[260px]`}>
                    <span className="flex min-w-0 items-center gap-1.5 font-semibold text-text-strong dark:text-white" title={r.jobTitle}>
                      {flags && <span className="shrink-0" aria-hidden>{flags}</span>}
                      <span className="truncate">{r.jobTitle}</span>
                    </span>
                  </td>
                  <td className={`${cell} max-w-[200px] truncate text-text-secondary`} title={r.mandatorySkills ?? undefined}>
                    {r.mandatorySkills || "—"}
                  </td>
                  <td className={`${cell} max-w-[110px] truncate text-text-secondary`} title={r.visa ?? undefined}>
                    {r.visa || "—"}
                  </td>
                  <td className={`${cell} max-w-[120px] truncate text-text-secondary`} title={r.location ?? undefined}>
                    {r.location || "—"}
                  </td>
                  <td className={`${cell} max-w-[110px] truncate text-[12px] text-text-secondary`} title={r.employmentType ?? undefined}>
                    {r.employmentType || "—"}
                  </td>
                  <td className={`${cell} max-w-[140px] truncate`} title={r.clientName ?? undefined}>
                    {r.clientName || "—"}
                  </td>
                  <td className={cell}>
                    <Avatars names={r.assignees} />
                  </td>
                  <td className={cell}>
                    <StatusChip status={r.status} />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className={emptyCellClass}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />

      {modal?.kind === "new" && (
        <RequirementModal key="new" mode="create" requirement={null} currentUserId={currentUserId} canEdit={canEdit} onClose={() => setModal(null)} />
      )}
      {(modal?.kind === "view" || modal?.kind === "clone") && (
        <RequirementPanelLoader
          key={`${modal.kind}-${modal.id}`}
          id={modal.id}
          purpose={modal.kind}
          row={requirements.find((r) => r.id === modal.id)}
          load={detail.load}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onClose={() => setModal(null)}
          onClone={(source) => setModal({ kind: "clone", id: source.id })}
        />
      )}
    </div>
  );
}

// GAS's priority colours (REQ_PRIORITY_COLORS): 5 red … 1 grey.
const PRIORITY_COLORS: Record<number, string> = { 5: "#d50000", 4: "#ef6c00", 3: "#1976d2", 2: "#0891b2", 1: "#757575", 0: "#ccc" };

function Stars({ value }: { value: number }) {
  if (!value) return <span className="text-xs text-text-muted">Not sourcing</span>;
  return (
    <span aria-label={`Priority ${value} of 5`} className="text-[15px] leading-none tracking-tight" style={{ color: PRIORITY_COLORS[value] }}>
      {"★".repeat(value)}
      <span className="text-[#d6dbe0]">{"★".repeat(5 - value)}</span>
    </span>
  );
}

// Overlapping count bubbles after the Job ID (GAS _reqBuildSubBadges):
// submissions received, in consideration, won and rejected.
const BUCKETS: { key: keyof SubmissionBuckets; color: string; label: string }[] = [
  { key: "blue", color: "#1565c0", label: "received" },
  { key: "amber", color: "#f57f17", label: "in consideration" },
  { key: "green", color: "#2e7d32", label: "won" },
  { key: "red", color: "#c62828", label: "rejected or out" },
];

function CountBubbles({ buckets }: { buckets: SubmissionBuckets }) {
  const shown = BUCKETS.filter((b) => buckets[b.key] > 0);
  if (shown.length === 0) return null;
  const tip = shown.map((b) => `${buckets[b.key]} ${b.label}`).join(" · ");
  return (
    <span className="ml-2 inline-flex items-center align-middle" title={`Submissions: ${tip}`} aria-label={`Submissions: ${tip}`}>
      {shown.map((b, i) => {
        const n = buckets[b.key];
        return (
          <span
            key={b.key}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-neutral-950"
            style={{ background: b.color, marginLeft: i === 0 ? 0 : -5, zIndex: shown.length - i }}
          >
            {n > 99 ? "99+" : n}
          </span>
        );
      })}
    </span>
  );
}
