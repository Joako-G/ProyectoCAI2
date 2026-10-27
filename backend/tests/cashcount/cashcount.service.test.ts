import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCashCountService } from '../../src/modules/cashcount/cashcount.service.js';
import { createJsonCashCountRepository } from '../../src/modules/cashcount/json-cashcount.repository.js';
import { createReportService } from '../../src/modules/reports/report.service.js';
import type { IncomeEntry } from '../../src/modules/reports/report.types.js';
import { ConflictError, ValidationError } from '../../src/shared/errors.js';

/** 2026-10-05 in the club time zone. */
const TODAY = new Date('2026-10-05T15:00:00Z');
const ACTOR = 'user-head';

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

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function setup(entries: IncomeEntry[] = [entry({ amount: 1000 }), entry({ receiptNumber: 2, method: 'qr', amount: 500 })], now = () => TODAY) {
  const dir = await mkdtemp(join(tmpdir(), 'cashcount-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'cashcounts.json');
  const repository = createJsonCashCountRepository(file);
  const reports = createReportService({
    income: { list: async () => entries },
    members: { list: async () => [] },
    disciplines: { findByIds: async () => [] },
  });
  return { service: createCashCountService({ repository, revenue: reports, now }), repository, file };
}

describe('closing the day', () => {
  it('snapshots the expected totals of the day by method and concept, and the cash expected', async () => {
    const { service } = await setup([
      entry({ receiptNumber: 1, amount: 1000 }),
      entry({ receiptNumber: 1, concept: 'carnetReplacement', amount: 200 }),
      entry({ receiptNumber: 2, method: 'qr', amount: 500 }),
      entry({ receiptNumber: 3, date: '2026-10-04', amount: 9999 }),
    ]);

    const close = await service.close({ countedCash: 1200 }, ACTOR);

    expect(close.businessDate).toBe('2026-10-05');
    expect(close.expected).toEqual({
      total: 1700,
      cash: 1200,
      byMethod: [{ method: 'cash', total: 1200 }, { method: 'qr', total: 500 }],
      byConcept: [{ concept: 'socialFee', total: 1500 }, { concept: 'carnetReplacement', total: 200 }],
    });
  });

  it('leaves annulled payments out of what is expected', async () => {
    const { service } = await setup([entry({ amount: 1000 }), entry({ receiptNumber: 2, amount: 800, annulled: true })]);

    const close = await service.close({ countedCash: 1000 }, ACTOR);

    expect(close.expected.cash).toBe(1000);
    expect(close.variance).toBe(0);
  });

  it.each([
    [1000, 0],
    [900, -100],
    [1150, 150],
  ])('saves a count of %i with variance %i against 1000 expected cash, never blocking the close', async (counted, variance) => {
    const { service, repository } = await setup([entry({ amount: 1000 })]);

    const close = await service.close({ countedCash: counted }, ACTOR);

    expect(close).toMatchObject({ countedCash: counted, variance });
    expect(await repository.list()).toEqual([close]);
  });

  it('keeps the reason for a difference when given, trimmed, and omits it otherwise', async () => {
    const withReason = await setup([entry()]);
    expect((await withReason.service.close({ countedCash: 900, varianceNote: '  Vuelto mal dado  ' }, ACTOR)).varianceNote).toBe('Vuelto mal dado');

    const blank = await setup([entry()]);
    expect('varianceNote' in (await blank.service.close({ countedCash: 900, varianceNote: '   ' }, ACTOR))).toBe(false);

    const none = await setup([entry()]);
    expect('varianceNote' in (await none.service.close({ countedCash: 1000 }, ACTOR))).toBe(false);
  });

  it.each([[-1], [1.5], ['1000'], [Number.NaN], [undefined], [null], [Number.MAX_SAFE_INTEGER + 1]])(
    'rejects a counted cash of %j and writes nothing',
    async (counted) => {
      const { service, repository } = await setup();

      await expect(service.close({ countedCash: counted as never }, ACTOR)).rejects.toBeInstanceOf(ValidationError);
      expect(await repository.list()).toEqual([]);
    },
  );

  it('rejects a note that is not text or is too long, and writes nothing', async () => {
    const { service, repository } = await setup();

    await expect(service.close({ countedCash: 1000, varianceNote: 5 as never }, ACTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.close({ countedCash: 1000, varianceNote: 'x'.repeat(501) }, ACTOR)).rejects.toBeInstanceOf(ValidationError);
    expect(await repository.list()).toEqual([]);
  });

  it('takes the date, the actor and the time from the server, ignoring what the caller sends', async () => {
    const { service } = await setup();
    const forged = { countedCash: 1000, businessDate: '2020-01-01', closedBy: 'someone-else', closedAt: '2020-01-01T00:00:00.000Z', variance: 999, expected: {} };

    const close = await service.close(forged as never, ACTOR);

    expect(close).toMatchObject({ businessDate: '2026-10-05', closedBy: ACTOR, closedAt: TODAY.toISOString(), variance: 0 });
    expect(close.expected.cash).toBe(1000);
  });

  it('refuses a second close of the same day and keeps the first untouched', async () => {
    const { service, repository } = await setup();
    const first = await service.close({ countedCash: 1000 }, ACTOR);

    await expect(service.close({ countedCash: 5 }, ACTOR)).rejects.toBeInstanceOf(ConflictError);
    expect(await repository.list()).toEqual([first]);
  });

  it('lets only one of two simultaneous closes of the same day through', async () => {
    const { service, repository } = await setup();

    const results = await Promise.allSettled([service.close({ countedCash: 1000 }, ACTOR), service.close({ countedCash: 1000 }, ACTOR)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
    expect(await repository.list()).toHaveLength(1);
  });

  it('closes a new day on its own, and lists the history newest first', async () => {
    let day = TODAY;
    const { service } = await setup([entry(), entry({ receiptNumber: 2, date: '2026-10-06' })], () => day);
    await service.close({ countedCash: 1000 }, ACTOR);
    day = new Date('2026-10-06T15:00:00Z');
    await service.close({ countedCash: 1000 }, ACTOR);

    expect((await service.history()).map((close) => close.businessDate)).toEqual(['2026-10-06', '2026-10-05']);
  });
});

describe('previewing the day', () => {
  it('shows what is expected today without writing anything', async () => {
    const { service, repository } = await setup();

    const preview = await service.preview();

    expect(preview).toMatchObject({ businessDate: '2026-10-05', expected: { total: 1500, cash: 1000 } });
    expect(preview.closed).toBeUndefined();
    expect(await repository.list()).toEqual([]);
  });

  it('includes the close once the day was closed', async () => {
    const { service } = await setup();
    const close = await service.close({ countedCash: 1000 }, ACTOR);

    expect((await service.preview()).closed).toEqual(close);
  });
});

describe('cash count file', () => {
  it('reads a missing file as no closes', async () => {
    const { repository } = await setup();

    expect(await repository.list()).toEqual([]);
  });

  it('refuses a malformed file and never overwrites it', async () => {
    const { service, file } = await setup();
    await writeFile(file, JSON.stringify({ not: 'a list' }));

    await expect(service.close({ countedCash: 1000 }, ACTOR)).rejects.toThrow(/Invalid cash counts file/);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ not: 'a list' });
  });

  it('refuses a stored close with a wrong shape', async () => {
    const { repository, file } = await setup();
    await writeFile(file, JSON.stringify([{ id: 'c1', businessDate: '2026-10-05' }]));

    await expect(repository.list()).rejects.toThrow(/Invalid cash counts file/);
  });
});
