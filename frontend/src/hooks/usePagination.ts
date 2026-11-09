import { useState } from 'react';
import { clampPage, PAGE_SIZE, pageCount } from '../utils/pagination';

export interface Pagination<T> {
  /** Current page, one-based and always an existing one. */
  page: number;
  pageCount: number;
  /** Total rows of the whole list. */
  total: number;
  /** The rows of the current page. */
  pageItems: T[];
  setPage: (page: number) => void;
}

/**
 * Client-side pagination of an already loaded list. A list that shrinks keeps the reader on the last page it still has;
 * a changed `resetKey` (a new search or filter) sends the reader back to the first page.
 */
export function usePagination<T>(items: readonly T[], resetKey = ''): Pagination<T> {
  const [state, setState] = useState({ page: 1, resetKey });
  // Adjusting state while rendering is the supported way to reset it when an input changes, with no extra render pass.
  if (state.resetKey !== resetKey) setState({ page: 1, resetKey });

  const count = pageCount(items.length);
  const page = clampPage(state.resetKey === resetKey ? state.page : 1, count);
  const start = (page - 1) * PAGE_SIZE;
  return {
    page,
    pageCount: count,
    total: items.length,
    pageItems: items.slice(start, start + PAGE_SIZE),
    setPage: (next) => setState({ page: clampPage(next, count), resetKey }),
  };
}
