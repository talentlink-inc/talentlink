// Shared list-table styling, GAS style (Css.html "Tables"): white card with a
// hairline border, light grey uppercase column headers, compact 13px rows.
// Cell padding comes from useCellClass() so the compact/comfortable toggle
// applies everywhere.
export const tableCardClass =
  "overflow-x-auto rounded-[10px] border border-line bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-950";
export const tableClass = "w-full text-left text-[13px] text-text-strong dark:text-white/90";
export const theadClass =
  "border-b-2 border-line bg-[#f7f8fa] text-[11px] font-semibold tracking-[0.04em] text-text-secondary uppercase dark:border-white/10 dark:bg-white/5 dark:text-white/60";
export const rowClass = "border-t border-line-soft transition-colors hover:bg-[#f8f9fb] dark:border-white/10 dark:hover:bg-white/5";
export const toolbarInputClass =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-text-strong placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 dark:border-white/15 dark:bg-transparent dark:text-white";
export const emptyCellClass = "px-4 py-10 text-center text-sm text-text-muted";
