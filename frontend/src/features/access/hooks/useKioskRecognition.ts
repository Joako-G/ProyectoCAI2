import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureGuideState } from '../../faces/hooks/useCaptureGuide';
import type { FaceCamera } from '../../faces/hooks/useFaceCamera';
import { ApiError } from '../../members/services/members-api';
import { recognizeAccess } from '../services/access-api';
import type { AccessCheck } from '../types/access';
import { createRepeatGuard } from '../utils/repeat-guard';
import type { RecognizeOutcome } from './useAccessCheck';
import { useCameraEntrance, type CameraTiming } from './useCameraEntrance';

/** Why the loop ended on its own: the server has no face recognition, or the session is no longer valid. */
export type RecognitionStop = 'unavailable' | 'unauthorized';

const noop = () => undefined;

/**
 * The hands-free loop of the client screen. While the camera is ready it guides the person (the shared capture
 * guide), and when the frame is ready and stable it asks the server who it is, with no button. The same person is
 * not asked about again for a while (the repeat guard runs BEFORE the call), and a different person is asked about
 * at once. The answer to show comes through the greeting stream; `onAnswer` also gets the HTTP answer as a fallback.
 */
export function useKioskRecognition({
  camera,
  timing,
  onAttempt,
  onAnswer,
}: {
  camera: FaceCamera;
  timing: CameraTiming;
  /** A recognition is about to be asked. */
  onAttempt: () => void;
  /** The server answered; the stream usually delivers the same result. */
  onAnswer: (check: AccessCheck) => void;
}): { guide: CaptureGuideState; identifying: boolean; stopped: RecognitionStop | undefined } {
  const [identifying, setIdentifying] = useState(false);
  const [stopped, setStopped] = useState<RecognitionStop | undefined>();
  const guard = useRef(createRepeatGuard());
  const controller = useRef<AbortController | null>(null);
  const handlers = useRef({ onAttempt, onAnswer });
  handlers.current = { onAttempt, onAnswer };

  useEffect(() => () => controller.current?.abort(), []);

  const onFace = useCallback(async (descriptor: number[]): Promise<RecognizeOutcome> => {
    if (guard.current.isRepeat(descriptor)) return 'skipped';
    const current = new AbortController();
    controller.current = current;
    setIdentifying(true);
    handlers.current.onAttempt();
    try {
      const check = await recognizeAccess(descriptor, current.signal);
      if (current.signal.aborted) return 'failed';
      // Only somebody who was recognized is remembered: a stranger who tries again is asked about again.
      if (check.reason !== 'not_recognized') guard.current.remember(descriptor);
      handlers.current.onAnswer(check);
      return 'answered';
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 503) {
        setStopped('unavailable');
        return 'unavailable';
      }
      if (error instanceof ApiError && error.status === 401) {
        setStopped('unauthorized');
        return 'unauthorized';
      }
      return 'failed';
    } finally {
      if (!current.signal.aborted) setIdentifying(false);
    }
  }, []);

  const guide = useCameraEntrance({ camera, timing, onFace, onUnavailable: noop });
  return { guide, identifying, stopped };
}
