import { vi } from 'vitest';
import type { FaceDetector, FaceScan } from '../types/face';

/** A descriptor with a distinctive value, so a test can see exactly what was sent. */
export const DESCRIPTOR = Array.from({ length: 128 }, () => 0.25);

export function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
}

/** Fakes of `faceTools`: tests mock the module and drive these, so no camera or model is needed. */
export function createFakeTools() {
  const cam = fakeStream();
  const detector = { detect: vi.fn(async (): Promise<FaceScan> => ({ kind: 'one', descriptor: DESCRIPTOR })) } satisfies FaceDetector;
  return {
    cam,
    detector,
    openCamera: vi.fn(async () => cam.stream),
    loadDetector: vi.fn(async () => detector as FaceDetector),
  };
}

export type FakeTools = ReturnType<typeof createFakeTools>;
