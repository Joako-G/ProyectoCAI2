import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccessCheck } from '../types/access';
import type { EntranceMethod, GreetingEvent } from '../types/greeting';
import { greetingFromCheck } from '../utils/greeting-from-check';
import { defaultCheckSession, defaultCreateSource, useGreetingStream, type GreetingSource } from './useGreetingStream';

/** How long the desk waits for the stream to deliver the result of a DNI check before it answers from the HTTP response. */
export const DEFAULT_STREAM_GRACE_MS = 2000;
const DEFAULT_RECONNECT_MS = 3000;

export interface ControlResultOptions {
  createSource?: (url: string) => GreetingSource;
  reconnectMs?: number;
  streamGraceMs?: number;
  checkSession?: () => Promise<boolean>;
}

/**
 * The last control seen at the desk, whoever made it: the door camera or this screen's DNI field. The greeting
 * stream is the single source. The HTTP answer to a DNI check is only a fallback: shown at once when the stream is
 * down, and after `streamGraceMs` when the stream is up but its event has not arrived. `version` changes with every
 * result so the day's list can catch up.
 */
export function useControlResult({
  createSource = defaultCreateSource,
  reconnectMs = DEFAULT_RECONNECT_MS,
  streamGraceMs = DEFAULT_STREAM_GRACE_MS,
  checkSession = defaultCheckSession,
}: ControlResultOptions = {}) {
  const { latest, connected, sessionExpired } = useGreetingStream({ createSource, reconnectMs, checkSession });
  const [shown, setShown] = useState<{ event: GreetingEvent; version: number } | undefined>();
  const [awaiting, setAwaiting] = useState<{ check: AccessCheck; method: EntranceMethod } | undefined>();
  const version = useRef(0);

  const show = useCallback((event: GreetingEvent) => {
    version.current += 1;
    setShown({ event, version: version.current });
  }, []);

  const streamKey = useRef(0);
  streamKey.current = latest?.key ?? 0;
  useEffect(() => {
    if (!latest) return;
    show(latest.event);
    setAwaiting(undefined);
  }, [latest, show]);

  const connectedNow = useRef(connected);
  connectedNow.current = connected;
  const keyWhenAsked = useRef(0);

  /** A DNI check is about to be sent. */
  const begin = useCallback(() => {
    keyWhenAsked.current = streamKey.current;
  }, []);

  /** The HTTP answer of a DNI check; ignored when the stream already delivered a result since `begin`. */
  const answer = useCallback((check: AccessCheck, method: EntranceMethod) => {
    if (streamKey.current > keyWhenAsked.current) return;
    if (connectedNow.current) setAwaiting({ check, method });
    else show(greetingFromCheck(check, new Date().toISOString(), method));
  }, [show]);

  useEffect(() => {
    if (!awaiting) return;
    const timer = setTimeout(() => {
      show(greetingFromCheck(awaiting.check, new Date().toISOString(), awaiting.method));
      setAwaiting(undefined);
    }, streamGraceMs);
    return () => clearTimeout(timer);
  }, [awaiting, show, streamGraceMs]);

  return { event: shown?.event, version: shown?.version ?? 0, connected, sessionExpired, begin, answer };
}
