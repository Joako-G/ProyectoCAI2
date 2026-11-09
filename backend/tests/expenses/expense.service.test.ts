import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../src/shared/errors.js';
import { createTestContext, TODAY, validBody } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];

async function setup(record = vi.fn(async () => undefined)) {
  const context = await createTestContext({ record });
  cleanups.push(context.cleanup);
  return { ...context, record };
}

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

describe('expense service: create', () => {
  it('stores the expense with the actor and the time decided by the service, and audits it', async () => {
    const { service, repository, record } = await setup();

    const expense = await service.create({ ...validBody, category: 'services' }, 'user-1');

    expect(expense).toMatchObject({ ...validBody, createdBy: 'user-1', createdAt: TODAY.toISOString() });
    expect(await repository.list()).toEqual([expense]);
    expect(record).toHaveBeenCalledWith({ actorId: 'user-1', action: 'create', entityType: 'expense', entityId: expense.id });
  });

  it('allows a past date so a late entry can be recorded', async () => {
    const { service } = await setup();
    await expect(service.create({ ...validBody, category: 'other', date: '2026-01-01' }, 'user-1')).resolves.toMatchObject({ date: '2026-01-01' });
  });

  it('refuses a future date and stores and audits nothing', async () => {
    const { service, repository, record } = await setup();

    await expect(service.create({ ...validBody, category: 'other', date: '2026-10-06' }, 'user-1')).rejects.toBeInstanceOf(ValidationError);

    expect(await repository.list()).toEqual([]);
    expect(record).not.toHaveBeenCalled();
  });

  it('refuses a missing actor', async () => {
    const { service, repository } = await setup();
    await expect(service.create({ ...validBody, category: 'other' }, ' ')).rejects.toBeInstanceOf(ValidationError);
    expect(await repository.list()).toEqual([]);
  });
});

describe('expense service: list', () => {
  it('lists newest first and filters by inclusive from and to dates', async () => {
    const { service } = await setup();
    const older = await service.create({ ...validBody, category: 'other', date: '2026-09-01' }, 'user-1');
    const newer = await service.create({ ...validBody, category: 'other', date: '2026-10-01' }, 'user-1');

    expect((await service.list()).map((e) => e.id)).toEqual([newer.id, older.id]);
    expect((await service.list({ from: '2026-10-01' })).map((e) => e.id)).toEqual([newer.id]);
    expect((await service.list({ to: '2026-09-01' })).map((e) => e.id)).toEqual([older.id]);
    expect(await service.list({ from: '2026-09-02', to: '2026-09-30' })).toEqual([]);
  });
});
