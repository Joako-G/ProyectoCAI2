/** Rows shown on each page of a paginated list. */
export const PAGE_SIZE = 10;

/** Lists with more pages than this collapse the far page numbers into gaps. */
const MAX_PAGE_BUTTONS = 7;

/** Number of pages a list needs; an empty list still has one (empty) page. */
export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Keeps a page number inside `1..count`, so a list that shrinks never leaves the reader on a missing page. */
export function clampPage(page: number, count: number): number {
  return Math.min(Math.max(page, 1), count);
}

/** First and last row (one-based, inclusive) shown on a page; `0..0` for an empty list. */
export function pageRange(page: number, total: number, pageSize = PAGE_SIZE): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  return { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total) };
}

/** The page buttons to draw: every page when they are few, otherwise the ends and the neighbours of the current page. */
export function pageNumbers(page: number, count: number): Array<number | 'gap'> {
  if (count <= MAX_PAGE_BUTTONS) return Array.from({ length: count }, (_unused, index) => index + 1);
  const wanted = new Set([1, count, page - 1, page, page + 1].filter((value) => value >= 1 && value <= count));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) {
      // A single hidden page is shown instead of a gap: the gap would be no shorter than the number.
      result.push(value - previous === 2 ? value - 1 : 'gap');
    }
    result.push(value);
  });
  return result;
}
