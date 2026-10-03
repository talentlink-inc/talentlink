"use client";

import { useMemo, useRef, useState } from "react";
import { setBenchConsultantHotlist, setBenchHotlistStatus } from "../consultants/actions";
import { BENCH_HOTLIST_STATUSES, relocationLabel } from "@/lib/bench";
import { buildHotlistEmailHtml, buildHotlistText } from "@/lib/hotlistEmail";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import { ConfirmButton } from "@/components/ConfirmButton";

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

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = consultants.filter((c) => c.hotlistStatus === "Active").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, role, skills, location..."
          className="min-w-[220px] flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <select
          aria-label="Filter by hotlist status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        >
          <option value="">All ({consultants.length})</option>
          {BENCH_HOTLIST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} ({consultants.filter((c) => c.hotlistStatus === s).length})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={consultants.length === 0}
          onClick={() => setExportOpen(true)}
          className="ml-auto rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Export hotlist
        </button>
      </div>
      <p className="mb-3 text-xs text-black/50 dark:text-white/50">
        Add or remove consultants from the hotlist on the Consultants tab. {activeCount} active of {consultants.length}.
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Skills</th>
              <th className="px-3 py-2">Visa</th>
              <th className="px-3 py-2">Relocation</th>
              <th className="px-3 py-2">Exp</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Availability</th>
              <th className="px-3 py-2">Hotlist</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-3 py-2 font-medium">{c.consultantName}</td>
                <td className="px-3 py-2">{c.role}</td>
                <td className="max-w-[220px] truncate px-3 py-2" title={c.technologySkills}>
                  {c.technologySkills}
                </td>
                <td className="px-3 py-2">{c.visaStatus}</td>
                <td className="px-3 py-2">{relocationLabel(c.relocation)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.experience}</td>
                <td className="px-3 py-2">{c.location}</td>
                <td className="px-3 py-2">{c.availability}</td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Hotlist status for ${c.consultantName}`}
                    value={c.hotlistStatus ?? "Active"}
                    disabled={busyId === c.id}
                    onChange={(e) => run(c.id, () => setBenchHotlistStatus(c.id, e.target.value))}
                    className="rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/15 dark:bg-transparent"
                  >
                    {BENCH_HOTLIST_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <ConfirmButton
                    label="Remove"
                    confirmText={`Remove ${c.consultantName} from the hotlist?`}
                    onConfirm={() => run(c.id, () => setBenchConsultantHotlist(c.id, false))}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                  {consultants.length === 0
                    ? "No one is on the hotlist yet — add consultants from the Consultants tab."
                    : "No hotlist consultants match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {exportOpen && (
        <ExportModal
          companyName={companyName}
          all={consultants}
          filtered={filtered}
          onClose={() => setExportOpen(false)}
        />
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
  const [scope, setScope] = useState<Scope>("active");
  const [copied, setCopied] = useState<string | null>(null);

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
      setCopied("Copied — paste into a new email.");
    } catch {
      setCopied("Couldn't access the clipboard — use Download instead.");
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
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white p-6 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Export Hotlist</h2>
          <button onClick={onClose} className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white" aria-label="Close">
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
              <input type="radio" name="scope" checked={scope === value} onChange={() => setScope(value)} />
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
          {copied && <span className="mr-auto text-sm text-black/60 dark:text-white/60">{copied}</span>}
          <button type="button" onClick={download} disabled={rows.length === 0} className="rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15">
            Download .html
          </button>
          <button type="button" onClick={copy} disabled={rows.length === 0} className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black">
            Copy for email
          </button>
        </div>
      </div>
    </div>
  );
}
