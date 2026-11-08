import type { AccessCheck } from './access.types.js';
import type { EntranceMethod, EntryRepository } from './entry.repository.js';
import type { EntranceKind, GreetingBus, GreetingEvent, GreetingMember } from './greeting.bus.js';

/** Who ran a check and by which door method; passed by the routes so the entrance can be recorded. */
export interface EntranceContext {
  method: EntranceMethod;
  actorId: string;
}

/** One finished check, as the entrance recorder sees it. `member` is absent when nobody was identified. */
export interface EntranceInput extends EntranceContext {
  member?: GreetingMember;
  answer: AccessCheck;
}

// A one-line description of a failure that quotes nothing but the driver's error code.
function describeFailure(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
  return `code ${code}`;
}

const MEMBER_KINDS: readonly EntranceKind[] = ['up_to_date', 'debtor', 'deregistered', 'inactive'];

// A member nobody could name (an unknown DNI, a stranger's face, a leftover profile) is reported by `kind` alone.
function kindFor({ member, answer }: EntranceInput): EntranceKind {
  if (!member) return answer.reason === 'not_found' ? 'not_found' : 'not_recognized';
  return MEMBER_KINDS.includes(answer.reason) ? answer.reason : 'not_recognized';
}

// The screens learn how the check went, and only for an identified member who it was. The public screen greets by
// first name only a member who enters (`tone`/`firstName`); everything else is detail for the staff screen.
function greetingFor(input: EntranceInput, at: string): GreetingEvent {
  const { member, answer, method } = input;
  const base = { at, kind: kindFor(input), method };
  if (!member) return { ...base, tone: 'refused' };
  const tone = answer.result === 'green' ? 'welcome' : answer.result === 'yellow' ? 'see_desk' : 'refused';
  const summary = answer.member;
  return {
    ...base,
    tone,
    ...(tone === 'refused' ? {} : { firstName: member.firstName }),
    member: { id: member.id, memberNumber: member.memberNumber, fullName: member.fullName, firstName: member.firstName, disciplines: member.disciplines },
    ...(summary?.paidThrough ? { paidThrough: summary.paidThrough } : {}),
    ...(summary?.dueDate ? { dueDate: summary.dueDate } : {}),
    ...(summary?.debtSince ? { debtSince: summary.debtSince } : {}),
    ...(summary ? { unpaidPeriodCount: summary.unpaidPeriodCount } : {}),
  };
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
