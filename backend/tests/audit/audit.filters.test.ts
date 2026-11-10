import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditLabelSources } from '../../src/modules/audit/audit.labels.js';
import type { AuditAction, AuditEntityType } from '../../src/modules/audit/audit.types.js';
import { createAuditService } from '../../src/modules/audit/audit.service.js';
import { parseAuditQuery } from '../../src/modules/audit/audit.validation.js';
import { ValidationError } from '../../src/shared/errors.js';
import { actors, createTestContext, HEAD_ACTOR, SECRETARY_ACTOR } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanups.length > 0) await cleanups.pop()!();
});

// Synthetic records. Member 0007 owns payment pay-7, member 0008 owns pay-8.
const labels = (): AuditLabelSources => ({
  members: async () => [
    { id: 'member-7', memberNumber: '0007' },
    { id: 'member-8', memberNumber: '0008' },
  ],
  disciplines: async () => [],
  users: async () => [],
  payments: async () => [
    { id: 'pay-7', receiptNumber: 1, memberId: 'member-7' },
    { id: 'pay-8', receiptNumber: 2, memberId: 'member-8' },
  ],
  cashCounts: async () => [],
});

/** Records an entry at a given instant; the clock is read when the entry is created. */
async function setup(sources: AuditLabelSources | undefined = labels()) {
  let instant = new Date('2026-11-01T15:00:00Z');
  const context = await createTestContext({ labels: sources, now: () => instant });
  cleanups.push(context.cleanup);
  const record = (
    at: string,
    actorId: string,
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string,
  ) => {
    instant = new Date(at);
    return context.service.record({ actorId, action, entityType, entityId });
  };
  return { ...context, record };
}

async function seeded() {
  const context = await setup();
  await context.record('2026-11-01T15:00:00Z', HEAD_ACTOR.id, 'create', 'member', 'member-7');
  await context.record('2026-11-02T15:00:00Z', SECRETARY_ACTOR.id, 'create', 'payment', 'pay-7');
  await context.record('2026-11-03T15:00:00Z', SECRETARY_ACTOR.id, 'annul', 'payment', 'pay-8');
  await context.record('2026-11-04T15:00:00Z', HEAD_ACTOR.id, 'update', 'face_profile', 'member-7');
  await context.record('2026-11-05T15:00:00Z', HEAD_ACTOR.id, 'update', 'member', 'member-8');
  return context;
}

const ids = async (service: Awaited<ReturnType<typeof setup>>['service'], query: Parameters<typeof service.list>[0]) =>
  (await service.list(query)).map((entry) => entry.entityId);

describe('audit filters', () => {
  it('returns the whole log, newest first, without filters', async () => {
    const { service } = await seeded();
    expect(await ids(service, undefined)).toEqual(['member-8', 'member-7', 'pay-8', 'pay-7', 'member-7']);
    expect(await ids(service, {})).toEqual(await ids(service, undefined));
  });

  it('filters by actor', async () => {
    const { service } = await seeded();
    expect(await ids(service, { actorId: SECRETARY_ACTOR.id })).toEqual(['pay-8', 'pay-7']);
    expect(await ids(service, { actorId: 'nobody' })).toEqual([]);
  });

  it('filters by entity type', async () => {
    const { service } = await seeded();
    expect(await ids(service, { entityType: 'payment' })).toEqual(['pay-8', 'pay-7']);
  });

  it('filters by action', async () => {
    const { service } = await seeded();
    expect(await ids(service, { action: 'annul' })).toEqual(['pay-8']);
  });

  it('filters by inclusive club-local dates', async () => {
    const { service } = await seeded();
    expect(await ids(service, { from: '2026-11-02', to: '2026-11-04' })).toEqual(['member-7', 'pay-8', 'pay-7']);
    expect(await ids(service, { from: '2026-11-05' })).toEqual(['member-8']);
    expect(await ids(service, { to: '2026-11-01' })).toEqual(['member-7']);
    expect(await ids(service, { from: '2026-11-03', to: '2026-11-03' })).toEqual(['pay-8']);
  });

  it('reads the day in the club time zone, not in UTC', async () => {
    const { service, record } = await setup();
    // 01:30 UTC on 11-02 is 22:30 on 11-01 in Tucumán (UTC-3).
    await record('2026-11-02T01:30:00Z', HEAD_ACTOR.id, 'create', 'member', 'member-7');
    expect(await ids(service, { from: '2026-11-01', to: '2026-11-01' })).toEqual(['member-7']);
    expect(await ids(service, { from: '2026-11-02' })).toEqual([]);
  });

  it('filters by member through the member, its face profile and its payments, leaving other members out', async () => {
    const { service } = await seeded();
    expect(await ids(service, { member: '0007' })).toEqual(['member-7', 'pay-7', 'member-7']);
    expect(await ids(service, { member: '0008' })).toEqual(['member-8', 'pay-8']);
  });

  it('matches a member number typed without leading zeros', async () => {
    const { service } = await seeded();
    expect(await ids(service, { member: '7' })).toEqual(await ids(service, { member: '0007' }));
  });

  it('shows nothing for a member number that does not exist', async () => {
    const { service } = await seeded();
    expect(await ids(service, { member: '0099' })).toEqual([]);
  });

  it('shows nothing, and logs a short message, when the member records cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service, record } = await setup({
      ...labels(),
      members: async () => {
        throw new Error('secret disk path');
      },
    });
    await record('2026-11-01T15:00:00Z', HEAD_ACTOR.id, 'create', 'member', 'member-7');
    expect(await ids(service, { member: '0007' })).toEqual([]);
    expect(error).toHaveBeenCalledWith('Could not read the member records to filter the audit log', expect.any(Error));
  });

  it('shows nothing for a member filter when the service has no sources', async () => {
    const { service } = await setup(undefined);
    expect(await ids(service, { member: '0007' })).toEqual([]);
  });

  it('combines every filter with AND', async () => {
    const { service } = await seeded();
    expect(await ids(service, { member: '0007', actorId: HEAD_ACTOR.id })).toEqual(['member-7', 'member-7']);
    expect(await ids(service, { member: '0007', actorId: HEAD_ACTOR.id, entityType: 'face_profile' })).toEqual(['member-7']);
    expect(await ids(service, { member: '0007', action: 'create', from: '2026-11-02', to: '2026-11-02' })).toEqual(['pay-7']);
    expect(await ids(service, { actorId: SECRETARY_ACTOR.id, action: 'update' })).toEqual([]);
  });

  it('does not read the member sources when no member filter is given', async () => {
    const sources = labels();
    const members = vi.fn(sources.members);
    const payments = vi.fn(sources.payments);
    const { service, record } = await setup({ ...sources, members, payments });
    await record('2026-11-01T15:00:00Z', HEAD_ACTOR.id, 'create', 'user', 'user-1');
    await service.list({ action: 'create' });
    expect(members).not.toHaveBeenCalled();
    expect(payments).not.toHaveBeenCalled();
  });

  it('lists the distinct actors of the whole log by name, with the latest name and role', async () => {
    const context = await seeded();
    expect(await context.service.actors()).toEqual([HEAD_ACTOR, SECRETARY_ACTOR]);

    // A renamed user appears once, under the name of the latest entry.
    const renamed = createAuditService({
      repository: context.repository,
      actors: { find: (id) => (id === HEAD_ACTOR.id ? { ...HEAD_ACTOR, name: 'Ana Gómez Díaz' } : actors.find(id)) },
      now: () => new Date('2026-11-06T15:00:00Z'),
    });
    await renamed.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'user', entityId: 'u1' });
    expect((await renamed.actors()).map((actor) => actor.name)).toEqual(['Ana Gómez Díaz', 'Luis Pérez']);
  });

  it('returns no actors for an empty log', async () => {
    const { service } = await setup();
    expect(await service.actors()).toEqual([]);
  });

  it('stores nothing new: the stored entries carry no member data after filtering', async () => {
    const { service, repository } = await seeded();
    await service.list({ member: '0007' });
    for (const entry of await repository.list()) {
      expect(Object.keys(entry).sort()).toEqual(['action', 'actor', 'at', 'changedFields', 'entityId', 'entityType', 'id']);
    }
  });
});

describe('parseAuditQuery', () => {
  const fieldErrors = (query: Record<string, unknown>) => {
    try {
      parseAuditQuery(query);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      return Object.keys((error as ValidationError).fieldErrors);
    }
    throw new Error('expected a ValidationError');
  };

  it('accepts no params and every valid filter', () => {
    expect(parseAuditQuery({})).toEqual({});
    const all = { actorId: 'user-1', member: '0007', entityType: 'payment', action: 'annul', from: '2026-11-01', to: '2026-11-30' };
    expect(parseAuditQuery(all)).toEqual(all);
  });

  it('rejects each bad value with its field name', () => {
    expect(fieldErrors({ actorId: '' })).toEqual(['actorId']);
    expect(fieldErrors({ actorId: 'x'.repeat(101) })).toEqual(['actorId']);
    expect(fieldErrors({ member: 'abc' })).toEqual(['member']);
    expect(fieldErrors({ member: '12345678901' })).toEqual(['member']);
    expect(fieldErrors({ entityType: 'nope' })).toEqual(['entityType']);
    expect(fieldErrors({ action: 'nope' })).toEqual(['action']);
    expect(fieldErrors({ from: '2026-13-01' })).toEqual(['from']);
    expect(fieldErrors({ to: '01/11/2026' })).toEqual(['to']);
    expect(fieldErrors({ from: '2026-02-30' })).toEqual(['from']);
  });

  it('rejects a repeated parameter and a range that ends before it starts', () => {
    expect(fieldErrors({ action: ['create', 'update'] })).toEqual(['action']);
    expect(fieldErrors({ from: '2026-11-05', to: '2026-11-01' })).toEqual(['to']);
  });

  it('reports every bad field at once', () => {
    expect(fieldErrors({ action: 'nope', from: 'x', member: 'y' }).sort()).toEqual(['action', 'from', 'member']);
  });
});
