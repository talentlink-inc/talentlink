// Shared row-select highlight for every clickable list table (Requirements,
// Submissions, Interviews, Placements, Users) — mirrors the original app's
// Excel-style single-row select (toggleRowSelect/rowSelectClass in
// Index.html): click a row to open it, and it stays marked as the last one
// selected — even after the view modal closes — until another row is
// clicked. Low-contrast on purpose; it's a "where was I" cue, not emphasis.
export function rowSelectClass(isSelected: boolean): string {
  return isSelected
    ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/15"
    : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]";
}
