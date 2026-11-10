import type { EntranceMethod } from './entry.repository.js';

/** How the entrance went, from the point of view of the screens. A face that matched nobody usable is `not_recognized`. */
export type EntranceKind = 'up_to_date' | 'debtor' | 'deregistered' | 'inactive' | 'not_recognized' | 'not_found';

/** A member who was identified. The id and number let the staff screen load the rest through the authenticated members API. */
export interface GreetingMember {
  id: string;
  memberNumber: string;
  fullName: string;
  firstName: string;
  /** Names of the disciplines the member is active in; empty when there are none or they could not be read. */
  disciplines: string[];
}

/**
 * What the entrance screens may know about a check. Everything except `at`, `tone`, `kind` and `method` exists only
 * for an identified member. Never on the stream: DNI, face descriptor, amount or the reason of a refusal beyond `kind`.
 * The public screen renders a subset; this is the staff-level detail.
 */
export interface GreetingEvent {
  /** ISO instant of the check. */
  at: string;
  /** welcome: green. see_desk: yellow, the member enters but passes by the desk. refused: anything else. */
  tone: 'welcome' | 'see_desk' | 'refused';
  /** Only for welcome and see_desk. */
  firstName?: string;
  kind: EntranceKind;
  method: EntranceMethod;
  member?: GreetingMember;
  /** Up to date members only: last month, as YYYY-MM, with nothing owed through it. */
  paidThrough?: string;
  /** Up to date members only: last day, as YYYY-MM-DD, to pay the next month without surcharge. */
  dueDate?: string;
  /** Debtor and deregistered members only: oldest unpaid month, as YYYY-MM. */
  debtSince?: string;
  unpaidPeriodCount?: number;
}

export type GreetingListener = (event: GreetingEvent) => void;

/**
 * What the public screen is told about a face enrollment. First name only: no member id, number, DNI or descriptor.
 * `start` switches the screen to enrollment mode; `end` returns it to recognition (done, cancelled, expired or failed).
 */
export type EnrollmentEvent =
  | { type: 'start'; sessionId: string; firstName: string; expiresAt: string; captures: number }
  | { type: 'end'; sessionId: string; outcome: 'completed' | 'cancelled' | 'expired' | 'failed' };

export type EnrollmentListener = (event: EnrollmentEvent) => void;

/** An in-memory fan-out. Nothing is stored, so a display that connects late sees only what happens next. */
export function createGreetingBus() {
  const listeners = new Set<GreetingListener>();
  const enrollmentListeners = new Set<EnrollmentListener>();
  // Subscribers that identified themselves as the public screen; the staff screens listen to the stream too.
  const publicScreens = new Set<EnrollmentListener>();
  return {
    /** Returns the function that stops listening. */
    subscribe(listener: GreetingListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(event: GreetingEvent): void {
      for (const listener of [...listeners]) {
        // One closed socket must not keep the others from the greeting, nor fail the check that published it.
        try {
          listener(event);
        } catch {
          listeners.delete(listener);
        }
      }
    },
    /** Returns the function that stops listening. `publicScreen` marks the connection as the screen members look at. */
    subscribeEnrollment(listener: EnrollmentListener, { publicScreen = false }: { publicScreen?: boolean } = {}): () => void {
      enrollmentListeners.add(listener);
      if (publicScreen) publicScreens.add(listener);
      return () => {
        enrollmentListeners.delete(listener);
        publicScreens.delete(listener);
      };
    },
    publishEnrollment(event: EnrollmentEvent): void {
      for (const listener of [...enrollmentListeners]) {
        try {
          listener(event);
        } catch {
          enrollmentListeners.delete(listener);
          publicScreens.delete(listener);
        }
      }
    },
    /** How many public screens are connected right now. */
    publicScreenCount: () => publicScreens.size,
    listenerCount: () => listeners.size,
  };
}

export type GreetingBus = ReturnType<typeof createGreetingBus>;
