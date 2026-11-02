import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditRepository } from '../../src/modules/audit/audit.repository.js';
import { createAuditService } from '../../src/modules/audit/audit.service.js';
import { actors, createTestContext, HEAD_ACTOR } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function setup(options: Parameters<typeof createTestContext>[0] = {}) {
  const context = await createTestContext(options);
  cleanups.push(context.cleanup);
  return context;
}

describe('audit service', () => {
  it('records the actor as they were at that moment, the action, the record and the changed field names', async () => {
    const { service } = await setup();
    await service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'member', entityId: 'm1', changedFields: ['category', 'whatsapp'] });
    expect(await service.list()).toEqual([
      {
        id: 'entry-1',
        at: '2026-11-01T15:00:00.000Z',
        actor: HEAD_ACTOR,
        action: 'update',
        entityType: 'member',
        entityId: 'm1',
        changedFields: ['category', 'whatsapp'],
      },
    ]);
  });

  it('records no changed fields when none are given', async () => {
    const { service } = await setup();
    await service.record({ actorId: HEAD_ACTOR.id, action: 'create', entityType: 'discipline', entityId: 'd1' });
    expect((await service.list())[0]!.changedFields).toEqual([]);
  });

  it('lists the newest entry first', async () => {
    let tick = 0;
    const { service } = await setup({ now: () => new Date(Date.UTC(2026, 10, 1, 12, tick++)) });
    for (const entityId of ['a', 'b', 'c']) {
      await service.record({ actorId: HEAD_ACTOR.id, action: 'create', entityType: 'member', entityId });
    }
    expect((await service.list()).map((entry) => entry.entityId)).toEqual(['c', 'b', 'a']);
  });

  it('keeps arrival order for entries written in the same instant', async () => {
    const { service } = await setup();
    for (const entityId of ['a', 'b']) {
      await service.record({ actorId: HEAD_ACTOR.id, action: 'create', entityType: 'member', entityId });
    }
    expect((await service.list()).map((entry) => entry.entityId)).toEqual(['b', 'a']);
  });

  it('snapshots an actor who is no longer known without failing', async () => {
    const { service } = await setup();
    await service.record({ actorId: 'ghost', action: 'create', entityType: 'member', entityId: 'm1' });
    expect((await service.list())[0]!.actor).toEqual({ id: 'ghost', name: 'ghost', role: 'unknown' });
  });

  it('never rejects when the audit write fails: it logs a short message with no personal data', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const repository: AuditRepository = { append: async () => { throw new Error('disk full'); }, list: async () => [] };
    const service = createAuditService({ repository, actors });
    await expect(service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'member', entityId: 'm1', changedFields: ['dni'] })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    const [message, cause] = error.mock.calls[0]!;
    expect((cause as Error).message).toBe('disk full');
    for (const personal of [HEAD_ACTOR.name, HEAD_ACTOR.id, 'm1', 'dni']) expect(String(message)).not.toContain(personal);
  });

  it('never rejects when the audit write throws before it starts', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const repository: AuditRepository = { append: () => { throw new Error('boom'); }, list: async () => [] };
    const service = createAuditService({ repository, actors });
    await expect(service.record({ actorId: HEAD_ACTOR.id, action: 'create', entityType: 'user', entityId: 'u1' })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('starts the write synchronously, so a read queued right after the call sees it', async () => {
    const { service } = await setup();
    void service.record({ actorId: HEAD_ACTOR.id, action: 'create', entityType: 'member', entityId: 'm1' });
    expect(await service.list()).toHaveLength(1);
  });

  it('counts failed audit writes in memory with the time of the last one and nothing else', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let tick = 0;
    const repository: AuditRepository = { append: async () => { throw new Error('disk full'); }, list: async () => [] };
    const service = createAuditService({ repository, actors, now: () => new Date(Date.UTC(2026, 10, 1, 12, tick++)) });
    expect(service.failures()).toEqual({ count: 0, lastFailedAt: null });
    await service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'member', entityId: 'm1', changedFields: ['dni'] });
    await service.record({ actorId: HEAD_ACTOR.id, action: 'create', entityType: 'user', entityId: 'u1' });
    // The clock is read for the entry (tick 0, 2) and again for the failure (tick 1, 3).
    expect(service.failures()).toEqual({ count: 2, lastFailedAt: '2026-11-01T12:03:00.000Z' });
    expect(JSON.stringify(service.failures())).not.toContain('disk full');
  });

  it('counts a write that throws before it starts, and does not count successful writes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const throwing = createAuditService({ repository: { append: () => { throw new Error('boom'); }, list: async () => [] }, actors });
    await throwing.record({ actorId: HEAD_ACTOR.id, action: 'create', entityType: 'user', entityId: 'u1' });
    expect(throwing.failures().count).toBe(1);

    const { service } = await setup();
    await service.record({ actorId: HEAD_ACTOR.id, action: 'create', entityType: 'member', entityId: 'm1' });
    expect(service.failures()).toEqual({ count: 0, lastFailedAt: null });
  });

  it('exposes record, list and failures only', async () => {
    const { service } = await setup();
    expect(Object.keys(service).sort()).toEqual(['failures', 'list', 'record']);
  });
});
