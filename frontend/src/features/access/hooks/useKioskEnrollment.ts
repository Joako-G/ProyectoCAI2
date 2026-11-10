import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCaptureGuide, type CaptureGuideState, type CaptureOutcome, type CaptureTiming } from '../../faces/hooks/useCaptureGuide';
import type { FaceCamera } from '../../faces/hooks/useFaceCamera';
import { completeEnrollment, getActiveEnrollment, reportEnrollmentProgress } from '../../faces/services/enrollment-api';
import { addCapture, EMPTY_PROGRESS, ENROLLMENT_CAPTURES, type EnrollmentProgress } from '../../faces/utils/enrollment-captures';
import { ApiError } from '../../members/services/members-api';
import type { EnrollmentStreamEvent } from '../utils/enrollment-event';
import { KIOSK_TEXT } from '../utils/kiosk-texts';

/** A short rest between captures, so the person can settle before the next one (as in the member record). */
export const ENROLLMENT_PAUSE_MS = 1200;
/** How long the confirmation stays before the screen goes back to recognizing. */
export const DEFAULT_DONE_MS = 4000;
/** Used only if the server sent a time that cannot be read. */
const FALLBACK_SESSION_MS = 120_000;

interface Session {
  id: string;
  firstName: string;
  expiresAt: string;
  total: number;
}

/** What the public screen shows while a face is being registered. */
export interface KioskEnrollmentView {
  firstName: string;
  /** capturing: guiding; saving: the descriptor is on its way; done: it was saved. */
  status: 'capturing' | 'saving' | 'done';
  /** The capture being taken, 1 to `total` (the last one while saving or done). */
  captureNumber: number;
  total: number;
  /** The one thing to tell the person now. */
  hint: string;
  /** How the guide judges the frame, for color. */
  guideStatus: CaptureGuideState['status'];
}

/**
 * The public screen's side of a face enrollment. Staff open a session; the server tells this screen through the
 * stream (and `GET /api/faces/enrollments/active` covers a screen that connected late). While a session runs it takes
 * over the camera that recognition already uses: recognition is paused (the caller pauses it while `enrollment` is
 * defined), the shared capture guide leads the person through three consistent captures, progress goes to the server
 * so the secretary can follow it, and one mean descriptor, never an image, is delivered at the end.
 * The session ends on success, on the server's end event, on any failure, or when its time is up.
 */
export function useKioskEnrollment({
  camera,
  timing,
  event,
  connected,
  doneMs = DEFAULT_DONE_MS,
}: {
  camera: FaceCamera;
  timing: CaptureTiming;
  /** The latest enrollment message of the stream. */
  event: { event: EnrollmentStreamEvent; key: number } | undefined;
  connected: boolean;
  doneMs?: number;
}): { enrollment: KioskEnrollmentView | undefined; guide: CaptureGuideState } {
  const [session, setSession] = useState<Session>();
  const [captures, setCaptures] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ firstName: string; total: number }>();
  const progressRef = useRef<EnrollmentProgress>(EMPTY_PROGRESS);
  const sessionRef = useRef<Session>(undefined);
  sessionRef.current = session;
  const lastEventKey = useRef(0);

  const clear = useCallback(() => {
    progressRef.current = EMPTY_PROGRESS;
    setSession(undefined);
    setCaptures(0);
    setNotice(undefined);
    setSaving(false);
  }, []);

  const begin = useCallback((next: Session) => {
    progressRef.current = EMPTY_PROGRESS;
    setCaptures(0);
    setNotice(undefined);
    setSaving(false);
    setDone(undefined);
    setSession(next);
  }, []);

  // The stream says when a session starts and when it ends, whoever ended it.
  useEffect(() => {
    if (!event) return;
    lastEventKey.current = event.key;
    const message = event.event;
    if (message.type === 'start') begin({ id: message.sessionId, firstName: message.firstName, expiresAt: message.expiresAt, total: message.captures });
    else if (sessionRef.current?.id === message.sessionId) {
      // The server announces a completed session before it answers the save, so the confirmation is shown from here too.
      const ended = sessionRef.current;
      if (message.outcome === 'completed') setDone({ firstName: ended.firstName, total: ended.total });
      clear();
    }
  }, [event, begin, clear]);

  // A screen that (re)connects asks what is running, so it never misses a start nor stays in enrollment after an end it missed.
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    const asked = lastEventKey.current;
    getActiveEnrollment(controller.signal).then(
      (answer) => {
        // A stream message that arrived meanwhile is newer than this answer.
        if (controller.signal.aborted || lastEventKey.current !== asked) return;
        const active = answer?.session;
        if (active) {
          if (sessionRef.current?.id !== active.id) begin({ id: active.id, firstName: active.firstName, expiresAt: active.expiresAt, total: active.total });
        } else if (sessionRef.current) {
          clear();
        }
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [connected, begin, clear]);

  // Whatever happens to the stream, the screen is released when the session's time is up.
  useEffect(() => {
    if (!session) return;
    const left = Date.parse(session.expiresAt) - Date.now();
    const timer = setTimeout(clear, Number.isFinite(left) ? Math.max(0, left) : FALLBACK_SESSION_MS);
    return () => clearTimeout(timer);
  }, [session, clear]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(undefined), doneMs);
    return () => clearTimeout(timer);
  }, [done, doneMs]);

  const enrollTiming = useMemo(() => ({ ...timing, pauseMs: Math.min(timing.pauseMs, ENROLLMENT_PAUSE_MS) }), [timing]);

  /** One stable, ready capture: keep it, retake it, start over, or (the last) deliver the mean. */
  async function takeCapture(descriptor: number[]): Promise<CaptureOutcome> {
    const current = sessionRef.current;
    if (!current) return 'continue';
    const result = addCapture(progressRef.current, descriptor);
    if (result.kind !== 'complete') {
      progressRef.current = result.progress;
      setCaptures(result.progress.captures.length);
      setNotice(result.kind === 'rejected' ? KIOSK_TEXT.enrolling.inconsistent : result.kind === 'restarted' ? KIOSK_TEXT.enrolling.restart : undefined);
      return 'continue';
    }
    setSaving(true);
    try {
      await completeEnrollment(current.id, result.descriptor);
      if (sessionRef.current?.id === current.id) setDone({ firstName: current.firstName, total: current.total });
    } catch (error) {
      // A 404 or 409 means the session already ended on the server; anything else is told to the secretary.
      const ended = error instanceof ApiError && (error.status === 404 || error.status === 409);
      if (!ended) await reportEnrollmentProgress(current.id, { status: 'failed', message: KIOSK_TEXT.enrolling.saveFailed }).catch(() => undefined);
    }
    if (sessionRef.current?.id === current.id) clear();
    return 'continue';
  }

  const guide = useCaptureGuide({
    camera,
    active: Boolean(session) && camera.state.phase === 'ready',
    timing: enrollTiming,
    onStable: session && !saving ? takeCapture : undefined,
  });

  const hint = saving ? KIOSK_TEXT.enrolling.saving : (notice ?? (guide.hint || KIOSK_TEXT.enrolling.lookAtCamera));

  // The secretary follows what the member sees: the hint and how many captures are done.
  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId) return;
    reportEnrollmentProgress(sessionId, { status: 'capturing', hint, captures }).catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 409) && sessionRef.current?.id === sessionId) clear();
    });
  }, [sessionId, hint, captures, clear]);

  // Without a working camera there is nothing to guide: say so to the secretary and give the screen back.
  const cameraMessage = camera.state.phase === 'error' ? camera.state.message : undefined;
  const cameraFailed = camera.state.phase === 'error';
  useEffect(() => {
    if (!sessionId || !cameraFailed) return;
    void reportEnrollmentProgress(sessionId, { status: 'failed', message: (cameraMessage ?? KIOSK_TEXT.camera.starting).slice(0, 120) }).catch(() => undefined);
    clear();
  }, [sessionId, cameraFailed, cameraMessage, clear]);

  let enrollment: KioskEnrollmentView | undefined;
  if (session) {
    enrollment = {
      firstName: session.firstName,
      status: saving ? 'saving' : 'capturing',
      captureNumber: Math.min(captures + 1, session.total || ENROLLMENT_CAPTURES),
      total: session.total || ENROLLMENT_CAPTURES,
      hint,
      guideStatus: guide.status,
    };
  } else if (done) {
    enrollment = { firstName: done.firstName, status: 'done', captureNumber: done.total, total: done.total, hint: KIOSK_TEXT.enrolling.done, guideStatus: 'ready' };
  }
  return { enrollment, guide };
}
