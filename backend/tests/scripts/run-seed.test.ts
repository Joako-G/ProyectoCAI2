import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DisciplineSeedEntry } from '../../src/modules/disciplines/discipline.seed.js';
import type { SeedEntry } from '../../src/modules/members/member.seed.js';
import { runSeed } from '../../src/scripts/run-seed.js';

let dir: string;
let disciplinesFile: string;
let membersFile: string;
let disciplineEntries: DisciplineSeedEntry[];
let memberEntries: SeedEntry[];

async function readSeed<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(__dirname, '../../data', name), 'utf8')) as T;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'run-seed-'));
  disciplinesFile = join(dir, 'disciplines.json');
  membersFile = join(dir, 'members.json');
  disciplineEntries = await readSeed('disciplines.seed.json');
  memberEntries = await readSeed('members.seed.json');
});

afterEach(() => rm(dir, { recursive: true, force: true }));

const options = (force = false) => ({ disciplinesFile, membersFile, disciplineEntries, memberEntries, force });
const missing = { code: 'ENOENT' };

describe('runSeed', () => {
  it('seeds disciplines, then members that reference them', async () => {
    const counts = await runSeed(options());

    expect(counts).toEqual({ disciplines: disciplineEntries.length, members: memberEntries.length });
    const disciplineIds = new Set((JSON.parse(await readFile(disciplinesFile, 'utf8')) as { id: string }[]).map((d) => d.id));
    const members = JSON.parse(await readFile(membersFile, 'utf8')) as { disciplineIds: string[] }[];
    for (const member of members) for (const id of member.disciplineIds) expect(disciplineIds.has(id)).toBe(true);
  });

  it('writes nothing when the members file already has data', async () => {
    await writeFile(membersFile, '[{"id":"keep"}]', 'utf8');

    await expect(runSeed(options())).rejects.toThrow(/Members file already has data/);

    await expect(readFile(disciplinesFile, 'utf8')).rejects.toMatchObject(missing);
    expect(await readFile(membersFile, 'utf8')).toBe('[{"id":"keep"}]');
  });

  it('writes nothing when the disciplines file already has data', async () => {
    const existing = '[{"id":"keep","name":"Judo","teachers":["T"],"leadTeacher":"T","status":"active"}]';
    await writeFile(disciplinesFile, existing, 'utf8');

    await expect(runSeed(options())).rejects.toThrow(/Disciplines file already has data/);

    expect(await readFile(disciplinesFile, 'utf8')).toBe(existing);
    await expect(readFile(membersFile, 'utf8')).rejects.toMatchObject(missing);
  });

  it('writes nothing when a member references a discipline that is not in the seed', async () => {
    memberEntries = [{ ...memberEntries[0]!, disciplineIds: ['not-seeded'] }];

    await expect(runSeed(options())).rejects.toThrow(/Validation failed/);

    await expect(readFile(disciplinesFile, 'utf8')).rejects.toMatchObject(missing);
    await expect(readFile(membersFile, 'utf8')).rejects.toMatchObject(missing);
  });

  it('replaces both files when forced', async () => {
    await runSeed(options());
    await expect(runSeed(options(true))).resolves.toMatchObject({ members: memberEntries.length });
  });
});
