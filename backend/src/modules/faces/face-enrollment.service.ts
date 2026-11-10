import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import type { EnrollmentEvent } from '../access/greeting.bus.js';
import { ENROLLMENT_CAPTURES, type EnrollmentProgressInput } from './face.validation.js';

/** How long a session stays open; the capture takes seconds, so this only frees the screen when something went wrong. */
export const ENROLLMENT_TTL_MS = 120_000;
/** How long a finished session stays readable, so the staff screen that was polling still sees how it ended. */
const FINISHED_KEPT_MS = 5 * 60_000;

export type EnrollmentStatus = 'waiting' | 'capturing' | 'completed' | 'cancelled' | 'failed' | 'expired';

/** What the staff screen reads. The member id lets it match the session to the record it is showing; no descriptor, ever. */
export interface EnrollmentSessionView {
  id: string;
  memberId: string;
  firstName: string;
  status: EnrollmentStatus;
  /** The live guidance the public screen shows, e.g. "Acercate". Empty until the screen reports one. */
  hint: string;
  captures: number;
  total: number;
  expiresAt: string;
  message?: string;
}

// Ports owned by this module; the members, faces and bus objects of the application satisfy them as they are.
export interface FaceEnrollmentDeps {
  members: { getById(id: string): Promise<{ id: string; firstName: string; status: 'active' | 'inactive' }> };
  faces: { enroll(memberId: string, input: { descriptor: number[]; consentedAt?: string }, actorId: string): Promise<void> };
  /** Tells the public screen to start or stop guiding. */
  display: { publish(event: EnrollmentEvent): void; publicScreenCount(): number };
  now?: () => Date;
  ttlMs?: number;
  newId?: () => string;
}

interface Session extends EnrollmentSessionView {
  openedBy: string;
  consentedAt: string;
  expiresAtMs: number;
  endedAtMs?: number;
  saving: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

const isActive = (session: Session) => session.status === 'waiting' || session.status === 'capturing';

/**
 * One enrollment session at a time, in memory. A session lives from the moment staff confirm the member's consent until
 * the public screen delivers the descriptor, someone cancels, the screen fails, or the time runs out. Nothing here is
 * persisted: the face is saved through the same faces service as the in-window enrollment, which audits it.
 */
export function createFaceEnrollmentService({ members, faces, display, now = () => new Date(), ttlMs = ENROLLMENT_TTL_MS, newId = randomUUID }: FaceEnrollmentDeps) {
  const sessions = new Map<string, Session>();

  const viewOf = (session: Session): EnrollmentSessionView => ({
    id: session.id,
    memberId: session.memberId,
    firstName: session.firstName,
    status: session.status,
    hint: session.hint,
    captures: session.captures,
    total: session.total,
    expiresAt: session.expiresAt,
    ...(session.message ? { message: session.message } : {}),
  });

  function finish(session: Session, status: 'completed' | 'cancelled' | 'failed' | 'expired', message?: string): void {
    if (!isActive(session)) return;
    session.status = status;
    session.endedAtMs = now().getTime();
    if (message) session.message = message;
    if (session.timer) clearTimeout(session.timer);
    display.publish({ type: 'end', sessionId: session.id, outcome: status });
  }

  // Expiry is checked whenever the session is touched and by a timer, so the public screen is released even if nobody asks.
  function refresh(session: Session): Session {
    if (isActive(session) && now().getTime() >= session.expiresAtMs && !session.saving) finish(session, 'expired');
    return session;
  }

  function prune(): void {
    const cutoff = now().getTime() - FINISHED_KEPT_MS;
    for (const [id, session] of sessions) if (session.endedAtMs !== undefined && session.endedAtMs < cutoff) sessions.delete(id);
  }

  function find(id: string): Session {
    const session = sessions.get(id);
    if (!session) throw new NotFoundError('Enrollment session not found');
    return refresh(session);
  }

  function findActive(id: string): Session {
    const session = find(id);
    if (!isActive(session)) throw new ConflictError('Enrollment session is no longer active');
    return session;
  }

  return {
    /** Whether a public screen is listening, so staff know the enrollment can be guided there. */
    displayConnected: () => display.publicScreenCount() > 0,

    /** The session being run, if any. */
    active(): EnrollmentSessionView | undefined {
      for (const session of sessions.values()) if (isActive(refresh(session))) return viewOf(session);
      return undefined;
    },

    // The consent was confirmed by `actorId` just now; the time and the staff member are the ones saved with the face.
    async open(memberId: string, actorId: string): Promise<EnrollmentSessionView> {
      prune();
      for (const session of sessions.values()) refresh(session);
      if ([...sessions.values()].some(isActive)) throw new ConflictError('Another face enrollment is in progress');
      if (display.publicScreenCount() === 0) throw new ConflictError('No public screen is connected');
      const member = await members.getById(memberId);
      if (member.status !== 'active') throw new ConflictError('Member is not active');
      // The member lookup yielded the event loop: someone else may have opened a session meanwhile.
      if ([...sessions.values()].some(isActive)) throw new ConflictError('Another face enrollment is in progress');
      const opened = now();
      const session: Session = {
        id: newId(),
        memberId: member.id,
        firstName: member.firstName,
        status: 'waiting',
        hint: '',
        captures: 0,
        total: ENROLLMENT_CAPTURES,
        expiresAt: new Date(opened.getTime() + ttlMs).toISOString(),
        openedBy: actorId,
        consentedAt: opened.toISOString(),
        expiresAtMs: opened.getTime() + ttlMs,
        saving: false,
      };
      session.timer = setTimeout(() => refresh(session), ttlMs);
      session.timer.unref?.();
      sessions.set(session.id, session);
      // First name only: the public screen never learns the member id, number or DNI.
      display.publish({ type: 'start', sessionId: session.id, firstName: session.firstName, expiresAt: session.expiresAt, captures: session.total });
      return viewOf(session);
    },

    get: (id: string): EnrollmentSessionView => viewOf(find(id)),

    // The public screen reports what the member sees. A failure ends the session and returns the screen to recognition.
    progress(id: string, input: EnrollmentProgressInput): EnrollmentSessionView {
      const session = findActive(id);
      if (input.status === 'failed') {
        finish(session, 'failed', input.message ?? 'The public screen could not capture the face');
        return viewOf(session);
      }
      session.status = 'capturing';
      if (input.hint !== undefined) session.hint = input.hint;
      if (input.captures !== undefined) session.captures = input.captures;
      return viewOf(session);
    },

    // Saves the face as the in-window enrollment does, attributed to the staff member who confirmed the consent.
    async complete(id: string, descriptor: number[]): Promise<void> {
      const session = findActive(id);
      if (session.saving) throw new ConflictError('Enrollment session is already being saved');
      session.saving = true;
      try {
        await faces.enroll(session.memberId, { descriptor, consentedAt: session.consentedAt }, session.openedBy);
      } catch (error) {
        session.saving = false;
        finish(session, 'failed', 'The face could not be saved');
        throw error;
      }
      session.saving = false;
      session.captures = session.total;
      finish(session, 'completed');
    },

    /** Cancelling a session that already ended changes nothing. */
    cancel(id: string): EnrollmentSessionView {
      const session = find(id);
      finish(session, 'cancelled');
      return viewOf(session);
    },
  };
}

export type FaceEnrollmentService = ReturnType<typeof createFaceEnrollmentService>;
