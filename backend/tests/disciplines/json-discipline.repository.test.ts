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
    ['an unknown status', '[{"id":"a","name":"Básquet","teachers":["T"],"leadTeacher":"T","status":"gone"}]'],
    ['a null element', '[null]'],
    ['teachers that are not strings', '[{"id":"a","name":"Básquet","teachers":[1],"leadTeacher":"T","status":"active"}]'],
    ['teachers without a lead teacher', '[{"id":"a","name":"Básquet","teachers":["T"],"status":"active"}]'],
    ['a lead teacher outside the teachers', '[{"id":"a","name":"Básquet","teachers":["T"],"leadTeacher":"U","status":"active"}]'],
    ['an empty teacher list', '[{"id":"a","name":"Básquet","teachers":[],"leadTeacher":"T","status":"active"}]'],
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

  it('reads a legacy record with teacherName as a single lead teacher, without rewriting the file', async () => {
    const file = await tempFile();
    const legacy = [{ id: 'a', name: 'Básquet', teacherName: 'Marcos', status: 'active', createdAt: '2026-01-01' }];
    const content = JSON.stringify(legacy);
    await writeFile(file, content, 'utf8');
    const repository = createJsonDisciplineRepository(file);

    expect(await repository.list()).toEqual([
      { id: 'a', name: 'Básquet', teachers: ['Marcos'], leadTeacher: 'Marcos', status: 'active', createdAt: '2026-01-01' },
    ]);
    expect(await readFile(file, 'utf8')).toBe(content);
  });

  it('writes only the new shape after a mutation of a legacy file', async () => {
    const file = await tempFile();
    await writeFile(file, '[{"id":"a","name":"Básquet","teacherName":"Marcos","status":"active"}]', 'utf8');
    const repository = createJsonDisciplineRepository(file);

    await repository.mutate((disciplines) => ({ disciplines, result: undefined }));

    const [stored] = JSON.parse(await readFile(file, 'utf8'));
    expect(stored).toEqual({ id: 'a', name: 'Básquet', teachers: ['Marcos'], leadTeacher: 'Marcos', status: 'active' });
    expect(stored).not.toHaveProperty('teacherName');
  });

  it('accepts well-shaped disciplines', async () => {
    const file = await tempFile();
    const discipline = {
      id: 'a',
      name: 'Básquet',
      teachers: ['T', 'U'],
      leadTeacher: 'U',
      status: 'inactive',
      deactivatedAt: '2026-10-01',
    };
    await writeFile(file, JSON.stringify([discipline]), 'utf8');

    expect(await createJsonDisciplineRepository(file).list()).toEqual([discipline]);
  });
});
