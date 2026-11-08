export interface Point {
  x: number;
  y: number;
}

/** Dimensionless head turn and tilt; 0 is a frontal face. Empty when the landmarks are unusable. */
export interface HeadPose {
  yaw?: number;
  pitch?: number;
}

// Indexes in the 68-point landmark layout.
const JAW_LEFT = 0;
const JAW_RIGHT = 16;
const CHIN = 8;
const NOSE_TIP = 30;
const EYES = Array.from({ length: 12 }, (_, i) => 36 + i);

/**
 * Where the nose tip sits between the eye line and the chin on a frontal face. An uncalibrated starting value from
 * typical face proportions; it only shifts the pitch zero, and the allowed pitch is generous (MAX_PITCH).
 */
const FRONTAL_NOSE_RATIO = 0.45;

/**
 * A cheap head pose from the 68 landmarks, with no extra model. Yaw is the nose tip's offset from the middle of
 * the jaw, as a fraction of the jaw width (about 0.5 at a full profile). Pitch is how far the nose sits along the
 * eye-to-chin line compared with a frontal face. Both are rough guides, good enough to say "look at the camera".
 */
export function estimateHeadPose(points: Point[]): HeadPose {
  const left = points[JAW_LEFT];
  const right = points[JAW_RIGHT];
  const chin = points[CHIN];
  const nose = points[NOSE_TIP];
  if (!left || !right || !chin || !nose) return {};

  const jawWidth = right.x - left.x;
  if (jawWidth <= 0) return {};
  const yaw = (nose.x - (left.x + right.x) / 2) / jawWidth;

  const eyeLine = EYES.reduce((sum, index) => sum + (points[index]?.y ?? 0), 0) / EYES.length;
  const eyeToChin = chin.y - eyeLine;
  if (eyeToChin <= 0) return { yaw };
  return { yaw, pitch: (nose.y - eyeLine) / eyeToChin - FRONTAL_NOSE_RATIO };
}
