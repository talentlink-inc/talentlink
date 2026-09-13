import { useMemo, useState } from "react";

// Client-side pagination — mirrors the original app's paginateData/
// renderPagination (Index.html): all matching rows are already loaded and
// filtered in the browser, this just slices them into pages for display.
// Resets to page 1 whenever the input list changes (a new search/filter
// naturally shrinks or grows it) so you're never stranded on a page number
// that no longer exists.
export function usePagination<T>(items: T[], perPage = 25) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return items.slice(start, start + perPage);
  }, [items, safePage, perPage]);

  const start = items.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const end = Math.min(safePage * perPage, items.length);

  return { page: safePage, setPage, totalPages, paged, start, end, total: items.length };
}
