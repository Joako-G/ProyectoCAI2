import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExpenseService } from '../../src/modules/expenses/expense.service.js';
import { createJsonExpenseRepository } from '../../src/modules/expenses/json-expense.repository.js';
import type { AuditRecorder } from '../../src/modules/audit/audit.service.js';
import { noAudit } from '../audit/helpers.js';

/** 2026-10-05 in the club time zone. */
export const TODAY = new Date('2026-10-05T15:00:00Z');

export const validBody = { date: '2026-10-05', amount: 12000, category: 'services', description: 'Factura de luz' };

/** The real expense service over a temporary file and a fixed clock. */
export async function createTestContext(audit: AuditRecorder = noAudit) {
  const dir = await mkdtemp(join(tmpdir(), 'expenses-'));
  const repository = createJsonExpenseRepository(join(dir, 'expenses.json'));
  const service = createExpenseService({ repository, audit, now: () => TODAY });
  return { service, repository, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
