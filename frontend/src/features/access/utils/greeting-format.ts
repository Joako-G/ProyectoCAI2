import type { EntranceKind, EntranceMethod, GreetingEvent, GreetingMember, GreetingTone } from '../types/greeting';

const TONES: readonly GreetingTone[] = ['welcome', 'see_desk', 'refused'];
const KINDS: readonly EntranceKind[] = ['up_to_date', 'debtor', 'deregistered', 'inactive', 'not_recognized', 'not_found'];
const METHODS: readonly EntranceMethod[] = ['dni', 'face'];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

// Keeps only the fields of a member the screens know, or nothing when the identity is incomplete.
function parseMember(value: unknown): GreetingMember | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  const id = text(raw.id);
  const memberNumber = text(raw.memberNumber);
  const fullName = text(raw.fullName);
  const firstName = text(raw.firstName);
  if (!id || !memberNumber || !fullName || !firstName) return undefined;
  const disciplines = Array.isArray(raw.disciplines) ? raw.disciplines.flatMap((name) => text(name) ?? []) : [];
  return { id, memberNumber, fullName, firstName, disciplines };
}

/** What the public screen says. Provisional wording, not yet confirmed by the club. A refusal never carries a name. */
export function greetingText({ tone, firstName }: GreetingEvent): string {
  if (tone === 'refused') return 'Acercate a secretaría';
  const greeting = firstName ? `¡Bienvenido/a, ${firstName}!` : '¡Bienvenido/a!';
  return tone === 'see_desk' ? `${greeting} Pasá por secretaría` : greeting;
}

/**
 * Reads one stream message and keeps only what the screens know: the time, the tone, the first name of someone who
 * enters and, when present and well formed, the kind, the method and the identified member with the month and date
 * details. Anything else is dropped, a field with the wrong shape is dropped on its own, and a message that is not
 * a greeting is ignored. A check that identified nobody never keeps member data, whatever the message says.
 */
export function parseGreeting(raw: string): GreetingEvent | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const message = record(value);
  if (!message) return undefined;
  const { at, tone, firstName, kind, method, paidThrough, dueDate, debtSince, unpaidPeriodCount } = message;
  if (typeof tone !== 'string' || !TONES.includes(tone as GreetingTone)) return undefined;
  if (firstName !== undefined && typeof firstName !== 'string') return undefined;
  const name = firstName?.trim();
  const validKind = typeof kind === 'string' && KINDS.includes(kind as EntranceKind) ? (kind as EntranceKind) : undefined;
  const validMethod = typeof method === 'string' && METHODS.includes(method as EntranceMethod) ? (method as EntranceMethod) : undefined;
  const identifiesNobody = validKind === 'not_recognized' || validKind === 'not_found';
  const member = identifiesNobody ? undefined : parseMember(message.member);
  const detail = !identifiesNobody;
  return {
    at: typeof at === 'string' ? at : '',
    tone: tone as GreetingTone,
    ...(tone !== 'refused' && name && detail ? { firstName: name } : {}),
    ...(validKind ? { kind: validKind } : {}),
    ...(validMethod ? { method: validMethod } : {}),
    ...(member ? { member } : {}),
    ...(detail && typeof paidThrough === 'string' && MONTH.test(paidThrough) ? { paidThrough } : {}),
    ...(detail && typeof dueDate === 'string' && DAY.test(dueDate) ? { dueDate } : {}),
    ...(detail && typeof debtSince === 'string' && MONTH.test(debtSince) ? { debtSince } : {}),
    ...(detail && typeof unpaidPeriodCount === 'number' && Number.isInteger(unpaidPeriodCount) && unpaidPeriodCount >= 0 ? { unpaidPeriodCount } : {}),
  };
}
