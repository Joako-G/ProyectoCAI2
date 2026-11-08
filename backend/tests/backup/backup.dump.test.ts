import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDumperFromCommands,
  createPgDumper,
  DumpError,
  dumpCandidates,
  parseCommandOverride,
  sanitizeTail,
  type DumpCommand,
} from '../../src/modules/backup/backup.dump.js';

const URL_WITH_SECRET = 'postgres://club:s3cret%21pw@127.0.0.1:5432/club_socios';
const COMPOSE = '/repo/docker-compose.yml';

let folder: string;
let target: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'dump-'));
  target = join(folder, 'database.dump.tmp');
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

// A fake dump command: the current Node runs a small script, so the real spawn path is exercised without PostgreSQL.
const node = (script: string): DumpCommand => ({ file: process.execPath, args: ['-e', script], env: {} });
const dumper = (command: DumpCommand, timeoutMs = 5_000) => createDumperFromCommands([command], { timeoutMs, secrets: ['s3cret!pw'] });
const MAGIC = "process.stdout.write('PGDMP');";

describe('parseCommandOverride', () => {
  it('reads a JSON array of strings, so a path with spaces works', () => {
    expect(parseCommandOverride('["C:\\\\Program Files\\\\pg\\\\pg_dump.exe","-Fc"]')).toEqual(['C:\\Program Files\\pg\\pg_dump.exe', '-Fc']);
  });

  it('splits plain text on whitespace', () => {
    expect(parseCommandOverride('  pg_dump   -Fc -w ')).toEqual(['pg_dump', '-Fc', '-w']);
  });

  it('rejects an empty value and a JSON that is not an array of strings', () => {
    expect(parseCommandOverride('   ')).toBeNull();
    expect(parseCommandOverride('[1,2]')).toBeNull();
    expect(parseCommandOverride('["pg_dump",')).toBeNull();
  });
});

describe('dumpCandidates: the order commands are tried in', () => {
  it('uses the override alone when it is set, with the connection in PG* variables', () => {
    const plan = dumpCandidates({ connectionString: URL_WITH_SECRET, env: { PG_DUMP_COMMAND: 'my-dump -Fc' }, composeFile: COMPOSE, composeFileExists: true });

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ file: 'my-dump', args: ['-Fc'] });
    expect(plan[0]!.env).toEqual({ PGHOST: '127.0.0.1', PGPORT: '5432', PGUSER: 'club', PGDATABASE: 'club_socios', PGPASSWORD: 's3cret!pw' });
  });

  it('has no candidate at all when the override cannot be read, instead of silently using another command', () => {
    expect(dumpCandidates({ connectionString: URL_WITH_SECRET, env: { PG_DUMP_COMMAND: '[1]' }, composeFile: COMPOSE, composeFileExists: true })).toEqual([]);
  });

  it('tries docker compose first for a local database, then pg_dump on the PATH', () => {
    const plan = dumpCandidates({ connectionString: URL_WITH_SECRET, env: {}, composeFile: COMPOSE, composeFileExists: true });

    expect(plan.map((candidate) => candidate.file)).toEqual(['docker', 'pg_dump']);
    expect(plan[0]!.args).toEqual(['compose', '-f', COMPOSE, 'exec', '-T', '-e', 'PGPASSWORD', 'db', 'pg_dump', '-U', 'club', '-d', 'club_socios', '-Fc', '-w']);
    expect(plan[1]!.args).toEqual(['-Fc', '-w']);
  });

  it('never puts the password on a command line', () => {
    const plan = dumpCandidates({ connectionString: URL_WITH_SECRET, env: {}, composeFile: COMPOSE, composeFileExists: true });

    for (const candidate of plan) expect(JSON.stringify([candidate.file, candidate.args])).not.toMatch(/s3cret|pw/);
    expect(plan[0]!.env.PGPASSWORD).toBe('s3cret!pw');
    expect(plan[1]!.env.PGPASSWORD).toBe('s3cret!pw');
  });

  it('skips docker when the compose file is not there', () => {
    const plan = dumpCandidates({ connectionString: URL_WITH_SECRET, env: {}, composeFile: COMPOSE, composeFileExists: false });
    expect(plan.map((candidate) => candidate.file)).toEqual(['pg_dump']);
  });

  it('skips docker when the database is not on this computer, because the compose service would be another database', () => {
    const plan = dumpCandidates({ connectionString: 'postgres://u:p@db.example.org:6543/other?sslmode=require', env: {}, composeFile: COMPOSE, composeFileExists: true });

    expect(plan.map((candidate) => candidate.file)).toEqual(['pg_dump']);
    expect(plan[0]!.env).toMatchObject({ PGHOST: 'db.example.org', PGPORT: '6543', PGDATABASE: 'other', PGSSLMODE: 'require' });
  });
});

describe('sanitizeTail', () => {
  it('hides connection strings and the password, collapses whitespace and stays short', () => {
    const text = `pg_dump: error: connection to postgres://club:s3cret!pw@host/db failed\n  password s3cret!pw wrong ${'x'.repeat(500)}`;
    const clean = sanitizeTail(text, ['s3cret!pw']);

    expect(clean).not.toContain('s3cret');
    expect(clean).not.toContain('postgres://');
    expect(clean).not.toContain('\n');
    expect(clean.length).toBeLessThanOrEqual(200);
  });
});

describe('the dumper', () => {
  it('streams the output of the command into the file and reports its size', async () => {
    const outcome = await dumper(node(`${MAGIC} process.stdout.write('-body');`)).dump(target);

    expect(outcome).toEqual({ bytes: 10 });
    expect(await readFile(target, 'utf8')).toBe('PGDMP-body');
  });

  it('streams a large output without holding it in memory (several megabytes)', async () => {
    const script = `${MAGIC} const chunk = Buffer.alloc(1024 * 1024, 7); let n = 6; (function write() { while (n-- > 0) { if (!process.stdout.write(chunk)) return process.stdout.once('drain', write); } })();`;
    const outcome = await dumper(node(script)).dump(target);

    expect(outcome.bytes).toBe(5 + 6 * 1024 * 1024);
    expect((await stat(target)).size).toBe(outcome.bytes);
  });

  it('fails with DATABASE_DUMP_UNAVAILABLE when no command can run, and creates no file', async () => {
    const missing: DumpCommand = { file: join(folder, 'no-such-pg-dump'), args: [], env: {} };

    await expect(dumper(missing).dump(target)).rejects.toMatchObject({ code: 'DATABASE_DUMP_UNAVAILABLE' });
    await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('is unavailable when it has no candidates at all', async () => {
    await expect(createDumperFromCommands([], { timeoutMs: 1_000, secrets: [] }).dump(target)).rejects.toMatchObject({ code: 'DATABASE_DUMP_UNAVAILABLE' });
  });

  it('moves on to the next command only when the previous one cannot start', async () => {
    const missing: DumpCommand = { file: join(folder, 'no-such-docker'), args: [], env: {} };
    const outcome = await createDumperFromCommands([missing, node(`${MAGIC}`)], { timeoutMs: 5_000, secrets: [] }).dump(target);
    expect(outcome.bytes).toBe(5);

    const failing = node("process.stderr.write('boom'); process.exit(3);");
    await expect(createDumperFromCommands([failing, node(`${MAGIC}`)], { timeoutMs: 5_000, secrets: [] }).dump(target)).rejects.toMatchObject({ code: 'DATABASE_DUMP_FAILED' });
  });

  it('fails with DATABASE_DUMP_FAILED on a non-zero exit, keeps a sanitized stderr tail and leaves no file', async () => {
    const script = "process.stderr.write('FATAL: password authentication failed for s3cret!pw at postgres://club:s3cret!pw@h/db'); process.exit(1);";
    const error = await dumper(node(script)).dump(target).catch((caught: unknown) => caught as DumpError);

    expect(error).toMatchObject({ code: 'DATABASE_DUMP_FAILED' });
    const detail = (error as DumpError).detail;
    expect(detail).toContain('password authentication failed');
    expect(detail).not.toContain('s3cret');
    expect(detail).not.toContain('postgres://');
    await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('removes the half-written file when the command dies after writing part of the output', async () => {
    const error = await dumper(node(`${MAGIC} process.stdout.write('partial'); process.exit(1);`)).dump(target).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'DATABASE_DUMP_FAILED' });
    expect(await readdir(folder)).toEqual([]);
  });

  it('kills a command that takes too long and leaves no file', async () => {
    const started = Date.now();
    const error = await dumper(node(`${MAGIC} setInterval(() => {}, 1000);`), 300).dump(target).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'DATABASE_DUMP_FAILED' });
    expect(Date.now() - started).toBeLessThan(4_000);
    expect(await readdir(folder)).toEqual([]);
  });

  it('refuses an empty output and an output that is not a custom-format dump', async () => {
    await expect(dumper(node('')).dump(target)).rejects.toMatchObject({ code: 'DATABASE_DUMP_FAILED' });
    await expect(dumper(node("process.stdout.write('-- plain SQL');")).dump(target)).rejects.toMatchObject({ code: 'DATABASE_DUMP_FAILED' });
    expect(await readdir(folder)).toEqual([]);
  });

  it('passes the password only through the environment of the child', async () => {
    const command: DumpCommand = {
      file: process.execPath,
      args: ['-e', `${MAGIC} process.stdout.write(process.env.PGPASSWORD ?? 'none'); process.stdout.write(process.env.DATABASE_URL ?? '|no-url');`],
      env: { PGPASSWORD: 's3cret!pw' },
    };
    process.env.DATABASE_URL = URL_WITH_SECRET;
    try {
      await dumper(command).dump(target);
    } finally {
      delete process.env.DATABASE_URL;
    }

    expect(await readFile(target, 'utf8')).toBe('PGDMPs3cret!pw|no-url');
  });

  it('createPgDumper uses the override command from the environment', async () => {
    const override = JSON.stringify([process.execPath, '-e', `${MAGIC} process.stdout.write(process.env.PGDATABASE);`]);
    const pgDumper = createPgDumper({ connectionString: URL_WITH_SECRET, env: { PG_DUMP_COMMAND: override }, composeFile: COMPOSE, timeoutMs: 5_000 });

    await pgDumper.dump(target);
    expect(await readFile(target, 'utf8')).toBe('PGDMPclub_socios');
  });
});
