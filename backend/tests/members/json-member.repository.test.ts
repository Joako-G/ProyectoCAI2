import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJsonMemberRepository } from '../../src/modules/members/json-member.repository.js';
import type { Member } from '../../src/modules/members/member.types.js';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'member-repo-'));
  file = join(dir, 'members.json');
});

afterEach(() => rm(dir, { recursive: true, force: true }));

const member = { id: 'a', memberNumber: '0001' } as Member;

describe('json member repository', () => {
  it('lists nothing when the file does not exist', async () => {
    expect(await createJsonMemberRepository(file).list()).toEqual([]);
  });

  it('persists the members returned by a mutation and returns its result', async () => {
    const repository = createJsonMemberRepository(file);

    const result = await repository.mutate((members) => ({ members: [...members, member], result: 'done' }));

    expect(result).toBe('done');
    expect(await repository.list()).toEqual([member]);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([member]);
  });

  it('writes nothing when the mutation throws', async () => {
    const repository = createJsonMemberRepository(file);
    await repository.mutate((members) => ({ members: [...members, member], result: null }));

    await expect(
      repository.mutate(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await repository.list()).toEqual([member]);
  });

  describe('when the file does not hold a JSON array', () => {
    const content = '{"members":[]}\n';

    it('fails to list with a clear error', async () => {
      await writeFile(file, content, 'utf8');

      await expect(createJsonMemberRepository(file).list()).rejects.toThrow(/must contain a JSON array/);
    });

    it('fails to mutate and leaves the file untouched', async () => {
      await writeFile(file, content, 'utf8');
      let called = false;

      await expect(
        createJsonMemberRepository(file).mutate((members) => {
          called = true;
          return { members: [...members], result: null };
        }),
      ).rejects.toThrow(/must contain a JSON array/);

      expect(called).toBe(false);
      expect(await readFile(file, 'utf8')).toBe(content);
    });
  });
});
