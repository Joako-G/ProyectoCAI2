import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DESCRIPTOR, GOOD_FACTS, NO_FACE_FACTS, TWO_FACES_FACTS } from '../test/fakes';
import type { FrameFacts } from '../types/face';
import { useCaptureGuide, type CaptureTiming } from './useCaptureGuide';

// Fast timing so the tests wait milliseconds; the pause is long enough to observe it.
const TIMING: CaptureTiming = { scanIntervalMs: 5, stableScans: 3, pauseMs: 150 };

function setup({
  looks = [GOOD_FACTS] as FrameFacts[],
  onStable,
  active = true,
}: { looks?: FrameFacts[]; onStable?: (descriptor: number[]) => Promise<'continue' | 'stop'>; active?: boolean } = {}) {
  let index = 0;
  const look = vi.fn(async () => looks[Math.min(index++, looks.length - 1)]!);
  const describe = vi.fn(async () => DESCRIPTOR as number[] | undefined);
  const hook = renderHook(() => useCaptureGuide({ camera: { look, describe }, active, timing: TIMING, onStable }));
  return { look, describe, ...hook };
}

describe('useCaptureGuide', () => {
  it('stays quiet while it is not active', async () => {
    const { look, result } = setup({ active: false });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(look).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: 'neutral', hint: '', stable: false });
  });

  it('shows the hint for what is wrong, as neutral when nobody is there and adjusting otherwise', async () => {
    const { result } = setup({ looks: [NO_FACE_FACTS] });
    await waitFor(() => expect(result.current).toMatchObject({ status: 'neutral', hint: 'No veo ninguna cara' }));
    const two = setup({ looks: [TWO_FACES_FACTS] });
    await waitFor(() => expect(two.result.current).toMatchObject({ status: 'adjusting', hint: 'Debe haber una sola persona frente a la cámara' }));
  });

  it('turns ready and then stable once the good frames hold for the stability window', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', stable: true }));
  });

  it('does not change the hint for a single odd frame', async () => {
    // Ready, ready, ready, one frame with no face, then ready again.
    const { result } = setup({ looks: [GOOD_FACTS, GOOD_FACTS, GOOD_FACTS, NO_FACE_FACTS, GOOD_FACTS] });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(result.current.status).toBe('ready');
  });

  it('hands over a descriptor only after the stability window of ready frames, then rests', async () => {
    const onStable = vi.fn(async () => 'continue' as const);
    const { look, describe } = setup({ onStable });
    await waitFor(() => expect(onStable).toHaveBeenCalledTimes(1));
    expect(onStable).toHaveBeenCalledWith(DESCRIPTOR);
    expect(describe).toHaveBeenCalledTimes(1);
    expect(look.mock.calls.length).toBeGreaterThanOrEqual(TIMING.stableScans);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(onStable).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onStable).toHaveBeenCalledTimes(2), { timeout: 2000 });
  });

  it('resets the count when a frame is not ready, so a face that keeps changing is never captured', async () => {
    const onStable = vi.fn(async () => 'continue' as const);
    const moved = { ...GOOD_FACTS, box: { x: 0.3, y: 0.25, width: 0.4, height: 0.5 } };
    const shifted = { ...GOOD_FACTS, box: { x: 0.4, y: 0.25, width: 0.4, height: 0.5 } };
    // The face jumps between two positions on every look: always "moving".
    const looks = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? moved : shifted));
    const { look, result } = setup({ looks, onStable });
    await waitFor(() => expect(look.mock.calls.length).toBeGreaterThan(20));
    expect(onStable).not.toHaveBeenCalled();
    expect(result.current.hint).toBe('Quedate quieto');
  });

  it('does not capture when nobody handles it, but still reports stable', async () => {
    const { describe, result } = setup();
    await waitFor(() => expect(result.current.stable).toBe(true));
    expect(describe).not.toHaveBeenCalled();
  });

  it('stops looking when the handler answers stop', async () => {
    const onStable = vi.fn(async () => 'stop' as const);
    const { look } = setup({ onStable });
    await waitFor(() => expect(onStable).toHaveBeenCalledTimes(1));
    const calls = look.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(look.mock.calls.length).toBe(calls);
  });

  it('skips the capture when the descriptor cannot be computed', async () => {
    const onStable = vi.fn(async () => 'continue' as const);
    const { describe } = setup({ onStable });
    describe.mockResolvedValue(undefined);
    await waitFor(() => expect(describe).toHaveBeenCalled());
    expect(onStable).not.toHaveBeenCalled();
  });

  it('exposes the box of the single face in view, and drops it when the face is gone', async () => {
    const { result } = setup({ looks: [GOOD_FACTS] });
    await waitFor(() => expect(result.current.box).toEqual(GOOD_FACTS.box));
    const gone = setup({ looks: [GOOD_FACTS, NO_FACE_FACTS] });
    await waitFor(() => expect(gone.result.current.box).toBeUndefined());
    const two = setup({ looks: [TWO_FACES_FACTS] });
    await waitFor(() => expect(two.result.current.status).toBe('adjusting'));
    expect(two.result.current.box).toBeUndefined();
  });
});
