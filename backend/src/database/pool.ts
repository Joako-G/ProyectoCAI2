import pg from 'pg';

/** One shared connection pool per process. The caller owns it and ends it on shutdown. */
export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString });
  // An idle client can fail (the database restarts); without a listener that would crash the process.
  // The message is the driver's own and carries no query text or parameters.
  pool.on('error', (error) => console.error('Idle database client failed', error.message));
  return pool;
}
