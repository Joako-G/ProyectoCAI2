import type { AccessCheck } from './access.types.js';
import type { EntranceMethod, EntryRepository } from './entry.repository.js';
import type { GreetingBus, GreetingEvent } from './greeting.bus.js';

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

// The public screen greets by first name only a member who enters; everyone else, identified or not, gets the same refusal.
function greetingFor({ member, answer }: EntranceInput, at: string): GreetingEvent {
  if (member && answer.result === 'green') return { at, tone: 'welcome', firstName: member.firstName };
  if (member && answer.result === 'yellow') return { at, tone: 'see_desk', firstName: member.firstName };
  return { at, tone: 'refused' };
}

/**
 * What happens after each entrance check: the public display is greeted, and an identified member is recorded in
 * the entry log. It never throws: a missing log (no database) or a failing write leaves the check's answer
 * untouched and writes one short line with no personal data. The greeting goes first and needs no database.
 */
export function createEntranceRecorder({
  entries,
  greetings,
  now = () => new Date(),
  log = (message: string) => console.error(message),
}: {
  entries?: Pick<EntryRepository, 'append'>;
  greetings?: Pick<GreetingBus, 'publish'>;
  now?: () => Date;
  log?: (message: string) => void;
}) {
  return {
    async register(input: EntranceInput): Promise<void> {
      const { member, answer, method, actorId } = input;
      const at = now().toISOString();
      greetings?.publish(greetingFor(input, at));
      // Only an identified member is logged: an unknown DNI or a stranger's face has no member, and the DNI is never stored.
      if (!entries || !member || answer.reason === 'not_found' || answer.reason === 'not_recognized') return;
      try {
        await entries.append({ memberId: member.id, result: answer.result, reason: answer.reason, method, checkedAt: at, checkedBy: actorId });
      } catch (error) {
        log(`Entrance log write failed (${describeFailure(error)})`);
      }
    },
  };
}

export type EntranceRecorder = ReturnType<typeof createEntranceRecorder>;
