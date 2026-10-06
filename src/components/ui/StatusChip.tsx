import { statusColor, statusLabel } from "@/lib/statusLabels";

// Outlined status pill in the status's GAS colour, with a plain-English label
// (design review 4A); the stored code is the tooltip.
export function StatusChip({ status, className = "" }: { status: string | null | undefined; className?: string }) {
  const color = statusColor(status);
  return (
    <span
      title={status ?? undefined}
      style={{ color, borderColor: color }}
      className={`inline-flex items-center rounded-full border-[1.5px] bg-white px-2.5 py-px text-[11px] font-semibold whitespace-nowrap dark:bg-transparent ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}
