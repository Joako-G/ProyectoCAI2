import { vi } from 'vitest';
import type { FaceDetector, FrameFacts } from '../types/face';

/** A descriptor with a distinctive value, so a test can see exactly what was sent. */
export const DESCRIPTOR = Array.from({ length: 128 }, () => 0.25);

/** Measured facts of a well framed, lit, frontal face: `assessCapture` calls it ready. */
export const GOOD_FACTS: FrameFacts = {
  faceCount: 1,
  box: { x: 0.3, y: 0.25, width: 0.4, height: 0.5 },
  score: 0.95,
  yaw: 0.02,
  pitch: 0,
  brightness: 130,
  surroundBrightness: 120,
};
export const NO_FACE_FACTS: FrameFacts = { faceCount: 0 };
export const TWO_FACES_FACTS: FrameFacts = { faceCount: 2 };
/** A face too small in the frame: the hint is "Acercate". */
export const FAR_FACTS: FrameFacts = { ...GOOD_FACTS, box: { x: 0.4, y: 0.35, width: 0.2, height: 0.3 } };

export function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
}

/** Fakes of `faceTools`: tests mock the module and drive these, so no camera or model is needed. */
export function createFakeTools() {
  const cam = fakeStream();
  const detector = {
    look: vi.fn(async (): Promise<FrameFacts> => GOOD_FACTS),
    describe: vi.fn(async (): Promise<number[] | undefined> => DESCRIPTOR),
  } satisfies FaceDetector;
  return {
    cam,
    detector,
    openCamera: vi.fn(async () => cam.stream),
    loadDetector: vi.fn(async () => detector as FaceDetector),
  };
}

export type FakeTools = ReturnType<typeof createFakeTools>;
