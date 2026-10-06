import type { LucideIcon } from "lucide-react";

// GAS stat card: a coloured icon tile, a big number and a muted label.
// Optionally a button (e.g. a status filter) — pressed shows an indigo ring.
export type StatTone = "blue" | "green" | "orange" | "purple" | "cyan" | "red" | "amber";

const TILE: Record<StatTone, string> = {
  blue: "bg-[#e3f2fd] text-[#1565c0]",
  green: "bg-[#e8f5e9] text-[#2e7d32]",
  orange: "bg-[#fff3e0] text-[#e65100]",
  purple: "bg-[#f3e5f5] text-[#6a1b9a]",
  cyan: "bg-[#e0f7fa] text-[#00838f]",
  red: "bg-[#ffebee] text-[#c62828]",
  amber: "bg-[#fff8e1] text-[#f57f17]",
};

export function StatCard({
  icon: Icon,
  tone,
  value,
  label,
  onClick,
  pressed,
}: {
  icon: LucideIcon;
  tone: StatTone;
  value: number | string;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  const body = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TILE[tone]}`} aria-hidden>
        <Icon size={22} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[26px] leading-none font-bold text-text-strong tabular-nums dark:text-white">{value}</span>
        <span className="mt-1 block truncate text-[12.5px] font-medium text-text-muted">{label}</span>
      </span>
    </>
  );
  const cls = `flex items-center gap-4 rounded-[10px] border bg-white px-5 py-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all dark:bg-neutral-950 ${
    pressed ? "border-primary ring-2 ring-primary/15" : "border-line-soft dark:border-white/10"
  }`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={`${cls} hover:-translate-y-0.5 hover:shadow-md`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">{children}</div>;
}
