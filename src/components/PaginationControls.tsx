// Mirrors the original app's renderPagination (Index.html): hidden entirely
// when everything fits on one page, otherwise "start-end of total" plus
// «/‹ page-numbers ›/» — up to 5 page buttons centered on the current page.
export function PaginationControls({
  page,
  totalPages,
  start,
  end,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  let startP = Math.max(1, page - 2);
  const endP = Math.min(totalPages, startP + 4);
  if (endP - startP < 4) startP = Math.max(1, endP - 4);
  const pages = Array.from({ length: endP - startP + 1 }, (_, i) => startP + i);

  const btnClass =
    "rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-40 dark:border-white/15";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-1 text-xs">
      <span className="mr-2 text-black/50 dark:text-white/50">
        {start}-{end} of {total}
      </span>
      <button disabled={page <= 1} onClick={() => onPageChange(1)} className={btnClass}>
        «
      </button>
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={btnClass}>
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`rounded border px-2.5 py-1 text-xs ${
            p === page
              ? "border-black bg-black font-semibold text-white dark:border-white dark:bg-white dark:text-black"
              : "border-black/15 dark:border-white/15"
          }`}
        >
          {p}
        </button>
      ))}
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className={btnClass}>
        ›
      </button>
      <button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} className={btnClass}>
        »
      </button>
    </div>
  );
}
