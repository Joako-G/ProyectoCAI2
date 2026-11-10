import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CAPTURE_TIMING, type CaptureTiming } from '../../faces/hooks/useCaptureGuide';
import { useFaceCamera } from '../../faces/hooks/useFaceCamera';
import { defaultCheckSession, defaultCreateSource, useGreetingStream, type GreetingSource } from '../hooks/useGreetingStream';
import { useClock } from '../hooks/useClock';
import { useEnrolledCount } from '../hooks/useEnrolledCount';
import { useFitScale } from '../hooks/useFitScale';
import { DEFAULT_DONE_MS, useKioskEnrollment } from '../hooks/useKioskEnrollment';
import { useKioskRecognition } from '../hooks/useKioskRecognition';
import type { AccessCheck } from '../types/access';
import type { GreetingEvent } from '../types/greeting';
import { entryTime } from '../utils/entries-format';
import { greetingFromCheck } from '../utils/greeting-from-check';
import { buildResultView } from '../utils/kiosk-texts';
import { frameForFace } from '../utils/pane-geometry';
import { KioskScreen, type KioskPhase } from './KioskScreen';

/** How long a result stays on the screen before it goes back to the welcome. */
export const DEFAULT_HOLD_MS = 7000;
const DEFAULT_RECONNECT_MS = 3000;
/** How long the screen waits for the stream to deliver a result before it answers from the HTTP response. */
export const DEFAULT_STREAM_GRACE_MS = 2000;
/** Opening the screen's own path reloads the app: without a session it asks to sign in and comes back here. */
const SIGN_IN_HREF = '/pantalla-ingreso';

interface EntranceDisplayProps {
  /** Overrides EventSource; used by tests. */
  createSource?: (url: string) => GreetingSource;
  holdMs?: number;
  reconnectMs?: number;
  streamGraceMs?: number;
  /** Overrides the camera timing; used by tests. */
  timing?: Partial<CaptureTiming>;
  /** Overrides the session check done when the stream closes; used by tests. */
  checkSession?: () => Promise<boolean>;
  /** How long the confirmation of a registered face stays; used by tests. */
  enrollmentDoneMs?: number;
}

/**
 * The client screen of the entrance, as in the approved "Kiosco facial" design: the live camera with a framing guide
 * on the left and, on the right, the welcome, the wait and the result of each check. Recognition is hands-free: the
 * camera looks for a stable face and asks the server who it is. Results come from the greeting stream, whether the
 * check was made by this camera or by the secretary at the desk; the HTTP answer only covers a stream that is down
 * or late. It shows the full name of an identified member, never a DNI, an amount or the reason of a refusal.
 */
export function EntranceDisplay({
  createSource = defaultCreateSource,
  holdMs = DEFAULT_HOLD_MS,
  reconnectMs = DEFAULT_RECONNECT_MS,
  streamGraceMs = DEFAULT_STREAM_GRACE_MS,
  timing,
  checkSession = defaultCheckSession,
  enrollmentDoneMs = DEFAULT_DONE_MS,
}: EntranceDisplayProps) {
  const { latest, enrollment: enrollmentMessage, connected, sessionExpired } = useGreetingStream({ createSource, reconnectMs, checkSession, publicScreen: true });
  const [shown, setShown] = useState<GreetingEvent | undefined>();
  const [awaiting, setAwaiting] = useState<AccessCheck | undefined>();
  const camera = useFaceCamera();
  const scale = useFitScale();
  const clock = useClock();
  const enrolled = useEnrolledCount();
  const captureTiming = useMemo(() => ({ ...DEFAULT_CAPTURE_TIMING, ...timing }), [timing]);

  // The camera runs while the screen is open and is released when it closes.
  const { start, stop } = camera;
  useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  // A result stays for `holdMs`; showing another one, or leaving the screen, cancels the time that was running.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const present = useCallback(
    (event: GreetingEvent | undefined) => {
      clearTimeout(holdTimer.current);
      setShown(event);
      if (event) holdTimer.current = setTimeout(() => setShown(undefined), holdMs);
    },
    [holdMs],
  );
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  // The stream is the single source of results. A new one also ends any wait for the HTTP fallback.
  const streamKey = latest?.key ?? 0;
  const lastStreamKey = useRef(0);
  lastStreamKey.current = streamKey;
  useEffect(() => {
    if (!latest) return;
    present(latest.event);
    setAwaiting(undefined);
  }, [latest, present]);

  // A new attempt takes over the screen: the result of the previous person goes away.
  const keyWhenAsked = useRef(0);
  const connectedNow = useRef(connected);
  connectedNow.current = connected;
  const handleAttempt = useCallback(() => {
    keyWhenAsked.current = lastStreamKey.current;
    present(undefined);
  }, [present]);

  // The HTTP answer is only a fallback: with the stream down it is shown at once, with the stream up it waits a moment
  // for the real event, and an event that already arrived makes it unnecessary.
  const handleAnswer = useCallback(
    (check: AccessCheck) => {
      if (lastStreamKey.current > keyWhenAsked.current) return;
      if (connectedNow.current) setAwaiting(check);
      else present(greetingFromCheck(check, new Date().toISOString()));
    },
    [present],
  );
  useEffect(() => {
    if (!awaiting) return;
    const timer = setTimeout(() => {
      present(greetingFromCheck(awaiting, new Date().toISOString()));
      setAwaiting(undefined);
    }, streamGraceMs);
    return () => clearTimeout(timer);
  }, [awaiting, present, streamGraceMs]);

  // A face enrollment started by staff takes the same camera: recognition waits, and resumes when the enrollment ends.
  const { enrollment, guide: enrollmentGuide } = useKioskEnrollment({ camera, timing: captureTiming, event: enrollmentMessage, connected, doneMs: enrollmentDoneMs });
  const { guide: recognitionGuide, identifying, stopped } = useKioskRecognition({ camera, timing: captureTiming, onAttempt: handleAttempt, onAnswer: handleAnswer, paused: Boolean(enrollment) });
  const guide = enrollment ? enrollmentGuide : recognitionGuide;

  const expired = sessionExpired || stopped === 'unauthorized';
  // With the session over there is nothing to look for: release the camera.
  useEffect(() => {
    if (expired) stop();
  }, [expired, stop]);

  const result = useMemo(() => (shown ? buildResultView(shown) : undefined), [shown]);

  let phase: KioskPhase = 'idle';
  if (expired) phase = 'expired';
  else if (enrollment) phase = 'enrolling';
  else if (result) phase = 'result';
  else if (identifying || awaiting) phase = 'identifying';
  else if (stopped === 'unavailable') phase = 'unavailable';

  // The framing rectangle follows the face; the video's real size tells how the image was cropped to fill the pane.
  const video = camera.videoRef.current;
  const frame = frameForFace(guide.box, { width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0 });

  // Only the live hint that asks the person to do something is worth showing; "no face" is the plain wait.
  const hint = guide.status === 'neutral' ? undefined : guide.hint || undefined;
  const cameraState = camera.state;

  return (
    <KioskScreen
      phase={phase}
      enrollment={enrollment}
      result={result}
      resultTime={shown ? entryTime(shown.at) : undefined}
      clock={clock}
      hint={hint}
      frame={frame}
      enrolled={enrolled}
      camera={cameraState.phase === 'error' ? { phase: 'error', message: cameraState.message } : { phase: cameraState.phase }}
      videoRef={camera.videoRef}
      connected={connected || expired}
      scale={scale}
      signInHref={SIGN_IN_HREF}
    />
  );
}
