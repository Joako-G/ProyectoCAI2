import { useEffect, useRef } from 'react';
import type { FaceCamera } from '../../faces/hooks/useFaceCamera';
import type { RecognizeOutcome } from './useAccessCheck';

export interface CameraTiming {
  /** Time between two looks at the camera. */
  scanIntervalMs: number;
  /** Consecutive looks with exactly one face before it counts as stable. */
  stableScans: number;
  /** Rest after an attempt, so one person standing there is not sent again and again. */
  pauseMs: number;
}

export const DEFAULT_CAMERA_TIMING: CameraTiming = { scanIntervalMs: 500, stableScans: 3, pauseMs: 4000 };

/**
 * While the camera is ready, looks at it over and over. When exactly one face stays in view for `stableScans`
 * looks in a row, it hands that descriptor to `onFace`, then rests for `pauseMs`. Two faces or none reset the count.
 * `onFace` answers `unavailable` to end the loop (the server has no face recognition).
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
}) {
  const handlers = useRef({ onFace, onUnavailable });
  handlers.current = { onFace, onUnavailable };
  const { scan } = camera;
  const ready = camera.state.phase === 'ready';
  const { scanIntervalMs, stableScans, pauseMs } = timing;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sleep = (ms: number) => new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); });

    void (async () => {
      let stable = 0;
      while (!cancelled) {
        await sleep(scanIntervalMs);
        if (cancelled) return;
        const found = await scan().catch(() => undefined);
        if (cancelled) return;
        if (found?.kind !== 'one') {
          stable = 0;
          continue;
        }
        stable += 1;
        if (stable < stableScans) continue;
        stable = 0;
        const outcome = await handlers.current.onFace(found.descriptor);
        if (cancelled) return;
        if (outcome === 'unavailable') return handlers.current.onUnavailable();
        await sleep(pauseMs);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, scan, scanIntervalMs, stableScans, pauseMs]);
}
