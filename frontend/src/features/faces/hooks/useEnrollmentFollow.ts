import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../members/services/members-api';
import { getEnrollment } from '../services/enrollment-api';
import { isEnrollmentActive, type EnrollmentSession } from '../types/enrollment';

export const DEFAULT_FOLLOW_INTERVAL_MS = 1000;
/** Failed polls in a row (the server unreachable) after which the secretary is told the follow-up was lost. */
const MAX_FAILURES = 5;

/**
 * Follows an enrollment session by asking the server for its state every second. The session lives in the server's
 * memory and the display stream is one-way and meant for the public screen, so polling a tiny answer is the simplest
 * thing that survives a reload and a dropped connection. It stops when the session ends or the follow-up is lost
 * (the server forgot the session, or kept failing), and tells the caller once through `onEnded`
 * (the final session, or `undefined` when lost).
 */
export function useEnrollmentFollow({
  initial,
  intervalMs = DEFAULT_FOLLOW_INTERVAL_MS,
  onEnded,
}: {
  initial: EnrollmentSession;
  intervalMs?: number;
  onEnded: (final: EnrollmentSession | undefined) => void;
}): EnrollmentSession {
  const [session, setSession] = useState(initial);
  const ended = useRef(onEnded);
  ended.current = onEnded;
  const id = initial.id;

  useEffect(() => {
    const controller = new AbortController();
    let failures = 0;
    let busy = false;
    let finished = false;

    const finish = (final: EnrollmentSession | undefined) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      ended.current(final);
    };

    const poll = async () => {
      if (busy || finished) return;
      busy = true;
      try {
        const current = await getEnrollment(id, controller.signal);
        if (controller.signal.aborted) return;
        failures = 0;
        setSession(current);
        if (!isEnrollmentActive(current.status)) finish(current);
      } catch (error) {
        if (controller.signal.aborted) return;
        failures += 1;
        if ((error instanceof ApiError && error.status === 404) || failures >= MAX_FAILURES) finish(undefined);
      } finally {
        busy = false;
      }
    };

    const timer = setInterval(() => void poll(), intervalMs);
    return () => {
      finished = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [id, intervalMs]);

  return session;
}
