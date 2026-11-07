import pg from 'pg';

export interface PoolOptions {
  /** How long a single statement may run on the server before it is cancelled. */
  statementTimeoutMs?: number;
}

/**
 * One shared connection pool per process. The caller owns it and ends it on shutdown. A database that stops
 * answering must fail a request quickly (it falls back to the 503 or an error), never hang it: connecting waits at
 * most 5 s and a statement runs at most 10 s, far above what the small face queries need.
 */
export function createPool(connectionString: string, { statementTimeoutMs = 10_000 }: PoolOptions = {}): pg.Pool {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5_000, statement_timeout: statementTimeoutMs });
  // An idle client can fail (the database restarts); without a listener that would crash the process.
  // The message is the driver's own and carries no query text or parameters.
  pool.on('error', (error) => console.error('Idle database client failed', error.message));
  return pool;
}
