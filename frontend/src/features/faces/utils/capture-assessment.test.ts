import { describe, expect, it } from 'vitest';
import type { CaptureFrame } from '../types/face';
import { assessCapture, measureMovement } from './capture-assessment';

/** A frame that satisfies every rule; each test changes one fact. */
const GOOD: CaptureFrame = {
  faceCount: 1,
  box: { x: 0.3, y: 0.25, width: 0.4, height: 0.5 },
  score: 0.95,
  yaw: 0.02,
  pitch: 0,
  brightness: 130,
  surroundBrightness: 120,
  movement: 0,
};

const hint = (frame: Partial<CaptureFrame>) => {
  const result = assessCapture({ ...GOOD, ...frame });
  return result.ready ? 'ready' : result.message;
};

describe('assessCapture', () => {
  it('is ready when every fact is good', () => {
    expect(assessCapture(GOOD)).toEqual({ ready: true });
  });

  it('is ready when the optional facts are unknown', () => {
    expect(assessCapture({ faceCount: 1, box: GOOD.box })).toEqual({ ready: true });
  });

  it('asks for a face when none is found, or the detection is not trustworthy', () => {
    expect(hint({ faceCount: 0, box: undefined })).toBe('No veo ninguna cara');
    expect(hint({ score: 0.4 })).toBe('No veo ninguna cara');
    expect(hint({ box: undefined })).toBe('No veo ninguna cara');
  });

  it('asks for one person when there are several faces', () => {
    expect(hint({ faceCount: 2 })).toBe('Debe haber una sola persona frente a la cámara');
  });

  it('says to come closer or move back', () => {
    expect(hint({ box: { x: 0.4, y: 0.35, width: 0.2, height: 0.3 } })).toBe('Acercate');
    expect(hint({ box: { x: 0.1, y: 0.05, width: 0.8, height: 0.9 } })).toBe('Alejate un poco');
  });

  it('tells the direction to move when the face is off center (the picture is a mirror)', () => {
    // A face in the left half of the raw frame is the person's right side: they move to their left.
    expect(hint({ box: { x: 0.0, y: 0.25, width: 0.4, height: 0.5 } })).toBe('Centrá la cara: movete a la izquierda');
    expect(hint({ box: { x: 0.6, y: 0.25, width: 0.4, height: 0.5 } })).toBe('Centrá la cara: movete a la derecha');
    expect(hint({ box: { x: 0.3, y: 0.0, width: 0.4, height: 0.5 } })).toBe('Centrá la cara: bajá un poco');
    expect(hint({ box: { x: 0.3, y: 0.5, width: 0.4, height: 0.5 } })).toBe('Centrá la cara: subí un poco');
  });

  it('asks to look straight at the camera when the head is turned or tilted', () => {
    expect(hint({ yaw: 0.3 })).toBe('Mirá de frente a la cámara');
    expect(hint({ yaw: -0.3 })).toBe('Mirá de frente a la cámara');
    expect(hint({ pitch: 0.3 })).toBe('Mirá de frente a la cámara');
  });

  it('asks for light when the face is dark, and warns about light behind the person', () => {
    expect(hint({ brightness: 30, surroundBrightness: 40 })).toBe('Falta luz');
    // A dark face against a bright surround is a backlit face, not a dark room.
    expect(hint({ brightness: 50, surroundBrightness: 170 })).toBe('Hay demasiada luz detrás');
    expect(hint({ brightness: 240, surroundBrightness: 235 })).toBe('Hay demasiada luz detrás');
  });

  it('asks to stay still when the face moved between frames', () => {
    expect(hint({ movement: 0.1 })).toBe('Quedate quieto');
  });

  it('reports only the most important hint, in priority order', () => {
    const everythingWrong: CaptureFrame = {
      faceCount: 1,
      box: { x: 0.0, y: 0.0, width: 0.1, height: 0.1 },
      score: 0.95,
      yaw: 0.5,
      brightness: 10,
      surroundBrightness: 10,
      movement: 0.5,
    };
    const order: Array<[Partial<CaptureFrame>, string]> = [
      [{ faceCount: 0 }, 'No veo ninguna cara'],
      [{ faceCount: 2 }, 'Debe haber una sola persona frente a la cámara'],
      [{}, 'Acercate'],
      [{ box: { x: 0.0, y: 0.0, width: 0.3, height: 0.3 } }, 'Centrá la cara: movete a la izquierda'],
      [{ box: GOOD.box }, 'Mirá de frente a la cámara'],
      [{ box: GOOD.box, yaw: 0 }, 'Falta luz'],
      [{ box: GOOD.box, yaw: 0, brightness: 120 }, 'Quedate quieto'],
    ];
    for (const [change, expected] of order) {
      expect(assessCapture({ ...everythingWrong, ...change })).toMatchObject({ ready: false, message: expected });
    }
  });
});

describe('measureMovement', () => {
  const box = { x: 0.3, y: 0.25, width: 0.4, height: 0.5 };

  it('is zero for the same box and grows with the shift of the center or the size', () => {
    expect(measureMovement(box, box)).toBe(0);
    expect(measureMovement(box, { ...box, x: 0.4 })).toBeCloseTo(0.1);
    expect(measureMovement(box, { ...box, width: 0.5 })).toBeGreaterThan(0.04);
  });
});
