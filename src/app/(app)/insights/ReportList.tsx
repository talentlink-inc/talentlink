"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toCsv } from "@/lib/insights";
import { usePagination } from "@/lib/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/button";
import { useCellClass, useUi } from "@/components/ui/UiProvider";
import { emptyCellClass, tableCardClass, tableClass, theadClass, toolbarInputClass, rowClass } from "@/components/ui/table";

export type ReportColumn = { key: string; label: string; status?: boolean; nowrap?: boolean; mono?: boolean };
export type ReportRow = { id: string; href?: string; [key: string]: string | number | null | undefined };

// The detail list under a report: search, pages of 25, each row links to its
// record, and "Export CSV" downloads exactly what's listed (search applied).
// Rows arrive already redacted for the viewer's permissions.
export function ReportList({
  title,
  columns,
  rows,
  csvName,
  emptyText,
}: {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  csvName: string;
  emptyText: string;
}) {
  const [search, setSearch] = useState("");
  const cell = useCellClass();
  const { toast } = useUi();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)));
  }, [rows, columns, search]);
  const { page, setPage, paged, totalPages, start, end, total } = usePagination(filtered, 25);

  function exportCsv() {
    const csv = toCsv(
      columns.map((c) => c.label),
      filtered.map((r) => columns.map((c) => r[c.key] ?? ""))
    );
    // BOM so Excel opens UTF-8 names correctly.
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ message: `Exported ${filtered.length} row${filtered.length === 1 ? "" : "s"}`, tone: "success" });
  }

  return (
    <section className="mb-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-semibold">
          {title} <span className="font-normal text-black/50 dark:text-white/50">· {filtered.length}</span>
        </h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={`Search ${title.toLowerCase()}`}
          placeholder="Search this list…"
          className={`${toolbarInputClass} w-full sm:w-64`}
        />
        <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className={buttonClass("secondary")}>
          <Download size={15} aria-hidden /> Export CSV
        </button>
      </div>
      <div className={tableCardClass}>
        <table className={`${tableClass} min-w-[760px]`}>
          <thead className={theadClass}>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cell}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id} className={rowClass}>
                {columns.map((c, i) => {
                  const v = r[c.key];
                  const content = c.status ? <StatusChip status={v ? String(v) : null} /> : (v ?? "—");
                  return (
                    <td
                      key={c.key}
                      className={`${cell} ${c.nowrap ? "whitespace-nowrap" : ""} ${c.mono ? "font-mono text-xs text-black/55 dark:text-white/55" : ""} ${i === 1 ? "font-medium" : ""}`}
                    >
                      {i === 0 && r.href ? (
                        <Link href={r.href} className="hover:text-brand-strong hover:underline">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className={emptyCellClass}>
                  {rows.length === 0 ? emptyText : "Nothing matches your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} start={start} end={end} total={total} onPageChange={setPage} />
    </section>
  );
}
