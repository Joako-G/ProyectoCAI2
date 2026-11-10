/** Mirrors `EnrollmentEvent` in backend/src/modules/access/greeting.bus.ts: first name only, never a member id or a descriptor. */
export type EnrollmentStreamEvent =
  | { type: 'start'; sessionId: string; firstName: string; expiresAt: string; captures: number }
  | { type: 'end'; sessionId: string; outcome: 'completed' | 'cancelled' | 'expired' | 'failed' };

const OUTCOMES = ['completed', 'cancelled', 'expired', 'failed'] as const;

/** Reads one `enrollment` stream message; anything that is not exactly the contract is ignored (undefined). */
export function parseEnrollmentEvent(data: string): EnrollmentStreamEvent | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.sessionId !== 'string' || value.sessionId === '') return undefined;
  if (value.type === 'start') {
    if (typeof value.firstName !== 'string' || typeof value.expiresAt !== 'string' || typeof value.captures !== 'number') return undefined;
    return { type: 'start', sessionId: value.sessionId, firstName: value.firstName, expiresAt: value.expiresAt, captures: value.captures };
  }
  if (value.type === 'end') {
    const outcome = OUTCOMES.find((candidate) => candidate === value.outcome);
    return outcome ? { type: 'end', sessionId: value.sessionId, outcome } : undefined;
  }
  return undefined;
}
