// List pages load their rows once and search/filter/paginate in the browser
// (see usePagination), so this cap is effectively "how many records the
// page can ever show". It used to be 100, which silently hid everything
// older — including most of the imported GAS history, and anything a global
// search result's ?open= link pointed at. This is a safety ceiling, not a
// page size; past it, these pages need real server-side pagination.
export const MAX_LIST_ROWS = 5000;
