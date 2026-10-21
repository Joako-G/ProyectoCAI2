import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createJsonDisciplineRepository } from '../../src/modules/disciplines/json-discipline.repository.js';

const dirs: string[] = [];

afterEach(async () => {
  while (dirs.length > 0) await rm(dirs.pop()!, { recursive: true, force: true });
});

async function tempFile() {
  const dir = await mkdtemp(join(tmpdir(), 'disciplines-repo-'));
  dirs.push(dir);
  return join(dir, 'disciplines.json');
}

describe('json discipline repository', () => {
  it('reads an empty list when the file does not exist', async () => {
    const repository = createJsonDisciplineRepository(await tempFile());
    expect(await repository.list()).toEqual([]);
  });

  it('refuses to read or mutate a file that is not a JSON array and leaves it untouched', async () => {
    const file = await tempFile();
    await writeFile(file, '{"not":"an array"}', 'utf8');
    const repository = createJsonDisciplineRepository(file);

    await expect(repository.list()).rejects.toThrow(/Invalid disciplines file/);
    await expect(repository.mutate((disciplines) => ({ disciplines, result: 1 }))).rejects.toThrow(
      /Invalid disciplines file/,
    );
    expect(await readFile(file, 'utf8')).toBe('{"not":"an array"}');
  });

  it.each([
    ['a non-object element', '[1]'],
    ['a missing field', '[{"id":"a","name":"Básquet","status":"active"}]'],
    ['an unknown status', '[{"id":"a","name":"Básquet","teacherName":"T","status":"gone"}]'],
    ['a null element', '[null]'],
  ])('refuses a file with %s and leaves it untouched', async (_label, content) => {
    const file = await tempFile();
    await writeFile(file, content, 'utf8');
    const repository = createJsonDisciplineRepository(file);

    await expect(repository.list()).rejects.toThrow(/Invalid disciplines file/);
    await expect(repository.mutate((disciplines) => ({ disciplines, result: 1 }))).rejects.toThrow(
      /Invalid disciplines file/,
    );
    expect(await readFile(file, 'utf8')).toBe(content);
  });

  it('accepts well-shaped disciplines', async () => {
    const file = await tempFile();
    const discipline = { id: 'a', name: 'Básquet', teacherName: 'T', status: 'inactive', deactivatedAt: '2026-10-01' };
    await writeFile(file, JSON.stringify([discipline]), 'utf8');

    expect(await createJsonDisciplineRepository(file).list()).toEqual([discipline]);
  });
});
