import { ConflictError } from '../../shared/errors.js';
import type { BackupRun } from './backup.types.js';

const HOUR_MS = 60 * 60 * 1000;

export interface BackupSchedulerDeps {
  service: { status(): Promise<{ lastSuccessAt: string | null }>; run(): Promise<BackupRun> };
  now?: () => Date;
  /** How often to check. */
  intervalMs?: number;
  /** A copy is made when the last good one is at least this old. */
  maxAgeMs?: number;
  log?: (message: string) => void;
}

export type TickOutcome = 'fresh' | 'ran' | 'failed' | 'busy';

/**
 * Checks at start and then every hour while the backend runs, and copies when the last good copy is a day old.
 * A copy only happens while the backend is running: a machine that is off at the time catches up at the next check.
 */
export function startBackupScheduler({ service, now = () => new Date(), intervalMs = HOUR_MS, maxAgeMs = 24 * HOUR_MS, log = console.error }: BackupSchedulerDeps) {
  let ticking = false;

  async function tick(): Promise<TickOutcome> {
    if (ticking) return 'busy';
    ticking = true;
    try {
      const { lastSuccessAt } = await service.status();
      if (lastSuccessAt !== null && now().getTime() - new Date(lastSuccessAt).getTime() < maxAgeMs) return 'fresh';
      return (await service.run()).ok ? 'ran' : 'failed';
    } catch (error) {
      if (error instanceof ConflictError) return 'busy';
      // Never stops the backend or the next check.
      log('The scheduled backup check failed');
      return 'failed';
    } finally {
      ticking = false;
    }
  }

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  // The timer alone must never keep the process, or a test run, alive.
  timer.unref();

  return { tick, stop: () => clearInterval(timer) };
}
