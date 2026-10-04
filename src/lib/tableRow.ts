// Shared row-select highlight for every clickable list table (Requirements,
// Submissions, Interviews, Placements, Users) — mirrors the original app's
// Excel-style single-row select (toggleRowSelect/rowSelectClass in
// Index.html): click a row to open it, and it stays marked as the last one
// selected — even after the view modal closes — until another row is
// clicked. Low-contrast on purpose; it's a "where was I" cue, not emphasis (brand teal tint, design review 1B).
export function rowSelectClass(isSelected: boolean): string {
  return isSelected
    ? "bg-brand-soft hover:bg-brand-soft dark:bg-brand/15 dark:hover:bg-brand/20"
    : "hover:bg-slate-50 dark:hover:bg-white/[0.03]";
}
