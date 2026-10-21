import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DisciplineSeedEntry } from '../../src/modules/disciplines/discipline.seed.js';
import type { DisciplineLookup } from '../../src/modules/members/discipline-lookup.js';
import { seedMembers, type SeedEntry } from '../../src/modules/members/member.seed.js';
import { createTestContext } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function setup() {
  const context = await createTestContext();
  cleanups.push(context.cleanup);
  const entries = JSON.parse(
    await readFile(join(__dirname, '../../data/members.seed.json'), 'utf8'),
  ) as SeedEntry[];
  const disciplineEntries = JSON.parse(
    await readFile(join(__dirname, '../../data/disciplines.seed.json'), 'utf8'),
  ) as DisciplineSeedEntry[];
  const disciplineLookup: DisciplineLookup = {
    findByIds: async (ids) => disciplineEntries.filter((d) => ids.includes(d.id)).map((d) => ({ id: d.id, status: 'active' })),
  };
  return { ...context, entries, disciplineEntries, disciplineLookup };
}

describe('seedMembers', () => {
  it('loads the synthetic seed through the service', async () => {
    const { service, repository, entries, disciplineLookup } = await setup();
    const count = await seedMembers({ repository, disciplineLookup, entries });

    const members = await service.list();
    expect(count).toBe(entries.length);
    expect(members).toHaveLength(8);
    expect(new Set(members.map((m) => m.memberNumber)).size).toBe(8);

    const inactive = members.filter((m) => m.status === 'inactive');
    expect(inactive.length).toBeGreaterThanOrEqual(1);
    for (const member of inactive) expect(member.deactivation?.reason).toBeTruthy();
    expect(members.some((m) => m.guardian)).toBe(true);
  });

  it('refuses to overwrite existing data without force', async () => {
    const { service, repository, entries, disciplineLookup } = await setup();
    await seedMembers({ repository, disciplineLookup, entries });

    await expect(seedMembers({ repository, disciplineLookup, entries })).rejects.toThrow(/already has data/);
    expect(await service.list()).toHaveLength(8);
  });

  it('replaces existing data when forced', async () => {
    const { service, repository, entries, disciplineLookup } = await setup();
    await seedMembers({ repository, disciplineLookup, entries });
    await seedMembers({ repository, disciplineLookup, entries, force: true });

    const members = await service.list();
    expect(members).toHaveLength(8);
    expect(members.map((m) => m.memberNumber).sort()[0]).toBe('0001');
  });

  it('leaves the original file byte-for-byte unchanged when a forced seed fails', async () => {
    const { repository, entries, file, disciplineLookup } = await setup();
    await seedMembers({ repository, disciplineLookup, entries });
    const before = await readFile(file, 'utf8');
    const invalid = [...entries, { ...entries[0]! }];

    await expect(seedMembers({ repository, disciplineLookup, entries: invalid, force: true })).rejects.toThrow(/DNI/);

    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('does not create the file when a first seed fails', async () => {
    const { repository, entries, file, disciplineLookup } = await setup();
    const invalid = [...entries, { ...entries[0]! }];

    await expect(seedMembers({ repository, disciplineLookup, entries: invalid })).rejects.toThrow(/DNI/);

    await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('gives every member one or two disciplines from the disciplines seed', async () => {
    const { entries, disciplineEntries } = await setup();
    const known = new Set(disciplineEntries.map((d) => d.id));
    for (const entry of entries) {
      expect(entry.disciplineIds.length).toBeGreaterThanOrEqual(1);
      expect(entry.disciplineIds.length).toBeLessThanOrEqual(2);
      for (const id of entry.disciplineIds) expect(known.has(id)).toBe(true);
    }
  });

  it('rejects a member whose discipline is not in the lookup and writes nothing', async () => {
    const { repository, entries, file, disciplineLookup } = await setup();
    const invalid = [{ ...entries[0]!, disciplineIds: ['not-seeded'] }];

    await expect(seedMembers({ repository, disciplineLookup, entries: invalid })).rejects.toThrow(/Validation failed/);

    await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
