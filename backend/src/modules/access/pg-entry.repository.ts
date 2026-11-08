import type pg from 'pg';
import { CLUB_TIME_ZONE } from '../../config/club.js';
import type { EntryRepository } from './entry.repository.js';

// Failures are reduced to the driver's error code so a message that quotes a row never reaches a log or a response.
async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
    throw Object.assign(new Error('Entry database operation failed'), { code });
  }
}

interface Row {
  id: string;
  member_id: string;
  result: 'green' | 'yellow' | 'red';
  reason: string | null;
  method: 'dni' | 'face';
  checked_at: Date;
  checked_by: string;
}

export function createPgEntryRepository(pool: Pick<pg.Pool, 'query'>, timeZone: string = CLUB_TIME_ZONE): EntryRepository {
  return {
    append: (entry) =>
      guard(async () => {
        await pool.query(
          'INSERT INTO access_entries (member_id, result, reason, method, checked_at, checked_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [entry.memberId, entry.result, entry.reason, entry.method, entry.checkedAt, entry.checkedBy],
        );
      }),

    listByDate: (date) =>
      guard(async () => {
        // The day runs from local midnight to the next local midnight, so the checked_at index serves the range.
        const result = await pool.query<Row>(
          `SELECT id, member_id, result, reason, method, checked_at, checked_by
           FROM access_entries
           WHERE checked_at >= ($1::date)::timestamp AT TIME ZONE $2
             AND checked_at < (($1::date + 1))::timestamp AT TIME ZONE $2
           ORDER BY checked_at DESC, id`,
          [date, timeZone],
        );
        return result.rows.map((row) => ({
          id: row.id,
          memberId: row.member_id,
          result: row.result,
          reason: row.reason ?? '',
          method: row.method,
          checkedAt: row.checked_at.toISOString(),
          checkedBy: row.checked_by,
        }));
      }),
  };
}
