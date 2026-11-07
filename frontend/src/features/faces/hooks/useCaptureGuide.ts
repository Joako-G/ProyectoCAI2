import { useEffect, useRef, useState } from 'react';
import type { FaceCamera } from './useFaceCamera';
import type { RelativeBox } from '../types/face';
import { assessCapture, measureMovement } from '../utils/capture-assessment';

export interface CaptureTiming {
  /** Time between two looks at the camera. */
  scanIntervalMs: number;
  /** Consecutive "ready" looks (the stability window) before a capture is taken. */
  stableScans: number;
  /** Rest after a capture, so one person standing there is not captured again and again. */
  pauseMs: number;
}

export const DEFAULT_CAPTURE_TIMING: CaptureTiming = { scanIntervalMs: 250, stableScans: 3, pauseMs: 4000 };

/** A new hint is shown only after it is seen on this many looks in a row, so a flickering frame never makes noise. */
const HINT_CONFIRM_LOOKS = 2;

export interface CaptureGuideState {
  /** neutral: nobody there yet; adjusting: a hint is showing; ready: well placed. */
  status: 'neutral' | 'adjusting' | 'ready';
  /** The one hint to show, in Spanish; empty when there is nothing to say. */
  hint: string;
  /** True once ready has held for the whole stability window. */
  stable: boolean;
}

const IDLE: CaptureGuideState = { status: 'neutral', hint: '', stable: false };
const READY_HINT = 'Bien, quedate así';

/** What the handler answers after a capture: look for the next one, or end the loop. */
export type CaptureOutcome = 'continue' | 'stop';

/**
 * While `active`, looks at the camera over and over and keeps the guide state: the one hint that matters, a visual
 * status, and whether the frame has been ready for the stability window. When `onStable` is given and the window
 * is met, it takes the descriptor and hands it over, then rests for `pauseMs`. Without `onStable` it only guides.
 * The handler is read on every look, so it can be added or removed without restarting the loop.
 */
export function useCaptureGuide({
  camera,
  active,
  timing,
  onStable,
  onEnd,
}: {
  camera: Pick<FaceCamera, 'look' | 'describe'>;
  active: boolean;
  timing: CaptureTiming;
  onStable?: (descriptor: number[]) => Promise<CaptureOutcome>;
  /** Called when the handler answered `stop` (not when the loop is cancelled by the screen going away). */
  onEnd?: () => void;
}): CaptureGuideState {
  const [guide, setGuide] = useState<CaptureGuideState>(IDLE);
  const handlers = useRef({ onStable, onEnd });
  handlers.current = { onStable, onEnd };
  const { look, describe } = camera;
  const { scanIntervalMs, stableScans, pauseMs } = timing;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sleep = (ms: number) => new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); });
    const show = (next: CaptureGuideState) =>
      setGuide((current) => (current.status === next.status && current.hint === next.hint && current.stable === next.stable ? current : next));

    void (async () => {
      let streak = 0;
      let previousBox: RelativeBox | undefined;
      let shownKey = '';
      let candidateKey = '';
      let candidateLooks = 0;

      while (!cancelled) {
        await sleep(scanIntervalMs);
        if (cancelled) return;
        const facts = await look().catch(() => undefined);
        if (cancelled) return;
        if (!facts) {
          streak = 0;
          continue;
        }

        const movement = facts.box && previousBox ? measureMovement(previousBox, facts.box) : undefined;
        previousBox = facts.box;
        const assessment = assessCapture({ ...facts, movement });
        streak = assessment.ready ? streak + 1 : 0;

        // Debounce the hint: switch to a new one only after it held for HINT_CONFIRM_LOOKS looks (the first shows at once).
        const key = assessment.ready ? 'ready' : assessment.code + assessment.message;
        candidateLooks = key === candidateKey ? candidateLooks + 1 : 1;
        candidateKey = key;
        if (shownKey === '' || candidateLooks >= HINT_CONFIRM_LOOKS) shownKey = key;
        const stable = streak >= stableScans;
        if (shownKey === 'ready') show({ status: 'ready', hint: READY_HINT, stable });
        else if (shownKey === key && !assessment.ready) {
          show({ status: assessment.code === 'no_face' ? 'neutral' : 'adjusting', hint: assessment.message, stable: false });
        }

        if (!stable || !handlers.current.onStable) continue;
        streak = 0;
        const descriptor = await describe().catch(() => undefined);
        if (cancelled) return;
        if (!descriptor) continue;
        show(IDLE);
        shownKey = '';
        const outcome = await handlers.current.onStable(descriptor);
        if (cancelled) return;
        if (outcome === 'stop') return handlers.current.onEnd?.();
        await sleep(pauseMs);
        previousBox = undefined;
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setGuide(IDLE);
    };
  }, [active, look, describe, scanIntervalMs, stableScans, pauseMs]);

  return guide;
}
