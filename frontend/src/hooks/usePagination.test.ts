import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePagination } from './usePagination';

const rows = (count: number) => Array.from({ length: count }, (_unused, index) => index + 1);

describe('usePagination', () => {
  it('returns the first ten rows and the page count', () => {
    const { result } = renderHook(() => usePagination(rows(25)));
    expect(result.current.page).toBe(1);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.total).toBe(25);
    expect(result.current.pageItems).toEqual(rows(10));
  });

  it('has a single page when ten rows or fewer exist', () => {
    const { result } = renderHook(() => usePagination(rows(10)));
    expect(result.current.pageCount).toBe(1);
    expect(result.current.pageItems).toHaveLength(10);
  });

  it('moves to another page and shows its rows', () => {
    const { result } = renderHook(() => usePagination(rows(25)));
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    expect(result.current.pageItems).toEqual([21, 22, 23, 24, 25]);
  });

  it('ignores a page outside the range', () => {
    const { result } = renderHook(() => usePagination(rows(25)));
    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(3);
    act(() => result.current.setPage(-2));
    expect(result.current.page).toBe(1);
  });

  it('stays on the last page that still exists when the list shrinks', () => {
    const { result, rerender } = renderHook(({ items }) => usePagination(items), { initialProps: { items: rows(25) } });
    act(() => result.current.setPage(3));
    rerender({ items: rows(12) });
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems).toEqual([11, 12]);
  });

  it('goes back to the first page when the reset key changes', () => {
    const { result, rerender } = renderHook(({ key }) => usePagination(rows(25), key), { initialProps: { key: 'a' } });
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    rerender({ key: 'b' });
    expect(result.current.page).toBe(1);
  });

  it('keeps the page when the list is reloaded with the same key', () => {
    const { result, rerender } = renderHook(({ items }) => usePagination(items, 'same'), { initialProps: { items: rows(25) } });
    act(() => result.current.setPage(2));
    rerender({ items: rows(26) });
    expect(result.current.page).toBe(2);
  });
});
