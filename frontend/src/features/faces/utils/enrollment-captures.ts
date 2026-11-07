/** Captures an enrollment takes, each one only when the frame is ready. */
export const ENROLLMENT_CAPTURES = 3;

/**
 * Largest Euclidean distance allowed between two captures of one enrollment. Two photos of the same person in the
 * same sitting are close (well under the server's match limit of 0.5); a stricter 0.4 catches a capture of someone
 * else walking in, or a blurred frame. Provisional, not tuned on the club's camera.
 */
export const MAX_CAPTURE_DISTANCE = 0.4;

/** Inconsistent captures in a row after which the enrollment starts over, so a bad first capture cannot trap it. */
export const MAX_CONSECUTIVE_REJECTIONS = 3;

export interface EnrollmentProgress {
  captures: number[][];
  rejections: number;
}

export const EMPTY_PROGRESS: EnrollmentProgress = { captures: [], rejections: 0 };

export type CaptureResult =
  | { kind: 'accepted'; progress: EnrollmentProgress }
  | { kind: 'rejected'; progress: EnrollmentProgress }
  | { kind: 'restarted'; progress: EnrollmentProgress }
  | { kind: 'complete'; descriptor: number[] };

/** Euclidean distance: the measure face-api (`euclideanDistance`) and the server (pgvector `<->`) both use. */
export function descriptorDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new Error('Descriptors must have the same length');
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(sum);
}

/**
 * The element-wise mean of the descriptors. It is deliberately NOT rescaled to unit length: face-api descriptors
 * are compared by Euclidean distance on their raw values (the net ends in a plain fully connected layer, with no
 * normalization), and the server's limit was chosen for that scale. Rescaling only the stored template would
 * change every distance to it. Averaging keeps the template in the same space, and nearer the person's center.
 */
export function meanDescriptor(descriptors: number[][]): number[] {
  const [first] = descriptors;
  if (!first) throw new Error('There is nothing to average');
  const sum = first.map(() => 0);
  for (const descriptor of descriptors) {
    if (descriptor.length !== first.length) throw new Error('Descriptors must have the same length');
    descriptor.forEach((value, i) => {
      sum[i] = sum[i]! + value;
    });
  }
  return sum.map((value) => value / descriptors.length);
}

/**
 * Adds one capture to an enrollment. A capture farther than MAX_CAPTURE_DISTANCE from any earlier one is rejected
 * (to be retaken); after MAX_CONSECUTIVE_REJECTIONS in a row the enrollment starts over; the last good capture
 * completes it with the mean.
 */
export function addCapture(progress: EnrollmentProgress, descriptor: number[]): CaptureResult {
  if (progress.captures.some((earlier) => descriptorDistance(earlier, descriptor) > MAX_CAPTURE_DISTANCE)) {
    const rejections = progress.rejections + 1;
    if (rejections >= MAX_CONSECUTIVE_REJECTIONS) return { kind: 'restarted', progress: EMPTY_PROGRESS };
    return { kind: 'rejected', progress: { captures: progress.captures, rejections } };
  }
  const captures = [...progress.captures, descriptor];
  if (captures.length >= ENROLLMENT_CAPTURES) return { kind: 'complete', descriptor: meanDescriptor(captures) };
  return { kind: 'accepted', progress: { captures, rejections: 0 } };
}
