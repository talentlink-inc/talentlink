"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Eye, FileText, FilterX } from "lucide-react";
import {
  EXPERIENCE_BANDS,
  REPOSITORY_COUNTRIES,
  REPOSITORY_PAGE_SIZE,
  REPOSITORY_SORTS,
  REPOSITORY_VISAS,
  resumeAge,
  type RepositoryQuery,
} from "@/lib/repository";
import { formatDate } from "@/lib/format";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { useOpenParam } from "@/lib/useOpenParam";
import { rowSelectClass } from "@/lib/tableRow";
import { buttonClass } from "@/components/ui/button";
import { VisaChip } from "@/components/ui/Chips";
import { RecordPanel } from "@/components/ui/RecordPanel";
import { emptyCellClass, rowClass, tableCardClass, tableClass, theadClass, toolbarInputClass } from "@/components/ui/table";
import { useDetailLoader } from "@/components/ui/useDetailLoader";
import { getRepositoryCandidate, type RepositoryCandidate } from "./actions";

export type RepositoryRow = {
  id: string;
  name: string;
  title: string | null;
  skills: string | null;
  visa: string | null;
  years: number | null;
  location: string | null;
  country: string | null;
  receivedAt: Date | null;
  resumeId: string | null;
  fileName: string | null;
};

type Permissions = { canViewResume: boolean; canDownloadResume: boolean };

export function RepositoryTable({
  rows,
  total,
  poolSize,
  query,
  permissions,
}: {
  rows: RepositoryRow[];
  total: number;
  poolSize: number;
  query: RepositoryQuery;
  permissions: Permissions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q);
  const [openId, setOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Always compact: the repository is a long list, density isn't a choice here.
  const cell = "px-3 py-1.5";
  const detail = useDetailLoader(getRepositoryCandidate, rows);

  // Filters live in the URL so results are shareable and Back works. Changes
  // build on the latest *requested* filters, not the last rendered ones —
  // otherwise two quick changes (or Clear followed by the debounced search)
  // raced and the second one restored the filters the first had changed.
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  }, [query]);
  const go = (patch: Partial<RepositoryQuery>) => {
    const next = { ...latest.current, ...patch, page: patch.page ?? 1 };
    latest.current = next;
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.visa) params.set("visa", next.visa);
    if (next.exp) params.set("exp", next.exp);
    if (next.country) params.set("country", next.country);
    if (next.sort && next.sort !== "added-desc") params.set("sort", next.sort);
    if (next.page > 1) params.set("page", String(next.page));
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }));
  };

  // Debounced search: query the server 300ms after typing stops.
  useEffect(() => {
    if (search.trim() === latest.current.q) return;
    const t = setTimeout(() => go({ q: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useOpenParam((id) => setOpenId(id));
  usePageShortcuts({
    onFocusSearch: () => searchRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const pages = Math.max(1, Math.ceil(total / REPOSITORY_PAGE_SIZE));
  const from = total === 0 ? 0 : (query.page - 1) * REPOSITORY_PAGE_SIZE + 1;
  const to = Math.min(query.page * REPOSITORY_PAGE_SIZE, total);
  const filtered = !!(query.q || query.visa || query.exp || query.country);

  const sortHeader = (label: string, asc: string, desc: string) => {
    const active = query.sort === asc ? "asc" : query.sort === desc ? "desc" : null;
    return (
      <button
        type="button"
        onClick={() => go({ sort: active === "asc" ? desc : asc })}
        className="inline-flex items-center gap-1 uppercase hover:text-primary"
        aria-label={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        {active === "asc" && <ArrowUp size={12} aria-hidden />}
        {active === "desc" && <ArrowDown size={12} aria-hidden />}
      </button>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-strong dark:text-white" title="Total resumes in the repository">
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold tabular-nums text-white">
            {poolSize.toLocaleString()}
          </span>
          Resumes
        </span>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search the repository"
          placeholder="Search name, skill, role, location…"
          className={`${toolbarInputClass} min-w-[200px] flex-1 md:max-w-xs`}
        />
        <select aria-label="Filter by visa" value={query.visa} onChange={(e) => go({ visa: e.target.value })} className={toolbarInputClass}>
          <option value="">All visas</option>
          {REPOSITORY_VISAS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Filter by experience" value={query.exp} onChange={(e) => go({ exp: e.target.value })} className={toolbarInputClass}>
          <option value="">All experience</option>
          {EXPERIENCE_BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by country" value={query.country} onChange={(e) => go({ country: e.target.value })} className={toolbarInputClass}>
          <option value="">All countries</option>
          {REPOSITORY_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c === "Other" ? "Other / unknown" : c}
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={query.sort} onChange={(e) => go({ sort: e.target.value })} className={toolbarInputClass}>
          {REPOSITORY_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              go({ q: "", visa: "", exp: "", country: "" });
            }}
            className={buttonClass("secondary")}
            title="Clear all filters"
          >
            <FilterX size={15} aria-hidden /> Clear
          </button>
        )}
      </div>

      {/* Phones: one card per resume (same pattern as the other lists). */}
      <ul className={`space-y-2 md:hidden ${pending ? "opacity-60" : ""}`} aria-label="Resumes">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setOpenId(r.id)}
              onTouchStart={() => void detail.prefetch(r.id)}
              className="w-full rounded-[10px] border border-line bg-white p-3 text-left shadow-sm dark:border-white/10 dark:bg-neutral-950"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-primary dark:text-[#9fa8da]">{r.name}</span>
                <VisaChip visa={r.visa} />
              </div>
              <div className="mt-1 truncate text-sm text-text-secondary">{r.title || "—"}</div>
              <div className="mt-1 text-xs text-text-muted">
                {[r.location, r.years != null ? `${r.years} yrs` : null, resumeAge(r.receivedAt)].filter(Boolean).join(" · ")}
              </div>
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className={emptyCellClass}>
            {poolSize === 0 ? "The repository is empty — resumes appear here once they're migrated from GAS." : "No resumes match your filters."}
          </li>
        )}
      </ul>

      <div className={`${tableCardClass} hidden md:block`}>
        {/* Slim progress strip while new results load (GAS .rdb-progress). */}
        <div className="h-0.5 overflow-hidden bg-transparent" aria-hidden>
          {pending && <div className="h-full w-1/3 animate-[tl-progress_1.1s_linear_infinite] bg-primary" />}
        </div>
        <table className={`${tableClass} min-w-[1000px]`} aria-busy={pending}>
          <thead className={theadClass}>
            <tr>
              <th className={cell}>{sortHeader("Name", "name-asc", "name-desc")}</th>
              <th className={cell}>Role / title</th>
              <th className={cell}>Top skills</th>
              <th className={cell}>Visa</th>
              <th className={cell}>{sortHeader("Yrs", "years-asc", "years-desc")}</th>
              <th className={cell}>{sortHeader("Location", "location-asc", "location-asc")}</th>
              <th className={cell}>{sortHeader("Country", "country-asc", "country-asc")}</th>
              <th className={cell}>{sortHeader("Resume age", "added-asc", "added-desc")}</th>
            </tr>
          </thead>
          <tbody className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                onMouseEnter={() => void detail.prefetch(r.id)}
                className={`cursor-pointer ${rowClass} ${rowSelectClass(r.id === openId)}`}
              >
                <td className={`${cell} max-w-[220px]`}>
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-primary dark:text-[#9fa8da]" title={r.name}>
                    <FileText size={14} className="shrink-0 text-text-muted" aria-hidden />
                    <span className="truncate">{r.name}</span>
                  </span>
                </td>
                <td className={`${cell} max-w-[220px] truncate`} title={r.title ?? undefined}>
                  {r.title || "—"}
                </td>
                <td className={`${cell} max-w-[260px] truncate text-[12px] text-text-secondary`} title={r.skills ?? undefined}>
                  {r.skills || "—"}
                </td>
                <td className={cell}>
                  <VisaChip visa={r.visa} />
                </td>
                <td className={`${cell} tabular-nums text-text-secondary`}>{r.years ?? "—"}</td>
                <td className={`${cell} max-w-[160px] truncate text-text-secondary`} title={r.location ?? undefined}>
                  {r.location || "—"}
                </td>
                <td className={`${cell} text-text-secondary`}>{r.country || "Other"}</td>
                <td className={`${cell} whitespace-nowrap text-text-secondary`} title={r.receivedAt ? formatDate(r.receivedAt) : undefined}>
                  {resumeAge(r.receivedAt)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className={emptyCellClass}>
                  {poolSize === 0
                    ? "The repository is empty — resumes appear here once they're migrated from GAS."
                    : "No resumes match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
        <span>
          {total === 0 ? "No resumes" : `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()} resumes`}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            disabled={query.page <= 1 || pending}
            onClick={() => go({ page: query.page - 1 })}
            className={buttonClass("secondary", "sm")}
          >
            Previous
          </button>
          <span className="tabular-nums">
            Page {query.page} of {pages}
          </span>
          <button
            type="button"
            disabled={query.page >= pages || pending}
            onClick={() => go({ page: query.page + 1 })}
            className={buttonClass("secondary", "sm")}
          >
            Next
          </button>
        </span>
      </div>

      {openId && (
        <CandidatePanel
          key={openId}
          id={openId}
          row={rows.find((r) => r.id === openId)}
          load={detail.load}
          permissions={permissions}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function CandidatePanel({
  id,
  row,
  load,
  permissions,
  onClose,
}: {
  id: string;
  row: RepositoryRow | undefined;
  load: (id: string) => Promise<RepositoryCandidate | null>;
  permissions: Permissions;
  onClose: () => void;
}) {
  const [c, setC] = useState<RepositoryCandidate | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    load(id).then(
      (v) => live && setC(v),
      () => live && setC(null)
    );
    return () => {
      live = false;
    };
  }, [id, load]);

  const name = c === null ? "Resume not found" : (c?.name ?? row?.name ?? "Loading…");
  const title = c?.title ?? row?.title;
  const r = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-2 border-b border-line-soft py-2 text-sm dark:border-white/10">
      <dt className="text-text-muted">{label}</dt>
      <dd className="col-span-2 break-words">{value || "—"}</dd>
    </div>
  );
  return (
    <RecordPanel title={name} subtitle={title ?? undefined} onClose={onClose}>
      {c === undefined ? (
        <div className="space-y-3 pt-1" role="status" aria-label="Loading">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <div className="tl-skeleton h-3.5 w-20" />
              <div className="tl-skeleton col-span-2 h-3.5" style={{ width: `${55 + ((i * 19) % 40)}%` }} />
            </div>
          ))}
        </div>
      ) : c === null ? (
        <p className="text-sm text-text-secondary">This resume is no longer in the repository.</p>
      ) : (
        <>
          {c.resume && permissions.canViewResume && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-[#f7f8fa] p-3 dark:border-white/10 dark:bg-white/5">
              <FileText size={18} className="text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={c.resume.fileName ?? undefined}>
                {c.resume.fileName ?? "Resume"}
              </span>
              <a href={`/api/resumes/${c.resume.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                <Eye size={14} aria-hidden /> View
              </a>
              {permissions.canDownloadResume && (
                <a href={`/api/resumes/${c.resume.id}?download=1`} className={buttonClass("primary", "sm")}>
                  <Download size={14} aria-hidden /> Download
                </a>
              )}
            </div>
          )}
          <dl>
            {r("Email", c.email ?? (permissions.canViewResume ? null : "Restricted"))}
            {r("Phone", c.phone)}
            {r("Location", c.location)}
            {r("Country", c.country)}
            {r("Visa", c.visa && <VisaChip visa={c.visa} />)}
            {r("Experience", c.years && `${c.years} yrs`)}
            {r("Skills", c.skills && <span className="whitespace-pre-wrap">{c.skills}</span>)}
            {r(
              "LinkedIn",
              c.linkedinUrl && /^https?:\/\//.test(c.linkedinUrl) ? (
                <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  {c.linkedinUrl}
                </a>
              ) : (
                c.linkedinUrl
              )
            )}
            {r("Received", c.receivedAt && `${formatDate(c.receivedAt)} (${resumeAge(c.receivedAt)} ago)`)}
            {r("Added by", c.addedBy)}
          </dl>
        </>
      )}
    </RecordPanel>
  );
}
