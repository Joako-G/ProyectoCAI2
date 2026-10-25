import { afterEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/shared/errors.js';
import { BASKET, LUCIA, SWIM, TOMAS, trackContexts, VOLLEY } from './helpers.js';

const contexts = trackContexts();
afterEach(() => contexts.cleanup());

const byDiscipline = (memberships: Array<{ disciplineId: string }>) => memberships.map((m) => m.disciplineId).sort();

describe('membership service: syncMember', () => {
  it('opens an active membership per listed discipline starting at the given date', async () => {
    const { service } = await contexts.create();
    await service.syncMember(LUCIA, [BASKET, VOLLEY], '2026-10-05');
    const memberships = await service.list({ memberId: LUCIA });
    expect(byDiscipline(memberships)).toEqual([BASKET, VOLLEY]);
    for (const membership of memberships) {
      expect(membership).toMatchObject({ memberId: LUCIA, startDate: '2026-10-05', status: 'active' });
      expect(membership.id).toEqual(expect.any(String));
      expect(membership).not.toHaveProperty('endDate');
    }
  });

  it('is idempotent: a second call with the same input changes nothing', async () => {
    const { service } = await contexts.create();
    await service.syncMember(LUCIA, [BASKET, VOLLEY], '2026-10-05');
    const before = await service.list();
    await service.syncMember(LUCIA, [VOLLEY, BASKET, BASKET], '2026-11-20');
    expect(await service.list()).toEqual(before);
  });

  it('ends the active memberships whose discipline is no longer listed, with a system reason', async () => {
    const { service } = await contexts.create();
    await service.syncMember(LUCIA, [BASKET, VOLLEY], '2026-09-01');
    await service.syncMember(LUCIA, [BASKET], '2026-10-05');
    const volley = (await service.list({ disciplineId: VOLLEY }))[0]!;
    expect(volley).toMatchObject({ status: 'ended', endDate: '2026-10-05', endReason: 'Discipline removed from member' });
    expect((await service.list({ disciplineId: BASKET }))[0]).toMatchObject({ status: 'active', startDate: '2026-09-01' });
  });

  it('adds and removes in the same call', async () => {
    const { service } = await contexts.create();
    await service.syncMember(LUCIA, [BASKET], '2026-09-01');
    await service.syncMember(LUCIA, [VOLLEY], '2026-10-05');
    expect(byDiscipline(await service.list({ memberId: LUCIA, status: 'active' }))).toEqual([VOLLEY]);
    expect(byDiscipline(await service.list({ memberId: LUCIA, status: 'ended' }))).toEqual([BASKET]);
  });

  it('opens a new record when a removed discipline is listed again, keeping the history', async () => {
    const { service } = await contexts.create();
    await service.syncMember(LUCIA, [BASKET], '2026-01-10');
    await service.syncMember(LUCIA, [], '2026-03-01');
    await service.syncMember(LUCIA, [BASKET], '2026-09-01');
    const records = await service.list({ memberId: LUCIA });
    expect(records.map((m) => [m.startDate, m.status])).toEqual([
      ['2026-01-10', 'ended'],
      ['2026-09-01', 'active'],
    ]);
  });

  it('never ends a membership before its own start date', async () => {
    const { service } = await contexts.create();
    await service.syncMember(LUCIA, [BASKET], '2026-10-20');
    await service.syncMember(LUCIA, [], '2026-10-05');
    expect((await service.list())[0]).toMatchObject({ status: 'ended', endDate: '2026-10-20' });
  });

  it('only touches the given member', async () => {
    const { service } = await contexts.create();
    await service.syncMember(LUCIA, [BASKET], '2026-09-01');
    await service.syncMember(TOMAS, [BASKET], '2026-09-01');
    await service.syncMember(LUCIA, [], '2026-10-05');
    expect(await service.list({ memberId: TOMAS, status: 'active' })).toHaveLength(1);
  });

  it('keeps one active membership per member and discipline under concurrent syncs', async () => {
    const { service } = await contexts.create();
    await Promise.all(Array.from({ length: 8 }, () => service.syncMember(LUCIA, [BASKET, VOLLEY], '2026-10-05')));
    expect(await service.list({ status: 'active' })).toHaveLength(2);
  });
});

describe('membership service: reconcile', () => {
  const members = [
    { id: LUCIA, disciplineIds: [BASKET, VOLLEY], memberSince: '2015-02-01' },
    { id: TOMAS, disciplineIds: [SWIM], memberSince: '2022-03-01' },
  ];

  it('backfills members without history from their memberSince date', async () => {
    const { service } = await contexts.create();
    await service.reconcile(members, '2026-10-05');
    const lucia = await service.list({ memberId: LUCIA });
    expect(lucia.map((m) => m.startDate)).toEqual(['2015-02-01', '2015-02-01']);
    expect((await service.list({ memberId: TOMAS }))[0]).toMatchObject({ disciplineId: SWIM, startDate: '2022-03-01' });
  });

  it('uses the given date for members that already have history and is idempotent', async () => {
    const { service } = await contexts.create();
    await service.syncMember(LUCIA, [BASKET], '2026-01-10');
    await service.reconcile(members, '2026-10-05');
    expect(await service.list({ memberId: LUCIA })).toHaveLength(2);
    expect((await service.list({ disciplineId: VOLLEY }))[0]).toMatchObject({ startDate: '2026-10-05' });
    expect((await service.list({ disciplineId: BASKET }))[0]).toMatchObject({ startDate: '2026-01-10' });

    const before = await service.list();
    await service.reconcile(members, '2026-12-01');
    expect(await service.list()).toEqual(before);
  });

  it('ends memberships of disciplines the member no longer has', async () => {
    const { service } = await contexts.create();
    await service.syncMember(TOMAS, [SWIM, BASKET], '2026-01-01');
    await service.reconcile(members, '2026-10-05');
    expect((await service.list({ memberId: TOMAS, disciplineId: BASKET }))[0]).toMatchObject({
      status: 'ended',
      endDate: '2026-10-05',
    });
  });

  it('does not treat a member whose whole history ended as new', async () => {
    const { service } = await contexts.create();
    await service.syncMember(TOMAS, [BASKET], '2026-01-01');
    await service.syncMember(TOMAS, [], '2026-02-01');
    await service.reconcile([{ id: TOMAS, disciplineIds: [SWIM], memberSince: '2022-03-01' }], '2026-10-05');
    expect((await service.list({ disciplineId: SWIM }))[0]).toMatchObject({ startDate: '2026-10-05' });
  });
});

describe('membership service: queries', () => {
  async function seeded() {
    const context = await contexts.create();
    const { service } = context;
    await service.syncMember(LUCIA, [VOLLEY], '2026-01-01');
    await service.syncMember(LUCIA, [BASKET], '2026-02-01');
    await service.syncMember(TOMAS, [BASKET], '2026-03-01');
    const all = await service.list();
    return { ...context, all };
  }

  it('lists everything ordered by start date', async () => {
    const { all } = await seeded();
    expect(all.map((m) => m.startDate)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('filters by member, discipline and status', async () => {
    const { service } = await seeded();
    expect(await service.list({ memberId: LUCIA })).toHaveLength(2);
    expect(byDiscipline(await service.list({ disciplineId: BASKET }))).toEqual([BASKET, BASKET]);
    expect(byDiscipline(await service.list({ status: 'ended' }))).toEqual([VOLLEY]);
    expect(await service.list({ memberId: LUCIA, status: 'active' })).toHaveLength(1);
  });

  it('offers list by member (optionally only active) and list by discipline', async () => {
    const { service } = await seeded();
    expect(await service.listByMember(LUCIA)).toHaveLength(2);
    expect(byDiscipline(await service.listByMember(LUCIA, { activeOnly: true }))).toEqual([BASKET]);
    expect(await service.listByDiscipline(BASKET)).toHaveLength(2);
  });

  it('gets by id and reports an unknown id as not found', async () => {
    const { service, all } = await seeded();
    expect(await service.getById(all[0]!.id)).toEqual(all[0]);
    await expect(service.getById('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('computes the active disciplines of a member for a period from the stored records', async () => {
    const { service } = await seeded();
    await service.syncMember(LUCIA, [BASKET], '2026-06-15');
    expect(await service.activeDisciplineIdsForPeriod(LUCIA, '2026-06')).toEqual([BASKET]);
    expect(await service.activeDisciplineIdsForPeriod(LUCIA, '2026-05')).toEqual([BASKET]);
    expect(await service.activeDisciplineIdsForPeriod(TOMAS, '2026-02')).toEqual([]);
  });
});
