import { describe, expect, it, vi } from 'vitest';
import { startFaces } from '../../src/modules/faces/faces.startup.js';

const SECRET_URL = 'postgres://club:s3cret-pass@127.0.0.1:5432/club_socios';

describe('startFaces', () => {
  it('reports the faces as available when the migrations succeed', async () => {
    const log = vi.fn();
    const migrate = vi.fn(async () => ['002_create_face_profiles.sql']);
    expect(await startFaces({ migrate, log, connectionString: SECRET_URL })).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('1 database migration'));
  });

  it('does not throw when the database is down: one clear line, no credentials, faces off', async () => {
    const log = vi.fn();
    const migrate = vi.fn(async () => {
      throw Object.assign(new Error(`connect ECONNREFUSED 127.0.0.1:5432 (${SECRET_URL})`), { code: 'ECONNREFUSED' });
    });
    expect(await startFaces({ migrate, log, connectionString: SECRET_URL })).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]![0]);
    expect(line).toContain('Face recognition is disabled until the server restarts');
    expect(line).toContain('ECONNREFUSED');
    expect(line).not.toContain('s3cret-pass');
    expect(line).not.toContain('\n');
  });

  it('degrades when a migration itself fails', async () => {
    const log = vi.fn();
    const migrate = async () => {
      throw new Error('Migration 002_x.sql failed: syntax error');
    };
    expect(await startFaces({ migrate, log, connectionString: SECRET_URL })).toBe(false);
    expect(String(log.mock.calls[0]![0])).toContain('Migration 002_x.sql failed');
  });
});
