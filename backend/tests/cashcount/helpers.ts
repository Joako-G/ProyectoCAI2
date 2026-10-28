import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCashCountService } from '../../src/modules/cashcount/cashcount.service.js';
import { createJsonCashCountRepository } from '../../src/modules/cashcount/json-cashcount.repository.js';
import { createReportService } from '../../src/modules/reports/report.service.js';
import type { IncomeEntry } from '../../src/modules/reports/report.types.js';

/** 2026-10-05 in the club time zone. */
export const TODAY = new Date('2026-10-05T15:00:00Z');

export function incomeEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
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

export const MEMBERS = [{ id: 'm1', memberNumber: '0001', firstName: 'Lucía', lastName: 'Pérez' }];
export const DISCIPLINES = [{ id: 'basket', name: 'Básquet' }];

/** Real report and cash count services over fixed income entries and a temporary cash counts file. */
export async function createTestContext(entries: IncomeEntry[] = [incomeEntry()]) {
  const dir = await mkdtemp(join(tmpdir(), 'cashcount-api-'));
  const repository = createJsonCashCountRepository(join(dir, 'cashcounts.json'));
  const reports = createReportService({
    income: { list: async () => entries },
    members: { list: async () => MEMBERS },
    disciplines: { findByIds: async (ids) => DISCIPLINES.filter((discipline) => ids.includes(discipline.id)) },
  });
  const cashCount = createCashCountService({ repository, revenue: reports, now: () => TODAY });
  return { reports, cashCount, repository, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
