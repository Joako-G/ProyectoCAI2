import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { listMigrationFiles, migrationsDirectory, runMigrations } from '../../src/database/migrate.js';
import { createTestPool, describeWithDatabase, resetDatabase } from './helpers.js';

async function migrationsFolder(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'migrations-'));
  for (const [name, sql] of Object.entries(files)) await writeFile(join(dir, name), sql);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

describe('listMigrationFiles', () => {
  it('returns the numbered .sql files in order and ignores anything else', async () => {
    const folder = await migrationsFolder({ '010_last.sql': '', '002_second.sql': '', '001_first.sql': '', 'README.md': '', 'notes.sql': '' });
    try {
      expect(await listMigrationFiles(folder.dir)).toEqual(['001_first.sql', '002_second.sql', '010_last.sql']);
    } finally {
      await folder.cleanup();
    }
  });

  it('finds the real migrations, starting with the pgvector extension', async () => {
    const files = await listMigrationFiles(migrationsDirectory);
    expect(files[0]).toBe('001_enable_pgvector.sql');
  });
});

describeWithDatabase('runMigrations', () => {
  let pool: pg.Pool;

  beforeEach(async () => {
    pool ??= createTestPool();
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('applies every migration once, in order, and records them', async () => {
    const applied = await runMigrations(pool);
    expect(applied[0]).toBe('001_enable_pgvector.sql');
    const recorded = await pool.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name');
    expect(recorded.rows.map((row) => row.name)).toEqual(applied);
    const extension = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    expect(extension.rowCount).toBe(1);
  });

  it('applies nothing the second time', async () => {
    await runMigrations(pool);
    expect(await runMigrations(pool)).toEqual([]);
  });

  it('applies only the new files and keeps the order', async () => {
    const first = await migrationsFolder({ '001_one.sql': 'CREATE TABLE one (id integer);' });
    const second = await migrationsFolder({ '001_one.sql': 'CREATE TABLE one (id integer);', '002_two.sql': 'CREATE TABLE two (id integer);' });
    try {
      expect(await runMigrations(pool, first.dir)).toEqual(['001_one.sql']);
      expect(await runMigrations(pool, second.dir)).toEqual(['002_two.sql']);
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
  });

  it('rolls a failing migration back completely, names it, and stops', async () => {
    const folder = await migrationsFolder({
      '001_ok.sql': 'CREATE TABLE ok (id integer);',
      '002_broken.sql': 'CREATE TABLE half (id integer); SELECT * FROM does_not_exist;',
      '003_never.sql': 'CREATE TABLE never (id integer);',
    });
    try {
      await expect(runMigrations(pool, folder.dir)).rejects.toThrow(/002_broken\.sql/);
      const tables = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      const names = tables.rows.map((row) => row.table_name);
      expect(names).toContain('ok');
      expect(names).not.toContain('half');
      expect(names).not.toContain('never');
      const recorded = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
      expect(recorded.rows.map((row) => row.name)).toEqual(['001_ok.sql']);
    } finally {
      await folder.cleanup();
    }
  });

  it('applies each file once when two runs start together', async () => {
    const folder = await migrationsFolder({ '001_one.sql': 'CREATE TABLE one (id integer);' });
    try {
      const results = await Promise.all([runMigrations(pool, folder.dir), runMigrations(pool, folder.dir)]);
      expect(results.flat()).toEqual(['001_one.sql']);
    } finally {
      await folder.cleanup();
    }
  });
});
