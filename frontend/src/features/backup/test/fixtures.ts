import type { BackupStatus } from '../types/backup';

export function buildStatus(overrides: Partial<BackupStatus> = {}): BackupStatus {
  return {
    destination: { isDefault: false, state: 'ready' },
    keep: 30,
    keepRecent: 5,
    copies: 12,
    lastSuccessAt: '2026-11-04T15:00:00.000Z',
    lastFailure: null,
    running: false,
    database: { lastCopy: { state: 'included', file: 'database.dump', format: 'pg_dump-custom', bytes: 5 * 1024 * 1024 }, lastFailure: null },
    ...overrides,
  };
}
