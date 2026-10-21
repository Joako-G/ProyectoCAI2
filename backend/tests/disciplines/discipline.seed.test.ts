import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { seedDisciplines, type DisciplineSeedEntry } from '../../src/modules/disciplines/discipline.seed.js';
import { createTestContext } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function setup() {
  const context = await createTestContext();
  cleanups.push(context.cleanup);
  const entries = JSON.parse(
    await readFile(join(__dirname, '../../data/disciplines.seed.json'), 'utf8'),
  ) as DisciplineSeedEntry[];
  return { ...context, entries };
}

describe('seedDisciplines', () => {
  it('loads the synthetic seed through the service', async () => {
    const { service, repository, entries } = await setup();
    const count = await seedDisciplines({ repository, entries });

    const disciplines = await service.list();
    expect(count).toBe(entries.length);
    expect(disciplines).toHaveLength(6);
    expect(disciplines.every((d) => d.status === 'active')).toBe(true);
  });

  it('seeds disciplines with one and with several teachers, each with a lead among them', async () => {
    const { service, repository, entries } = await setup();
    await seedDisciplines({ repository, entries });

    const disciplines = await service.list();
    expect(disciplines.some((d) => d.teachers.length === 1)).toBe(true);
    expect(disciplines.some((d) => d.teachers.length === 2)).toBe(true);
    expect(disciplines.every((d) => d.teachers.includes(d.leadTeacher))).toBe(true);
  });

  it('refuses a seed entry whose lead teacher is not among its teachers', async () => {
    const { service, repository, entries } = await setup();
    const invalid = [{ ...entries[0]!, leadTeacher: 'Nobody (demo)' }];

    await expect(seedDisciplines({ repository, entries: invalid })).rejects.toThrow(/Validation failed/);
    expect(await service.list()).toEqual([]);
  });

  it('refuses to overwrite existing data without force', async () => {
    const { service, repository, entries } = await setup();
    await seedDisciplines({ repository, entries });

    await expect(seedDisciplines({ repository, entries })).rejects.toThrow(/already has data/);
    expect(await service.list()).toHaveLength(6);
  });

  it('replaces existing data when forced', async () => {
    const { service, repository, entries } = await setup();
    await seedDisciplines({ repository, entries });
    await seedDisciplines({ repository, entries, force: true });

    expect(await service.list()).toHaveLength(6);
  });

  it('writes nothing when an entry is invalid', async () => {
    const { service, repository, entries } = await setup();
    const invalid = [...entries, { ...entries[0]!, id: 'disc-copy' }];

    await expect(seedDisciplines({ repository, entries: invalid })).rejects.toThrow(/already exists/);
    expect(await service.list()).toEqual([]);
  });

  it('keeps the fixed ids of the seed entries so other seeds can reference them', async () => {
    const { service, repository, entries } = await setup();
    await seedDisciplines({ repository, entries });

    expect((await service.list()).map((d) => d.id).sort()).toEqual(entries.map((e) => e.id).sort());
  });

  it('rejects duplicate ids and writes nothing', async () => {
    const { service, repository, entries } = await setup();
    const invalid = [entries[0]!, { ...entries[1]!, id: entries[0]!.id }];

    await expect(seedDisciplines({ repository, entries: invalid })).rejects.toThrow(/id/i);
    expect(await service.list()).toEqual([]);
  });
});
