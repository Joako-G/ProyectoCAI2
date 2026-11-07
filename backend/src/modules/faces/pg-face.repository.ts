import type pg from 'pg';
import type { FaceRepository } from './face.repository.js';

/** pgvector reads a vector from text such as `[0.1,0.2]`; the value always travels as a bound parameter. */
const toVectorText = (descriptor: readonly number[]) => `[${descriptor.join(',')}]`;

// A driver error can quote the failing row, and a row holds a descriptor. So the error is replaced by one that
// carries only the driver's error code, and the original is dropped.
async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
    console.error(`Face database operation failed (code ${code})`);
    throw new Error('Face database operation failed');
  }
}

export function createPgFaceRepository(pool: Pick<pg.Pool, 'query'>): FaceRepository {
  return {
    upsert: (profile) =>
      guard(async () => {
        // xmax is 0 on a freshly inserted row and not on one the conflict clause updated.
        const result = await pool.query<{ inserted: boolean }>(
          `INSERT INTO face_profiles (member_id, descriptor, consented_at, consented_by, enrolled_at)
           VALUES ($1, $2::vector, $3, $4, $5)
           ON CONFLICT (member_id) DO UPDATE SET
             descriptor = EXCLUDED.descriptor,
             consented_at = EXCLUDED.consented_at,
             consented_by = EXCLUDED.consented_by,
             enrolled_at = EXCLUDED.enrolled_at
           RETURNING (xmax = 0) AS inserted`,
          [profile.memberId, toVectorText(profile.descriptor), profile.consentedAt, profile.consentedBy, profile.enrolledAt],
        );
        return result.rows[0]!.inserted ? 'created' : 'updated';
      }),

    remove: (memberId) =>
      guard(async () => {
        const result = await pool.query('DELETE FROM face_profiles WHERE member_id = $1', [memberId]);
        return (result.rowCount ?? 0) > 0;
      }),

    findEnrollment: (memberId) =>
      guard(async () => {
        const result = await pool.query<{ enrolled_at: Date }>('SELECT enrolled_at FROM face_profiles WHERE member_id = $1', [memberId]);
        const row = result.rows[0];
        return row ? { enrolledAt: row.enrolled_at.toISOString() } : undefined;
      }),

    nearest: (descriptor) =>
      guard(async () => {
        // <-> is the Euclidean (L2) distance.
        const result = await pool.query<{ member_id: string; distance: number }>(
          'SELECT member_id, descriptor <-> $1::vector AS distance FROM face_profiles ORDER BY descriptor <-> $1::vector LIMIT 1',
          [toVectorText(descriptor)],
        );
        const row = result.rows[0];
        return row ? { memberId: row.member_id, distance: Number(row.distance) } : undefined;
      }),
  };
}
