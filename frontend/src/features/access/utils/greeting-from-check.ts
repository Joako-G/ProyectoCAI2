import type { AccessCheck, AccessResult } from '../types/access';
import type { EntranceMethod, GreetingEvent, GreetingTone } from '../types/greeting';

const TONE: Record<AccessResult, GreetingTone> = { green: 'welcome', yellow: 'see_desk', red: 'refused' };

/**
 * The event the stream would have sent for a face check, rebuilt from the HTTP answer. The screen uses it only when
 * the stream is down or late, so a recognized member is never left without an answer. The HTTP answer has no member
 * id, no separate first name and no disciplines: the number stands in for the id, the first word of the name for
 * the first name, and the list is empty. `method` is how the check was made; the camera by default.
 */
export function greetingFromCheck(check: AccessCheck, at: string, method: EntranceMethod = 'face'): GreetingEvent {
  const { member } = check;
  const tone = TONE[check.result];
  const firstName = member?.name.split(/\s+/)[0] ?? '';
  return {
    at,
    tone,
    kind: check.reason,
    method,
    ...(member && tone !== 'refused' ? { firstName } : {}),
    ...(member ? { member: { id: member.memberNumber, memberNumber: member.memberNumber, fullName: member.name, firstName, disciplines: [] } } : {}),
    ...(member?.paidThrough ? { paidThrough: member.paidThrough } : {}),
    ...(member?.dueDate ? { dueDate: member.dueDate } : {}),
    ...(member?.debtSince ? { debtSince: member.debtSince } : {}),
    ...(member ? { unpaidPeriodCount: member.unpaidPeriodCount } : {}),
  };
}
