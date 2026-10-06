// Small inline chips used across the tables (GAS badge styles).

// Visa: green for USC/GC, blue for H1B/L1, amber for OPT/CPT, grey otherwise
// (GAS getVisaBadgeClass).
export function VisaChip({ visa }: { visa: string | null | undefined }) {
  if (!visa) return <span className="text-text-muted">—</span>;
  const v = visa.trim().toUpperCase();
  const tone =
    v === "USC" || v === "GC" || v === "GC-EAD"
      ? "bg-[#e8f5e9] text-[#2e7d32]"
      : v === "H1B" || v === "L1"
        ? "bg-[#e3f2fd] text-[#1565c0]"
        : v === "OPT" || v === "CPT" || v.includes("STEM")
          ? "bg-[#fff8e1] text-[#f57f17]"
          : "bg-[#f0f0f0] text-[#555]";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tone}`}>{visa}</span>;
}

// Record IDs (JOB-0323, SUB-0624…): indigo monospace, like GAS's .cell-link-id.
export const idClass = "font-mono text-[11.5px] font-semibold whitespace-nowrap text-primary dark:text-[#9fa8da]";

// A requirement's Job ID shown inside other tables (soft blue pill).
export function JobIdChip({ jobId }: { jobId: string | null | undefined }) {
  if (!jobId) return <span className="text-text-muted">—</span>;
  return (
    <span className="inline-flex rounded-full bg-[#e3f2fd] px-2 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-[#1565c0]">
      {jobId}
    </span>
  );
}

// Plain grey chip (roles, employment types).
export function SoftChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#555] dark:bg-white/10 dark:text-white/70">
      {children}
    </span>
  );
}

// Coloured initials for a person (Assigned to); stable colour per name.
const AVATAR = ["#e65100", "#c62828", "#6a1b9a", "#1565c0", "#00838f", "#2e7d32", "#ad1457", "#4527a0"];
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
export function Avatars({ names, max = 3 }: { names: string[]; max?: number }) {
  if (names.length === 0) return <span className="text-text-muted">—</span>;
  const shown = names.slice(0, max);
  return (
    <span className="inline-flex items-center" title={names.join(", ")}>
      {shown.map((n, i) => {
        let h = 0;
        for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return (
          <span
            key={`${n}-${i}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9.5px] font-bold text-white ring-2 ring-white dark:ring-neutral-950"
            style={{ background: AVATAR[h % AVATAR.length], marginLeft: i === 0 ? 0 : -6, zIndex: shown.length - i }}
          >
            {initialsOf(n)}
          </span>
        );
      })}
      {names.length > max && <span className="ml-1 text-[11px] font-semibold text-text-muted">+{names.length - max}</span>}
    </span>
  );
}
