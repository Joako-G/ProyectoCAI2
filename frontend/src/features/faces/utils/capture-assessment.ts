import type { CaptureFrame, RelativeBox } from '../types/face';

// All thresholds are provisional: they were chosen from typical webcam geometry and have not been tuned on the
// club's camera. Boxes are fractions of the frame, brightness is 0 to 255 luma.

/** Detections below this confidence are treated as "no face": the tiny detector's own floor is 0.5. */
export const MIN_DETECTION_SCORE = 0.6;
/** Face narrower than this fraction of the frame: too far for a reliable descriptor (about 140 px at 640 px). */
export const MIN_FACE_WIDTH = 0.22;
/** Face wider than this fraction of the frame: too close, and the chin or forehead may be cut off. */
export const MAX_FACE_WIDTH = 0.6;
/** How far the face center may be from the frame center, horizontally. */
export const MAX_CENTER_OFFSET_X = 0.15;
/** How far the face center may be from the frame center, vertically. */
export const MAX_CENTER_OFFSET_Y = 0.18;
/** Head turn (see head-pose.ts) beyond which the face is no longer frontal. */
export const MAX_YAW = 0.18;
/** Head tilt (see head-pose.ts) beyond which the face is no longer frontal. */
export const MAX_PITCH = 0.2;
/** Face region darker than this: not enough light. */
export const MIN_BRIGHTNESS = 60;
/** Face region brighter than this: washed out. */
export const MAX_BRIGHTNESS = 220;
/** A dark face in a frame this much brighter than the face is backlit (a window or lamp behind the person). */
export const BACKLIGHT_DELTA = 60;
/** Movement between two looks beyond which the person is not holding still (fraction of the frame). */
export const MAX_MOVEMENT = 0.04;

export type CaptureHintCode =
  | 'no_face'
  | 'several_faces'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'turned'
  | 'too_dark'
  | 'backlit'
  | 'moving';

export type CaptureAssessment = { ready: true } | { ready: false; code: CaptureHintCode; message: string };

const hint = (code: CaptureHintCode, message: string): CaptureAssessment => ({ ready: false, code, message });

/** The movement the person has to make; the camera picture is shown as a mirror, so these are the person's own sides. */
function centeringHint(box: RelativeBox): CaptureAssessment | undefined {
  const offsetX = box.x + box.width / 2 - 0.5;
  const offsetY = box.y + box.height / 2 - 0.5;
  const outX = Math.abs(offsetX) / MAX_CENTER_OFFSET_X;
  const outY = Math.abs(offsetY) / MAX_CENTER_OFFSET_Y;
  if (outX <= 1 && outY <= 1) return undefined;
  // A face in the left half of the raw frame is on the person's right side, so they move to their left.
  if (outX >= outY) return hint('off_center', `Centrá la cara: movete a la ${offsetX < 0 ? 'izquierda' : 'derecha'}`);
  return hint('off_center', `Centrá la cara: ${offsetY < 0 ? 'bajá' : 'subí'} un poco`);
}

/**
 * Turns the measured facts of a frame into "ready" or the single most important hint. Priority: no face, several
 * faces, too far, too close, off center, turned, too dark, too bright or backlit, moving. Unknown facts are skipped.
 */
export function assessCapture(frame: CaptureFrame): CaptureAssessment {
  const { faceCount, box, score, yaw, pitch, brightness, surroundBrightness, movement } = frame;
  if (faceCount === 0) return hint('no_face', 'No veo ninguna cara');
  if (faceCount > 1) return hint('several_faces', 'Debe haber una sola persona frente a la cámara');
  if (!box || (score !== undefined && score < MIN_DETECTION_SCORE)) return hint('no_face', 'No veo ninguna cara');
  if (box.width < MIN_FACE_WIDTH) return hint('too_far', 'Acercate');
  if (box.width > MAX_FACE_WIDTH) return hint('too_close', 'Alejate un poco');
  const centering = centeringHint(box);
  if (centering) return centering;
  if ((yaw !== undefined && Math.abs(yaw) > MAX_YAW) || (pitch !== undefined && Math.abs(pitch) > MAX_PITCH)) {
    return hint('turned', 'Mirá de frente a la cámara');
  }
  if (brightness !== undefined) {
    const backlit = surroundBrightness !== undefined && surroundBrightness - brightness > BACKLIGHT_DELTA;
    if (brightness < MIN_BRIGHTNESS) {
      return backlit ? hint('backlit', 'Hay demasiada luz detrás') : hint('too_dark', 'Falta luz');
    }
    if (brightness > MAX_BRIGHTNESS) return hint('backlit', 'Hay demasiada luz detrás');
  }
  if (movement !== undefined && movement > MAX_MOVEMENT) return hint('moving', 'Quedate quieto');
  return { ready: true };
}

/** How far the face moved between two looks: the shift of its center plus the change of its size. */
export function measureMovement(previous: RelativeBox, current: RelativeBox): number {
  const shiftX = current.x + current.width / 2 - (previous.x + previous.width / 2);
  const shiftY = current.y + current.height / 2 - (previous.y + previous.height / 2);
  return Math.hypot(shiftX, shiftY, current.width - previous.width);
}
