import type { AccessCheck } from './access.types.js';
import type { EntranceMethod, EntryRepository } from './entry.repository.js';

/** Who ran a check and by which door method; passed by the routes so the entrance can be recorded. */
export interface EntranceContext {
  method: EntranceMethod;
  actorId: string;
}

/** One finished check, as the entrance recorder sees it. `member` is absent when nobody was identified. */
export interface EntranceInput extends EntranceContext {
  member?: { id: string; firstName: string };
  answer: AccessCheck;
}

// A one-line description of a failure that quotes nothing but the driver's error code.
function describeFailure(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
  return `code ${code}`;
}

/**
 * Records each identified entrance check in the entry log. It never throws: a missing log (no database) or a
 * failing write leaves the check's answer untouched and writes one short line with no personal data.
 */
export function createEntranceRecorder({
  entries,
  now = () => new Date(),
  log = (message: string) => console.error(message),
}: {
  entries?: Pick<EntryRepository, 'append'>;
  now?: () => Date;
  log?: (message: string) => void;
}) {
  return {
    async register({ member, answer, method, actorId }: EntranceInput): Promise<void> {
      // Only an identified member is logged: an unknown DNI or a stranger's face has no member, and the DNI is never stored.
      if (!entries || !member || answer.reason === 'not_found' || answer.reason === 'not_recognized') return;
      try {
        await entries.append({ memberId: member.id, result: answer.result, reason: answer.reason, method, checkedAt: now().toISOString(), checkedBy: actorId });
      } catch (error) {
        log(`Entrance log write failed (${describeFailure(error)})`);
      }
    },
  };
}

export type EntranceRecorder = ReturnType<typeof createEntranceRecorder>;
