import type { Expense } from '../../expenses/types/expense';

const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface MonthPoint {
  /** `YYYY-MM`. */
  month: string;
  /** Short label such as `oct 26`. */
  label: string;
  income: number;
  /** Absent when the expenses could not be read, so the chart never shows a made-up zero. */
  expense?: number;
}

/** The `count` months ending at the month of `today` (`YYYY-MM-DD`), oldest first. */
export function lastMonths(today: string, count: number): string[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_unused, index) => {
    const offset = count - 1 - index;
    const date = new Date(Date.UTC(year, month - offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export function monthLabel(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;
}

/** Income per month, with the expenses of the same month when they are known. */
export function buildMonthlySeries(months: string[], incomes: number[], expenses?: Expense[]): MonthPoint[] {
  return months.map((month, index) => ({
    month,
    label: monthLabel(month),
    income: incomes[index] ?? 0,
    expense: expenses
      ? expenses.filter(({ date }) => date.startsWith(month)).reduce((sum, { amount }) => sum + amount, 0)
      : undefined,
  }));
}

/** Height of a bar as a whole percentage of the tallest value; a tiny bar still shows when the value is above zero. */
export function barPercent(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}

/** Colors of the pie slices, in the order of the ranking; disciplines past the palette share the last grey. */
export const PIE_COLORS = ['#1f4e8c', '#d9a441', '#2f8f6b', '#c0563f', '#7a5ca8', '#3a9bb0', '#a3a33a', '#d17aa0'] as const;
export const PIE_OTHER_COLOR = '#9a9a94';

export const pieColor = (index: number): string => PIE_COLORS[index] ?? PIE_OTHER_COLOR;

/**
 * Where each slice of a ring of the given `circumference` starts and how long it is, in the same unit, so a circle
 * stroked with `strokeDasharray`/`strokeDashoffset` draws the pie. A thin gap separates the slices when there are
 * several; with a single slice the ring is closed.
 */
export function pieSlices(values: readonly number[], circumference: number, gap = 2): Array<{ start: number; length: number }> {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return values.map(() => ({ start: 0, length: 0 }));
  const separation = values.filter((value) => value > 0).length > 1 ? gap : 0;
  let start = 0;
  return values.map((value) => {
    const share = (Math.max(0, value) / total) * circumference;
    const slice = { start, length: Math.max(0, share - separation) };
    start += share;
    return slice;
  });
}

/** The longest range the server answers, in months. */
export const MAX_RANGE_MONTHS = 24;

export type RangePreset = 'month' | 'previous' | 'quarter' | 'half' | 'year';

export const RANGE_PRESETS: ReadonlyArray<{ value: RangePreset; label: string }> = [
  { value: 'month', label: 'Este mes' },
  { value: 'previous', label: 'Mes anterior' },
  { value: 'quarter', label: 'Últimos 3 meses' },
  { value: 'half', label: 'Últimos 6 meses' },
  { value: 'year', label: 'Este año' },
];

/** The months a preset covers, ending at the month of `today`; `previous` is the month before it alone. */
export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const current = today.slice(0, 7);
  if (preset === 'month') return { from: current, to: current };
  if (preset === 'previous') {
    const previous = lastMonths(today, 2)[0];
    return { from: previous, to: previous };
  }
  if (preset === 'quarter') return { from: lastMonths(today, 3)[0], to: current };
  if (preset === 'half') return { from: lastMonths(today, 6)[0], to: current };
  return { from: `${today.slice(0, 4)}-01`, to: current };
}

/** Spanish reason a range cannot be asked for, or `undefined` when it can. */
export function rangeProblem(from: string, to: string): string | undefined {
  if (from === '' || to === '') return 'Elegí el mes de inicio y el de fin.';
  if (from > to) return 'El mes de inicio no puede ser posterior al de fin.';
  const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
  return months > MAX_RANGE_MONTHS ? `El período puede abarcar hasta ${MAX_RANGE_MONTHS} meses.` : undefined;
}

/** Every month from `from` to `to`, both included, as `YYYY-MM`. */
export function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  while (`${year}-${String(month).padStart(2, '0')}` <= to) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

const MONTH_FULL_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fullName = (month: string) => MONTH_FULL_NAMES[Number(month.slice(5, 7)) - 1];

/** The month spelled out, such as `octubre de 2026`. */
export function monthName(month: string): string {
  return `${fullName(month)} de ${month.slice(0, 4)}`;
}

/** A period in words: `noviembre de 2026`, `de junio a noviembre de 2026`, `de noviembre de 2025 a octubre de 2026`. */
export function periodLabel(from: string, to: string): string {
  if (from === to) return monthName(to);
  return from.slice(0, 4) === to.slice(0, 4) ? `de ${fullName(from)} a ${monthName(to)}` : `de ${monthName(from)} a ${monthName(to)}`;
}

/** A share without decimals, such as `70 %`; a part too small to round to one still says it is there. */
export function wholeShare(part: number, total: number): string {
  if (total <= 0) return '—';
  const percent = Math.round((part / total) * 100);
  return percent === 0 && part > 0 ? 'menos del 1 %' : `${percent} %`;
}
