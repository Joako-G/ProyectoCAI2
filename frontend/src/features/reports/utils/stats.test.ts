import { describe, expect, it } from 'vitest';
import type { Expense } from '../../expenses/types/expense';
import { barPercent, buildMonthlySeries, lastMonths, monthLabel, monthName, periodLabel, pieColor, pieSlices, presetRange, rangeProblem, wholeShare } from './stats';

const expense = (date: string, amount: number): Expense => ({ id: date, date, amount, category: 'other', description: 'x', createdBy: 'u', createdAt: date });

describe('lastMonths', () => {
  it('ends at the current month and crosses the year boundary', () => {
    expect(lastMonths('2026-02-10', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('monthLabel', () => {
  it('uses a short Spanish month and a two-digit year', () => expect(monthLabel('2026-10')).toBe('oct 26'));
});

describe('buildMonthlySeries', () => {
  it('adds the expenses of each month', () => {
    const series = buildMonthlySeries(['2026-09', '2026-10'], [100, 200], [expense('2026-09-03', 30), expense('2026-09-20', 20), expense('2026-10-01', 5)]);
    expect(series.map(({ income, expense: spent }) => [income, spent])).toEqual([[100, 50], [200, 5]]);
  });

  it('leaves the expenses empty when they are unknown', () => {
    expect(buildMonthlySeries(['2026-10'], [200])[0].expense).toBeUndefined();
  });
});

describe('barPercent', () => {
  it('scales to the tallest value and keeps small values visible', () => {
    expect(barPercent(50, 200)).toBe(25);
    expect(barPercent(1, 1000)).toBe(2);
    expect(barPercent(0, 1000)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
  });
});

describe('pieSlices', () => {
  it('lays the slices one after the other around the ring, leaving a gap between them', () => {
    expect(pieSlices([75, 25], 100, 2)).toEqual([{ start: 0, length: 73 }, { start: 75, length: 23 }]);
  });

  it('closes the ring when a single discipline took everything and draws nothing without income', () => {
    expect(pieSlices([40, 0], 100, 2)).toEqual([{ start: 0, length: 100 }, { start: 100, length: 0 }]);
    expect(pieSlices([0, 0], 100)).toEqual([{ start: 0, length: 0 }, { start: 0, length: 0 }]);
  });
});

describe('pieColor', () => {
  it('gives each of the first disciplines its own color and the rest the same grey', () => {
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7].map(pieColor)).size).toBe(8);
    expect(pieColor(8)).toBe(pieColor(20));
  });
});

describe('presetRange', () => {
  it('covers the month, the previous month, the last three months and the year so far', () => {
    expect(presetRange('month', '2026-02-10')).toEqual({ from: '2026-02', to: '2026-02' });
    expect(presetRange('previous', '2026-01-10')).toEqual({ from: '2025-12', to: '2025-12' });
    expect(presetRange('quarter', '2026-02-10')).toEqual({ from: '2025-12', to: '2026-02' });
    expect(presetRange('year', '2026-10-10')).toEqual({ from: '2026-01', to: '2026-10' });
  });
});

describe('rangeProblem', () => {
  it('accepts a valid range and explains the ones the server would refuse', () => {
    expect(rangeProblem('2026-01', '2026-10')).toBeUndefined();
    expect(rangeProblem('2024-11', '2026-10')).toBeUndefined();
    expect(rangeProblem('', '2026-10')).toMatch(/Elegí/);
    expect(rangeProblem('2026-10', '2026-09')).toMatch(/posterior/);
    expect(rangeProblem('2024-10', '2026-10')).toMatch(/24 meses/);
  });
});

describe('plain wording', () => {
  it('spells a month and a period out', () => {
    expect(monthName('2026-10')).toBe('octubre de 2026');
    expect(periodLabel('2026-11', '2026-11')).toBe('noviembre de 2026');
    expect(periodLabel('2026-06', '2026-11')).toBe('de junio a noviembre de 2026');
    expect(periodLabel('2025-11', '2026-10')).toBe('de noviembre de 2025 a octubre de 2026');
  });

  it('gives a share without decimals and never hides a small part as zero', () => {
    expect(wholeShare(7000, 10000)).toBe('70 %');
    expect(wholeShare(1, 1000)).toBe('menos del 1 %');
    expect(wholeShare(0, 1000)).toBe('0 %');
    expect(wholeShare(5, 0)).toBe('—');
  });
});
