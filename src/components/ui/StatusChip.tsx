import { statusLabel, statusTone, type StatusTone } from "@/lib/statusLabels";

const TONE_CLASSES: Record<StatusTone, string> = {
  early: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  progress: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  placed: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  closed: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-white/70 dark:ring-white/15",
};

// Plain-English, colour-coded status (design review 4A). The raw stored
// code stays available as a tooltip for people used to GAS's wording.
export function StatusChip({ status, className = "" }: { status: string | null | undefined; className?: string }) {
  return (
    <span
      title={status ?? undefined}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONE_CLASSES[statusTone(status)]} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}
