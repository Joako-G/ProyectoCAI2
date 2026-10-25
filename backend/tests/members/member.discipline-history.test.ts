import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DisciplineHistory } from '../../src/modules/members/discipline-history.js';
import { createJsonMemberRepository } from '../../src/modules/members/json-member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import { adultInput, BASKET, fakeDisciplineLookup, TODAY, VOLLEY } from './helpers.js';

const dirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (dirs.length > 0) await rm(dirs.pop()!, { recursive: true, force: true });
});

async function setup(disciplineHistory?: DisciplineHistory, now: () => Date = () => TODAY) {
  const dir = await mkdtemp(join(tmpdir(), 'members-history-'));
  dirs.push(dir);
  const service = createMemberService({
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
    const member = await service.create(adultInput);
    await expect(service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY] })).resolves.toBeTruthy();
  });

  it('is called on create with the member id, its disciplines and the club-local date', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history, () => new Date('2026-10-06T01:30:00Z'));
    const member = await service.create({ ...adultInput, disciplineIds: [BASKET, VOLLEY] });
    expect(onDisciplinesChanged).toHaveBeenCalledTimes(1);
    expect(onDisciplinesChanged).toHaveBeenCalledWith(member.id, [BASKET, VOLLEY], '2026-10-05');
  });

  it('is called on update with the current disciplines', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history);
    const member = await service.create(adultInput);
    await service.update(member.id, { ...adultInput, disciplineIds: [VOLLEY] });
    expect(onDisciplinesChanged).toHaveBeenCalledTimes(2);
    expect(onDisciplinesChanged).toHaveBeenLastCalledWith(member.id, [VOLLEY], '2026-10-05');
  });

  it('is not called when the write fails', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history);
    const member = await service.create(adultInput);
    onDisciplinesChanged.mockClear();

    await expect(service.create(adultInput)).rejects.toThrow(); // duplicate DNI
    await expect(service.create({ ...adultInput, dni: '1' })).rejects.toThrow(); // invalid input
    await expect(service.update('missing', adultInput)).rejects.toThrow(); // not found
    await expect(service.update(member.id, { ...adultInput, disciplineIds: ['unknown'] })).rejects.toThrow();
    expect(onDisciplinesChanged).not.toHaveBeenCalled();
  });

  it('is not called on deactivate or reactivate (cascade is an undecided owner rule)', async () => {
    const { history, onDisciplinesChanged } = spyHistory();
    const service = await setup(history);
    const member = await service.create(adultInput);
    onDisciplinesChanged.mockClear();
    await service.deactivate(member.id, 'Moved');
    await service.reactivate(member.id);
    expect(onDisciplinesChanged).not.toHaveBeenCalled();
  });

  it('keeps the saved member and logs when the port fails, because the startup reconcile repairs it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = await setup({
      onDisciplinesChanged: async () => {
        throw new Error('history down');
      },
    });
    const member = await service.create(adultInput);
    expect(await service.getById(member.id)).toEqual(member);
    expect(error).toHaveBeenCalled();
  });
});
