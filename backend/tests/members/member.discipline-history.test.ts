import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DisciplineHistory } from '../../src/modules/members/discipline-history.js';
import { createJsonMemberRepository } from '../../src/modules/members/json-member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import { adultInput, BASKET, fakeDisciplineLookup, TODAY, VOLLEY } from './helpers.js';
import { noAudit } from '../audit/helpers.js';

const dirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (dirs.length > 0) await rm(dirs.pop()!, { recursive: true, force: true });
});

async function setup(disciplineHistory?: DisciplineHistory, now: () => Date = () => TODAY) {
  const dir = await mkdtemp(join(tmpdir(), 'members-history-'));
  dirs.push(dir);
  const service = createMemberService({
    audit: noAudit,
    repository: createJsonMemberRepository(join(dir, 'members.json')),
    disciplineLookup: fakeDisciplineLookup(),
    disciplineHistory,
    now,
  });
  return service;
}

function spyHistory() {
  const onDisciplinesChanged = vi.fn<DisciplineHistory['onDisciplinesChanged']>(async () => undefined);
  return { history: { onDisciplinesChanged } satisfies DisciplineHistory, onDisciplinesChanged };
}

describe('members discipline history port', () => {
  it('works without a port', async () => {
    const service = await setup();
    const member = await service.create(adultInput, 'user-test');
    await expect(service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY] }, 'user-test')).resolves.toBeTruthy();
  });

  it('is called on create with the member id, its disciplines and the club-local date', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history, () => new Date('2026-10-06T01:30:00Z'));
    const member = await service.create({ ...adultInput, disciplineIds: [BASKET, VOLLEY] }, 'user-test');
    expect(onDisciplinesChanged).toHaveBeenCalledTimes(1);
    expect(onDisciplinesChanged).toHaveBeenCalledWith(member.id, [BASKET, VOLLEY], '2026-10-05');
  });

  it('is called on update with the current disciplines', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history);
    const member = await service.create(adultInput, 'user-test');
    await service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY] }, 'user-test');
    expect(onDisciplinesChanged).toHaveBeenCalledTimes(2);
    expect(onDisciplinesChanged).toHaveBeenLastCalledWith(member.id, [VOLLEY], '2026-10-05');
  });

  it('is not called when the write fails', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history);
    const member = await service.create(adultInput, 'user-test');
    onDisciplinesChanged.mockClear();

    await expect(service.create(adultInput, 'user-test')).rejects.toThrow(); // duplicate DNI
    await expect(service.create({ ...adultInput, dni: '1' }, 'user-test')).rejects.toThrow(); // invalid input
    await expect(service.update('missing', adultInput, 'user-test')).rejects.toThrow(); // not found
    await expect(service.update(member.id, { ...adultInput, disciplineIds: ['unknown'] }, 'user-test')).rejects.toThrow();
    expect(onDisciplinesChanged).not.toHaveBeenCalled();
  });

  it('is not called on deactivate or reactivate (cascade is an undecided owner rule)', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history);
    const member = await service.create(adultInput, 'user-test');
    onDisciplinesChanged.mockClear();
    await service.deactivate(member.id, 'Moved', 'user-test');
    await service.reactivate(member.id, 'user-test');
    expect(onDisciplinesChanged).not.toHaveBeenCalled();
  });

  it('keeps the saved member and logs when the port fails, because the startup reconcile repairs it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = await setup({
      onDisciplinesChanged: async () => {
        throw new Error('history down');
      },
    });
    const member = await service.create(adultInput, 'user-test');
    expect(await service.getById(member.id)).toEqual(member);
    expect(error).toHaveBeenCalled();
  });
});

describe('members discipline history: ordering and dating', () => {
  function controlledHistory() {
    const gates: Array<() => void> = [];
    let applied: readonly string[] = [];
    const history: DisciplineHistory = {
      onDisciplinesChanged: async (_id, ids) => {
        await new Promise<void>((resolve) => gates.push(resolve));
        applied = ids;
      },
    };
    // Releases pending port calls newest first until every given promise settled.
    async function drain(...promises: Array<Promise<unknown>>) {
      let done = false;
      const all = Promise.all(promises).then(() => {
        done = true;
      });
      while (!done) {
        // Let every call that is going to start register first, so the newest one is released first.
        let seen = -1;
        while (seen !== gates.length) {
          seen = gates.length;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        const gate = gates.pop();
        if (gate) gate();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await all;
    }
    return { history, drain, applied: () => applied };
  }

  it('ends with history matching the final disciplines when port calls resolve out of order', async () => {
    const { history, drain, applied } = controlledHistory();
    const service = await setup(history);
    const created = service.create({ ...adultInput, disciplineIds: [BASKET, VOLLEY] }, 'user-test');
    await drain(created);
    const member = await created;

    const first = service.update(member.id, { ...adultInput, disciplineIds: [BASKET] }, 'user-test');
    const second = service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY] }, 'user-test');
    await drain(first, second);

    expect(applied()).toEqual((await service.getById(member.id)).disciplineIds);
  });

  it('serializes port calls per member', async () => {
    let running = 0;
    let maxRunning = 0;
    const service = await setup({
      onDisciplinesChanged: async () => {
        maxRunning = Math.max(maxRunning, ++running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
      },
    });
    const member = await service.create(adultInput, 'user-test');
    await Promise.all([
      service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY] }, 'user-test'),
      service.update(member.id, { ...adultInput, disciplineIds: [BASKET] }, 'user-test'),
      service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY, BASKET] }, 'user-test'),
    ]);
    expect(maxRunning).toBe(1);
  });

  it('stamps disciplinesChangedOn on create and only when the set of disciplines changes', async () => {
    let instant = new Date('2026-10-05T15:00:00Z');
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history, () => instant);
    const member = await service.create({ ...adultInput, disciplineIds: [BASKET, VOLLEY] }, 'user-test');
    expect(member.disciplinesChangedOn).toBe('2026-10-05');

    instant = new Date('2026-10-20T15:00:00Z');
    const reordered = await service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY, BASKET], whatsapp: '1155550000' }, 'user-test');
    expect(reordered.disciplinesChangedOn).toBe('2026-10-05');
    expect(onDisciplinesChanged).toHaveBeenLastCalledWith(member.id, [VOLLEY, BASKET], '2026-10-05');

    const changed = await service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY] }, 'user-test');
    expect(changed.disciplinesChangedOn).toBe('2026-10-20');
    expect((await service.getById(member.id)).disciplinesChangedOn).toBe('2026-10-20');
    expect(onDisciplinesChanged).toHaveBeenLastCalledWith(member.id, [VOLLEY], '2026-10-20');
  });

  it('ignores a client-supplied disciplinesChangedOn', async () => {
    const service = await setup();
    const member = await service.create({ ...adultInput, disciplinesChangedOn: '1999-01-01' } as never, 'user-test');
    expect(member.disciplinesChangedOn).toBe('2026-10-05');
  });

  it('reads and updates a legacy member without disciplinesChangedOn', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const dir = await mkdtemp(join(tmpdir(), 'members-legacy-'));
    dirs.push(dir);
    const file = join(dir, 'members.json');
    const repository = createJsonMemberRepository(file);
    const created = await createMemberService({ audit: noAudit, repository, disciplineLookup: fakeDisciplineLookup(), now: () => TODAY }).create(adultInput, 'user-test');
    await repository.mutate((members) => ({
      members: members.map(({ disciplinesChangedOn: _omit, ...legacy }) => legacy),
      result: undefined,
    }));

    const service = createMemberService({ audit: noAudit, repository, disciplineLookup: fakeDisciplineLookup(), disciplineHistory: history, now: () => TODAY });
    expect((await service.getById(created.id)).disciplinesChangedOn).toBeUndefined();
    await service.update(created.id, { ...adultInput, whatsapp: '1155550000' }, 'user-test');
    expect(onDisciplinesChanged).toHaveBeenLastCalledWith(created.id, [BASKET], '2026-10-05');
  });
});
