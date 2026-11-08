import { useCallback, useRef } from 'react';
import {
  DEFAULT_CAPTURE_TIMING,
  useCaptureGuide,
  type CaptureGuideState,
  type CaptureOutcome,
  type CaptureTiming,
} from '../../faces/hooks/useCaptureGuide';
import type { FaceCamera } from '../../faces/hooks/useFaceCamera';
import type { RecognizeOutcome } from './useAccessCheck';

export type CameraTiming = CaptureTiming;
export const DEFAULT_CAMERA_TIMING: CameraTiming = DEFAULT_CAPTURE_TIMING;

/**
 * While the camera is ready, guides the person into a good capture and, when the frame has been ready (one face,
 * placed, frontal, lit, still) for the stability window, hands that descriptor to `onFace`, then rests for `pauseMs`.
 * `onFace` answers `unavailable` or `unauthorized` to end the loop (no face recognition on the server, or the session
 * ended). Returns the guide to show.
 */
export function useCameraEntrance({
  camera,
  timing,
  onFace,
  onUnavailable,
}: {
  camera: FaceCamera;
  timing: CameraTiming;
  onFace: (descriptor: number[]) => Promise<RecognizeOutcome>;
  onUnavailable: () => void;
}): CaptureGuideState {
  const handlers = useRef({ onFace, onUnavailable });
  handlers.current = { onFace, onUnavailable };

  const onStable = useCallback(async (descriptor: number[]): Promise<CaptureOutcome> => {
    const outcome = await handlers.current.onFace(descriptor);
    return outcome === 'unavailable' || outcome === 'unauthorized' ? 'stop' : 'continue';
  }, []);
  const onEnd = useCallback(() => handlers.current.onUnavailable(), []);

  return useCaptureGuide({ camera, active: camera.state.phase === 'ready', timing, onStable, onEnd });
}
