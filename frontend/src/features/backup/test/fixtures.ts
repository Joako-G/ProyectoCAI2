import type { BackupStatus } from '../types/backup';

export function buildStatus(overrides: Partial<BackupStatus> = {}): BackupStatus {
  return {
    destination: { isDefault: false },
    keep: 30,
    copies: 12,
    lastSuccessAt: '2026-11-04T15:00:00.000Z',
    lastFailure: null,
    running: false,
    ...overrides,
  };
}
