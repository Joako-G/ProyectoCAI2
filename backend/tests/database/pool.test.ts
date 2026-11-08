import { describe, expect, it } from 'vitest';
import { createPool } from '../../src/database/pool.js';

describe('createPool', () => {
  it('sets connection and statement timeouts so a stuck database cannot hang a request', async () => {
    const pool = createPool('postgres://club:pw@127.0.0.1:1/none');
    try {
      const options = pool.options as { connectionTimeoutMillis?: number; statement_timeout?: number };
      expect(options.connectionTimeoutMillis).toBe(5_000);
      expect(options.statement_timeout).toBe(10_000);
    } finally {
      await pool.end();
    }
  });

  it('lets a caller such as the migrate script allow longer statements', async () => {
    const pool = createPool('postgres://club:pw@127.0.0.1:1/none', { statementTimeoutMs: 120_000 });
    try {
      expect((pool.options as { statement_timeout?: number }).statement_timeout).toBe(120_000);
    } finally {
      await pool.end();
    }
  });
});
