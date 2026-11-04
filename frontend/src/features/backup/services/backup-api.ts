import { request, sendJson } from '../../members/services/members-api';
import type { BackupResult, BackupStatus } from '../types/backup';

/** When the last copy ran, where copies go and how many are kept. */
export function fetchBackupStatus(signal?: AbortSignal): Promise<BackupStatus> {
  return request<BackupStatus>('/api/backups', { signal });
}

/** Makes a copy now. The server decides the folder and the files. */
export function runBackup(): Promise<BackupResult> {
  return request<BackupResult>('/api/backups', sendJson('POST'));
}
