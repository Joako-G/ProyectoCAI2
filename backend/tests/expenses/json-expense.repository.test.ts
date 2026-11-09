import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createJsonExpenseRepository } from '../../src/modules/expenses/json-expense.repository.js';
import type { Expense } from '../../src/modules/expenses/expense.types.js';

const dirs: string[] = [];

async function fileWith(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'expenses-repo-'));
  dirs.push(dir);
  const path = join(dir, 'expenses.json');
  await writeFile(path, content);
  return path;
}

afterEach(async () => {
  while (dirs.length > 0) await rm(dirs.pop()!, { recursive: true, force: true });
});

const expense: Expense = { id: 'e1', date: '2026-10-01', amount: 100, category: 'other', description: 'Algo', createdBy: 'u1', createdAt: '2026-10-01T15:00:00.000Z' };

describe('json expense repository', () => {
  it('reads a missing file as no expenses and appends to it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'expenses-repo-'));
    dirs.push(dir);
    const repository = createJsonExpenseRepository(join(dir, 'expenses.json'));

    expect(await repository.list()).toEqual([]);
    await repository.add(expense);
    expect(await repository.list()).toEqual([expense]);
  });

  it.each([
    ['not an array', '{"id":"e1"}'],
    ['a row with a negative amount', JSON.stringify([{ ...expense, amount: -5 }])],
    ['a row with a fractional amount', JSON.stringify([{ ...expense, amount: 1.5 }])],
    ['a row with an unknown category', JSON.stringify([{ ...expense, category: 'food' }])],
    ['a row with a date that is not a calendar day', JSON.stringify([{ ...expense, date: '2026-02-30' }])],
    ['a row with a date in another format', JSON.stringify([{ ...expense, date: '01/10/2026' }])],
    ['a row with an unreadable creation time', JSON.stringify([{ ...expense, createdAt: 'yesterday' }])],
    ['a row without a description', JSON.stringify([{ ...expense, description: undefined }])],
  ])('refuses to read %s', async (_name, content) => {
    const repository = createJsonExpenseRepository(await fileWith(content));
    await expect(repository.list()).rejects.toThrow(/Invalid expenses file/);
  });

  it('refuses to append to a wrong-shaped file and leaves it byte for byte as it was', async () => {
    const content = JSON.stringify([{ ...expense, amount: -5 }]);
    const path = await fileWith(content);
    const repository = createJsonExpenseRepository(path);

    await expect(repository.add(expense)).rejects.toThrow(/Invalid expenses file/);
    expect(await readFile(path, 'utf8')).toBe(content);
  });
});
