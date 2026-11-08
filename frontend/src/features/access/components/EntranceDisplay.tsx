import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CAPTURE_TIMING, useCaptureGuide, type CaptureTiming } from '../../faces/hooks/useCaptureGuide';
import { useFaceCamera } from '../../faces/hooks/useFaceCamera';
import { defaultCreateSource, useGreetingStream, type GreetingSource } from '../hooks/useGreetingStream';
import { useClock } from '../hooks/useClock';
import { useEnrolledCount } from '../hooks/useEnrolledCount';
import { useFitScale } from '../hooks/useFitScale';
import type { GreetingEvent } from '../types/greeting';
import { entryTime } from '../utils/entries-format';
import { buildResultView } from '../utils/kiosk-texts';
import { frameForFace } from '../utils/pane-geometry';
import { KioskScreen } from './KioskScreen';

/** How long a result stays on the screen before it goes back to the welcome. */
export const DEFAULT_HOLD_MS = 7000;
const DEFAULT_RECONNECT_MS = 3000;

interface EntranceDisplayProps {
  /** Overrides EventSource; used by tests. */
  createSource?: (url: string) => GreetingSource;
  holdMs?: number;
  reconnectMs?: number;
  /** Overrides the camera timing; used by tests. */
  timing?: Partial<CaptureTiming>;
}

/**
 * The client screen of the entrance, as in the approved "Kiosco facial" design: the live camera with a framing guide
 * on the left and, on the right, the welcome, the wait and the result of each check. Results come only from the
 * greeting stream, whether the check was made by this camera or by the secretary at the desk. It shows the full
 * name of an identified member, never a DNI, an amount or the reason of a refusal. Opened full screen in its own window.
 */
export function EntranceDisplay({ createSource = defaultCreateSource, holdMs = DEFAULT_HOLD_MS, reconnectMs = DEFAULT_RECONNECT_MS, timing }: EntranceDisplayProps) {
  const { latest, connected } = useGreetingStream({ createSource, reconnectMs });
  const [shown, setShown] = useState<GreetingEvent | undefined>();
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

  const guide = useCaptureGuide({ camera, active: camera.state.phase === 'ready', timing: captureTiming });

  // Each new result replaces the one on screen and restarts the time it stays.
  useEffect(() => {
    if (!latest) return;
    setShown(latest.event);
    const timer = setTimeout(() => setShown(undefined), holdMs);
    return () => clearTimeout(timer);
  }, [latest, holdMs]);

  const result = useMemo(() => (shown ? buildResultView(shown) : undefined), [shown]);

  // The framing rectangle follows the face; the video's real size tells how the image was cropped to fill the pane.
  const video = camera.videoRef.current;
  const frame = frameForFace(guide.box, { width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0 });

  // Only the live hint that asks the person to do something is worth showing; "no face" is the plain wait.
  const hint = guide.status === 'neutral' ? undefined : guide.hint || undefined;
  const cameraState = camera.state;

  return (
    <KioskScreen
      phase={result ? 'result' : 'idle'}
      result={result}
      resultTime={shown ? entryTime(shown.at) : undefined}
      clock={clock}
      hint={hint}
      frame={frame}
      enrolled={enrolled}
      camera={cameraState.phase === 'error' ? { phase: 'error', message: cameraState.message } : { phase: cameraState.phase }}
      videoRef={camera.videoRef}
      connected={connected}
      scale={scale}
    />
  );
}
