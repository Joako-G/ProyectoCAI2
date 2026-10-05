import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
  return { ...context, entries };
}

describe('seedMembers', () => {
  it('loads the synthetic seed through the service', async () => {
    const { service, repository, entries } = await setup();
    const count = await seedMembers({ service, repository, entries });

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
    const { service, repository, entries } = await setup();
    await seedMembers({ service, repository, entries });

    await expect(seedMembers({ service, repository, entries })).rejects.toThrow(/already has data/);
    expect(await service.list()).toHaveLength(8);
  });

  it('replaces existing data when forced', async () => {
    const { service, repository, entries } = await setup();
    await seedMembers({ service, repository, entries });
    await seedMembers({ service, repository, entries, force: true });

    const members = await service.list();
    expect(members).toHaveLength(8);
    expect(members.map((m) => m.memberNumber).sort()[0]).toBe('0001');
  });
});
