import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { runMigrations } from '../../src/database/migrate.js';
import { createPgFaceRepository } from '../../src/modules/faces/pg-face.repository.js';
import { descriptor } from '../faces/helpers.js';
import { createTestPool, describeWithDatabase, resetDatabase } from './helpers.js';

const WHEN = '2026-11-07T15:00:00.000Z';

/** A 128-number descriptor that is `first` in the first position and 0 elsewhere, so distances are easy to predict. */
function unit(first: number): number[] {
  return [first, ...descriptor(0, 127)];
}

function profile(memberId: string, vector: number[], overrides: Record<string, string> = {}) {
  return { memberId, descriptor: vector, consentedAt: WHEN, consentedBy: 'user-1', enrolledAt: WHEN, ...overrides };
}

describeWithDatabase('PostgreSQL face repository', () => {
  let pool: pg.Pool;
  let repository: ReturnType<typeof createPgFaceRepository>;

  beforeAll(async () => {
    pool = createTestPool();
    await resetDatabase(pool);
    await runMigrations(pool);
    repository = createPgFaceRepository(pool);
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM face_profiles');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates a profile, then updates it, and says which', async () => {
    expect(await repository.upsert(profile('m1', unit(0.1)))).toBe('created');
    expect(await repository.upsert(profile('m1', unit(0.2), { consentedBy: 'user-2' }))).toBe('updated');
    const rows = await pool.query('SELECT member_id, consented_by FROM face_profiles');
    expect(rows.rows).toEqual([{ member_id: 'm1', consented_by: 'user-2' }]);
  });

  it('stores only the descriptor and the consent fields, with no image, name or DNI column', async () => {
    const columns = await pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'face_profiles' ORDER BY column_name");
    expect(columns.rows.map((row) => row.column_name)).toEqual(['consented_at', 'consented_by', 'descriptor', 'enrolled_at', 'member_id']);
  });

  it('reports the enrollment time and never the descriptor', async () => {
    expect(await repository.findEnrollment('m1')).toBeUndefined();
    await repository.upsert(profile('m1', unit(0.1)));
    expect(await repository.findEnrollment('m1')).toEqual({ enrolledAt: WHEN });
  });

  it('removes a profile and says whether there was one', async () => {
    await repository.upsert(profile('m1', unit(0.1)));
    expect(await repository.remove('m1')).toBe(true);
    expect(await repository.remove('m1')).toBe(false);
    expect((await pool.query('SELECT 1 FROM face_profiles')).rowCount).toBe(0);
  });

  it('finds the nearest profile by Euclidean distance', async () => {
    await repository.upsert(profile('near', unit(0.3)));
    await repository.upsert(profile('far', unit(0.9)));
    const found = await repository.nearest(unit(0.35));
    expect(found?.memberId).toBe('near');
    expect(found?.distance).toBeCloseTo(0.05, 5);
  });

  it('returns undefined when nobody is enrolled', async () => {
    expect(await repository.nearest(unit(0.3))).toBeUndefined();
  });

  it('treats a hostile member id as plain text', async () => {
    const hostile = "x'; DROP TABLE face_profiles; --";
    await repository.upsert(profile(hostile, unit(0.1)));
    expect(await repository.findEnrollment(hostile)).toEqual({ enrolledAt: WHEN });
    expect(await repository.remove(hostile)).toBe(true);
    expect((await pool.query("SELECT to_regclass('face_profiles') AS t")).rows[0].t).toBe('face_profiles');
  });

  it('rejects a descriptor of the wrong size with an error that carries no values', async () => {
    const wrong = descriptor(0.31415926, 100);
    const error = await repository.upsert(profile('m1', wrong)).then(() => undefined, (caught: unknown) => caught as Error);
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe('Face database operation failed');
    expect(JSON.stringify(error)).not.toContain('0.31415926');
    expect(String((error as Error & { cause?: unknown }).cause ?? '')).not.toContain('0.31415926');
  });
});
