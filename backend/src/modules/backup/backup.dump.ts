import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { open, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const DEFAULT_TIMEOUT_MS = 120_000;
const STDERR_KEEP_CHARS = 2_000;
const TAIL_MAX_CHARS = 200;
// Every `pg_dump -Fc` file starts with these five bytes.
const CUSTOM_FORMAT_MAGIC = 'PGDMP';
const LOCAL_HOSTS = new Set(['', 'localhost', '127.0.0.1', '::1', '[::1]']);

/** The port the backup uses to take a database dump: streams a PostgreSQL custom-format dump into `target`. */
export interface DatabaseDumper {
  dump(target: string): Promise<{ bytes: number }>;
}

export type DumpFailureCode = 'DATABASE_DUMP_FAILED' | 'DATABASE_DUMP_UNAVAILABLE';

/** A dump that did not finish. `code` is stored and shown; `detail` is a short sanitized text for the server log only. */
export class DumpError extends Error {
  constructor(
    readonly code: DumpFailureCode,
    readonly detail: string = '',
  ) {
    super(code);
  }
}

/** One way of running `pg_dump`: the executable, its argument list (never a shell string) and extra environment variables. */
export interface DumpCommand {
  file: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Reads `PG_DUMP_COMMAND`: a JSON array of strings (a path with spaces works) or plain text split on whitespace.
 * Returns null when the value is empty or is not a list of strings.
 */
export function parseCommandOverride(raw: string): string[] | null {
  const text = raw.trim();
  if (text === '') return null;
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text);
      return Array.isArray(parsed) && parsed.length > 0 && parsed.every((part) => typeof part === 'string' && part !== '') ? (parsed as string[]) : null;
    } catch {
      return null;
    }
  }
  return text.split(/\s+/);
}

interface Connection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslMode: string;
}

function parseConnection(connectionString: string): Connection {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    sslMode: url.searchParams.get('sslmode') ?? '',
  };
}

/** The libpq variables pg_dump reads. The password is only ever here, in the child's environment. */
function pgEnvironment(connection: Connection): Record<string, string> {
  const entries: Array<[string, string]> = [
    ['PGHOST', connection.host],
    ['PGPORT', connection.port],
    ['PGUSER', connection.user],
    ['PGDATABASE', connection.database],
    ['PGPASSWORD', connection.password],
    ['PGSSLMODE', connection.sslMode],
  ];
  return Object.fromEntries(entries.filter(([, value]) => value !== ''));
}

export interface CandidateOptions {
  connectionString: string;
  env: NodeJS.ProcessEnv;
  composeFile: string;
  composeFileExists: boolean;
}

/**
 * The commands to try, in order:
 * 1. `PG_DUMP_COMMAND`, when set. It is used alone: a mistake in it is reported, never replaced by another command.
 * 2. `docker compose -f <repo>/docker-compose.yml exec -T db pg_dump ...`, for a database on this computer and when
 *    the compose file exists. This is how the development database runs and this PC has no `pg_dump` of its own.
 * 3. `pg_dump` found on the PATH, connected with the settings of DATABASE_URL.
 * A command is skipped for the next one only when it cannot start (not found); a command that ran and failed is a failure.
 */
export function dumpCandidates({ connectionString, env, composeFile, composeFileExists }: CandidateOptions): DumpCommand[] {
  const connection = parseConnection(connectionString);
  const pgEnv = pgEnvironment(connection);
  const override = env.PG_DUMP_COMMAND?.trim();
  if (override) {
    const parts = parseCommandOverride(override);
    return parts ? [{ file: parts[0]!, args: parts.slice(1), env: pgEnv }] : [];
  }
  const candidates: DumpCommand[] = [];
  if (composeFileExists && LOCAL_HOSTS.has(connection.host)) {
    // `-e PGPASSWORD` without a value passes the child's own variable on: the password is not on the command line.
    const passPassword = connection.password === '' ? [] : ['-e', 'PGPASSWORD'];
    candidates.push({
      file: 'docker',
      args: ['compose', '-f', composeFile, 'exec', '-T', ...passPassword, 'db', 'pg_dump', '-U', connection.user, '-d', connection.database, '-Fc', '-w'],
      env: pgEnv.PGPASSWORD ? { PGPASSWORD: pgEnv.PGPASSWORD } : {},
    });
  }
  candidates.push({ file: 'pg_dump', args: ['-Fc', '-w'], env: pgEnv });
  return candidates;
}

/** Makes stderr safe for the server log: no connection string, no password, one short line. */
export function sanitizeTail(text: string, secrets: readonly string[]): string {
  let clean = text.replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection]');
  for (const secret of secrets) {
    if (secret !== '') clean = clean.split(secret).join('[hidden]');
  }
  return clean.replace(/\s+/g, ' ').trim().slice(0, TAIL_MAX_CHARS);
}

interface DumperOptions {
  timeoutMs?: number;
  /** Values that must never reach a log, for example the database password. */
  secrets?: readonly string[];
}

type RunOutcome = { kind: 'done'; bytes: number } | { kind: 'not_found' };

async function hasCustomFormatHeader(path: string): Promise<boolean> {
  const handle = await open(path, 'r');
  try {
    const { bytesRead, buffer } = await handle.read(Buffer.alloc(CUSTOM_FORMAT_MAGIC.length), 0, CUSTOM_FORMAT_MAGIC.length, 0);
    return buffer.subarray(0, bytesRead).toString('latin1') === CUSTOM_FORMAT_MAGIC;
  } finally {
    await handle.close();
  }
}

async function runCommand(command: DumpCommand, target: string, timeoutMs: number, secrets: readonly string[]): Promise<RunOutcome> {
  // The child inherits the environment except the connection string: only PG* variables carry the connection.
  const { DATABASE_URL: _omitted, ...inherited } = process.env;
  const child = spawn(command.file, command.args, { env: { ...inherited, ...command.env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.on('error', () => undefined);
  const started = await new Promise<boolean>((resolve) => {
    child.once('spawn', () => resolve(true));
    child.once('error', () => resolve(false));
  });
  if (!started) return { kind: 'not_found' };

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString('utf8')).slice(-STDERR_KEEP_CHARS);
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutMs);
  const closed = new Promise<number | null>((resolve) => child.once('close', (code) => resolve(code)));
  // Straight to the file: the dump is never held in memory.
  const written = pipeline(child.stdout, createWriteStream(target)).then(
    () => null,
    (error: unknown) => {
      child.kill();
      return error;
    },
  );
  const [exitCode, writeError] = await Promise.all([closed, written]);
  clearTimeout(timer);

  if (timedOut) throw new DumpError('DATABASE_DUMP_FAILED', 'timed out');
  if (writeError) throw new DumpError('DATABASE_DUMP_FAILED', 'could not write the dump file');
  if (exitCode !== 0) throw new DumpError('DATABASE_DUMP_FAILED', `exit code ${exitCode}: ${sanitizeTail(stderr, secrets)}`);
  const { size } = await stat(target);
  if (size === 0) throw new DumpError('DATABASE_DUMP_FAILED', 'empty output');
  if (!(await hasCustomFormatHeader(target))) throw new DumpError('DATABASE_DUMP_FAILED', 'output is not a custom-format dump');
  return { kind: 'done', bytes: size };
}

/** Tries each command in order and streams the first one that can start into the target file. */
export function createDumperFromCommands(commands: readonly DumpCommand[], { timeoutMs = DEFAULT_TIMEOUT_MS, secrets = [] }: DumperOptions = {}): DatabaseDumper {
  return {
    async dump(target) {
      for (const command of commands) {
        try {
          const outcome = await runCommand(command, target, timeoutMs, secrets);
          if (outcome.kind === 'not_found') continue;
          return { bytes: outcome.bytes };
        } catch (error) {
          // A failed dump never leaves a half-written file behind.
          await rm(target, { force: true }).catch(() => undefined);
          throw error instanceof DumpError ? error : new DumpError('DATABASE_DUMP_FAILED', 'unexpected error');
        }
      }
      throw new DumpError('DATABASE_DUMP_UNAVAILABLE', 'no dump command could be started');
    },
  };
}

export interface PgDumperOptions {
  connectionString: string;
  composeFile: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

/** The real dumper: `pg_dump -Fc`, found through PG_DUMP_COMMAND, docker compose or the PATH (see `dumpCandidates`). */
export function createPgDumper({ connectionString, composeFile, env = process.env, timeoutMs }: PgDumperOptions): DatabaseDumper {
  try {
    const candidates = dumpCandidates({ connectionString, env, composeFile, composeFileExists: existsSync(composeFile) });
    return createDumperFromCommands(candidates, { timeoutMs, secrets: [parseConnection(connectionString).password] });
  } catch {
    // A DATABASE_URL that cannot be read must not stop the backend: every dump just reports that it is unavailable.
    return createDumperFromCommands([]);
  }
}
