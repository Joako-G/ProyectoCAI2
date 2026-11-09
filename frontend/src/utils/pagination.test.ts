import { describe, expect, it } from 'vitest';
import { clampPage, PAGE_SIZE, pageCount, pageNumbers, pageRange } from './pagination';

describe('pagination', () => {
  it('shows ten rows per page', () => {
    expect(PAGE_SIZE).toBe(10);
  });

  it('counts at least one page, even for an empty list', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(10)).toBe(1);
    expect(pageCount(11)).toBe(2);
    expect(pageCount(100)).toBe(10);
    expect(pageCount(101)).toBe(11);
  });

  it('clamps a page into the existing range', () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(-4, 3)).toBe(1);
    expect(clampPage(2, 3)).toBe(2);
    expect(clampPage(9, 3)).toBe(3);
  });

  it('describes the rows a page shows, one-based and inclusive', () => {
    expect(pageRange(1, 25)).toEqual({ from: 1, to: 10 });
    expect(pageRange(3, 25)).toEqual({ from: 21, to: 25 });
    expect(pageRange(1, 0)).toEqual({ from: 0, to: 0 });
  });

  it('lists every page number while there are few of them', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the far pages into gaps around the current one', () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(pageNumbers(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
    expect(pageNumbers(20, 20)).toEqual([1, 'gap', 19, 20]);
    expect(pageNumbers(3, 20)).toEqual([1, 2, 3, 4, 'gap', 20]);
  });
});
