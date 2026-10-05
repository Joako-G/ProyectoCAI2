import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJsonStore } from '../src/database/json-store.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'json-store-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createJsonStore', () => {
  it('returns the default value when the file does not exist', async () => {
    const store = createJsonStore(join(dir, 'missing.json'), { items: [] as string[] });

    expect(await store.read()).toEqual({ items: [] });
  });

  it('does not create the file on read', async () => {
    await createJsonStore(join(dir, 'missing.json'), []).read();

    expect(await readdir(dir)).toEqual([]);
  });

  it('round-trips data written by update', async () => {
    const file = join(dir, 'data.json');

    await createJsonStore(file, { count: 0 }).update((current) => ({ count: current.count + 1 }));

    expect(await createJsonStore(file, { count: 0 }).read()).toEqual({ count: 1 });
  });

  it('writes pretty-printed JSON', async () => {
    const file = join(dir, 'data.json');

    await createJsonStore<Record<string, number>>(file, {}).update(() => ({ a: 1 }));

    expect(await readFile(file, 'utf8')).toBe('{\n  "a": 1\n}\n');
  });

  it('creates missing parent directories on first write', async () => {
    const file = join(dir, 'nested', 'deeper', 'data.json');

    await createJsonStore(file, [] as number[]).update((current) => [...current, 1]);

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([1]);
  });

  it('supports async updaters and returns the new value', async () => {
    const store = createJsonStore(join(dir, 'data.json'), 0);

    const result = await store.update(async (current) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return current + 10;
    });

    expect(result).toBe(10);
  });

  it('applies concurrent updates in order without losing any', async () => {
    const file = join(dir, 'counter.json');
    const store = createJsonStore(file, { count: 0 });

    await Promise.all(
      Array.from({ length: 50 }, () => store.update((current) => ({ count: current.count + 1 }))),
    );

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ count: 50 });
  });

  it('serializes updates across store instances on the same file', async () => {
    const file = join(dir, 'shared.json');
    const first = createJsonStore(file, { count: 0 });
    const second = createJsonStore(file, { count: 0 });

    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        (index % 2 === 0 ? first : second).update((current) => ({ count: current.count + 1 })),
      ),
    );

    expect(await first.read()).toEqual({ count: 40 });
  });

  it('keeps processing the queue after a failed update', async () => {
    const store = createJsonStore(join(dir, 'data.json'), { count: 0 });

    const failing = store.update(() => {
      throw new Error('boom');
    });
    const following = store.update((current) => ({ count: current.count + 1 }));

    await expect(failing).rejects.toThrow('boom');
    expect(await following).toEqual({ count: 1 });
  });

  it('throws a clear error on invalid JSON and leaves the file untouched', async () => {
    const file = join(dir, 'broken.json');
    await writeFile(file, '{ not json', 'utf8');
    const store = createJsonStore<Record<string, number>>(file, {});

    await expect(store.read()).rejects.toThrow(/invalid json/i);
    await expect(store.update(() => ({ a: 1 }))).rejects.toThrow(/invalid json/i);
    expect(await readFile(file, 'utf8')).toBe('{ not json');
  });

  it('leaves no temporary files behind after writes', async () => {
    const store = createJsonStore(join(dir, 'data.json'), { count: 0 });

    await Promise.all(
      Array.from({ length: 10 }, () => store.update((current) => ({ count: current.count + 1 }))),
    );

    expect(await readdir(dir)).toEqual(['data.json']);
  });

  it('returns a fresh clone of the default value on every read', async () => {
    const defaultValue = { items: [] as string[] };
    const store = createJsonStore(join(dir, 'missing.json'), defaultValue);

    (await store.read()).items.push('leaked');

    expect(await store.read()).toEqual({ items: [] });
    expect(defaultValue).toEqual({ items: [] });
  });

  it('rejects values that cannot be serialized and keeps the store usable', async () => {
    const file = join(dir, 'data.json');
    const store = createJsonStore<unknown>(file, { count: 0 });
    await store.update(() => ({ count: 1 }));

    await expect(store.update(() => undefined)).rejects.toThrow(/serializ/i);
    await expect(store.update(() => (() => 1))).rejects.toThrow(/serializ/i);

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ count: 1 });
    expect(await store.update(() => ({ count: 2 }))).toEqual({ count: 2 });
    expect(await readdir(dir)).toEqual(['data.json']);
  });

  it('cleans up the temporary file and recovers when the final rename fails', async () => {
    const file = join(dir, 'data.json');
    const store = createJsonStore(file, { count: 0 });

    await expect(
      store.update(async (current) => {
        await mkdir(file);
        return { count: current.count + 1 };
      }),
    ).rejects.toThrow();

    expect(await readdir(dir)).toEqual(['data.json']);
    await rm(file, { recursive: true });
    expect(await store.update((current) => ({ count: current.count + 5 }))).toEqual({ count: 5 });
    expect(await readdir(dir)).toEqual(['data.json']);
  });
});
