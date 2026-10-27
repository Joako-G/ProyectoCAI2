import { CHARGE_LINE_KINDS } from '../payments/charge.types.js';
import type { ClubDate } from '../payments/charge.types.js';
import { PAYMENT_METHODS } from '../payments/payment.types.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import {
  REPORT_GRANULARITIES,
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

function revenueReport(entries: readonly IncomeEntry[], query: RevenueQuery): RevenueReport {
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
    byMethod: PAYMENT_METHODS
      .map((method) => ({ method, total: sum(valid.filter((entry) => entry.method === method)) }))
      .filter((row) => valid.some((entry) => entry.method === row.method)),
    receipts: [...receipts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([receiptNumber, lines]) => ({ receiptNumber, date: lines[0]!.date, method: lines[0]!.method, total: sum(lines) })),
    annulled: { count: new Set(annulled.map((entry) => entry.receiptNumber)).size, total: sum(annulled) },
  };
}

const byName = (a: string, b: string) => a.localeCompare(b, 'es');

export function createReportService({ income, members, disciplines }: ReportServiceDeps) {
  return {
    // Valid income of a day, week or month by concept and payment method; annulled payments are listed apart.
    async revenue(query: RevenueQuery): Promise<RevenueReport> {
      rangeFor(query);
      return revenueReport(await income.list(), query);
    },

    // PROVISIONAL(S3c): "al día" is read as "paid that month's fee for this discipline", like the current
    // planilla, so a member who still owes an earlier month is listed. The club has yet to confirm this
    // against the alternative of listing only members whose whole account is up to date.
    // Fees count by the month they are for, not the day they were paid.
    async disciplineSettlement({ period, disciplineId }: DisciplineSettlementQuery): Promise<DisciplineSettlement> {
      if (typeof period !== 'string' || !PERIOD.test(period)) {
        throw new ValidationError({ period: 'Must be a valid month (YYYY-MM)' });
      }
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
