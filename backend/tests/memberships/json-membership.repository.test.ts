import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { membershipsFilePath } from '../../src/config/paths.js';
import { createJsonMembershipRepository } from '../../src/modules/memberships/json-membership.repository.js';
import type { Membership } from '../../src/modules/memberships/membership.types.js';

const dirs: string[] = [];

afterEach(async () => {
  while (dirs.length > 0) await rm(dirs.pop()!, { recursive: true, force: true });
});

async function tempFile() {
  const dir = await mkdtemp(join(tmpdir(), 'memberships-repo-'));
  dirs.push(dir);
  return join(dir, 'memberships.json');
}

const valid: Membership = {
  id: 'a',
  memberId: 'm',
  disciplineId: 'd',
  startDate: '2026-01-01',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('json membership repository', () => {
  it('reads an empty list when the file does not exist', async () => {
    expect(await createJsonMembershipRepository(await tempFile()).list()).toEqual([]);
  });

  it('persists a mutation and returns its result', async () => {
    const file = await tempFile();
    const repository = createJsonMembershipRepository(file);
    const result = await repository.mutate((memberships) => ({ memberships: [...memberships, valid], result: 'ok' }));
    expect(result).toBe('ok');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([valid]);
  });

  it('does not write when the change throws', async () => {
    const file = await tempFile();
    const repository = createJsonMembershipRepository(file);
    await expect(
      repository.mutate(() => {
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await repository.list()).toEqual([]);
  });

  it.each([
    ['an object instead of an array', '{"not":"an array"}'],
    ['a null element', '[null]'],
    ['a missing field', '[{"id":"a","memberId":"m","status":"active"}]'],
    ['an unknown status', JSON.stringify([{ ...valid, status: 'gone' }])],
    ['an ended record without an end date', JSON.stringify([{ ...valid, status: 'ended' }])],
  ])('refuses a file with %s and leaves it untouched', async (_label, content) => {
    const file = await tempFile();
    await writeFile(file, content, 'utf8');
    const repository = createJsonMembershipRepository(file);
    await expect(repository.list()).rejects.toThrow(/Invalid memberships file/);
    await expect(repository.mutate((memberships) => ({ memberships, result: 1 }))).rejects.toThrow(
      /Invalid memberships file/,
    );
    expect(await readFile(file, 'utf8')).toBe(content);
  });
});

describe('membershipsFilePath', () => {
  it('defaults to data/memberships.json and honors MEMBERSHIPS_FILE', () => {
    expect(membershipsFilePath({})).toMatch(/data[\\/]memberships\.json$/);
    expect(membershipsFilePath({ MEMBERSHIPS_FILE: '/abs/custom.json' })).toMatch(/custom\.json$/);
  });
});
