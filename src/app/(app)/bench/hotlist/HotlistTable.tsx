"use client";

import { useMemo, useRef, useState } from "react";
import { setBenchConsultantHotlist, setBenchHotlistStatus } from "../consultants/actions";
import { BENCH_HOTLIST_STATUSES, relocationLabel } from "@/lib/bench";
import { buildHotlistEmailHtml, buildHotlistText } from "@/lib/hotlistEmail";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { DensityToggle, useCellClass, useUi } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass, rowClass } from "@/components/ui/table";

type HotlistRow = {
  id: string;
  consultantCode: string;
  consultantName: string;
  role: string;
  technologySkills: string;
  visaStatus: string;
  relocation: string;
  experience: string;
  location: string;
  availability: string;
  status: string;
  hotlistStatus: string | null;
  marketerNameRaw: string | null;
};

type Scope = "filtered" | "active" | "all";

export function HotlistTable({ consultants, companyName }: { consultants: HotlistRow[]; companyName: string }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cell = useCellClass();
  const { toast } = useUi();

  usePageShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consultants.filter((c) => {
      if (statusFilter && (c.hotlistStatus ?? "") !== statusFilter) return false;
      if (q && !`${c.consultantName} ${c.role} ${c.technologySkills} ${c.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [consultants, search, statusFilter]);

  async function run(id: string, fn: () => Promise<unknown>, done?: { message: string; undo?: () => Promise<unknown> }) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      if (done) toast({ message: done.message, tone: "success", undo: done.undo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = consultants.filter((c) => c.hotlistStatus === "Active").length;
  const emptyMessage =
    consultants.length === 0
      ? "No one is on the hotlist yet — add consultants from the Consultants tab."
      : "No hotlist consultants match your filters.";

  // Reversible, so no "are you sure?" — an Undo toast instead (design review 3C).
  const removeButton = (c: HotlistRow) => (
    <button
      type="button"
      disabled={busyId === c.id}
      onClick={() =>
        run(c.id, () => setBenchConsultantHotlist(c.id, false), {
          message: `${c.consultantName} removed from hotlist`,
          undo: () => setBenchConsultantHotlist(c.id, true),
        })
      }
      className={buttonClass("subtle", "sm", "hover:text-red-600")}
    >
      Remove
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search name, role, skills, location"
          placeholder="Search name, role, skills, location…"
          className={`${toolbarInputClass} min-w-[220px] flex-1`}
        />
        <select
          aria-label="Filter by hotlist status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={toolbarInputClass}
        >
          <option value="">All ({consultants.length})</option>
          {BENCH_HOTLIST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} ({consultants.filter((c) => c.hotlistStatus === s).length})
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <DensityToggle />
          </span>
          <button
            type="button"
            disabled={consultants.length === 0}
            onClick={() => setExportOpen(true)}
            className={buttonClass("primary")}
          >
            Export hotlist
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-black/50 dark:text-white/50">
        Add or remove consultants from the hotlist on the Consultants tab. {activeCount} active of {consultants.length}.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <ul className="space-y-2 md:hidden" aria-label="Hotlist">
        {filtered.map((c) => (
          <li key={c.id} className="rounded-[10px] border border-line bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{c.consultantName}</span>
              <StatusChip status={c.hotlistStatus ?? "Active"} />
            </div>
            <div className="mt-1 text-sm text-text-secondary">
              {c.role} · {c.visaStatus} · {c.location}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-black/45 dark:text-white/45">
                {c.experience} · {c.availability}
              </span>
              {removeButton(c)}
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li className={emptyCellClass}>{emptyMessage}</li>}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        <table className={`${tableClass} min-w-[1000px]`}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>Name</th>
              <th className={cell}>Role</th>
              <th className={cell}>Skills</th>
              <th className={cell}>Visa</th>
              <th className={cell}>Relocation</th>
              <th className={cell}>Exp</th>
              <th className={cell}>Location</th>
              <th className={cell}>Availability</th>
              <th className={cell}>Hotlist</th>
              <th className={cell}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className={rowClass}>
                <td className={`${cell} font-semibold text-text-strong dark:text-white`}>{c.consultantName}</td>
                <td className={cell}>{c.role}</td>
                <td className={`${cell} max-w-[220px] truncate`} title={c.technologySkills}>
                  {c.technologySkills}
                </td>
                <td className={cell}>{c.visaStatus}</td>
                <td className={cell}>{relocationLabel(c.relocation)}</td>
                <td className={`${cell} whitespace-nowrap`}>{c.experience}</td>
                <td className={cell}>{c.location}</td>
                <td className={cell}>{c.availability}</td>
                <td className={cell}>
                  <select
                    aria-label={`Hotlist status for ${c.consultantName}`}
                    value={c.hotlistStatus ?? "Active"}
                    disabled={busyId === c.id}
                    onChange={(e) => {
                      const previous = c.hotlistStatus ?? "Active";
                      const next = e.target.value;
                      run(c.id, () => setBenchHotlistStatus(c.id, next), {
                        message: `${c.consultantName} marked ${next}`,
                        undo: () => setBenchHotlistStatus(c.id, previous),
                      });
                    }}
                    className="rounded-md border border-black/15 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-transparent"
                  >
                    {BENCH_HOTLIST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${cell} text-right`}>{removeButton(c)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className={emptyCellClass}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {exportOpen && (
        <ExportModal companyName={companyName} all={consultants} filtered={filtered} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}

// GAS bsHlShowExportModal: pick a scope, get the formatted hotlist. Email
// sending isn't wired up yet, so this copies the HTML (pastes as a formatted
// table into Outlook/Gmail) or downloads it.
function ExportModal({
  companyName,
  all,
  filtered,
  onClose,
}: {
  companyName: string;
  all: HotlistRow[];
  filtered: HotlistRow[];
  onClose: () => void;
}) {
  useEscapeToClose(onClose);
  const { toast } = useUi();
  const [scope, setScope] = useState<Scope>("active");

  const rows = scope === "all" ? all : scope === "active" ? all.filter((c) => c.hotlistStatus === "Active") : filtered;
  const forEmail = rows.map((c) => ({ ...c, relocation: relocationLabel(c.relocation) }));
  const now = new Date();
  const html = buildHotlistEmailHtml(companyName, forEmail, now);
  const text = buildHotlistText(companyName, forEmail, now);

  async function copy() {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast({ message: "Hotlist copied — paste it into a new email", tone: "success" });
    } catch {
      toast({ message: "Couldn't access the clipboard — use Download instead", tone: "error" });
    }
  }

  function download() {
    const blob = new Blob([`<!doctype html><meta charset="utf-8"><title>Hotlist</title>${html}`], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hotlist-${now.toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export hotlist"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white p-6 shadow-2xl dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Export hotlist</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <fieldset className="mb-4 flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">Which consultants</legend>
          {(
            [
              ["active", `Active only (${all.filter((c) => c.hotlistStatus === "Active").length})`],
              ["all", `Everyone on the hotlist (${all.length})`],
              ["filtered", `Current filter (${filtered.length})`],
            ] as [Scope, string][]
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="scope"
                checked={scope === value}
                onChange={() => setScope(value)}
                className="accent-brand"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="mb-4 min-h-0 flex-1 overflow-hidden rounded-md border border-black/10 dark:border-white/10">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-black/50 dark:text-white/50">No consultants in this selection.</p>
          ) : (
            // sandbox="" — the preview renders our own escaped HTML, but it
            // still gets no script execution or same-origin access.
            <iframe title="Hotlist preview" sandbox="" srcDoc={html} className="h-[50vh] w-full bg-white" />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={download} disabled={rows.length === 0} className={buttonClass("secondary")}>
            Download .html
          </button>
          <button type="button" onClick={copy} disabled={rows.length === 0} className={buttonClass("primary")}>
            Copy for email
          </button>
        </div>
      </div>
    </div>
  );
}
