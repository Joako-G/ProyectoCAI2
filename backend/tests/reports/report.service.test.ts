import { describe, expect, it } from 'vitest';
import type { Payment } from '../../src/modules/payments/payment.types.js';
import { createPaymentIncomeSource } from '../../src/modules/reports/income.source.js';
import { createReportService } from '../../src/modules/reports/report.service.js';
import type { IncomeEntry } from '../../src/modules/reports/report.types.js';
import { NotFoundError, ValidationError } from '../../src/shared/errors.js';

function entry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    receiptNumber: 1,
    date: '2026-10-05',
    method: 'cash',
    memberId: 'm1',
    concept: 'socialFee',
    period: '2026-10',
    amount: 1000,
    annulled: false,
    ...overrides,
  };
}

const MEMBERS = [
  { id: 'm1', memberNumber: '0001', firstName: 'Lucía', lastName: 'Pérez' },
  { id: 'm2', memberNumber: '0002', firstName: 'Ana', lastName: 'Gómez' },
  { id: 'm3', memberNumber: '0003', firstName: 'Bruno', lastName: 'Díaz' },
];
const DISCIPLINES = [{ id: 'basket', name: 'Básquet' }, { id: 'judo', name: 'Judo' }];

function serviceWith(entries: IncomeEntry[]) {
  return createReportService({
    income: { list: async () => entries },
    members: { list: async () => MEMBERS },
    disciplines: { findByIds: async (ids) => DISCIPLINES.filter((discipline) => ids.includes(discipline.id)) },
  });
}

describe('revenue report', () => {
  it('sums a day by concept and payment method and lists each receipt', async () => {
    const report = await serviceWith([
      entry({ receiptNumber: 1, concept: 'socialFee', amount: 1000 }),
      entry({ receiptNumber: 1, concept: 'activityFee', disciplineId: 'basket', amount: 3000 }),
      entry({ receiptNumber: 2, method: 'qr', concept: 'socialFee', amount: 1000, memberId: 'm2' }),
      entry({ receiptNumber: 3, date: '2026-10-06', concept: 'socialFee', amount: 1000 }),
    ]).revenue({ granularity: 'daily', date: '2026-10-05' });

    expect(report).toMatchObject({ granularity: 'daily', from: '2026-10-05', to: '2026-10-05', total: 5000 });
    expect(report.byConcept).toEqual([{ concept: 'socialFee', total: 2000 }, { concept: 'activityFee', total: 3000 }]);
    expect(report.byMethod).toEqual([{ method: 'cash', total: 4000 }, { method: 'qr', total: 1000 }]);
    expect(report.receipts).toEqual([
      { receiptNumber: 1, date: '2026-10-05', method: 'cash', total: 4000 },
      { receiptNumber: 2, date: '2026-10-05', method: 'qr', total: 1000 },
    ]);
  });

  it('keeps the concept, method and receipt figures adding up to the total', async () => {
    const report = await serviceWith([
      entry({ receiptNumber: 1, amount: 700 }),
      entry({ receiptNumber: 1, concept: 'carnetReplacement', amount: 300 }),
      entry({ receiptNumber: 2, method: 'debit', amount: 900 }),
    ]).revenue({ granularity: 'daily', date: '2026-10-05' });

    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    expect(sum(report.byConcept.map((row) => row.total))).toBe(report.total);
    expect(sum(report.byMethod.map((row) => row.total))).toBe(report.total);
    expect(sum(report.receipts.map((row) => row.total))).toBe(report.total);
  });

  it('covers Monday to Sunday for a weekly report, boundaries included', async () => {
    // 2026-10-05 is a Monday; the week is 10-05 .. 10-11.
    const entries = [
      entry({ receiptNumber: 1, date: '2026-10-04', amount: 10 }),
      entry({ receiptNumber: 2, date: '2026-10-05', amount: 20 }),
      entry({ receiptNumber: 3, date: '2026-10-11', amount: 40 }),
      entry({ receiptNumber: 4, date: '2026-10-12', amount: 80 }),
    ];
    const fromSunday = await serviceWith(entries).revenue({ granularity: 'weekly', date: '2026-10-11' });

    expect(fromSunday).toMatchObject({ from: '2026-10-05', to: '2026-10-11', total: 60 });
    expect((await serviceWith(entries).revenue({ granularity: 'weekly', date: '2026-10-05' })).total).toBe(60);
  });

  it('covers the whole calendar month for a monthly report, including leap February', async () => {
    const entries = [
      entry({ receiptNumber: 1, date: '2028-01-31', amount: 1 }),
      entry({ receiptNumber: 2, date: '2028-02-01', amount: 2 }),
      entry({ receiptNumber: 3, date: '2028-02-29', amount: 4 }),
      entry({ receiptNumber: 4, date: '2028-03-01', amount: 8 }),
    ];
    const report = await serviceWith(entries).revenue({ granularity: 'monthly', date: '2028-02-15' });

    expect(report).toMatchObject({ from: '2028-02-01', to: '2028-02-29', total: 6 });
  });

  it('leaves annulled payments out of the totals and reports them apart', async () => {
    const report = await serviceWith([
      entry({ receiptNumber: 1, amount: 1000 }),
      entry({ receiptNumber: 2, amount: 600, annulled: true }),
      entry({ receiptNumber: 2, concept: 'carnetReplacement', amount: 400, annulled: true }),
    ]).revenue({ granularity: 'daily', date: '2026-10-05' });

    expect(report.total).toBe(1000);
    expect(report.receipts.map((row) => row.receiptNumber)).toEqual([1]);
    expect(report.annulled).toEqual({ count: 1, total: 1000 });
  });

  it('returns zeros and empty lists for a period with no payments', async () => {
    const report = await serviceWith([]).revenue({ granularity: 'daily', date: '2026-10-05' });

    expect(report).toMatchObject({ total: 0, byConcept: [], byMethod: [], receipts: [], annulled: { count: 0, total: 0 } });
  });

  it.each([
    [{ granularity: 'yearly', date: '2026-10-05' }, 'granularity'],
    [{ granularity: 'daily', date: '2026-02-30' }, 'date'],
    [{ granularity: 'daily', date: '05/10/2026' }, 'date'],
  ])('rejects invalid input %j', async (input, field) => {
    const error = await serviceWith([]).revenue(input as never).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect(Object.keys((error as ValidationError).fieldErrors)).toContain(field);
  });
});

describe('discipline settlement report', () => {
  const basketFee = (overrides: Partial<IncomeEntry> = {}) =>
    entry({ concept: 'activityFee', disciplineId: 'basket', period: '2026-10', amount: 3000, ...overrides });

  it('lists who paid the discipline fee for the month, with name, member number and month, and the amount', async () => {
    const report = await serviceWith([
      basketFee({ receiptNumber: 1, memberId: 'm1' }),
      basketFee({ receiptNumber: 2, memberId: 'm2' }),
      basketFee({ receiptNumber: 3, memberId: 'm3', disciplineId: 'judo' }),
      basketFee({ receiptNumber: 4, memberId: 'm3', period: '2026-09' }),
    ]).disciplineSettlement({ period: '2026-10', disciplineId: 'basket' });

    expect(report.discipline).toEqual({ id: 'basket', name: 'Básquet' });
    expect(report.students).toEqual([
      { memberNumber: '0002', fullName: 'Ana Gómez', period: '2026-10' },
      { memberNumber: '0001', fullName: 'Lucía Pérez', period: '2026-10' },
    ]);
    expect(report.feeTotal).toBe(6000);
  });

  it('never exposes a DNI', async () => {
    const report = await serviceWith([basketFee()]).disciplineSettlement({ period: '2026-10', disciplineId: 'basket' });

    expect(JSON.stringify(report)).not.toMatch(/dni/i);
  });

  // PROVISIONAL(S3c): "al día" means paid that month in that discipline; confirm with the club.
  it('lists a member who paid the month even when an earlier month is still owed', async () => {
    const report = await serviceWith([basketFee({ memberId: 'm1', date: '2026-10-20' })])
      .disciplineSettlement({ period: '2026-10', disciplineId: 'basket' });

    expect(report.students.map((student) => student.memberNumber)).toEqual(['0001']);
  });

  it('counts the month a fee is for, not the day it was paid', async () => {
    const report = await serviceWith([basketFee({ memberId: 'm1', date: '2026-11-03' })])
      .disciplineSettlement({ period: '2026-10', disciplineId: 'basket' });

    expect(report.feeTotal).toBe(3000);
  });

  it('reports surcharges apart from the fee', async () => {
    const report = await serviceWith([
      basketFee({ receiptNumber: 1, memberId: 'm1' }),
      basketFee({ receiptNumber: 1, memberId: 'm1', concept: 'activitySurcharge', amount: 300 }),
    ]).disciplineSettlement({ period: '2026-10', disciplineId: 'basket' });

    expect(report).toMatchObject({ feeTotal: 3000, surchargeTotal: 300 });
    expect(report.students).toHaveLength(1);
  });

  it('leaves annulled fees out, and lists a member once when the fee was annulled and paid again', async () => {
    const report = await serviceWith([
      basketFee({ receiptNumber: 1, memberId: 'm1', annulled: true }),
      basketFee({ receiptNumber: 2, memberId: 'm1' }),
      basketFee({ receiptNumber: 3, memberId: 'm2', annulled: true }),
    ]).disciplineSettlement({ period: '2026-10', disciplineId: 'basket' });

    expect(report.students.map((student) => student.memberNumber)).toEqual(['0001']);
    expect(report.feeTotal).toBe(3000);
  });

  it('is empty, not an error, when nobody paid', async () => {
    const report = await serviceWith([]).disciplineSettlement({ period: '2026-10', disciplineId: 'judo' });

    expect(report).toMatchObject({ students: [], feeTotal: 0, surchargeTotal: 0 });
  });

  it('rejects an unknown discipline and an invalid month', async () => {
    const service = serviceWith([]);

    await expect(service.disciplineSettlement({ period: '2026-10', disciplineId: 'chess' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.disciplineSettlement({ period: '2026-13', disciplineId: 'basket' })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('payment income source', () => {
  const payment: Payment = {
    id: 'p1',
    receiptNumber: 7,
    memberId: 'm1',
    method: 'transfer',
    paymentDate: '2026-10-05',
    lines: [
      { kind: 'socialFee', period: '2026-10', amount: 1000 },
      { kind: 'activityFee', period: '2026-10', disciplineId: 'basket', amount: 3000 },
    ],
    total: 4000,
    createdBy: 'u1',
    createdAt: '2026-10-05T12:00:00.000Z',
  };

  it('turns each payment line into an income entry carrying the receipt, date and method', async () => {
    const source = createPaymentIncomeSource({ list: async () => [payment] });

    expect(await source.list()).toEqual([
      { receiptNumber: 7, date: '2026-10-05', method: 'transfer', memberId: 'm1', concept: 'socialFee', period: '2026-10', amount: 1000, annulled: false },
      { receiptNumber: 7, date: '2026-10-05', method: 'transfer', memberId: 'm1', concept: 'activityFee', period: '2026-10', disciplineId: 'basket', amount: 3000, annulled: false },
    ]);
  });

  it('flags the lines of an annulled payment', async () => {
    const annulled = { ...payment, annulment: { reason: 'Error', annulledBy: 'u2', annulledAt: '2026-10-06T10:00:00.000Z' } };
    const source = createPaymentIncomeSource({ list: async () => [annulled] });

    expect((await source.list()).every((line) => line.annulled)).toBe(true);
  });
});
