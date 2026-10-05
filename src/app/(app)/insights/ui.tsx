import Link from "next/link";
import type { Count } from "@/lib/insights";

// Presentational building blocks for Insights. Server components: no state.

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function Kpi({
  label,
  value,
  detail,
  change,
  href,
}: {
  label: string;
  value: number | string;
  detail?: React.ReactNode;
  change?: number | null; // % vs previous period
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[11px] font-semibold tracking-wide text-black/50 uppercase dark:text-white/50">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {change !== undefined && change !== null && (
          <span
            className={`text-xs font-semibold tabular-nums ${change > 0 ? "text-emerald-700 dark:text-emerald-400" : change < 0 ? "text-red-700 dark:text-red-400" : "text-black/45"}`}
            title="Compared with the previous period"
          >
            {change > 0 ? "▲" : change < 0 ? "▼" : "•"} {Math.abs(change)}%
          </span>
        )}
      </div>
      {detail && <div className="mt-0.5 text-xs text-black/55 dark:text-white/55">{detail}</div>}
    </>
  );
  const cls =
    "block rounded-lg border border-black/10 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-neutral-950";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-brand/60 hover:bg-brand-soft/30`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Panel({
  title,
  note,
  action,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-950 ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Horizontal bars, scaled to the largest value; long lists show the top N. */
export function BarList({
  items,
  limit = 8,
  showPctOf,
  empty = "Nothing in this period.",
}: {
  items: Count[];
  limit?: number;
  showPctOf?: number; // show "x%" of this total next to each count
  empty?: string;
}) {
  if (items.length === 0 || items.every((i) => i.count === 0)) {
    return <p className="py-4 text-center text-sm text-black/45 dark:text-white/45">{empty}</p>;
  }
  const shown = items.slice(0, limit);
  const max = Math.max(...shown.map((i) => i.count), 1);
  const rest = items.slice(limit).reduce((n, i) => n + i.count, 0);
  return (
    <ul className="space-y-1.5">
      {shown.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-black/75 dark:text-white/75" title={i.label}>
            {i.label}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/10" aria-hidden>
            <span className="block h-full rounded-full bg-brand" style={{ width: `${(i.count / max) * 100}%` }} />
          </span>
          <span className="w-16 text-right tabular-nums">
            {i.count}
            {showPctOf ? (
              <span className="ml-1 text-xs text-black/45 dark:text-white/45">
                {showPctOf ? Math.round((i.count / showPctOf) * 100) : 0}%
              </span>
            ) : null}
          </span>
        </li>
      ))}
      {rest > 0 && <li className="pt-1 text-xs text-black/45 dark:text-white/45">+ {rest} more in other groups</li>}
    </ul>
  );
}

/** Vertical columns for a short time series (e.g. 6 months). */
export function ColumnChart({ items }: { items: Count[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={items.map((i) => `${i.label}: ${i.count}`).join(", ")}>
      {items.map((i, idx) => (
        <div key={i.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold tabular-nums">{i.count}</span>
          <div
            className={`w-full max-w-12 rounded-t ${idx === items.length - 1 ? "bg-brand" : "bg-brand/40"}`}
            style={{ height: `${Math.max((i.count / max) * 100, i.count ? 4 : 1)}%` }}
          />
          <span className="truncate text-[11px] text-black/50 dark:text-white/50">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

export function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 grid gap-4 lg:grid-cols-2">{children}</div>;
}
