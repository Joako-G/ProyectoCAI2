import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface JsonStore<T> {
  read(): Promise<T>;
  update(updater: (current: T) => T | Promise<T>): Promise<T>;
}

// Module-level so separate stores on the same file share one queue.
const queues = new Map<string, Promise<unknown>>();

function enqueue<R>(key: string, task: () => Promise<R>): Promise<R> {
  const result = (queues.get(key) ?? Promise.resolve()).then(task);
  const tail = result.catch(() => undefined);
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return result;
}

async function readFileOrDefault<T>(filePath: string, defaultValue: T): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(defaultValue);
    throw error;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${(error as Error).message}`);
  }
}

async function writeAtomically(filePath: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value, null, 2) as string | undefined;
  if (serialized === undefined) {
    throw new Error(`Cannot serialize ${typeof value} value to JSON for ${filePath}`);
  }
  await mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${serialized}\n`, 'utf8');
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export function createJsonStore<T>(filePath: string, defaultValue: T): JsonStore<T> {
  const path = resolve(filePath);

  return {
    read: () => enqueue(path, () => readFileOrDefault(path, defaultValue)),
    update: (updater) =>
      enqueue(path, async () => {
        const next = await updater(await readFileOrDefault(path, defaultValue));
        await writeAtomically(path, next);
        return next;
      }),
  };
}
