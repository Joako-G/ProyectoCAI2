import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { seedDisciplines } from '../../src/modules/disciplines/discipline.seed.js';
import type { DisciplineInput } from '../../src/modules/disciplines/discipline.types.js';
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
  ) as DisciplineInput[];
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
    const invalid = [...entries, { ...entries[0]! }];

    await expect(seedDisciplines({ repository, entries: invalid })).rejects.toThrow(/already exists/);
    expect(await service.list()).toEqual([]);
  });
});
