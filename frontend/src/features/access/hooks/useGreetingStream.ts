import { useEffect, useRef, useState } from 'react';
import type { GreetingEvent } from '../types/greeting';
import { fetchCurrentUser } from '../../auth/services/auth-api';
import { parseEnrollmentEvent, type EnrollmentStreamEvent } from '../utils/enrollment-event';
import { parseGreeting } from '../utils/greeting-format';

/** The slice of EventSource the stream uses; tests supply a fake. */
export interface GreetingSource {
  readyState: number;
  onopen: (() => void) | null;
  onerror: (() => void) | null;
  addEventListener(type: 'greeting' | 'enrollment', listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export const DISPLAY_EVENTS_URL = '/api/access/display-events';
/** The public screen says so, so the server knows a screen is there to guide a face enrollment. */
export const PUBLIC_SCREEN_EVENTS_URL = `${DISPLAY_EVENTS_URL}?screen=public`;
const CLOSED = 2;

/**
 * An EventSource cannot see why it was closed, so when it gives up the session is asked about directly. A failed
 * check (the server is unreachable) counts as still valid: the stream will simply keep trying to reconnect.
 */
export const defaultCheckSession = (): Promise<boolean> => fetchCurrentUser().then((user) => user !== null, () => true);

export const defaultCreateSource = (url: string): GreetingSource => new EventSource(url) as unknown as GreetingSource;

/**
 * Listens to the greeting stream. The browser reconnects by itself after a dropped connection; when it gives up
 * (the server answered an error, for example after a restart) a new connection is opened after `reconnectMs`.
 * Before opening a new connection it asks `checkSession`; if the session ended it stops reconnecting for good and
 * reports `sessionExpired`. `latest` changes with every greeting and `enrollment` with every face enrollment event; `connected` is false while the stream is down.
 */
export function useGreetingStream({
  createSource,
  reconnectMs,
  checkSession = defaultCheckSession,
  publicScreen = false,
}: {
  createSource: (url: string) => GreetingSource;
  reconnectMs: number;
  checkSession?: () => Promise<boolean>;
  /** True on the screen members look at: the server then counts it and sends it the face enrollments. */
  publicScreen?: boolean;
}) {
  const [latest, setLatest] = useState<{ event: GreetingEvent; key: number } | undefined>();
  const [enrollment, setEnrollment] = useState<{ event: EnrollmentStreamEvent; key: number } | undefined>();
  const [connected, setConnected] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const key = useRef(0);
  // Apart from the greeting counter: the display compares that one to know whether a result came through the stream.
  const enrollmentKey = useRef(0);
  // Read at the moment of use, so a new function from the caller never reopens the connection.
  const session = useRef(checkSession);
  session.current = checkSession;

  useEffect(() => {
    let source: GreetingSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function connect() {
      const current = createSource(publicScreen ? PUBLIC_SCREEN_EVENTS_URL : DISPLAY_EVENTS_URL);
      source = current;
      current.onopen = () => setConnected(true);
      current.onerror = () => {
        setConnected(false);
        // Still connecting means the browser is retrying on its own; only a closed source needs a new one.
        if (current.readyState === CLOSED && !stopped) {
          current.close();
          void session.current().then((valid) => {
            if (stopped) return;
            if (valid) retry = setTimeout(connect, reconnectMs);
            else setSessionExpired(true);
          });
        }
      };
      current.addEventListener('greeting', (message) => {
        const event = parseGreeting(message.data);
        if (event) setLatest({ event, key: (key.current += 1) });
      });
      current.addEventListener('enrollment', (message) => {
        const event = parseEnrollmentEvent(message.data);
        if (event) setEnrollment({ event, key: (enrollmentKey.current += 1) });
      });
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      source?.close();
    };
  }, [createSource, reconnectMs, publicScreen]);

  return { latest, enrollment, connected, sessionExpired };
}
