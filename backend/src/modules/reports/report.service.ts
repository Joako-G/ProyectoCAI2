import { CHARGE_LINE_KINDS } from '../payments/charge.types.js';
import type { ClubDate } from '../payments/charge.types.js';
import { PAYMENT_METHODS } from '../payments/payment.types.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import {
  REPORT_GRANULARITIES,
  type DisciplineIncome,
  type DisciplineIncomeQuery,
  type DisciplineSettlement,
  type DisciplineSettlementQuery,
  type IncomeEntry,
  type IncomeSource,
  type RevenueQuery,
  type RevenueReport,
} from './report.types.js';

// Ports owned by the reports module; the members and disciplines services satisfy them as they are.
export interface ReportServiceDeps {
  income: IncomeSource;
  members: { list(): Promise<Array<{ id: string; memberNumber: string; firstName: string; lastName: string }>> };
  disciplines: { findByIds(ids: readonly string[]): Promise<Array<{ id: string; name: string }>> };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_INCOME_MONTHS = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: unknown): Date {
  const parsed = typeof value === 'string' && DATE.test(value) ? new Date(`${value}T00:00:00Z`) : undefined;
  // Round-tripping rejects dates that only look valid, such as 2026-02-30.
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ValidationError({ date: 'Must be a valid date (YYYY-MM-DD)' });
  }
  return parsed;
}

const isoDay = (date: Date): ClubDate => date.toISOString().slice(0, 10);

// Weeks run Monday to Sunday; months are calendar months.
function rangeFor({ granularity, date }: RevenueQuery): { from: ClubDate; to: ClubDate } {
  if (!REPORT_GRANULARITIES.includes(granularity)) {
    throw new ValidationError({ granularity: `Must be one of ${REPORT_GRANULARITIES.join(', ')}` });
  }
  const day = parseDate(date);
  if (granularity === 'daily') return { from: isoDay(day), to: isoDay(day) };
  if (granularity === 'weekly') {
    const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS);
    return { from: isoDay(monday), to: isoDay(new Date(monday.getTime() + 6 * DAY_MS)) };
  }
  const lastDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0));
  return { from: `${isoDay(day).slice(0, 7)}-01`, to: isoDay(lastDay) };
}

const sum = (entries: readonly IncomeEntry[]) => entries.reduce((total, entry) => total + entry.amount, 0);

type MemberRow = { id: string; memberNumber: string; firstName: string; lastName: string };

function revenueReport(entries: readonly IncomeEntry[], query: RevenueQuery, members: ReadonlyMap<string, MemberRow>): RevenueReport {
  const { from, to } = rangeFor(query);
  const inRange = entries.filter((entry) => entry.date >= from && entry.date <= to);
  const valid = inRange.filter((entry) => !entry.annulled);
  const annulled = inRange.filter((entry) => entry.annulled);

  const receipts = new Map<number, IncomeEntry[]>();
  for (const entry of valid) receipts.set(entry.receiptNumber, [...(receipts.get(entry.receiptNumber) ?? []), entry]);

  return {
    granularity: query.granularity,
    from,
    to,
    total: sum(valid),
    byConcept: CHARGE_LINE_KINDS
      .map((concept) => ({ concept, total: sum(valid.filter((entry) => entry.concept === concept)) }))
      .filter((row) => valid.some((entry) => entry.concept === row.concept)),
    operationsByConcept: CHARGE_LINE_KINDS
      .map((concept) => ({ concept, count: valid.filter((entry) => entry.concept === concept).length }))
      .filter((row) => row.count > 0),
    byMethod: PAYMENT_METHODS
      .map((method) => ({ method, total: sum(valid.filter((entry) => entry.method === method)) }))
      .filter((row) => valid.some((entry) => entry.method === row.method)),
    receipts: [...receipts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([receiptNumber, lines]) => {
        const member = members.get(lines[0]!.memberId);
        return {
          receiptNumber,
          date: lines[0]!.date,
          method: lines[0]!.method,
          total: sum(lines),
          concepts: CHARGE_LINE_KINDS.filter((concept) => lines.some((line) => line.concept === concept)),
          ...(member ? { member: { memberNumber: member.memberNumber, fullName: `${member.firstName} ${member.lastName}` } } : {}),
        };
      }),
    annulled: { count: new Set(annulled.map((entry) => entry.receiptNumber)).size, total: sum(annulled) },
    issued: issuedRange(inRange),
  };
}

function issuedRange(entries: readonly IncomeEntry[]): RevenueReport['issued'] {
  const numbers = [...new Set(entries.map((entry) => entry.receiptNumber))];
  return numbers.length === 0 ? null : { first: Math.min(...numbers), last: Math.max(...numbers), count: numbers.length };
}

const byName = (a: string, b: string) => a.localeCompare(b, 'es');

// `YYYY-MM` months from `from` to `to`, both included.
function monthsBetween(from: string, to: string): string[] {
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

function incomeRange({ from, to }: DisciplineIncomeQuery): string[] {
  const errors: Record<string, string> = {};
  if (typeof from !== 'string' || !PERIOD.test(from)) errors.from = 'Must be a valid month (YYYY-MM)';
  if (typeof to !== 'string' || !PERIOD.test(to)) errors.to = 'Must be a valid month (YYYY-MM)';
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  if (from > to) throw new ValidationError({ to: 'Must not be before the first month' });
  const months = monthsBetween(from, to);
  if (months.length > MAX_INCOME_MONTHS) throw new ValidationError({ to: `Must span at most ${MAX_INCOME_MONTHS} months` });
  return months;
}

export function createReportService({ income, members, disciplines }: ReportServiceDeps) {
  return {
    // Valid income of a day, week or month by concept and payment method; annulled payments are listed apart.
    async revenue(query: RevenueQuery): Promise<RevenueReport> {
      rangeFor(query);
      const memberById = new Map((await members.list()).map((member) => [member.id, member]));
      return revenueReport(await income.list(), query, memberById);
    },

    // What each discipline took in over a range of months. Unlike the settlement, which counts fees by the month
    // they are for, this counts by the day the money was taken, like the revenue reports and the Arqueo.
    async disciplineIncome(query: DisciplineIncomeQuery): Promise<DisciplineIncome> {
      const months = incomeRange(query);
      const entries = (await income.list()).filter(
        (entry) =>
          !entry.annulled &&
          entry.disciplineId !== undefined &&
          (entry.concept === 'activityFee' || entry.concept === 'activitySurcharge') &&
          entry.date.slice(0, 7) >= query.from &&
          entry.date.slice(0, 7) <= query.to,
      );
      const ids = [...new Set(entries.map((entry) => entry.disciplineId!))];
      const names = new Map((await disciplines.findByIds(ids)).map((discipline) => [discipline.id, discipline.name]));

      const rows = ids.map((id) => {
        const own = entries.filter((entry) => entry.disciplineId === id);
        return {
          id,
          // A discipline deleted since the payment keeps its money in the figures; its name is not guessed.
          name: names.get(id) ?? 'Disciplina eliminada',
          total: sum(own),
          fees: sum(own.filter((entry) => entry.concept === 'activityFee')),
          surcharges: sum(own.filter((entry) => entry.concept === 'activitySurcharge')),
          byMonth: months.map((month) => sum(own.filter((entry) => entry.date.slice(0, 7) === month))),
        };
      });
      rows.sort((a, b) => b.total - a.total || byName(a.name, b.name));
      return { from: query.from, to: query.to, months, total: sum(entries), disciplines: rows };
    },

    // PROVISIONAL(S3c): "al día" is read as "paid that month's fee for this discipline", like the current
    // planilla, so a member who still owes an earlier month is listed. The club has yet to confirm this
    // against the alternative of listing only members whose whole account is up to date.
    // Fees count by the month they are for, not the day they were paid.
    async disciplineSettlement({ period, disciplineId }: DisciplineSettlementQuery): Promise<DisciplineSettlement> {
      if (typeof period !== 'string' || !PERIOD.test(period)) {
        throw new ValidationError({ period: 'Must be a valid month (YYYY-MM)' });
      }
      if (typeof disciplineId !== 'string' || disciplineId === '') throw new ValidationError({ disciplineId: 'Required' });
      const [discipline] = await disciplines.findByIds([disciplineId]);
      if (!discipline) throw new NotFoundError('Discipline not found');

      const entries = (await income.list()).filter(
        (entry) => !entry.annulled && entry.period === period && entry.disciplineId === disciplineId,
      );
      const fees = entries.filter((entry) => entry.concept === 'activityFee');
      const memberById = new Map((await members.list()).map((member) => [member.id, member]));
      const students = [...new Set(fees.map((entry) => entry.memberId))]
        .flatMap((memberId) => {
          const member = memberById.get(memberId);
          return member ? [{ memberNumber: member.memberNumber, fullName: `${member.firstName} ${member.lastName}`, period }] : [];
        })
        .sort((a, b) => byName(a.fullName, b.fullName));

      return {
        period,
        discipline: { id: discipline.id, name: discipline.name },
        students,
        feeTotal: sum(fees),
        surchargeTotal: sum(entries.filter((entry) => entry.concept === 'activitySurcharge')),
      };
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
