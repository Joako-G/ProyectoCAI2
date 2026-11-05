import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuditEntry } from '../../src/modules/audit/audit.types.js';
import { createJsonAuditRepository } from '../../src/modules/audit/json-audit.repository.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function tempFile() {
  const dir = await mkdtemp(join(tmpdir(), 'audit-repo-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  return join(dir, 'audit.json');
}

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'e1',
    at: '2026-11-01T15:00:00.000Z',
    actor: { id: 'user-head', name: 'Ana Gómez', role: 'head_secretary' },
    action: 'create',
    entityType: 'member',
    entityId: 'm1',
    changedFields: [],
    ...overrides,
  };
}

describe('JSON audit repository', () => {
  it('reads a missing file as an empty log', async () => {
    expect(await createJsonAuditRepository(await tempFile()).list()).toEqual([]);
  });

  it('appends entries in order and keeps them across instances', async () => {
    const file = await tempFile();
    const repository = createJsonAuditRepository(file);
    await repository.append(entry({ id: 'e1' }));
    await repository.append(entry({ id: 'e2', action: 'update', changedFields: ['category'] }));
    expect((await createJsonAuditRepository(file).list()).map((stored) => stored.id)).toEqual(['e1', 'e2']);
  });

  it('keeps every earlier entry unchanged when appending', async () => {
    const file = await tempFile();
    const repository = createJsonAuditRepository(file);
    await repository.append(entry({ id: 'e1' }));
    const before = (JSON.parse(await readFile(file, 'utf8')) as AuditEntry[])[0];
    await repository.append(entry({ id: 'e2' }));
    expect((JSON.parse(await readFile(file, 'utf8')) as AuditEntry[])[0]).toEqual(before);
  });

  it('serialises concurrent appends without losing any', async () => {
    const repository = createJsonAuditRepository(await tempFile());
    await Promise.all(Array.from({ length: 20 }, (_, index) => repository.append(entry({ id: `e${index}` }))));
    expect(await repository.list()).toHaveLength(20);
  });

  it('exposes append and list only: there is no way to edit or delete an entry', async () => {
    expect(Object.keys(createJsonAuditRepository(await tempFile())).sort()).toEqual(['append', 'list']);
  });

  it.each([
    ['not JSON', '{nope'],
    ['not an array', '{"id":"e1"}'],
    ['an entry with a missing field', JSON.stringify([{ id: 'e1' }])],
    ['an unknown action', JSON.stringify([entry({ action: 'explode' as never })])],
    ['changed fields that are not text', JSON.stringify([entry({ changedFields: [1] as never })])],
  ])('fails loudly on a corrupt file (%s) instead of reading or overwriting it', async (_label, content) => {
    const file = await tempFile();
    await writeFile(file, content);
    const repository = createJsonAuditRepository(file);
    await expect(repository.list()).rejects.toThrow();
    await expect(repository.append(entry())).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe(content);
  });
});
